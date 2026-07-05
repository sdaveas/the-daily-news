# The Daily News - News Fetcher

## Overview
The Daily News newspaper runs at `/home/br3/the-daily-news/` on the Pi.
Headlines are fetched by `fetch-news.py` (stdlib only, no deps, no agent).

## How it works
- `fetch-news.py` pulls RSS feeds for 6 sections, writes `www/data/news.json`
- `server.py` serves the static site + exposes `POST /refresh` to trigger a fetch
- The website reads `news.json` on load and renders 6 section windows

## Sections & Feeds
1. **greek** — Kathimerini, To Vima
2. **world** — BBC World, NYT World, Al Jazeera
3. **tech** — Ars Technica, The Verge, TechCrunch
4. **sports** — Skai Sports, ESPN Soccer, ESPN NBA
5. **markets** — CoinDesk, Cointelegraph, MarketWatch
6. **gaming** — Polygon, IGN, EN World

## Manual refresh
```bash
python3 /home/br3/the-daily-news/fetch-news.py
```

## Cron (optional, every 4h)
Add to crontab:
```
0 */4 * * * /usr/bin/python3 /home/br3/the-daily-news/fetch-news.py >> /home/br3/the-daily-news/fetch.log 2>&1
```

## Files
- `server.py` — HTTP server (port 8090)
- `fetch-news.py` — RSS fetcher → news.json
- `feeds.json` — section/feed configuration
- `www/` — static site (HTML/CSS/JS)
- `www/data/news.json` — fetched headlines