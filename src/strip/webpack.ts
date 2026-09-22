import {normalizeOptions, StripLogOptions} from "./options";

declare const require: {resolve(id: string): string};

/** Structural subset of the Webpack compiler this plugin touches. */
export interface WebpackCompilerLike {
    options: {
        mode?: string;
        module?: {rules?: unknown[]};
    };
}

/**
 * Removes log calls above the configured level at build time.
 *
 * Active for `mode: "production"` only, so development builds keep every call.
 * Pass `enabled` to override that.
 *
 * ```js
 * // webpack.config.js
 * const {StripLogPlugin} = require("@slavshik/log/webpack");
 *
 * module.exports = {plugins: [new StripLogPlugin({level: "warn"})]};
 * ```
 */
export class StripLogPlugin {
    private readonly options: StripLogOptions;

    constructor(options: StripLogOptions = {}) {
        // Validates eagerly, so a bad level fails at config time.
        normalizeOptions(options);
        this.options = options;
    }

    apply(compiler: WebpackCompilerLike): void {
        const enabled =
            this.options.enabled !== undefined
                ? this.options.enabled
                : compiler.options.mode === "production";
        if (!enabled) {
            return;
        }
        const normalized = normalizeOptions(this.options);
        const loader = this.options.loaderPath || require.resolve("./loader.js");
        const moduleOptions = compiler.options.module || (compiler.options.module = {});
        const rules = moduleOptions.rules || (moduleOptions.rules = []);
        rules.push({
            // A post loader runs last in the chain, so the source has already
            // been through ts-loader / babel-loader and is plain JavaScript.
            enforce: "post",
            test: normalized.include,
            exclude: normalized.exclude,
            use: [{loader, options: this.options}]
        });
    }
}

export default StripLogPlugin;
export type {StripLogOptions};
