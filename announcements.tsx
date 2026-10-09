import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { AnnouncementCard, DiscordIcon } from '@/components/Cards'
import { useReveal, useSite } from '@/lib/ui'

export const Route = createFileRoute('/announcements')({
  head: () => ({ meta: [{ title: 'Announcements — MOMO MC' }] }),
  component: News,
})

function News() {
  const { settings: s, announcements } = useSite()
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'web' | 'discord'>('all')
  const list = announcements.filter((a) => filter === 'all' || a.source === filter)
  useReveal(list)
  useEffect(() => {
    const h = setInterval(() => router.invalidate(), 45_000)
    return () => clearInterval(h)
  }, [router])

  return (
    <div className="wrap section" style={{ paddingTop: 60, maxWidth: 900 }}>
      <div className="reveal" style={{ textAlign: 'center', marginBottom: 34 }}>
        <span className="eyebrow">Live feed</span>
        <h1 className="h2" style={{ fontSize: 'clamp(38px,6vw,70px)' }}><span className="grad">Announcements</span></h1>
        <p className="lead" style={{ margin: '0 auto 24px' }}>Everything posted by staff — on the website and in our Discord announcements channel.</p>
        <div className="cat-tabs">
          {(['all', 'web', 'discord'] as const).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'web' ? '🌐 Website' : <><DiscordIcon size={16} /> Discord</>}
            </button>
          ))}
        </div>
      </div>
      <div className="ann-list">
        {list.map((a, i) => <AnnouncementCard key={a.id} a={a} i={Math.min(i, 5)} />)}
      </div>
      {!list.length && <p style={{ textAlign: 'center', color: 'var(--mut)' }}>No announcements yet.</p>}
      <div style={{ textAlign: 'center', marginTop: 34 }}>
        <a className="btn btn-discord" href={s.discordInvite} target="_blank" rel="noopener"><DiscordIcon size={18} /> Get notified on Discord</a>
      </div>
    </div>
  )
}
