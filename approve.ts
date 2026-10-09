import { createFileRoute } from '@tanstack/react-router'
import { decide, esc, pageHtml, preview } from '@/server/approval'
import { rateLimit, sameOrigin } from '@/server/guard'

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })

// Link from the approval email. GET only shows a confirm button (so mail scanners cannot approve by prefetching),
// the decision itself is a POST.
export const Route = createFileRoute('/api/admin/approve')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = rateLimit(request, 'approve-page', 30, 60_000)
        if (blocked) return blocked
        const q = new URL(request.url).searchParams
        const id = q.get('id') || '', k = q.get('k') || '', a = q.get('a') === 'deny' ? 'deny' : 'approve'
        const info = await preview(id)
        if (!info) return html(pageHtml('Request not found', '<p>This request has expired, was already used, or does not exist.</p>'), 404)
        const word = a === 'approve' ? 'Approve login' : 'Deny login'
        const color = a === 'approve' ? '#16a34a' : '#dc2626'
        return html(pageHtml(word, `<p>Admin account: <b>${esc(info.user)}</b><br>IP: <b>${esc(info.ip)}</b><br>Device: ${esc(info.ua)}</p><form method="POST" action="/api/admin/approve"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="k" value="${esc(k)}"><input type="hidden" name="a" value="${a}"><button style="width:100%;padding:14px;border:0;border-radius:10px;background:${color};color:#fff;font-size:16px;font-weight:bold;cursor:pointer">${word}</button></form>`))
      },
      POST: async ({ request }) => {
        const blocked = sameOrigin(request) ?? rateLimit(request, 'approve', 20, 10 * 60_000)
        if (blocked) return blocked
        const f = await request.formData().catch(() => null)
        const id = String(f?.get('id') ?? ''), k = String(f?.get('k') ?? ''), a = f?.get('a') === 'deny' ? 'deny' : 'approve'
        const r = await decide(id, k, a)
        return html(pageHtml(r.ok ? (a === 'approve' ? 'Approved ✔' : 'Denied ✖') : 'Not done', `<p>${esc(r.message)}</p>`), r.ok ? 200 : 400)
      },
    },
  },
})
