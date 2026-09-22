import {stripLogCalls} from "./core";
import {NormalizedOptions, normalizeOptions, shouldTransform, StripLogOptions} from "./options";

/**
 * Structural subset of Vite's `Plugin`. Declared locally so the package needs no
 * dependency on Vite and stays compatible across its major versions.
 */
export interface VitePluginLike {
    name: string;
    apply?: "build" | "serve";
    configResolved?: (config: {command?: string; mode?: string}) => void;
    transform?: (
        this: {warn?: (message: string) => void},
        code: string,
        id: string
    ) => {code: string; map: {mappings: ""}} | null;
}

/**
 * Tells Rollup the rewrite did not move any character, so the incoming source
 * map stays valid. The transform pads every removal back to its original length.
 */
const UNCHANGED_MAP: {mappings: ""} = {mappings: ""};

/**
 * Removes log calls above the configured level at build time.
 *
 * Runs on non-debug builds only: it is skipped by the dev server and by
 * `vite build --mode development`. Pass `enabled` to override that.
 *
 * ```ts
 * // vite.config.ts
 * import {stripLog} from "@slavshik/log/vite";
 *
 * export default defineConfig({plugins: [stripLog({level: "warn"})]});
 * ```
 *
 * No `enforce` is set on purpose: the plugin then runs after Vite's own esbuild
 * transform, so it always sees plain JavaScript rather than TypeScript or JSX.
 */
export const stripLog = (options: StripLogOptions = {}): VitePluginLike => {
    const normalized: NormalizedOptions = normalizeOptions(options);
    let active = options.enabled === true;
    let warned = false;

    return {
        name: "slavshik-log:strip",
        // `enabled: true` opts into the dev server as well.
        apply: options.enabled === true ? undefined : "build",
        configResolved(config) {
            active =
                options.enabled !== undefined
                    ? options.enabled
                    : config.command === "build" && config.mode !== "development";
        },
        transform(code, id) {
            if (!active || !shouldTransform(normalized, id)) {
                return null;
            }
            const warn = (message: string): void => {
                if (warned || !this.warn) {
                    return;
                }
                warned = true;
                this.warn(`${message} (further warnings suppressed)`);
            };
            const result = stripLogCalls(code, normalized, error =>
                warn(`[slavshik-log] could not parse ${id}, left unchanged: ${String(error)}`)
            );
            if (!result) {
                return null;
            }
            if (result.code.length !== code.length) {
                // The rewrite is length-preserving by design; bail out rather
                // than hand Rollup a source map that no longer lines up.
                warn(`[slavshik-log] skipped ${id}: rewrite changed the source length`);
                return null;
            }
            return {code: result.code, map: UNCHANGED_MAP};
        }
    };
};

export default stripLog;
export type {StripLogOptions};
