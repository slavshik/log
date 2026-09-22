import {existsSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {parse} from "acorn";
import {describe, expect, it, vi} from "vitest";
import {LogLevel, strippableLevels} from "../src/levels";
import {stripLogCalls} from "../src/strip/core";
import {normalizeOptions, shouldTransform, StripLogOptions} from "../src/strip/options";
import {stripLog} from "../src/strip/vite";
import {StripLogPlugin} from "../src/strip/webpack";

const require = createRequire(import.meta.url);
const DIST_WEBPACK = resolve(import.meta.dirname, "../dist/webpack.js");

const lineCount = (code: string) => code.split("\n").length;

/**
 * Runs the transform and asserts the invariants that every rewrite must hold:
 * identical byte length, identical line count, and output that still parses.
 * Returns `null` when the transform declined to touch the source.
 */
const strip = (code: string, options: StripLogOptions = {}): string | null => {
    const result = stripLogCalls(code, normalizeOptions(options));
    if (!result) {
        return null;
    }
    expect(result.code.length).toBe(code.length);
    expect(lineCount(result.code)).toBe(lineCount(code));
    expect(() => parse(result.code, {ecmaVersion: "latest", sourceType: "module"})).not.toThrow();
    return result.code;
};

describe("levels", () => {
    it("strips everything more verbose than the ceiling", () => {
        expect(strippableLevels("warn")).toEqual(["debug", "trace"]);
        expect(strippableLevels("trace")).toEqual([]);
        expect(strippableLevels(LogLevel.info)).toEqual(["error", "warn", "debug", "trace"]);
    });

    it("rejects an unknown level name", () => {
        expect(() => normalizeOptions({level: "verbose" as never})).toThrow(/unknown level/);
    });
});

describe("stripLogCalls", () => {
    it("removes debug and trace but keeps the rest at the default level", () => {
        const code = [
            `log.trace("t");`,
            `log.debug("d");`,
            `log.info("i");`,
            `log.error("e");`,
            `log.warn("w");`,
            `log.fatal("f");`
        ].join("\n");
        const out = strip(code)!;
        expect(out).not.toContain(`"t"`);
        expect(out).not.toContain(`"d"`);
        expect(out).toContain(`log.info("i")`);
        expect(out).toContain(`log.error("e")`);
        expect(out).toContain(`log.warn("w")`);
        expect(out).toContain(`log.fatal("f")`);
    });

    it("honours an explicit level", () => {
        const out = strip(`log.warn("w");log.error("e");log.info("i");`, {level: "info"})!;
        expect(out).not.toContain(`"w"`);
        expect(out).not.toContain(`"e"`);
        expect(out).toContain(`log.info("i")`);
    });

    it("honours an explicit method list over the level", () => {
        const out = strip(`log.info("i");log.debug("d");`, {methods: ["info"]})!;
        expect(out).not.toContain(`"i"`);
        expect(out).toContain(`log.debug("d")`);
    });

    it("is a no-op when nothing is strippable", () => {
        expect(strip(`log.debug("d");`, {level: "trace"})).toBeNull();
        expect(strip(`log.debug("d");`, {methods: []})).toBeNull();
        expect(strip(`const a = 1;`)).toBeNull();
    });

    it("keeps line numbers of the code after a multi-line call", () => {
        const code = ["log.debug(", `    "a",`, "    {b: 1}", ");", `const after = "keep";`].join(
            "\n"
        );
        const out = strip(code)!;
        expect(out).not.toContain(`"a"`);
        expect(out.split("\n")[4]).toBe(`const after = "keep";`);
    });

    it("removes arguments that contain parentheses, arrows and templates", () => {
        const code = 'log.debug("a(", () => f(")"), `x${g(")")}y`, /\\)/);\nconst keep = 1;';
        const out = strip(code)!;
        expect(out).not.toContain("f(");
        expect(out).not.toContain("g(");
        expect(out).toContain("const keep = 1;");
    });

    it("leaves a log call that only appears inside a string", () => {
        expect(strip(`const s = "log.debug(1)";`)).toBeNull();
        expect(strip("const s = `log.debug(1)`;")).toBeNull();
        expect(strip(`// log.debug(1)\nconst a = 1;`)).toBeNull();
    });

    it("follows a scoped logger", () => {
        const out = strip(`const api = log.scope("api");\napi.debug("d");\napi.info("i");`)!;
        expect(out).not.toContain(`"d"`);
        expect(out).toContain(`api.info("i")`);
    });

    it("follows a chain of scopes and an inline scope call", () => {
        const out = strip(
            [
                `const a = log.scope("a");`,
                `const b = a.scope("b");`,
                `b.debug("nested");`,
                `log.scope("inline").debug("inline");`
            ].join("\n")
        )!;
        expect(out).not.toContain(`"nested"`);
        expect(out).not.toContain(`"inline"`);
        expect(out).toContain(`log.scope("a")`);
    });

    it("follows a renamed import from the package", () => {
        const out = strip(`import {log as l} from "@slavshik/log";\nl.debug("d");\nl.info("i");`)!;
        expect(out).not.toContain(`"d"`);
        expect(out).toContain(`l.info("i")`);
    });

    it("ignores a renamed import from an unrelated module", () => {
        expect(strip(`import {log as l} from "other";\nl.debug("d");`, {identifiers: []})).toBeNull();
    });

    it("matches the trailing property of a member chain", () => {
        const out = strip(`this.log.debug("d");\nutils.log.debug("u");\nother.debug("o");`)!;
        expect(out).not.toContain(`"d"`);
        expect(out).not.toContain(`"u"`);
        expect(out).toContain(`other.debug("o")`);
    });

    it("leaves unrelated objects alone", () => {
        expect(strip(`console.debug("c");\nemitter.trace("t");`)).toBeNull();
    });

    it("handles a custom identifier list", () => {
        const out = strip(`logger.debug("d");\nlog.debug("l");`, {identifiers: ["logger"]})!;
        expect(out).not.toContain(`"d"`);
        expect(out).toContain(`log.debug("l")`);
    });

    it("removes a call nested inside another stripped call", () => {
        const out = strip(`log.debug("outer", log.trace("inner"));\nconst keep = 1;`)!;
        expect(out).not.toContain(`"outer"`);
        expect(out).not.toContain(`"inner"`);
        expect(out).toContain("const keep = 1;");
    });

    it("stays valid syntax in every expression position", () => {
        const code = [
            `if (x) log.debug("a");`,
            `else log.debug("b");`,
            `while (y) log.debug("c");`,
            `const f = () => log.debug("d");`,
            `const g = {h: log.debug("e")};`,
            `for (let i = 0; i < 1; i++) log.debug("f");`,
            `x ? log.debug("g") : log.debug("h");`,
            `x && log.debug("i");`,
            `switch (x) { case 1: log.debug("j"); }`,
            `label: log.debug("k");`
        ].join("\n");
        const out = strip(code)!;
        for (const gone of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"]) {
            expect(out).not.toContain(`"${gone}"`);
        }
    });

    it("keeps offsets when the call starts on its own line", () => {
        const out = strip(`log\n    .debug("d");\nconst keep = 1;`)!;
        expect(out).not.toContain(`"d"`);
        expect(out.split("\n")[2]).toBe("const keep = 1;");
    });

    it("reports a parse failure and leaves the source untouched", () => {
        const onParseError = vi.fn();
        const code = `const x: number = 1;\nlog.debug(x);`;
        expect(stripLogCalls(code, normalizeOptions(), onParseError)).toBeNull();
        expect(onParseError).toHaveBeenCalledOnce();
    });
});

describe("shouldTransform", () => {
    const options = normalizeOptions();

    it("accepts js and ts sources, with or without a query", () => {
        expect(shouldTransform(options, "/app/src/a.ts")).toBe(true);
        expect(shouldTransform(options, "/app/src/a.tsx")).toBe(true);
        expect(shouldTransform(options, "/app/src/a.mjs")).toBe(true);
        expect(shouldTransform(options, "/app/src/a.js?v=123")).toBe(true);
    });

    it("skips dependencies and non-script assets", () => {
        expect(shouldTransform(options, "/app/node_modules/x/index.js")).toBe(false);
        expect(shouldTransform(options, "/app/src/a.css")).toBe(false);
    });
});

describe("vite plugin", () => {
    const context = {warn: vi.fn()};
    const run = (plugin: ReturnType<typeof stripLog>, code: string, id = "/app/src/a.ts") =>
        plugin.transform!.call(context, code, id);

    it("strips on a production build", () => {
        const plugin = stripLog();
        expect(plugin.apply).toBe("build");
        plugin.configResolved!({command: "build", mode: "production"});
        const result = run(plugin, `log.debug("d");log.info("i");`);
        expect(result!.code).not.toContain(`"d"`);
        expect(result!.map).toEqual({mappings: ""});
    });

    it("does nothing for a development-mode build", () => {
        const plugin = stripLog();
        plugin.configResolved!({command: "build", mode: "development"});
        expect(run(plugin, `log.debug("d");`)).toBeNull();
    });

    it("does nothing before configResolved runs", () => {
        expect(run(stripLog(), `log.debug("d");`)).toBeNull();
    });

    it("applies everywhere when explicitly enabled", () => {
        const plugin = stripLog({enabled: true});
        expect(plugin.apply).toBeUndefined();
        plugin.configResolved!({command: "serve", mode: "development"});
        expect(run(plugin, `log.debug("d");`)!.code).not.toContain(`"d"`);
    });

    it("stays off when explicitly disabled", () => {
        const plugin = stripLog({enabled: false});
        plugin.configResolved!({command: "build", mode: "production"});
        expect(run(plugin, `log.debug("d");`)).toBeNull();
    });

    it("warns once on an unparseable module", () => {
        const warn = vi.fn();
        const plugin = stripLog();
        plugin.configResolved!({command: "build", mode: "production"});
        const bad = `const x: number = 1;\nlog.debug(x);`;
        plugin.transform!.call({warn}, bad, "/app/src/a.ts");
        plugin.transform!.call({warn}, bad, "/app/src/b.ts");
        expect(warn).toHaveBeenCalledOnce();
        expect(warn.mock.calls[0][0]).toContain("could not parse");
    });
});

describe("webpack plugin", () => {
    // The real loader path is resolved relative to the published CommonJS build,
    // which does not exist while the TypeScript sources run under vitest - the
    // last test in this block covers that resolution against `dist/`.
    const LOADER = "/dist/loader.js";
    const compiler = (mode: string) => ({options: {mode, module: {rules: [] as unknown[]}}});
    const plugin = (options: StripLogOptions = {}) =>
        new StripLogPlugin({loaderPath: LOADER, ...options});

    it("adds a post loader rule for a production build", () => {
        const c = compiler("production");
        plugin().apply(c);
        expect(c.options.module.rules).toHaveLength(1);
        const rule = c.options.module.rules[0] as {
            enforce: string;
            test: RegExp[];
            exclude: RegExp[];
            use: Array<{loader: string; options: StripLogOptions}>;
        };
        expect(rule.enforce).toBe("post");
        expect(rule.test[0].test("/app/src/a.ts")).toBe(true);
        expect(rule.exclude[0].test("/app/node_modules/x.js")).toBe(true);
        expect(rule.use[0].loader).toBe(LOADER);
    });

    it("adds nothing for a development build", () => {
        const c = compiler("development");
        plugin().apply(c);
        expect(c.options.module.rules).toHaveLength(0);
    });

    it("creates the rules array when the config has none", () => {
        const c = {options: {mode: "production"}} as Parameters<StripLogPlugin["apply"]>[0];
        plugin().apply(c);
        expect(c.options.module!.rules).toHaveLength(1);
    });

    it("respects an explicit enabled flag", () => {
        const on = compiler("development");
        plugin({enabled: true}).apply(on);
        expect(on.options.module.rules).toHaveLength(1);

        const off = compiler("production");
        plugin({enabled: false}).apply(off);
        expect(off.options.module.rules).toHaveLength(0);
    });

    it("validates options at construction time", () => {
        expect(() => new StripLogPlugin({level: "nope" as never})).toThrow(/unknown level/);
    });

    it.skipIf(!existsSync(DIST_WEBPACK))("resolves its shipped loader in the built package", () => {
        const {StripLogPlugin: Built} = require(DIST_WEBPACK);
        const c = compiler("production");
        new Built().apply(c);
        const rule = c.options.module.rules[0] as {use: Array<{loader: string}>};
        expect(existsSync(rule.use[0].loader)).toBe(true);
        expect(typeof require(rule.use[0].loader)).toBe("function");
    });
});
