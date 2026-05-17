import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { existsSync, cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

function copyWxCloudFunctions() {
  return {
    name: 'copy-wx-cloud-functions',
    closeBundle() {
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return

      const sourceDir = resolve(__dirname, 'cloudfunctions')
      const outputDir = process.env.UNI_OUTPUT_DIR || resolve(__dirname, 'dist/build/mp-weixin')
      const targetDir = resolve(outputDir, 'cloudfunctions')

      if (!existsSync(sourceDir)) return

      rmSync(targetDir, { recursive: true, force: true })
      cpSync(sourceDir, targetDir, { recursive: true })
      console.log(`[cloudfunctions] copied to ${targetDir}`)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    copyWxCloudFunctions(),
    uni(),
  ],
})
