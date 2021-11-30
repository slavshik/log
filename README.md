# Logger that I use
## As simople as possible
[![Version](https://img.shields.io/npm/v/tinylog.svg)](https://npmjs.org/package/tinylog)
[![Downloads/week](https://img.shields.io/npm/dw/tinylog.svg)](https://npmjs.org/package/tinylog)
[![License](https://img.shields.io/npm/l/tinylog.svg)](https://github.com/alex-slv4/tinylog/blob/main/package.json)
### Example

```js
import {log} from "@slavshik/log";
// levels: 1 - fatal, 2 - info, 3 - error, 4 - warn, 5 - debug, 6 - trace (default is 2)
log.setLevel(6); // the larger the number, the higher the verbosity

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
### Pictures
<img src="https://i.ibb.co/d4k8FPM/logger-chrome.png" alt="Chrome (Dark)" />
<img src="https://i.ibb.co/rGB0NXf/logger-safari.png" alt="Safari" />
