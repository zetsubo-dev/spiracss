import { resolve } from "pathe";

const srcDir = resolve("src");

export default defineNuxtConfig({
  compatibilityDate: "2026-01-25",
  srcDir: "src/",
  css: ["~/assets/css/global.scss", "~/assets/css/common.scss"],
  alias: {
    "@": srcDir,
    "@styles": resolve(srcDir, "styles"),
    "@components": resolve(srcDir, "components"),
    "@layouts": resolve(srcDir, "layouts"),
    "@common": resolve(srcDir, "components/common"),
    "@pages": resolve(srcDir, "components/pages"),
    "@parts": resolve(srcDir, "components/parts"),
    "@assets": resolve(srcDir, "assets")
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [srcDir]
        }
      }
    }
  }
});
