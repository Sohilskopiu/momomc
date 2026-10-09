import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import Doc from '@/components/Doc'
import ModeStatus from '@/components/ModeStatus'
import { modeCfg, modeName } from '@/lib/modes'
import { MODES } from '@/lib/types'
import type { Mode } from '@/lib/types'
import { useReveal, useSite } from '@/lib/ui'

// Shared layout for the Vote page and the Terms & Refund page. A switch at the top picks Survival or Lifesteal.
export default function ModeDocPage({ kind, mode }: { kind: 'vote' | 'terms'; mode: Mode }) {
  const { settings: s } = useSite()
  const cfg = modeCfg(s, mode)
  const name = modeName(s, mode)
  useReveal(mode)
  const to = kind === 'vote' ? '/vote' : '/terms'

  return (
    <div className="wrap mode-page doc-page" style={{ ['--ma' as string]: cfg.accent }}>
      <div className="mode-switch">
        {MODES.map((m) => (
          <Link key={m} to={to} search={{ mode: m }} className={m === mode ? 'active' : ''}>
            {modeCfg(s, m).emoji} {modeName(s, m)}
          </Link>
        ))}
      </div>

      <section className="mode-hero">
        <div className="mode-emoji pop" aria-hidden>{cfg.emoji}</div>
        <h1 className="font-display">{kind === 'vote' ? `Vote for ${name}` : `${name} terms & refund policy`}</h1>
        <p className="lead">{kind === 'vote' ? cfg.voteNote : `Please read this before you buy anything for ${name}.`}</p>
        <div className="hero-actions"><ModeStatus mode={mode} /></div>
      </section>

      {kind === 'vote' ? (
        <section className="mode-sec">
          {cfg.votes.length ? (
            <div className="vote-grid">
              {cfg.votes.map((v, i) => (
                <a key={i} href={v.url} target="_blank" rel="noopener" className="glass vote-card reveal" style={{ ['--d' as string]: `${i * 70}ms` }}>
                  <div><b>{v.name}</b>{v.reward && <small>{v.reward}</small>}</div>
                  <ExternalLink size={18} />
                </a>
              ))}
            </div>
          ) : (
            <div className="glass" style={{ padding: 32, textAlign: 'center', color: 'var(--mut)' }}>Vote links for {name} are coming soon.</div>
          )}
        </section>
      ) : (
        <>
          <section className="mode-sec">
            <div className="glass doc-card reveal">
              <h2 className="h2">Terms of purchase</h2>
              <Doc text={cfg.terms} />
            </div>
          </section>
          <section className="mode-sec" id="refund">
            <div className="glass doc-card reveal">
              <h2 className="h2">Refund policy</h2>
              <Doc text={cfg.refund} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
