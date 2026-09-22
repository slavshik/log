import typescript from "@rollup/plugin-typescript";
import {terser} from "rollup-plugin-terser";

// Declarations come from the dedicated `tsconfig.dts.json` pass in `yarn build`.
const ts = () => typescript({tsconfig: "./tsconfig.json", declaration: false});
const external = id => !/^[./]/.test(id);

const bundle = (input, output) => ({input, external, plugins: [ts()], output});

export default [
    // Runtime - shipped to the browser, so it stays minified and dependency free.
    bundle("src/index.ts", [
        {file: "dist/index.js", format: "cjs", plugins: [terser()], sourcemap: true},
        {file: "dist/index.mjs", format: "es", sourcemap: true}
    ]),
    // Build-time entries - Node only, never bundled into an app.
    bundle("src/strip/vite.ts", [
        {file: "dist/vite.js", format: "cjs", sourcemap: true, exports: "named"},
        {file: "dist/vite.mjs", format: "es", sourcemap: true}
    ]),
    // Webpack configs are CommonJS in practice, and the plugin resolves the
    // loader next to itself with `require.resolve`, so CJS only here.
    bundle("src/strip/webpack.ts", [
        {file: "dist/webpack.js", format: "cjs", sourcemap: true, exports: "named"}
    ]),
    // `module.exports = loader` - what webpack's loader runner expects.
    bundle("src/strip/loader.ts", [
        {
            file: "dist/loader.js",
            format: "cjs",
            sourcemap: true,
            exports: "default",
            esModule: false
        }
    ])
];
