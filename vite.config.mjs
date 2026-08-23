import { resolve } from "node:path";
import { tpgWorkbench } from "@tpgames/sdk-dev-kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tpgWorkbench({
      title: "Punch Up!",
      surfaces: {
        host: "/surfaces/host.html",
        controller: "/surfaces/controller.html",
        spectator: "/surfaces/spectator.html"
      },
      controllers: [
        { id: "avery", screenName: "Avery" },
        { id: "blake", screenName: "Blake" },
        { id: "casey", screenName: "Casey" },
        { id: "devon", screenName: "Devon" },
        { id: "ellis", screenName: "Ellis" }
      ],
      spectator: true,
      networkProfile: { latencyMs: 80, jitterMs: 20, reconnectDelayMs: 1_500, seed: 42 }
    })
  ],
  build: {
    emptyOutDir: true,
    outDir: "build/surfaces",
    target: "es2022",
    lib: {
      entry: {
        controller: resolve(import.meta.dirname, "src/controller.ts"),
        host: resolve(import.meta.dirname, "src/host.ts"),
        spectator: resolve(import.meta.dirname, "src/spectator.ts")
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
