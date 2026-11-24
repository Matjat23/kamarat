import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// While developing, the translation page (open the app with ?translations)
// saves finished translations of Kamarat's screens into public/i18n, so they
// ship with the app. This only exists in the dev server.
function saveTranslations() {
  return {
    name: 'kamarat-save-translations',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-translation', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const { code, map } = JSON.parse(body)
            if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(code)) throw new Error('Unknown language code')
            const dir = path.resolve(server.config.root, 'public', 'i18n')
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(path.join(dir, `${code}.json`), `${JSON.stringify(map, null, 1)}\n`)
            res.end('saved')
          } catch (err) {
            res.statusCode = 400
            res.end(err.message)
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveTranslations()],
})
