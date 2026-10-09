import { createFileRoute } from '@tanstack/react-router'
import ModeDocPage from '@/components/ModeDocPage'
import { isMode } from '@/lib/types'
import type { Mode } from '@/lib/types'

export const Route = createFileRoute('/vote')({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({ mode: isMode(s.mode) ? s.mode : undefined }),
  head: () => ({ meta: [{ title: 'Vote — MOMO MC' }, { name: 'description', content: 'Vote for MOMO MC and get rewards in Survival and Lifesteal.' }] }),
  component: Page,
})

function Page() {
  const { mode } = Route.useSearch()
  return <ModeDocPage kind="vote" mode={mode ?? 'survival'} />
}
