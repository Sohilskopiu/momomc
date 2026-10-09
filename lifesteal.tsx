import { createFileRoute } from '@tanstack/react-router'
import ModePage from '@/components/ModePage'

export const Route = createFileRoute('/lifesteal')({
  head: () => ({ meta: [{ title: 'Lifesteal — MOMO MC' }, { name: 'description', content: 'MOMO MC Lifesteal: steal hearts, survive the season and power up in the store.' }] }),
  component: () => <ModePage mode="lifesteal" />,
})
