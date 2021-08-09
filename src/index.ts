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
    (level: number) =>
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
                        `%c #%s %c ${idd.join(" ")}`,
                        `background-color:${colors[0] ? colors[0] : "color:white"}`,
                        tag,
                        colors[1] ? `color: ${colors[1]}` : ""
                    ].concat(...params)
                );
            }
        }
    };

export const log = {
    trace: (...params: any[]) => tryToLog(6)(params),
    debug: (...params: any[]) => tryToLog(5)(params),
    warn: (...params: any[]) => tryToLog(4)(params),
    error: (...params: any[]) => tryToLog(3)(params),
    info: (...params: any[]) => tryToLog(2)(params),
    fatal: (...params: any[]) => tryToLog(1)(params),
    setLevel: (level: number) => (CURRENT_LOG_LEVEL = level)
};
