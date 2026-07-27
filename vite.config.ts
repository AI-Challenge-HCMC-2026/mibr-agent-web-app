import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env (all keys, not just VITE_*) so secrets stay server-side.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.CKEY_APIKEY ?? ''
  const adminPassword = env.ADMIN_PASSWORD ?? ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Browser calls /api/ckey/<path> ; we forward to ckey.vn/api/<path>?key=<apiKey>
        // with the API key injected server-side so it never reaches the client.
        '/api/ckey': {
          target: 'https://ckey.vn',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/ckey/, '/api'),
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
              if (apiKey) {
                const currentPath = proxyReq.path || ''
                const sep = currentPath.includes('?') ? '&' : '?'
                proxyReq.path = `${currentPath}${sep}key=${encodeURIComponent(apiKey)}`
              }
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

