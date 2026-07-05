# The Daily News

A newspaper-style RSS aggregator running on a Raspberry Pi. Fetches headlines from configurable RSS feeds across thematic sections and renders them in a broadsheet layout.

**Live site:** https://sdaveas.github.io/the-daily-news/

## Architecture

- **`server.py`** — Python HTTP server (stdlib only, no deps). Serves static files from `www/`, exposes `/config` (GET/POST) and `/refresh` (POST) endpoints.
- **`fetch-news.py`** — RSS fetcher (stdlib only). Reads `feeds.json`, fetches feeds, writes `www/data/news.json`.
- **`feeds.json`** — Section/feed configuration (editable via the settings UI).
- **`www/`** — Static site: HTML, CSS (based on [Robot Dreams](https://github.com/panosdaveas/robot-dreams-website) layout), JS.
- **`skill/SKILL.md`** — Project documentation.

## Sections

Default sections: Greek News, World, Tech & AI, Sports, Markets, D&D / Gaming. All configurable via the settings gear icon.

## Running

```bash
python3 server.py
```

Serves on port 8090.

## Systemd service

```ini
[Unit]
Description=The Daily News newspaper
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/br3/the-daily-news
ExecStart=/usr/bin/python3 /home/br3/the-daily-news/server.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Auto-refresh

The server fetches headlines on startup and on first page load if `news.json` is older than 4 hours. No cron needed.

## Credits

Newspaper layout and CSS adapted from [Robot Dreams](https://github.com/panosdaveas/robot-dreams-website) by Panos Daveas.

## No dependencies

Pure Python stdlib + vanilla HTML/CSS/JS. No npm, no pip, no framework.