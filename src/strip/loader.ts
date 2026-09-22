import {stripLogCalls} from "./core";
import {normalizeOptions, shouldTransform, StripLogOptions} from "./options";

/** Structural subset of the Webpack loader context this loader uses. */
interface LoaderContext {
    resourcePath?: string;
    query?: unknown;
    getOptions?: () => StripLogOptions;
    cacheable?: (flag?: boolean) => void;
    emitWarning?: (warning: Error) => void;
    callback: (error: Error | null, code?: string, map?: unknown) => void;
}

/**
 * Webpack post loader added by `StripLogPlugin`. Never used directly - the
 * plugin wires it up with its own options.
 */
function stripLogLoader(this: LoaderContext, source: string, map?: unknown): void {
    if (this.cacheable) {
        this.cacheable();
    }
    const raw: StripLogOptions = this.getOptions
        ? this.getOptions()
        : ((this.query as StripLogOptions) || {});
    const options = normalizeOptions(raw);
    const id = this.resourcePath || "";

    // `include`/`exclude` already gated the rule; re-checking keeps the loader
    // honest when it is referenced by hand.
    if (id && !shouldTransform(options, id)) {
        this.callback(null, source, map);
        return;
    }

    const result = stripLogCalls(source, options, error => {
        if (this.emitWarning) {
            this.emitWarning(
                new Error(`[slavshik-log] could not parse ${id}, left unchanged: ${String(error)}`)
            );
        }
    });

    if (!result || result.code.length !== source.length) {
        // Length must be preserved for the incoming source map to stay valid.
        this.callback(null, source, map);
        return;
    }
    this.callback(null, result.code, map);
}

export default stripLogLoader;
