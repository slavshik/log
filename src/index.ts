import {LogLevel, LogLevelName, resolveLevel} from "./levels";

let CURRENT_LOG_LEVEL: number = LogLevel.info; // error level by default
type LogLevelSetting = [
    tag: string,
    colors: [background: string] | [background: string, foreground: string],
    logFunction: (...data: any) => void
];

const settings: {[level: number]: LogLevelSetting} = {
    [LogLevel.fatal]: ["fatal", ["#7c002a"], console.error],
    [LogLevel.info]: ["info", ["#4454FF", "#7e86de"], console.info],
    [LogLevel.error]: ["error", ["#f31"], console.error],
    [LogLevel.warn]: ["warn", ["#ffcd84"], console.warn],
    [LogLevel.debug]: ["debug", ["#168d21", "#168d21"], console.log],
    [LogLevel.trace]: ["trace", ["#aaa"], console.log]
};
const typeToPrintf = (item: any) => {
    switch (typeof item) {
        case "string":
            return "%s";
        case "boolean":
            return "%o";
        case "number":
            return (0 ^ item) === item ? "%i" : "%f";
        default:
            return "%O";
    }
};
const tryToLog =
    (level: number, scope = "") =>
        (params: any[]) => {
            if (CURRENT_LOG_LEVEL >= level) {
                if (settings[level]) {
                    const [tag, colors, log_fn] = settings[level];
                    log_fn.apply(
                        null,
                        [
                            `${scope} %c #%s %c ${params.map(typeToPrintf).join(" ")}`,
                            `background-color:${colors[0] || ""};color:white;`,
                            tag,
                            colors[1] ? `color:${colors[1]};` : ""
                        ].concat(params)
                    );
                }
            }
        };
const scope = (name?: string) => ({
    trace: (...params: unknown[]) => tryToLog(LogLevel.trace, name)(params),
    debug: (...params: unknown[]) => tryToLog(LogLevel.debug, name)(params),
    warn: (...params: unknown[]) => tryToLog(LogLevel.warn, name)(params),
    error: (...params: unknown[]) => tryToLog(LogLevel.error, name)(params),
    info: (...params: unknown[]) => tryToLog(LogLevel.info, name)(params),
    fatal: (...params: unknown[]) => tryToLog(LogLevel.fatal, name)(params)
});
export const log = Object.assign(scope(), {
    scope,
    setLevel: (level: LogLevelName | number) => (CURRENT_LOG_LEVEL = resolveLevel(level))
});

export {LogLevel};
export type {LogLevelName};
