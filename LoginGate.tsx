import { useEffect, useState } from 'react'
import { DiscordIcon } from '@/components/Cards'
import { discordLoginUrl, img, readLoginResult, saveLoginResult, useSite } from '@/lib/ui'
import type { LoginResult } from '@/lib/ui'

// Shown instead of the whole site until the visitor has logged in with Discord.
export default function LoginGate() {
  const { settings: s } = useSite()
  const [result, setResult] = useState<LoginResult | null>(null)
  useEffect(() => { setResult(readLoginResult()) }, [])
  const problem = result && explain(result)
  return (
    <main className="gate">
      <div className="glass gate-card">
        <img src={img('/img/momo-logo.png', 500)} alt={s.serverName} width={220} height={146} />
        <h1>Log in to enter {s.serverName}</h1>
        <p>Sign in with Discord to see the server, use the stores and open payment tickets. We only read your Discord name and avatar.</p>
        {problem && <p className="gate-err">{problem}</p>}
        <button className="btn btn-discord" onClick={() => { saveLoginResult(null); location.href = discordLoginUrl() }}><DiscordIcon size={20} /> Login with Discord</button>
      </div>
    </main>
  )
}

// Plain-language reason for a failed login, so the owner can see what to fix.
function explain(r: LoginResult) {
  if (r.login === 'unconfigured') return 'Discord login is not set up yet. Owner: set DISCORD_CLIENT_SECRET (and DISCORD_CLIENT_ID if you use your own app) in the site environment variables.'
  switch (r.why) {
    case 'denied': return 'The Discord login was cancelled. Press the button to try again.'
    case 'session': return 'The login session was lost on the way back from Discord. Open the site from its main address, make sure cookies are allowed, then try again. Owner: SITE_URL must be the exact address people visit.'
    case 'secret': return 'Discord rejected the Client ID or Client Secret. Owner: DISCORD_CLIENT_SECRET must come from the same Discord application as DISCORD_CLIENT_ID.'
    case 'redirect': return `Discord rejected the redirect URL. Owner: add ${r.ru ?? 'https://YOUR-SITE/api/auth/callback'} under Discord Developer Portal > OAuth2 > Redirects, exactly like that.`
    case 'user': return 'Discord accepted the login but the site could not read your profile. Please try again.'
    default: return 'Discord login failed at the last step. Please try again. Owner: check the function logs for the Discord error.'
  }
}
