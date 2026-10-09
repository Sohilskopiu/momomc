# MOMO MC — Official Website

The official site and store for the MOMO MC Minecraft network. It has a blue animated "live" background, a floating 3D logo, a store for ranks, keys and coins, a staff showcase, news that syncs both ways with Discord, and a full Admin Panel.

## Pages

The whole site sits behind **Discord login**: visitors see a login screen until they sign in (the admin panel has its own login).

| Route | What it is |
|-------|------------|
| `/` | Home: hero with the floating logo and four floating momos, live player and Discord counts, join cards, news, the two game modes, features, staff and FAQ |
| `/survival` | Survival page. Sections: Overview, Ranks, Keys, Coins, How to buy. Own store, own cart, own tickets |
| `/lifesteal` | Lifesteal page. Same sections, completely separate store, cart and tickets |
| `/vote?mode=survival` or `lifesteal` | Vote page. Vote links and rewards are separate for each mode |
| `/terms?mode=survival` or `lifesteal` | Terms of purchase and refund policy, separate for each mode |
| `/announcements`, `/staff` | Still available, no longer in the menu |
| `/admin` | Admin Panel |

The menu only contains **Survival** and **Lifesteal**.

## Store, cart and automatic Discord tickets

1. Visitor adds items to the cart on `/survival` or `/lifesteal` (one cart per mode).
2. **Continue to payment** calls `POST /api/checkout`. Prices are re-read from the database on the server.
3. The site creates a private ticket channel in that mode's Discord category, gives the buyer and that mode's staff role access, posts price, perks and payment info, and sends the browser straight into the ticket.
4. The buyer posts a payment screenshot. The bot (`/bot`) checks it is a real, readable image from the buyer, then asks that mode's staff to press **Approve payment** or **Reject**.
5. On approval the order becomes *paid*, the bot pings the buyer 3 times, and staff can press **Mark delivered** and **Close ticket**.

The bot cannot read your bank or UPI history, so a person on the staff team always presses Approve. One open ticket per player per mode.

### Setup

Ticket category, staff role, log channel and payment info for each mode are set in **Admin Panel > Game Modes** (no redeploy needed). The bot reads the staff role and log channel from the website, so it does not need them in its own `.env`.

Vercel environment variables you still need:

| Variable | Purpose |
|----------|---------|
| `DISCORD_CLIENT_SECRET` | Discord login (required, otherwise nobody can enter) |
| `DISCORD_BOT_TOKEN` | Bot token used to create tickets (or save it under Discord Sync) |
| `BOT_API_KEY` | Long random string shared with the bot |

The old `DISCORD_GUILD_ID`, `TICKET_CATEGORY_*`, `STAFF_ROLE_*`, `LOG_CHANNEL_*` and `PAYMENT_INFO_*` variables still work as a fallback when the admin field is empty.

### Running the bot

The bot must stay online (a VPS, Railway, or any Node host). Vercel cannot host it.

```bash
cd bot && cp .env.example .env   # fill it in
npm install && npm start
```

In the Discord Developer Portal turn on **Message Content Intent**, and give the bot Manage Channels, Manage Messages, View Channels, Send Messages, Embed Links and Attach Files.

## Admin Panel

Everything on the site can be edited from `/admin`:

- **Dashboard**: server status, pending orders, revenue and quick actions
- **Announcements**: publish, edit, pin and delete posts, and optionally send them to Discord at the same time
- **Game Modes**: switch between Survival and Lifesteal and edit each one separately: mode name, own Java/Bedrock address and version (used for the live status and player count), vote links, terms, refund policy, page icon, colour, tagline, about text, highlight cards, live/coming soon, its own store open switch and note, its own Ranks/Keys/Coins names, icons and descriptions, and its Discord ticket setup (server ID, ticket category, staff role, sales log channel, payment info)
- **Store Items & Prices**: pick Survival or Lifesteal, then edit names and prices inline, then save everything at once; add or edit items (icon, colour, perks, sale price, popular flag, visibility)
- **Store Categories**: rename Ranks, Keys and Coins, change their icons and descriptions, hide a category, set the currency, open or close the store
- **Orders**: search, filter and change status (pending → paid → delivered)
- **Staff**: add, edit or remove staff members (avatars come from the Minecraft username)
- **Server & Links**: Java IP and port, Bedrock IP and port, version, Discord invite, YouTube and Instagram
- **Discord Sync**: webhook, bot token, channel ID, a test message and manual sync
- **Branding & Content**: hero texts, ticker, game modes, features and FAQ
- **Security**: change the admin username and password right inside the panel (stored hashed in the database), Discord login setup status

Credentials are checked on the server. Once you change them in *Security* they live in the database and win over env vars. Lost the password? Set `ADMIN_FORCE_ENV=true` with `ADMIN_USERNAME` and `ADMIN_PASSWORD`, redeploy, log in, then change them in the panel. The panel is not linked anywhere on the public site.

## Discord login (visitors)

