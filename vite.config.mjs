import { resolve } from "node:path";
import { tpgWorkbench } from "@tpgames/sdk-dev-kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tpgWorkbench({
      title: "Punch Up!",
      surfaces: {
        host: "/surfaces/host.html",
        controller: "/surfaces/controller.html"
      },
      controllers: 2
    })
  ],
  build: {
    emptyOutDir: true,
    outDir: "build/surfaces",
    target: "es2022",
    lib: {
      entry: {
        controller: resolve(import.meta.dirname, "src/controller.ts"),
        host: resolve(import.meta.dirname, "src/host.ts")
      },
      formats: ["es"]
    },
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "[name].js"
      }
    }
  }
});
