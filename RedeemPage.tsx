import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Gift } from 'lucide-react'
import ModeStatus from '@/components/ModeStatus'
import { modeCfg, modeName } from '@/lib/modes'
import { MODES } from '@/lib/types'
import type { Mode } from '@/lib/types'
import { toast, useReveal, useSite } from '@/lib/ui'

type Result = { title: string; icon: string; description: string; auto: boolean }

// Redeem page: one per game mode (switch at the top). The code only works for the mode it was made for.
export default function RedeemPage({ mode }: { mode: Mode }) {
  const { settings: s } = useSite()
  const cfg = modeCfg(s, mode)
  const name = modeName(s, mode)
  useReveal(mode)
  const [mc, setMc] = useState(() => (typeof localStorage === 'undefined' ? '' : localStorage.getItem('momo_mc_name') || ''))
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Result | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setDone(null)
    try {
      const r = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, code, mcUsername: mc }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) toast(d.error || 'Could not redeem', true)
      else {
        localStorage.setItem('momo_mc_name', mc.trim())
        setDone(d)
        setCode('')
      }
    } catch {
      toast('Network error, please try again', true)
    }
    setBusy(false)
  }

  return (
    <div className="wrap mode-page doc-page" style={{ ['--ma' as string]: cfg.accent }}>
      <div className="mode-switch">
        {MODES.map((m) => (
          <Link key={m} to="/redeem" search={{ mode: m }} className={m === mode ? 'active' : ''}>
            {modeCfg(s, m).emoji} {modeName(s, m)}
          </Link>
        ))}
      </div>

      <section className="mode-hero">
        <div className="mode-emoji pop" aria-hidden>{cfg.emoji}</div>
        <h1 className="font-display">Redeem a {name} code</h1>
        <p className="lead">Got a code? Enter your Minecraft username and the code. Our bot delivers the reward to you on the {name} server.</p>
        <div className="hero-actions"><ModeStatus mode={mode} /></div>
      </section>

      <section className="mode-sec">
        <form className="glass doc-card reveal" onSubmit={submit} style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 className="h2" style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Gift size={22} /> {name} redeem code</h2>
          <label className="field">
            <span>Minecraft username</span>
            <input value={mc} onChange={(e) => setMc(e.target.value.trim())} placeholder="Your in-game name" maxLength={20} autoComplete="off" required />
          </label>
          <label className="field">
            <span>Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" maxLength={40} autoComplete="off" spellCheck={false} required style={{ letterSpacing: '0.08em', fontWeight: 700 }} />
          </label>
          <button className="btn btn-primary" disabled={busy || !mc || !code} style={{ width: '100%' }}>
            <Gift size={17} /> {busy ? 'Redeeming…' : 'Redeem'}
          </button>
          <p className="help" style={{ marginBottom: 0 }}>This code only works for {name}. You need to be logged in with Discord, and each code can be used a limited number of times.</p>
        </form>

        {done && (
          <div className="glass doc-card" style={{ maxWidth: 560, margin: '18px auto 0', textAlign: 'center' }}>
            <div style={{ fontSize: 44 }} aria-hidden>{done.icon}</div>
            <h2 className="h2" style={{ marginBottom: 6 }}>Code redeemed! 🎉</h2>
            <p style={{ margin: '0 0 6px', fontSize: 18 }}><b>{done.title}</b></p>
            {done.description && <p className="help" style={{ margin: '0 0 8px' }}>{done.description}</p>}
            <p className="help" style={{ margin: 0 }}>
              {done.auto
                ? `The bot is delivering it to ${mc} now. Be online on ${name} (it usually takes a few seconds). If it does not arrive, open a ticket in our Discord.`
                : `Staff will deliver it to ${mc} in-game shortly. If it takes long, open a ticket in our Discord.`}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
