import {parse} from "acorn";
import {NormalizedOptions} from "./options";

/**
 * Minimal ESTree node shape. Acorn hands back plain objects, and the transform
 * only ever reads `type`, `start`, `end` plus a handful of known properties, so
 * a structural `any` is cheaper here than mirroring the whole ESTree union.
 */
type Node = any;

/**
 * Object-valued keys that never hold child nodes. Primitives are filtered by the
 * `typeof === "object"` guard below, so only these need naming explicitly.
 */
const SKIP_KEYS: {[key: string]: true} = {loc: true, range: true};

const walk = (node: Node, visit: (node: Node) => void): void => {
    if (!node || typeof node !== "object") {
        return;
    }
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            walk(node[i], visit);
        }
        return;
    }
    if (typeof node.type === "string") {
        visit(node);
    }
    for (const key in node) {
        if (SKIP_KEYS[key]) {
            continue;
        }
        const child = node[key];
        if (child && typeof child === "object") {
            walk(child, visit);
        }
    }
};

/** Property name of a non-computed member expression, e.g. `debug` in `log.debug`. */
const memberName = (node: Node): string | null =>
    node &&
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property &&
    node.property.type === "Identifier"
        ? (node.property.name as string)
        : null;

/**
 * Replaces `[start, end)` with a `0` literal padded to the exact original byte
 * length, keeping every line break. Byte offsets therefore never move, which
 * lets the callers reuse the incoming source map verbatim.
 *
 * A single-character replacement is used on purpose: a longer one could be split
 * by a preserved line break (`log\n.debug(1)`) and produce invalid syntax.
 */
const blank = (source: string, start: number, end: number): string => {
    const original = source.slice(start, end);
    let out = "";
    let placed = false;
    for (let i = 0; i < original.length; i++) {
        const char = original.charAt(i);
        if (char === "\n" || char === "\r") {
            out += char;
        } else if (placed) {
            out += " ";
        } else {
            out += "0";
            placed = true;
        }
    }
    return out;
};

/**
 * Builds the predicate deciding whether an expression evaluates to a logger.
 * Everything is module-local: a logger re-exported from another module is
 * matched by name via the `identifiers` option, not by following the import.
 */
const createIsLogger = (names: {[name: string]: true}) => {
    const isLogger = (node: Node): boolean => {
        if (!node) {
            return false;
        }
        if (node.type === "Identifier") {
            return names[node.name] === true;
        }
        // `this.log`, `utils.log` - matched on the trailing property name.
        const property = memberName(node);
        if (property !== null) {
            return names[property] === true;
        }
        // `log.scope("api").debug(...)`
        if (node.type === "CallExpression" && memberName(node.callee) === "scope") {
            return isLogger(node.callee.object);
        }
        return false;
    };
    return isLogger;
};

/** Collects the local names that refer to a logger inside a single module. */
const collectLoggerNames = (ast: Node, options: NormalizedOptions): {[name: string]: true} => {
    const names: {[name: string]: true} = {};
    for (let i = 0; i < options.identifiers.length; i++) {
        names[options.identifiers[i]] = true;
    }

    walk(ast, node => {
        if (
            node.type !== "ImportDeclaration" ||
            !node.source ||
            typeof node.source.value !== "string" ||
            options.moduleIds.indexOf(node.source.value) === -1
        ) {
            return;
        }
        const specifiers: Node[] = node.specifiers || [];
        for (let i = 0; i < specifiers.length; i++) {
            const specifier = specifiers[i];
            if (
                specifier.type === "ImportSpecifier" &&
                (!specifier.imported || specifier.imported.name !== "log")
            ) {
                continue;
            }
            if (specifier.local && specifier.local.type === "Identifier") {
                names[specifier.local.name] = true;
            }
        }
    });

    const isLogger = createIsLogger(names);

    // `const api = log.scope("api")` - collected in source order, so a chain of
    // scopes resolves as long as each one is declared before it is reused.
    walk(ast, node => {
        if (
            node.type !== "VariableDeclarator" ||
            !node.id ||
            node.id.type !== "Identifier" ||
            !node.init ||
            node.init.type !== "CallExpression" ||
            memberName(node.init.callee) !== "scope" ||
            !isLogger(node.init.callee.object)
        ) {
            return;
        }
        names[node.id.name] = true;
    });

    return names;
};

export interface StripResult {
    code: string;
}

/**
 * Removes the configured log calls from a JavaScript module.
 *
 * Returns `null` when there is nothing to do. A source that cannot be parsed is
 * reported through `onParseError` and also yields `null`, so a file this
 * transform does not understand is left untouched instead of breaking a build.
 */
export const stripLogCalls = (
    code: string,
    options: NormalizedOptions,
    onParseError?: (error: unknown) => void
): StripResult | null => {
    if (!options.methods.length) {
        return null;
    }
    let mentioned = false;
    for (let i = 0; i < options.methods.length; i++) {
        if (code.indexOf(options.methods[i]) !== -1) {
            mentioned = true;
            break;
        }
    }
    if (!mentioned) {
        return null;
    }

    let ast: Node;
    try {
        ast = parse(code, {
            ecmaVersion: "latest",
            sourceType: "module",
            allowHashBang: true,
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true
        });
    } catch (error) {
        if (onParseError) {
            onParseError(error);
        }
        return null;
    }

    const isLogger = createIsLogger(collectLoggerNames(ast, options));
    const ranges: Array<[number, number]> = [];
    walk(ast, node => {
        if (node.type !== "CallExpression") {
            return;
        }
        const method = memberName(node.callee);
        if (method === null || options.methods.indexOf(method) === -1) {
            return;
        }
        if (!isLogger(node.callee.object)) {
            return;
        }
        ranges.push([node.start, node.end]);
    });

    if (!ranges.length) {
        return null;
    }

    // Back to front, so an outer call overwrites any nested one it contains.
    ranges.sort((a, b) => b[0] - a[0]);
    let out = code;
    for (let i = 0; i < ranges.length; i++) {
        const start = ranges[i][0];
        const end = ranges[i][1];
        out = out.slice(0, start) + blank(out, start, end) + out.slice(end);
    }
    return {code: out};
};
