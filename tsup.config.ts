import { defineConfig } from 'tsup'

export default defineConfig((opts) => {
    return {
        entry: ["./events/**/*.ts", "./providers/**/*.ts"],
        splitting: false,
        sourcemap: true,
        dts: true,
        clean: true,
        format: ["esm"],
        ignoreWatch: [
            "**/node_modules/**",
            "**/.git/**",
            "**/dist/**",
        ],
        esbuildOptions(options) {
            options.resolveExtensions = ['.ts', '.js', '.json']
            options.loader = {
                ...options.loader,
                '.json': 'json'
            }
        },
        noExternal: [/./],
        bundle: true
    }
})