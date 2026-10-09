import { createFileRoute } from '@tanstack/react-router'
import RedeemPage from '@/components/RedeemPage'
import { isMode } from '@/lib/types'
import type { Mode } from '@/lib/types'

export const Route = createFileRoute('/redeem')({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({ mode: isMode(s.mode) ? s.mode : undefined }),
  head: () => ({ meta: [{ title: 'Redeem a code — MOMO MC' }, { name: 'description', content: 'Redeem your MOMO MC code for Survival or Lifesteal and get your reward in-game.' }] }),
  component: Page,
})

function Page() {
  const { mode } = Route.useSearch()
  return <RedeemPage mode={mode ?? 'survival'} />
}
