import { useEffect } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { fetchSite } from '@/server/site.functions'
import LiveBackground from '@/components/LiveBackground'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import LoginGate from '@/components/LoginGate'
import CartDrawer from '@/components/CartDrawer'
import { CartProvider } from '@/lib/cart'
import { Toaster, saveLoginResult, setLogo, toast, useDiscordUser } from '@/lib/ui'
import { themeCss } from '@/lib/theme'

import '../styles.css'

const siteName = 'MOMO MC — Minecraft Server & Store'
const siteDescription = 'MOMO MC Minecraft network. Play Survival or Lifesteal at play.momomc.fun and grab ranks, keys and coins in each mode\'s own store.'

export const Route = createRootRoute({
  loader: () => fetchSite(),
  staleTime: 30_000,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: siteName },
      { name: 'description', content: siteDescription },
      { name: 'theme-color', content: '#030a14' },
      { property: 'og:title', content: siteName },
      { property: 'og:description', content: siteDescription },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/img/momo-banner.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'preload', as: 'image', href: loaderData?.logoVersion ? `/logo?v=${loaderData.logoVersion}` : '/img/momo-logo.webp' },
    ],
  }),
  component: RootLayout,
  shellComponent: RootDocument,
})

// Result of the Discord login round-trip (?login=ok | error | unconfigured)
function LoginToast() {
  useEffect(() => {
    const u = new URL(location.href)
    const r = u.searchParams.get('login')
    if (!r) return
    if (r === 'ok') { saveLoginResult(null); setTimeout(() => toast('Logged in with Discord ✅'), 400) }
    else saveLoginResult({ login: r, why: u.searchParams.get('why') ?? undefined, ru: u.searchParams.get('ru') ?? undefined })
    u.searchParams.delete('login'); u.searchParams.delete('why'); u.searchParams.delete('ru')
    history.replaceState(null, '', u.pathname + u.search + u.hash)
  }, [])
  return null
}

function RootLayout() {
  const site = Route.useLoaderData()
  setLogo(site.logoVersion) // every logo on the site follows the uploaded one
  const isAdmin = useRouterState({ select: (s) => s.location.pathname.startsWith('/admin') })
  const { user, loading } = useDiscordUser()

  // The admin panel has its own login. Everything else needs a Discord login first.
  let body: React.ReactNode
  if (isAdmin) body = <main><Outlet /></main>
  else if (loading) body = <div className="splash" aria-busy="true" />
  else if (!user) body = <LoginGate />
  else body = (
    <>
      <Header />
      <main><Outlet /></main>
      <Footer />
      <CartDrawer />
    </>
  )

  return (
    <CartProvider>
      <style id="site-theme" dangerouslySetInnerHTML={{ __html: themeCss(site.settings.theme) }} />
      <LiveBackground />
      <LoginToast />
      {body}
      <Toaster />
    </CartProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
