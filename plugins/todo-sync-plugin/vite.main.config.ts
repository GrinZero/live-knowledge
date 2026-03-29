import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { builtinModules } from "module";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["cjs"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [
        "electron",
        "@live-knowledge/plugin-sdk",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
  },
  plugins: [
    dts({
      rollupTypes: true,
      skipDiagnostics: true,
    }),
  ],
});
