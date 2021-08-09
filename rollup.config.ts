import typescript from "@rollup/plugin-typescript";
import {terser} from "rollup-plugin-terser";

const bundle = config => ({
    ...config,
    input: "src/index.ts",
    external: id => !/^[./]/.test(id)
});
const name = require("./package.json").main.replace(/\.js$/, "");

export default bundle({
    plugins: [typescript({tsconfig: "./tsconfig.json"})],

    output: [
        {
            file: `${name}.js`,
            format: "cjs",
            plugins: [terser()],
            sourcemap: true
        },
        {
            file: `${name}.mjs`,
            format: "es",
            sourcemap: true
        }
    ]
});
