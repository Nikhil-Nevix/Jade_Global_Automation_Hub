import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local development on the VM (MERGED app — isolated from the live apps).
// Access the app from your laptop via VS Code's forwarded port:
//   http://localhost:5174/
// The dev server proxies /api and /socket.io to the merged backend on :8001, so
// the whole app is same-origin during development — no nginx, no reverse proxy.
export default defineConfig({
  base: '/',

  plugins: [react()],

  server: {
    // Dual-stack: '::' binds IPv6 + IPv4 (v6only=0 on Linux) so both
    // http://localhost:5175 (resolves to ::1 on this host) and 127.0.0.1 work.
    host: '::',
    port: 5175,
    proxy: {
      // Use 127.0.0.1 (not localhost) — the backend listens on IPv4 only, and
      // 'localhost' resolves to ::1 first here, which would otherwise fail.
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:8001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
