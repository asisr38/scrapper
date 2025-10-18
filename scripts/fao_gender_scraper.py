
#!/usr/bin/env python3
"""
FAO Gender Site Scraper
-----------------------
Scrapes paginated listings from FAO's Gender site (News, Insights, Success Stories,
and E-learnings) and exports to CSV and JSON.

Examples
--------
# Scrape the first 10 pages of News; outputs to public/news.csv and news.json
python scripts/fao_gender_scraper.py --section news --max-pages 10

# Scrape Insights (all pages until empty), 2s delay; explicit output path in public/
python scripts/fao_gender_scraper.py --section insights --delay 2.0 --out public/insights.csv

# Scrape Success Stories, starting at page 3 through 12; defaults to public/
python scripts/fao_gender_scraper.py --section success-stories --start-page 3 --max-pages 10

# Deep-scrape News: fetch each article and auto-summarize into 3 sentences
python scripts/fao_gender_scraper.py --section news --max-pages 5 --fetch-article --summarize --summary-sentences 3

# Scrape Publications (use the numeric page in the URL, e.g. 61)
python scripts/fao_gender_scraper.py --section publications --start-page 61 --max-pages 3

Notes
-----
- By default, outputs are written under public/<section>.csv and <section>.json.
- The script sends a desktop-like User-Agent and uses retry logic to reduce 403/5xx errors.
- If your network blocks automated requests to fao.org, run this script from a different network
  or manually save the HTML and parse locally.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup  # pip install beautifulsoup4
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
from datetime import datetime
from urllib.parse import urlparse


BASE = "https://www.fao.org"
SECTIONS = {
    # listing path fragment after /gender/
    "news": "news",
    "insights": "insights",
    "success-stories": "success-stories",
    # E-learnings lives under /gender/resources/e-learning
    "e-learning": "resources/e-learning",
    # Publications live under /gender/resources/publications/<page>/en (page is numeric like 61)
    "publications": "resources/publications",
}


@dataclass
class Item:
    section: str
    page: int
    title: str
    date: str
    date_iso: str
    year: int
    month: int
    category: str
    url: str
    summary: str
    # Optional deep-scrape fields
    article_summary: str = ""
    article_text: str = ""


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    retries = Retry(
        total=5,
        backoff_factor=0.6,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]),
        raise_on_status=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://", HTTPAdapter(max_retries=retries))
    return s


def build_page_url(section_key: str, page: int) -> str:
    path = SECTIONS[section_key]
    # Page 1 is .../<path>/en ; pages >=2 are .../<path>/<n>/en
    if section_key == "e-learning":
        # e-learning path includes 'resources' segment
        return f"{BASE}/gender/{path}/en" if page == 1 else f"{BASE}/gender/{path}/{page}/en"
    else:
        return f"{BASE}/gender/{path}/en" if page == 1 else f"{BASE}/gender/{path}/{page}/en"


def parse_listing_generic(html: str) -> List[Tuple[str, str, str, str]]:
    """Parse generic listing pages (news/insights/success-stories).
    Returns list of (title, date, url, summary) tuples.
    """
    soup = BeautifulSoup(html, "html.parser")
    out: List[Tuple[str, str, str, str]] = []
    for content in soup.select("div.d-list-content"):
        title_tag = content.select_one("h5.title-link a")
        date_tag = content.select_one("h6.date")
        # summary is usually first immediate div inside .d-list-content
        summary_div = content.find("div")
        title = title_tag.get_text(strip=True) if title_tag else ""
        href = title_tag.get("href", "") if title_tag else ""
        # Normalize relative links
        if href and href.startswith("/"):
            href = f"{BASE}{href}"
        date = date_tag.get_text(strip=True) if date_tag else ""
        # Some pages wrap summary in <p> inside the <div>
        summary = ""
        if summary_div:
            # Join all immediate text (strip nested tags gracefully)
            summary = summary_div.get_text(" ", strip=True)
        if any([title, date, href, summary]):
            out.append((title, date, href, summary))
    return out


def parse_listing_elearning(html: str) -> List[Tuple[str, str, str, str]]:
    """Parse e-learning cards (structure differs).
    Returns list of (title, date, url, summary) tuples.
    """
    soup = BeautifulSoup(html, "html.parser")
    out: List[Tuple[str, str, str, str]] = []
    for card in soup.select("div.card.card-elearning div.card-body"):
        a = card.select_one("h5.card-title a.title-link")
        date_tag = card.select_one("h6.date")
        summary_p = card.select_one("p.card-text")
        title = a.get_text(strip=True) if a else ""
        href = a.get("href", "") if a else ""
        if href and href.startswith("/"):
            href = f"{BASE}{href}"
        date = date_tag.get_text(strip=True) if date_tag else ""
        summary = summary_p.get_text(" ", strip=True) if summary_p else ""
        if any([title, date, href, summary]):
            out.append((title, date, href, summary))
    return out


def normalize_space(text: str) -> str:
    if not text:
        return ""
    # Collapse whitespace and strip
    return re.sub(r"\s+", " ", text).strip()


def try_dateutil_parse(date_str: str) -> Optional[datetime]:
    try:
        from dateutil.parser import parse as dt_parse  # type: ignore
    except Exception:
        return None
    try:
        return dt_parse(date_str, dayfirst=True, yearfirst=False)
    except Exception:
        return None


def parse_date_to_iso(date_str: str) -> Tuple[str, int, int]:
    """Return (YYYY-MM-DD, year, month) or ("", 0, 0) if unknown."""
    s = normalize_space(date_str)
    if not s:
        return "", 0, 0

    # Try python-dateutil if available
    dt = try_dateutil_parse(s)
    if dt is None:
        # Fallback to common formats
        formats = [
            "%d %B %Y", "%d %b %Y",
            "%B %d, %Y", "%b %d, %Y",
            "%Y-%m-%d",
            "%d/%m/%Y", "%m/%d/%Y",
            "%d.%m.%Y",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(s, fmt)
                break
            except Exception:
                dt = None
    if dt is None:
        return "", 0, 0
    return dt.strftime("%Y-%m-%d"), dt.year, dt.month


def categorize_article(title: str, summary: str, section: str) -> str:
    """Categorize into FAO Gender Thematic Areas using keyword scoring.
    Returns one primary Thematic Area string from the predefined list.
    """
    text = f"{title} {summary}".lower()
    # Normalize common punctuation variants to improve matching
    text = text.replace("’", "'").replace("“", '"').replace("”", '"')

    thematic_keywords: List[Tuple[str, List[str]]] = [
        ("Gender equality and women’s empowerment", [
            "gender equality", "women", "girls", "empower", "empowerment", "leadership", "equity", "inclusion", "rights"
        ]),
        ("Gender analysis, gender mainstreaming and the project cycle", [
            "gender analysis", "gender mainstreaming", "mainstreaming", "project cycle", "logframe", "logical framework", "design phase", "implementation phase", "monitoring and evaluation", "m&e"
        ]),
        ("Gender-responsive policy making and budgeting", [
            "policy", "policies", "policy-making", "policy making", "budget", "budgeting", "gender-responsive budget", "grb", "governance", "regulation", "legislation"
        ]),
        ("Gender statistics and sex-disaggregated data", [
            "sex-disaggregated", "sex disaggregated", "gender statistics", "disaggregated data", "indicator", "survey", "census", "data collection", "gender data"
        ]),
        ("Gender in fisheries and aquaculture", [
            "fishery", "fisheries", "aquaculture", "fisher", "fishing", "fish value chain"
        ]),
        ("Gender in forestry and agroforestry", [
            "forestry", "forest", "agroforestry", "woodlot", "non-timber forest", "ntfp"
        ]),
        ("Gender and livestock", [
            "livestock", "pastoral", "pastoralist", "herd", "animal health", "small ruminant", "cattle", "goat", "sheep"
        ]),
        ("Gender and plant production and protection", [
            "plant production", "crop", "crop production", "plant protection", "ipm", "integrated pest", "seed", "agronomy", "plant health"
        ]),
        ("Gender and innovative and labour-saving technologies", [
            "innovation", "innovative", "technology", "technologies", "labour-saving", "labor-saving", "mechanization", "mechanisation", "tools", "equipment", "digital"
        ]),
        ("Gender and land and water", [
            "land tenure", "land rights", "land", "water", "irrigation", "watershed", "water management", "land governance"
        ]),
        ("Gender and food security and nutrition", [
            "food security", "nutrition", "malnutrition", "diet", "food systems", "household food", "nutritious"
        ]),
        ("Gender and inclusive food systems and value chains", [
            "inclusive", "value chain", "market access", "agrifood", "food system", "processing", "marketing", "inclusive business"
        ]),
        ("Gender and climate change, agroecology and biodiversity", [
            "climate", "climate change", "agroecology", "biodiversity", "mitigation", "adaptation", "emissions", "ecosystem", "nature-based"
        ]),
        ("Gender and emergencies and resilience building", [
            "emergency", "humanitarian", "crisis", "conflict", "resilience", "shock", "disaster", "drm", "risk management"
        ]),
        ("Gender-based violence and protection from sexual exploitation and abuse", [
            "gender-based violence", "gbv", "violence", "protection from sexual exploitation and abuse", "psea", "harassment", "safeguarding"
        ]),
        ("Gender and rural financial services", [
            "finance", "financial services", "microfinance", "credit", "loans", "savings", "remittances"
        ]),
        ("Gender and decent rural employment and child labour", [
            "decent work", "decent employment", "rural employment", "child labour", "child labor", "occupational safety", "oshea", "youth employment"
        ]),
        ("Gender and investment in sustainable agrifood systems", [
            "investment", "invest", "sustainable agrifood", "infrastructure", "capital", "financing", "public investment", "private investment"
        ]),
        ("Gender and rural advisory services", [
            "extension", "advisory services", "rural advisory", "farmer field school", "ffs", "capacity development", "training"
        ]),
        ("Gender-sensitive social protection", [
            "social protection", "cash transfer", "safety net", "social assistance", "insurance", "public works"
        ]),
    ]

    best_category = "Gender equality and women’s empowerment"
    best_score = 0
    for category_label, keywords in thematic_keywords:
        score = 0
        for keyword in keywords:
            if keyword in text:
                score += 1
        if score > best_score:
            best_score = score
            best_category = category_label

    return best_category


def extract_main_text(html: str) -> str:
    """Extract main article text with heuristic selectors and paragraph join."""
    soup = BeautifulSoup(html, "html.parser")
    for sel in [
        "script", "style", "nav", "header", "footer", "aside", "form", "noscript",
        "div.share", "div.social", "ul.share-buttons",
    ]:
        for n in soup.select(sel):
            n.decompose()

    candidate_selectors = [
        "article", "main article", "main .article", "div.article", "div.article-content",
        "div.entry-content", "div#content", "main", "section.content", "div.content",
        "div.text", "div#main-content",
    ]
    best = ""
    best_len = 0
    for sel in candidate_selectors:
        node = soup.select_one(sel)
        if not node:
            continue
        text = "\n".join([p.get_text(" ", strip=True) for p in node.find_all(["p", "li"])])
        if len(text) > best_len:
            best = text
            best_len = len(text)
    if not best:
        best = "\n".join([p.get_text(" ", strip=True) for p in soup.find_all("p")])
    return normalize_space(best)


def summarize_text(text: str, max_sentences: int = 3) -> str:
    if not text:
        return ""
    sentences = re.split(r"(?<=[\.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    stop = set("""
        a an the and or but if while of for on in at to from by with as is are was were be been being
        this that those these it its they them their we our you your he she his her not no yes do does did
    """.split())
    words = re.findall(r"[A-Za-z']+", text.lower())
    freq: Dict[str, int] = {}
    for w in words:
        if w in stop or len(w) <= 2:
            continue
        freq[w] = freq.get(w, 0) + 1

    scores: List[Tuple[int, int]] = []
    for idx, s in enumerate(sentences):
        score = 0
        for w in re.findall(r"[A-Za-z']+", s.lower()):
            score += freq.get(w, 0)
        scores.append((score, idx))
    top = sorted(scores, key=lambda x: x[0], reverse=True)[:max_sentences]
    top_idx = sorted([i for _, i in top])
    return " ".join([sentences[i] for i in top_idx])


def scrape(section: str, start_page: int, max_pages: int, delay: float,
           fetch_article: bool = False, summarize: bool = False, summary_sentences: int = 3) -> List[Item]:
    session = make_session()
    results: List[Item] = []
    parser: Callable[[str], List[Tuple[str, str, str, str]]]
    parser = parse_listing_elearning if section == "e-learning" else parse_listing_generic

    page = start_page
    pages_fetched = 0
    while True:
        if pages_fetched >= max_pages:
            break
        url = build_page_url(section, page)
        resp = session.get(url, timeout=30)
        status = resp.status_code
        if status != 200:
            # Stop on 404 or break on consecutive non-200s
            # Print to stderr for visibility but keep going if later pages might exist
            print(f"WARN: HTTP {status} for {url}", file=sys.stderr)
            if status == 404:
                break
        html = resp.text
        rows = parser(html)
        if not rows:
            # No more items; stop
            break
        for title, date, href, summary in rows:
            clean_title = normalize_space(title)
            clean_summary = normalize_space(summary)
            date_iso, year, month = parse_date_to_iso(date)
            category = categorize_article(clean_title, clean_summary, section)
            article_text = ""
            article_summary = ""
            if fetch_article and href:
                try:
                    aresp = session.get(href, timeout=45)
                    if aresp.status_code == 200:
                        article_text = extract_main_text(aresp.text)
                        if summarize and article_text:
                            article_summary = summarize_text(article_text, max_sentences=summary_sentences)
                except Exception:
                    pass
            if summarize and not article_summary and clean_summary:
                article_summary = summarize_text(clean_summary, max_sentences=summary_sentences)

            results.append(Item(
                section=section,
                page=page,
                title=clean_title,
                date=normalize_space(date),
                date_iso=date_iso,
                year=year,
                month=month,
                category=category,
                url=href,
                summary=clean_summary,
                article_summary=article_summary,
                article_text=article_text,
            ))
        pages_fetched += 1
        page += 1
        if delay > 0:
            time.sleep(delay)
    return results


def write_csv(items: List[Item], out_path: str) -> None:
    # Sort items by date (desc), then section, then title
    def sort_key(it: Item) -> Tuple[int, str, str]:
        # Use YYYYMMDD as int if available, else 0
        if it.date_iso:
            ymd = int(it.date_iso.replace("-", ""))
        else:
            ymd = 0
        return (ymd, it.section.lower(), it.title.lower())

    sorted_items = sorted(items, key=sort_key, reverse=True)

    fieldnames = [
        "section",
        "category",
        "title",
        "summary",
        "article_summary",
        "date",
        "date_iso",
        "year",
        "month",
        "url",
        "page",
    ]

    # Ensure output directory exists
    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    # Use utf-8-sig for better Excel compatibility and quote all fields for presentation
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore", quoting=csv.QUOTE_ALL)
        writer.writeheader()
        for it in sorted_items:
            writer.writerow(asdict(it))


def write_json(items: List[Item], out_path: str) -> None:
    # Ensure directory exists
    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    data = [asdict(it) for it in items]
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "count": len(items),
            "items": data,
        }, f, ensure_ascii=False, indent=2)


def main() -> None:
    ap = argparse.ArgumentParser(description=(
        "Scrape FAO Gender paginated sections to CSV/JSON. "
        "Defaults to writing outputs into public/<section>.{csv,json} (repo-relative)."
    ))
    ap.add_argument("--section", choices=list(SECTIONS.keys()), default="news",
                    help="Which section to scrape (default: news)")
    ap.add_argument("--start-page", type=int, default=1, help="Start at this page number (default: 1)")
    ap.add_argument("--max-pages", type=int, default=10,
                    help="Maximum number of pages to fetch (stops early if a page has no items). Default 10.")
    ap.add_argument("--delay", type=float, default=0.8, help="Seconds to sleep between page requests (default: 0.8)")
    ap.add_argument("--out", default=None, help=(
        "Output CSV path. If omitted, writes to public/<section>.csv"
    ))
    ap.add_argument("--json-out", default=None, help=(
        "Optional JSON output path (default: match CSV basename with .json)"
    ))
    ap.add_argument("--fetch-article", action="store_true", help="Fetch each article page and extract main text")
    ap.add_argument("--summarize", action="store_true", help="Generate an extractive summary")
    ap.add_argument("--summary-sentences", type=int, default=3, help="Number of sentences in the summary (default: 3)")
    args = ap.parse_args()

    try:
        items = scrape(
            section=args.section,
            start_page=args.start_page,
            max_pages=args.max_pages,
            delay=args.delay,
            fetch_article=args.fetch_article,
            summarize=args.summarize,
            summary_sentences=max(1, min(8, args.summary_sentences)),
        )
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)

    if not items:
        print("No items scraped. Try reducing delay, increasing max-pages, or running from a different network.")
    else:
        # Determine output paths; default to repoRoot/public/<section>.csv
        out_path = args.out
        if not out_path:
            # Resolve repository root relative to this script's directory
            script_dir = os.path.dirname(os.path.abspath(__file__))
            repo_root = os.path.dirname(script_dir)
            out_filename = f"{args.section}.csv"
            out_path = os.path.join(repo_root, "public", out_filename)

        write_csv(items, out_path)
        # Derive JSON path if not provided
        json_out = args.json_out
        if not json_out:
            base = out_path.rsplit('.', 1)[0] if '.' in out_path else out_path
            json_out = f"{base}.json"
        write_json(items, json_out)
        print(f"Wrote {len(items)} rows to {out_path} and JSON to {json_out}")

if __name__ == "__main__":
    main()
