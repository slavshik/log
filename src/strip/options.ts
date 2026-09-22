import {LogLevel, LogLevelName, strippableLevels} from "../levels";

export interface StripLogOptions {
    /**
     * Highest level kept in the build. Anything more verbose is removed from the
     * source. Defaults to `"warn"`, which strips `debug` and `trace` and keeps
     * `fatal`, `info`, `error` and `warn`.
     */
    level?: LogLevelName | number;
    /** Explicit list of methods to strip. Overrides `level` when given. */
    methods?: LogLevelName[];
    /**
     * Object names treated as a logger, matched either as a bare identifier
     * (`log.debug()`) or as the trailing property of a chain (`this.log.debug()`).
     * Defaults to `["log"]`.
     */
    identifiers?: string[];
    /**
     * Module specifiers whose `log` export is followed to its local binding, so
     * `import {log as l} from "@slavshik/log"` is recognised too.
     */
    moduleIds?: string[];
    /**
     * Forces stripping on or off. By default it is on for non-debug builds only:
     * a production Webpack build, or a Vite build in a mode other than
     * `development`.
     */
    enabled?: boolean;
    /** Files to process. Defaults to JavaScript and TypeScript sources. */
    include?: RegExp | RegExp[];
    /** Files to leave alone. Defaults to `[/node_modules/]`. */
    exclude?: RegExp | RegExp[];
    /**
     * Webpack only: absolute path of the loader to install. Defaults to the
     * loader shipped next to the plugin, which is what every normal install
     * wants - override it only when module resolution cannot find it.
     */
    loaderPath?: string;
}

export interface NormalizedOptions {
    methods: string[];
    identifiers: string[];
    moduleIds: string[];
    include: RegExp[];
    exclude: RegExp[];
}

export const DEFAULT_LEVEL: LogLevelName = "warn";
const DEFAULT_INCLUDE = [/\.[cm]?[jt]sx?$/];
const DEFAULT_EXCLUDE = [/node_modules/];

const toArray = <T>(value: T | T[] | undefined, fallback: T[]): T[] => {
    if (value === undefined) {
        return fallback;
    }
    return Array.isArray(value) ? value : [value];
};

const resolveMethods = (options: StripLogOptions): string[] => {
    if (options.methods) {
        return options.methods.slice();
    }
    const level = options.level === undefined ? DEFAULT_LEVEL : options.level;
    if (typeof level === "string" && !(level in LogLevel)) {
        throw new Error(
            `[strip-log] unknown level "${level}", expected one of: ${Object.keys(LogLevel).join(", ")}`
        );
    }
    return strippableLevels(level);
};

export const normalizeOptions = (options: StripLogOptions = {}): NormalizedOptions => ({
    methods: resolveMethods(options),
    identifiers: options.identifiers ? options.identifiers.slice() : ["log"],
    moduleIds: options.moduleIds ? options.moduleIds.slice() : ["@slavshik/log"],
    include: toArray(options.include, DEFAULT_INCLUDE),
    exclude: toArray(options.exclude, DEFAULT_EXCLUDE)
});

const matches = (patterns: RegExp[], id: string): boolean => {
    for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(id)) {
            return true;
        }
    }
    return false;
};

/** Query strings (`?v=1`, `?worker`) are stripped before matching. */
export const shouldTransform = (options: NormalizedOptions, id: string): boolean => {
    const file = id.split("?")[0];
    return matches(options.include, file) && !matches(options.exclude, file);
};