The login screen uses Discord OAuth2 (`identify` scope). The Client ID is built in (override with `DISCORD_CLIENT_ID`). Set `DISCORD_CLIENT_SECRET` in Vercel, and add `https://YOUR-DOMAIN/api/auth/callback` as a redirect URL in the Discord Developer Portal (OAuth2). Optional: `SITE_URL`. Logged-in buyers get their verified Discord name attached to each order.

## Discord ↔ Website

- **Website → Discord**: paste a channel webhook URL in *Discord Sync*.
- **Discord → Website**: create a bot with *Message Content Intent* enabled, invite it with View Channels and Read Message History, then paste the bot token and the channel ID. New messages are pulled every 5 minutes by a daily Vercel cron (`/api/cron/discord-sync`), when pages are visited, or when you press *Sync now*. Instead of saving the token in the panel, you can set it as the `DISCORD_BOT_TOKEN` environment variable.

## Tech

TanStack Start (React 19), Vite, Tailwind 4, Postgres (Neon) with Drizzle ORM, deployed on Vercel via Nitro.

```bash
npm install
cp .env.example .env     # fill DATABASE_URL etc.
npm run db:setup         # creates the tables
npm run dev
```

See `.env.example` for every environment variable. Default content is seeded automatically on the first request.

## Security & bot protection

Built in (`src/server/guard.ts`, `vercel.json`):
- Rate limits per IP on checkout, admin login/actions/data, Discord login and the public site API (HTTP 429 when exceeded). Limits are in memory per server instance.
- Same-origin check on browser POSTs (blocks cross-site request forgery), and a size cap on JSON bodies.
- Security headers on every page (HSTS, nosniff, no framing, referrer and permissions policy) and `no-store` on `/api/*`.
- All traffic is already encrypted by HTTPS on Vercel. Base64 is only encoding, not encryption, so it is not used.

Turn on in the Vercel dashboard for real bot protection across all instances:
1. Project → Firewall → **Bot Protection** (Bot Filter) → set to Challenge.
2. Firewall → **Rate Limiting** rule, e.g. `/api/*` 100 requests per minute per IP.
3. If you are attacked: Firewall → **Attack Challenge Mode**.
4. Change the admin password in Admin Panel → Security, and set `ADMIN_SESSION_SECRET`, `BOT_API_KEY`, `CRON_SECRET` to long random strings.

## Admin login approval

Even with the right username and password, the admin panel waits until someone opens the Approve link the bot posts in the approval channel (default `1557784605833171084`, or `ADMIN_APPROVAL_CHANNEL_ID`). The approvers (default `896582112487043082` and `1373581087506301003`, editable in **Admin Panel > Security** with your admin password) are pinged there. Whoever approves or denies first decides. Requests last 10 minutes and work once.

**Keep that channel private**: anyone who can see it can press Approve. The bot needs View Channel + Send Messages + Mention permission in it. If the message cannot be posted, the login stays locked. Owner Discord login (`Continue as owner`) is separate and still works. Emergency switch: `ADMIN_APPROVAL=off`.

## Separate ticket categories

Survival and Lifesteal tickets always go into their own Discord category. If you leave **Ticket category ID** empty in Admin Panel > Game Modes > Discord tickets, the bot creates `🌲 Survival Tickets` and `❤️ Lifesteal Tickets` itself on the first order (the bot needs the **Manage Channels** permission) and remembers them. If a category is deleted, a new one is created automatically.

## SEO: sitemap and robots

`public/sitemap.xml` and `public/robots.txt` are served as static files at `https://www.momomc.fun/sitemap.xml` and `/robots.txt`. After deploying, open Google Search Console > Sitemaps and submit `sitemap.xml`. When you add a new public page, add its URL to `public/sitemap.xml`. `/admin` is `noindex` and not listed anywhere; `/api/` is disallowed.

## Theme and logo

Admin Panel > **Theme & Logo**: choose one of 6 themes (Ocean is the original look and the default, plus Emerald, Crimson, Royal Purple, Sunset Gold and Neon Pink), or set your own three colours (main, second, background). The tab previews the choice live; it goes public after **Save theme**. The **Logo** box uploads your own logo (PNG, JPG or WebP; it is shrunk in the browser and stored in the database, served from `/logo`). "Use the original logo" brings the built-in one back.


## Redeem codes

Public page: `/redeem` (a switch at the top picks Survival or Lifesteal; a code only works in the mode it was made for). Create codes in **Admin Panel > Redeem Codes**: reward name, console commands (`{player}` placeholder), max uses, one use per Discord account, expiry, or generate up to 100 random codes at once. The two database tables are created automatically on first use (`npm run db:setup` also creates them). Delivery is done by the Discord bot, see `bot/README.md` (RCON setup).

## Deploy from the admin panel

Admin Panel > **Deploy**. Everything you change in the panel (products, prices, redeem codes, theme, logo, settings, news) is live instantly. The **Deploy now** button is for new code: push it to GitHub first, then press the button and Vercel publishes the latest code. Setup: create a Deploy Hook in Vercel (Project > Settings > Git > Deploy Hooks) and paste its URL in the Deploy tab (or set `DEPLOY_HOOK_URL`). Optionally add a Vercel token + project ID (`VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`) to see build status in the panel.
