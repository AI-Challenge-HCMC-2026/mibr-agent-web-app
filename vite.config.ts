import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env (all keys, not just VITE_*) so secrets stay server-side.
  const env = loadEnv(mode, process.cwd(), '')
  const cookie = env.CKEY_COOKIE ?? ''
  const adminPassword = env.ADMIN_PASSWORD ?? ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Browser calls /api/ckey/<path> ; we forward to ckey.vn/ajax/<path>
        // with the auth cookie injected server-side so it never reaches the
        // client. Mirrors the Vercel edge function in api/ckey/[...path].ts.
        '/api/ckey': {
          target: 'https://ckey.vn',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/ckey/, '/ajax'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Same auth gate as production: require a matching x-admin-key.
              const key = req.headers['x-admin-key']
              if (adminPassword && key !== adminPassword) {
                res.statusCode = 401
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ error: 'Không có quyền truy cập.' }))
                proxyReq.destroy()
                return
              }
              if (cookie) proxyReq.setHeader('cookie', cookie)
              // ckey.vn only serves same-origin XHR — spoof the browser context.
              proxyReq.setHeader('referer', 'https://ckey.vn/api-ai-dashboard')
              proxyReq.setHeader('origin', 'https://ckey.vn')
              proxyReq.setHeader('accept', 'application/json')
              proxyReq.setHeader(
                'user-agent',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
              )
            })
          },
        },
      },
    },
  }
})
