// @ts-check
import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://astro.build/config
export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@styles': path.resolve(__dirname, './src/styles'),
        '@components': path.resolve(__dirname, './src/components'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@common': path.resolve(__dirname, './src/components/common'),
        '@pages': path.resolve(__dirname, './src/components/pages'),
        '@parts': path.resolve(__dirname, './src/components/parts'),
        '@assets': path.resolve(__dirname, './src/assets')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@styles/partials/global" as *;`,
          loadPaths: [path.resolve(__dirname, './src')]
        }
      }
    }
  }
})
