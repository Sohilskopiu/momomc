import { createFileRoute } from '@tanstack/react-router'
import { readKey } from '@/server/site'

// Serves the logo uploaded in Admin Panel > Theme & Logo. The URL carries a version (?v=), so browsers can cache it for a year.
export const Route = createFileRoute('/logo')({
  server: {
    handlers: {
      GET: async () => {
        const d = await readKey<{ mime?: string; b64?: string }>('logo_data', {})
        if (!d.mime || !d.b64) return new Response(null, { status: 302, headers: { Location: '/img/momo-logo.webp', 'Cache-Control': 'no-store' } })
        return new Response(Buffer.from(d.b64, 'base64'), {
          headers: {
            'Content-Type': d.mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Security-Policy': "default-src 'none'",
          },
        })
      },
    },
  },
})
