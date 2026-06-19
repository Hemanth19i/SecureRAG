import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // Dev: proxy /api -> Flask backend (same-origin in the browser, so the
  // backend's CORS config is never exercised and stays untouched). The backend
  // mounts routes at the root (/query, /auth/login, ...), so we strip the
  // leading /api prefix on the way through.
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5000"

  return {
    base: './',
    plugins: [inspectAttr(), react()],
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
});
