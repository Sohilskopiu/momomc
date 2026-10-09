import { modeServer } from '@/lib/modes'
import type { Mode } from '@/lib/types'
import { useServerStatus, useSite } from '@/lib/ui'

// Live online / offline dot and player count for one game mode, using that mode's own address.
export default function ModeStatus({ mode, className = '' }: { mode: Mode; className?: string }) {
  const { settings: s } = useSite()
  const a = modeServer(s, mode)
  const st = useServerStatus(a.ip, a.port)
  const text = st.loading ? 'Checking…' : st.online ? `${st.players}${st.max ? ' / ' + st.max : ''} online` : 'Offline'
  return (
    <span className={'mstat ' + className}>
      <span className={'dot ' + (st.loading ? '' : st.online ? 'on' : 'off')} />
      {text}
    </span>
  )
}
