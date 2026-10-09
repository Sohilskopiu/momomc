# MOMO MC ticket bot

Add the bot to your Discord server (bot + slash commands):

https://discord.com/oauth2/authorize?client_id=1519990400574689430&scope=bot%20applications.commands&permissions=125968

Then, in this folder, create `.env` (see `bot.env`) and run:

    npm install
    npm start

Needed in `.env`: `DISCORD_BOT_TOKEN`, `SITE_URL` (no trailing slash) and `BOT_API_KEY`
(must be identical to `BOT_API_KEY` on the website).

## Redeem codes (automatic delivery)

Codes are created in **Admin Panel > Redeem Codes** (separately for Survival and Lifesteal). When a player redeems one on the website, this bot gives the reward:

- **With RCON** the bot runs the code's console commands on that mode's server (`{player}` = the player's name). Enable RCON in the Minecraft `server.properties` (`enable-rcon=true`, `rcon.port=25575`, `rcon.password=...`), then add to the bot `.env`:

      RCON_SURVIVAL_HOST=your.survival.server.ip
      RCON_SURVIVAL_PORT=25575
      RCON_SURVIVAL_PASSWORD=...
      RCON_LIFESTEAL_HOST=your.lifesteal.server.ip
      RCON_LIFESTEAL_PORT=25575
      RCON_LIFESTEAL_PASSWORD=...

  Open the RCON port only to the machine that runs the bot (firewall), because RCON gives full console access.
- **Without RCON** (or a code with no commands) the bot posts the reward in that mode's log channel and staff press **Mark delivered**.

If delivery fails, staff are pinged in the log channel and the claim shows as failed in the admin panel, where **Retry** runs it again. The bot checks for new redeems every 10 seconds.
