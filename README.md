# @slavshik/log
### As simple as possible
[![Version](https://img.shields.io/npm/v/@slavshik/log.svg)]([https://npmjs.org/package/tinylog](https://www.npmjs.com/package/@slavshik/log))
[![Downloads/week](https://img.shields.io/npm/dw/@slavshik/log.svg)](https://npmjs.org/package/@slavshik/log)
[![License](https://img.shields.io/npm/l/@slavshik/log.svg)](https://github.com/slavshik/log/blob/main/package.json)
### Example

```js
import {log} from "@slavshik/log";
// levels: 1 - fatal, 2 - info, 3 - error, 4 - warn, 5 - debug, 6 - trace (default is 2)
log.setLevel(6); // the larger the number, the higher the verbosity
log.setLevel("trace"); // same thing, by name

// simple logging
log.trace("trace message");
log.debug("debug message");
log.info("info message");
log.error("error message");
log.warn("warn message");
log.fatal("fatal message");

// passing params
log.debug("debug message with array:", [1, 2, 3, 4], {a: 1, b: 2});
log.debug("debug message with object:", {a: 1, b: 2});
log.debug("debug message with number:", Math.random());

// using scopes
const scopedLog = log.scope("scope");
scopedLog.debug("debug message");
```

> Levels are ordered by verbosity, not by severity: `info` (2) sits below `error` (3) and
> `warn` (4), so the default level of 2 prints `fatal` and `info` but not `error` or `warn`.
> Call `setLevel("warn")` (or `4`) to see them.

### Stripping logs at build time

`setLevel` filters at runtime, which means the message strings still ship to the browser and
the arguments are still evaluated. The bundler plugins remove the call sites instead, so
nothing is shipped and nothing is evaluated.

**Vite**

```ts
// vite.config.ts
import {defineConfig} from "vite";
import {stripLog} from "@slavshik/log/vite";

export default defineConfig({
    plugins: [stripLog({level: "warn"})]
});
```

**Webpack**

```js
// webpack.config.js
const {StripLogPlugin} = require("@slavshik/log/webpack");

module.exports = {
    plugins: [new StripLogPlugin({level: "warn"})]
};
```

Both run on **non-debug builds only** - the Vite dev server, `vite build --mode development`
and `webpack --mode development` keep every call. Pass `enabled` to decide for yourself.

```js
// before, with level: "warn"
log.debug("cart", serializeCart(cart));
log.error("checkout failed", error);

// after - the string and the serializeCart() call are gone from the bundle
0;
log.error("checkout failed", error);
```

The leftover `0` is what a minifier drops, so use these plugins together with minification
(both bundlers minify production builds by default).

#### Options

| option | default | meaning |
| --- | --- | --- |
| `level` | `"warn"` | Highest level kept. Anything more verbose is removed, mirroring the runtime `>=` check, so `"warn"` strips `debug` and `trace`. |
| `methods` | - | Explicit list of methods to strip, e.g. `["debug", "trace"]`. Overrides `level`. |
| `identifiers` | `["log"]` | Object names treated as a logger, matched as a bare identifier (`log.debug()`) or as the trailing property of a chain (`this.log.debug()`). |
| `moduleIds` | `["@slavshik/log"]` | Modules whose `log` export is followed to its local name, so `import {log as l}` is recognised. |
| `enabled` | non-debug builds | Forces stripping on or off. `true` also enables it in the Vite dev server. |
| `include` | `[/\.[cm]?[jt]sx?$/]` | Files to process. |
| `exclude` | `[/node_modules/]` | Files to leave alone. |

Calls are found by resolving the logger within each module: a direct or renamed import of
`log`, a scoped logger (`const api = log.scope("api")`, including chains), and any name listed
in `identifiers`. So a shared wrapper module works out of the box as long as the local name
matches:

```ts
// logger.ts
export const log = createAppLogger();

// cart.ts - matched by `identifiers: ["log"]`
import {log} from "./logger";
log.debug("dropped in production");
```

#### Caveats

- **Arguments disappear with the call.** `log.debug("saved", save())` removes the `save()` call
  too. Keep side effects out of log arguments.
- Build level and runtime level are independent. The build level is a hard ceiling; `setLevel`
  still filters below it at runtime.
- A file that cannot be parsed is left untouched and reported as a build warning, never an
  error. Both plugins run after the TypeScript/JSX transform, so this should not happen.
- Stripping is line- and column-preserving, so incoming source maps stay valid.

### Screenshots
<img src="https://i.ibb.co/d4k8FPM/logger-chrome.png" alt="Chrome (Dark)" />
<img src="https://i.ibb.co/rGB0NXf/logger-safari.png" alt="Safari" />
