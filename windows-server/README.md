# MetaList Stuttgart — Windows companion server

Local / LAN companion for the [MetaList Stuttgart](https://github.com/SangfoidEns/Metalist_Stuttgart) client.

## Why Node.js (not .NET)

The client already talks to a **Node HTTP API** on port **8787** (`ClubBot.apiBase()`, `ms_auth_api`, Telegram `validate`). Extending that stack keeps one protocol and one runtime. A separate .NET listener would duplicate the bot/auth surface for little gain on Windows.

## Requirements

- Windows 10/11 (or any OS with Node)
- [Node.js 18+](https://nodejs.org/)

## How to run

```bat
cd windows-server
start.bat
```

Or PowerShell:

```powershell
cd windows-server
.\start.ps1
```

Or from repo root:

```bash
npm run auth-server
# or
node windows-server/src/main.mjs
```

- **Default port:** `8787`
- **Control panel:** http://127.0.0.1:8787/
- **Stop:** Ctrl+C in the console window (or close it)

Optional env:

| Variable | Meaning |
|----------|---------|
| `PORT` | Listen port (default `8787`) |
| `TELEGRAM_BOT_TOKEN` | Club bot (optional for JSON club sync) |
| `TELEGRAM_CLUB_CHAT_ID` | Default group chat id |
| `BOT_API_SECRET` | If set, require `X-Bot-Secret` |
| `CLUB_DATA_DIR` | Where coach/player JSON files are stored |
| `OPEN_UI` | `0` to skip opening the browser |

Point the Mini App / browser client at this server:

```js
localStorage.setItem('ms_auth_api', 'http://127.0.0.1:8787');
```

## Protocol (what the client expects)

### Discovery

1. `window.__MS_AUTH_API__`
2. `<meta name="ms-auth-api">`
3. `localStorage.ms_auth_api`
4. Fallback: `http://127.0.0.1:8787`

### Existing bot / auth API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Liveness |
| POST | `/api/telegram/validate` | `{ initData }` HMAC check |
| GET | `/api/bot/status` | Bot identity |
| GET | `/api/bot/discover-chats` | Find group chat ids |
| POST | `/api/bot/attendance-poll` | Poll ~36h before training |
| POST | `/api/bot/training-plan` | Plan message |
| POST | `/api/bot/match-lineup` | Lineup message |
| POST | `/api/bot/club-event` | Event message |
| POST | `/api/bot/send-text` | Free text |
| POST | `/api/bot/schedule-check` | Auto poll window |

### JSON club file transfer (“Johnson” club file)

The client models **coach** and **player** roles and exchanges a **JSON club snapshot** (`metalist_full_migration` / export payload / `metalist_roster_migration`). There was no HTTP club-file API before; this companion adds matching endpoints and client buttons.

| Method | Path | Role |
|--------|------|------|
| GET | `/api/club/status` | Presence + meta for `coach` and `player` |
| POST | `/api/club/upload?role=coach\|player` | Body = club JSON (or `{ "club": {…} }`) |
| GET | `/api/club/download?role=coach\|player` | `{ ok, role, meta, club }` |
| GET | `/api/club/download/file?role=coach\|player` | Attachment download |

**Flow**

1. **Coach** exports / pushes club JSON → `POST /api/club/upload?role=coach`
2. **Player** pulls coach pack → `GET /api/club/download?role=coach` (or downloads the coach file from the panel) and imports it in the app
3. **Player** may upload their own slice → `POST /api/club/upload?role=player`
4. Files are stored under `windows-server/data/club/` as `metalist_club_coach.json` / `metalist_club_player.json`

In the web client: **Settings → На сервер / З сервера** (visible for coach and player).

## Layout

```
windows-server/
  README.md
  start.bat / start.ps1
  src/main.mjs      # opens panel + starts ../server
  ui/               # control panel (status, upload/download)
  data/club/        # stored club JSON files
server/
  index.mjs         # shared HTTP API
  clubStore.mjs     # coach/player file store
```
