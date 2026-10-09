import { createFileRoute } from '@tanstack/react-router'
import ModePage from '@/components/ModePage'

export const Route = createFileRoute('/survival')({
  head: () => ({ meta: [{ title: 'Survival — MOMO MC' }, { name: 'description', content: 'MOMO MC Survival: claims, jobs, a player economy and its own store.' }] }),
  component: () => <ModePage mode="survival" />,
})
