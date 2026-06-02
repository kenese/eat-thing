# Mac mini scraper service

The production scraper runs the compiled worker under `launchd`. The plist keeps
secrets out of source control: `dotenv` reads them from `apps/scraper/.env`.

## Install or refresh

From the production checkout:

```bash
pnpm install --frozen-lockfile
pnpm --filter @eat/scraper build
cp apps/scraper/launchd/com.eat-thing.scraper.plist ~/Library/LaunchAgents/
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.eat-thing.scraper.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.eat-thing.scraper.plist
```

Before loading the service, create `apps/scraper/.env` from `.env.example` and
set `API_BASE_URL`, `SCRAPER_HMAC_SECRET`, and `SUPERMARKET_ENC_KEY`.

Check the service with:

```bash
launchctl print gui/$(id -u)/com.eat-thing.scraper
tail -f ~/Library/Logs/eat-thing-scraper.log
```
