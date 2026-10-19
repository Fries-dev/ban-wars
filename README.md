# Ban Wars

## Setup (Windows PowerShell)
    npm install
    npm test

## Run (two terminals)
    npm run dev:server
    npm run dev:app

Friends on your network: set `$env:BW_SERVER="http://<server-ip>:3001"` before `npm run dev:app`.
Run Siege in borderless windowed mode. F10 toggles overlay click-through.

## Public multiplayer server (Railway)

The server is configured for Railway using the repository-root `railway.json`. In Railway, create a project from this GitHub repository and deploy from the repository root. Railway installs the workspace dependencies using its standard install step (do not add a second `npm ci` build command). `.nvmrc` selects Node 20. Railway uses `/health` for its health check. Generate a public domain in the Railway service's Networking settings; the app server URL should be `https://<your-domain>` (no path or trailing slash).

Before publishing a Windows release, add these **repository Actions variables** under GitHub **Settings → Secrets and variables → Actions → Variables**:

- `BW_SERVER`: the public Railway URL, for example `https://ban-wars-production.up.railway.app`
- `VITE_SUPABASE_URL`: the Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: the Supabase publishable/anon key (never a Supabase secret key)

The release workflow requires these values and embeds them in the packaged app. For local development, put the Supabase variables in `packages/overlay/.env` and run the server locally; the desktop app defaults to `http://localhost:3001`. The server keeps parties in memory, so restarting/redeploying it ends active parties.

Free parties get three randomly selected premium bans for the party game; the selection stays the same across matches and rerolls when the host resets the party. Once either team has a ban applied, it disappears from later vote choices and cannot be selected again until it is mercy-unbanned. Premium parties can use the full ban catalog.

Party invites can be copied as a code or as a web link. Opening the invite link redirects to the Ban Wars app and fills in the party code; if the app is not installed, the page links to the latest installer. The lobby shows up to 10 recent match results (up to 20 are retained for the party lifetime, including across a host reset). Rejoin credentials are encrypted with the operating system's secure storage so the app can attempt to rejoin after a restart while the server still retains the party. Settings include overlay scale/position, colorblind colors, and sound mute/volume; vote start, bans, and unbans have distinct sound cues.

Players can mark themselves ready in the lobby after joining a team. Ready status is informational, clears when a match starts or a player changes teams, and does not prevent the host from starting. Match history can be copied from the lobby as a plain-text results summary.

## Sign-in setup

Sign-in uses Supabase Auth (free tier) for Google, Apple, and email/password accounts. Apple sign-in also requires Apple provider credentials, which may require membership in Apple's paid developer program.

1. Create a Supabase project and copy its project URL and anon key into `packages/overlay/.env` using `.env.example` as a template.
2. In Supabase Authentication settings, enable Google and Apple and configure each provider's credentials. Do not put provider secrets in the app.
3. Add `banwars://auth/callback` to the Supabase redirect URL allow list. For email confirmation links, set the email redirect URL to the same callback.
4. Rebuild the app after changing the environment file.

The app opens provider sign-in in the system browser. The Windows installer registers the `banwars://` callback protocol, and development mode registers it against the running Electron app. Provider sign-in requires a Supabase project and valid provider credentials.

Email sign-in supports resending a signup confirmation and requesting a password-reset email. Reset links return to the app so a new password can be set. Supabase email rate limits and SMTP delivery settings apply.

The app footer contains draft Privacy Policy and Terms of Service pages. Complete and review the privacy contact, payment provider, subscription price and renewal, cancellation, and refund details before enabling Premium subscription sales.

## Releases and updates

The packaged Windows app checks the GitHub Releases page for updates when it starts. To publish an update, bump `packages/overlay/package.json`'s version, commit the change, and push a matching version tag (for example, version `0.1.14` with tag `v0.1.14`). The version in the package and tag must match; changing only the tag will not make the app update. The release workflow builds the installer and publishes it with the update metadata. Existing installations download updates automatically and install them when the app exits.

### Sharing the installer in Discord

The Electron installer is larger than Discord's 10 MB upload limit. Build the small downloader launcher with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-discord-launcher.ps1
```

Upload `packages\overlay\dist\Ban-Wars-Discord-Launcher.exe` instead. When opened, it downloads the latest installer from the public GitHub release, checks its SHA-256 digest, and starts the installer. The recipient needs an internet connection; the launcher itself does not contain the app.
