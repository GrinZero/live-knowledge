import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    lib: {
      entry: "src/renderer.tsx",
      formats: ["iife"],
      name: "WebhookPluginRenderer",
      fileName: () => "renderer.global.js",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "ReactJSXRuntime",
        },
      },
    },
    outDir: "dist",
    emptyOutDir: false,
    minify: false,
  },
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
