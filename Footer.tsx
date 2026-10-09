import { Link } from '@tanstack/react-router'
import { modeName, modeServer } from '@/lib/modes'
import { copy, fullAddress, img, useSite } from '@/lib/ui'

export default function Footer() {
  const { settings: s } = useSite()
  return (
    <footer className="site">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <img src={img('/img/momo-logo.png', 240)} alt={s.serverName} style={{ height: 70, marginBottom: 14 }} />
            <p style={{ color: 'var(--mut)', fontSize: 14.5, maxWidth: 320, margin: 0 }}>{s.heroSubtitle}</p>
          </div>
          <div>
            <h4>Explore</h4>
            <Link to="/">Home</Link>
            <Link to="/survival">{modeName(s, 'survival')}</Link>
            <Link to="/lifesteal">{modeName(s, 'lifesteal')}</Link>
            <Link to="/vote">Vote</Link>
            <Link to="/redeem">Redeem</Link>
            <Link to="/terms">Terms &amp; Refund</Link>
            <Link to="/announcements">Announcements</Link>
          </div>
          <div>
            <h4>Community</h4>
            <a href={s.discordInvite} target="_blank" rel="noopener">Discord</a>
            {s.youtube && <a href={s.youtube} target="_blank" rel="noopener">YouTube</a>}
            {s.instagram && <a href={s.instagram} target="_blank" rel="noopener">Instagram</a>}
          </div>
          <div>
            <h4>Play now</h4>
            {(['survival', 'lifesteal'] as const).map((m) => {
              const a = modeServer(s, m)
              const java = fullAddress(a.ip, a.port)
              return (
                <a key={m} href="#" onClick={(e) => { e.preventDefault(); copy(java, `${modeName(s, m)} IP copied`) }}>{modeName(s, m)} · <b style={{ color: '#fff' }}>{java}</b></a>
              )
            })}
            <span style={{ color: 'var(--mut)', fontSize: 14 }}>Version {s.version}</span>
          </div>
        </div>
        <div className="copyright">
          <span>© {new Date().getFullYear()} {s.serverName}. All rights reserved.</span>
          <span>Not affiliated with Mojang Studios or Microsoft.</span>
        </div>
      </div>
    </footer>
  )
}
