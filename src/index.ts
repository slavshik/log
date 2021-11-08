let CURRENT_LOG_LEVEL = 2; // error level by default

type LogLevelSetting = [
    tag: string,
    colors: [background: string] | [background: string, foreground: string],
    logFunction: (...data: any) => void
];

const settings: {[level: number]: LogLevelSetting} = {
    [1]: ["fatal", ["#7c002a"], console.error],
    [2]: ["info", ["#4454FF", "#273095"], console.info],
    [3]: ["error", ["#f31", "#f00"], console.error],
    [4]: ["warn", ["#ffcd84", "#ff5b0c"], console.warn],
    [5]: ["debug", ["#115816"], console.log],
    [6]: ["trace", ["#aaa"], console.log]
};

const tryToLog =
    (level: number, scope = "") =>
    (...params: any[]) => {
        if (CURRENT_LOG_LEVEL >= level) {
            if (settings[level]) {
                const [tag, colors, logFunction] = settings[level];
                const idd: string[] = params.map(item => {
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
                });

                logFunction.apply(
                    null,
                    [
                        `%s %c #%s %c ${idd.join(" ")}`,
                        scope,
                        `background-color:${colors[0] ? colors[0] : "color:white"}`,
                        tag,
                        colors[1] ? `color: ${colors[1]}` : ""
                    ].concat(...params)
                );
            }
        }
    };
const scope = (scopeName?: string) => ({
    trace: (...params: unknown[]) => tryToLog(6, scopeName)(params),
    debug: (...params: unknown[]) => tryToLog(5, scopeName)(params),
    warn: (...params: unknown[]) => tryToLog(4, scopeName)(params),
    error: (...params: unknown[]) => tryToLog(3, scopeName)(params),
    info: (...params: unknown[]) => tryToLog(2, scopeName)(params),
    fatal: (...params: unknown[]) => tryToLog(1, scopeName)(params)
});
export const log = {
    ...scope(),
    scope,
    setLevel: (level: number) => (CURRENT_LOG_LEVEL = level)
};
