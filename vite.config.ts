import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import pkg from "./package.json";

export default defineConfig({
  plugins: [
    react(),
    // generate the typescript declaration files (.d.ts)
    dts({
      insertTypesEntry: true,
      include: ["src"],
    }),
  ],
  build: {
    lib: {
      // The entry point is barrel file
      entry: resolve(__dirname, "src/index.ts"),
      name: "Laminar",
      // build both an ES Module and a CommonJS version
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
        assetFileNames: "laminar.[ext]",
      },
    },
  },
});
