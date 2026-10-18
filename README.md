# Ban Wars

## Setup (Windows PowerShell)
    npm install
    npm test

## Run (two terminals)
    npm run dev:server
    npm run dev:app

Friends on your network: set `$env:BW_SERVER="http://<server-ip>:3001"` before `npm run dev:app`.
Run Siege in borderless windowed mode. F10 toggles overlay click-through.

Free parties get three rotating premium bans in each match's ban vote. Premium parties can use the full ban catalog.

## Releases and updates

The packaged Windows app checks the GitHub Releases page for updates when it starts. To publish an update, bump `packages/overlay/package.json`'s version, commit the change, and push a matching version tag (for example, version `0.1.5` with tag `v0.1.5`). The version in the package and tag must match; changing only the tag will not make the app update. The release workflow builds the installer and publishes it with the update metadata. Existing installations download updates automatically and install them when the app exits.
