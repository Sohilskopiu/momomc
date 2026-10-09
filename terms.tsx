import { createFileRoute } from '@tanstack/react-router'
import ModeDocPage from '@/components/ModeDocPage'
import { isMode } from '@/lib/types'
import type { Mode } from '@/lib/types'

export const Route = createFileRoute('/terms')({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({ mode: isMode(s.mode) ? s.mode : undefined }),
  head: () => ({ meta: [{ title: 'Terms and Refund Policy — MOMO MC' }, { name: 'description', content: 'Terms of purchase and refund policy for the MOMO MC store.' }] }),
  component: Page,
})

function Page() {
  const { mode } = Route.useSearch()
  return <ModeDocPage kind="terms" mode={mode ?? 'survival'} />
}
