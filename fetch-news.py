#!/usr/bin/env python3
"""Fetch headlines via RSS and write news.json. No deps, no Ash."""
import urllib.request, xml.etree.ElementTree as ET, json, datetime, sys, re, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FEEDS_PATH = os.path.join(SCRIPT_DIR, 'feeds.json')

def load_feeds():
  if os.path.exists(FEEDS_PATH):
    with open(FEEDS_PATH) as f:
      return json.load(f)
  # default config
  return {
    "sections": [
      {"id":"greek","title":"Greek News","feeds":[
        {"url":"https://www.tovima.gr/feed/","source":"To Vima"},
        {"url":"https://www.skai.gr/rss/news","source":"Skai News"}
      ]},
      {"id":"world","title":"World","feeds":[
        {"url":"https://feeds.bbci.co.uk/news/world/rss.xml","source":"BBC World"},
        {"url":"https://rss.nytimes.com/services/xml/rss/nyt/World.xml","source":"NYT World"},
        {"url":"https://www.aljazeera.com/xml/rss/all.xml","source":"Al Jazeera"}
      ]},
      {"id":"tech","title":"Tech & AI","feeds":[
        {"url":"https://feeds.arstechnica.com/arstechnica/index","source":"Ars Technica"},
        {"url":"https://www.theverge.com/rss/index.xml","source":"The Verge"},
        {"url":"https://techcrunch.com/feed/","source":"TechCrunch"}
      ]},
      {"id":"sports","title":"Sports","feeds":[
        {"url":"https://www.skai.gr/rss/sports","source":"Skai Sports"},
        {"url":"https://www.espn.com/espn/rss/soccer/news","source":"ESPN Soccer"},
        {"url":"https://www.espn.com/espn/rss/nba/news","source":"ESPN NBA"}
      ]},
      {"id":"markets","title":"Markets","feeds":[
        {"url":"https://www.coindesk.com/arc/outboundfeeds/rss/","source":"CoinDesk"},
        {"url":"https://cointelegraph.com/rss","source":"Cointelegraph"},
        {"url":"https://feeds.marketwatch.com/marketwatch/topstories/","source":"MarketWatch"}
      ]},
      {"id":"gaming","title":"D&D / Gaming","feeds":[
        {"url":"https://www.polygon.com/rss/index.xml","source":"Polygon"},
        {"url":"https://www.eurogamer.net/feed","source":"Eurogamer"}
      ]}
    ]
  }

def clean(s):
  s = re.sub(r'<[^>]+>', '', s or '')
  s = re.sub(r'\s+', ' ', s).strip()
  return s[:280]

def fetch_feed(url, source, timeout=10):
  items = []
  try:
    req = urllib.request.Request(url, headers={'User-Agent':'DailyClaw/1.0 (+local)'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
      root = ET.parse(r).getroot()
    elems = root.findall('.//item') or root.findall('.//{http://purl.org/rss/1.0/}item')
    for it in elems[:20]:
      title = it.findtext('title') or ''
      link = it.findtext('link') or ''
      desc = it.findtext('description') or ''
      if not title or not link: continue
      items.append({
        'title': clean(title),
        'url': link,
        'snippet': clean(desc),
        'source': source,
      })
  except Exception as e:
    sys.stderr.write(f"[fetch] {url}: {e}\n")
  return items

def main():
  config = load_feeds()
  out = {"updated": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sections": []}
  for sec in config.get("sections", []):
    all_items = []
    for feed in sec.get("feeds", []):
      all_items.extend(fetch_feed(feed["url"], feed.get("source","")))
    lead = all_items[0] if all_items else None
    items = all_items[1:15] if len(all_items) > 1 else []
    out["sections"].append({
      "id": sec["id"],
      "title": sec["title"],
      "lead": lead,
      "items": items,
    })
  path = os.path.join(SCRIPT_DIR, "www", "data", "news.json")
  with open(path, "w") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
  total = sum(1 for s in out["sections"] if s["lead"]) + sum(len(s["items"]) for s in out["sections"])
  print(f"Paper updated. {total} headlines across {len(out['sections'])} sections.")

if __name__ == "__main__":
  main()