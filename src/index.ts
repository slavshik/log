let CURRENT_LOG_LEVEL = 2; // error level by default
type LogLevelSetting = [
    tag: string,
    colors: [background: string] | [background: string, foreground: string],
    logFunction: (...data: any) => void
];

const settings: {[level: number]: LogLevelSetting} = {
    [1]: ["fatal", ["#7c002a"], console.error],
    [2]: ["info", ["#4454FF", "#7e86de"], console.info],
    [3]: ["error", ["#f31"], console.error],
    [4]: ["warn", ["#ffcd84"], console.warn],
    [5]: ["debug", ["#168d21", "#168d21"], console.log],
    [6]: ["trace", ["#aaa"], console.log]
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
    trace: (...params: unknown[]) => tryToLog(6, name)(params),
    debug: (...params: unknown[]) => tryToLog(5, name)(params),
    warn: (...params: unknown[]) => tryToLog(4, name)(params),
    error: (...params: unknown[]) => tryToLog(3, name)(params),
    info: (...params: unknown[]) => tryToLog(2, name)(params),
    fatal: (...params: unknown[]) => tryToLog(1, name)(params)
});
export const log = Object.assign(scope(), {
    scope,
    setLevel: (level: number) => (CURRENT_LOG_LEVEL = level)
});
