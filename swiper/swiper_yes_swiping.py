import re
import requests
from bs4 import BeautifulSoup
import json
import time
import random
import os
import difflib
from datetime import datetime

BASE_URL = "https://awakening.wiki"
CATEGORY_URL = f"{BASE_URL}/Category:Items"

USER_AGENTS = [
    # Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    # Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    # Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edge/121.0.0.0",
]

ITEMS_FILE = "data/items.json"
LOG_FILE = "data/update_log.txt"
EMPTY_ITEMS_FILE = "data/empty_items.json"


def get_random_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
    }


def load_existing_items():
    if os.path.exists(ITEMS_FILE):
        with open(ITEMS_FILE, "r", encoding="utf-16") as f:
            return json.load(
                f,
            )
    return {}


def get_item_links():
    item_links = []
    next_page = CATEGORY_URL
    while next_page:
        response = requests.get(next_page, headers=get_random_headers())
        soup = BeautifulSoup(response.text, "html.parser")
        for li in soup.select("div#mw-pages li a"):
            href = li.get("href")
            if href:
                item_links.append(BASE_URL + href)
        next_link = soup.find("a", string="next page")
        next_page = BASE_URL + next_link["href"] if next_link else None
        time.sleep(0.5)
    return item_links


def parse_item_page(url):
    resp = requests.get(url, headers=get_random_headers())
    soup = BeautifulSoup(resp.text, "html.parser")

    item_name = soup.find("h1", id="firstHeading").text.strip()

    # if item_name != "Iron Ingot": # TODO: REMOVE
    #     return item_name, [], {}

    # find the "Crafted By" marker
    crafted = soup.find("span", string="Crafted By")
    if not crafted:
        return item_name, [], {}

    # grab the very next wikitable after that span, wherever it lives
    table = crafted.find_next("table")
    if not table:
        return item_name, [], {}

    rows = table.find_all("tr")[1:]  # skip table header

    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 2:
            continue

        stations = [a["title"] for a in cols[0].find_all("a", title=True)]
        ingredients = {}

        for li in cols[1].find_all("li"):
            name_elem = li.find("a", title=True)
            text = li.get_text().strip()

            if name_elem:
                name = name_elem["title"]
            elif re.search(r"\d+\s*mL", text):
                name = "Water"
            elif text.endswith("s"):
                name = "Time"
            else:
                continue  # unknown item, skip

            try:
                if "x" in text:
                    qty = int(text.split("x")[-1])
                elif re.search(r"\d+\s*mL", text):
                    qty = int(text.split("mL")[0].strip())
                elif text.endswith("s"):
                    qty = float(text[:-1])  # float for seconds
                else:
                    qty = 1
            except ValueError:
                qty = 1  # fallback

            ingredients[name] = qty

        # only return the first matching recipe (too lazy to check if some items have more than one)
        return item_name, stations, ingredients

    return item_name, [], {}


def log_change(name, status, old=None, new=None):
    with open(LOG_FILE, "a", encoding="utf-16") as log:
        timestamp = datetime.now().isoformat()
        log.write(f"[{timestamp}] {status.upper()} - {name}\n")
        if status == "updated" and old and new:
            old_str = json.dumps(old, indent=2, ensure_ascii=False, sort_keys=True)
            new_str = json.dumps(new, indent=2, ensure_ascii=False, sort_keys=True)
            diff = difflib.unified_diff(
                old_str.splitlines(),
                new_str.splitlines(),
                fromfile="old",
                tofile="new",
                lineterm="",
            )
            for line in diff:
                log.write(f"{line}\n")
        log.write("\n")


def sort_ingredients(ingredients):
    return dict(sorted(ingredients.items(), key=lambda x: x[0].lower()))


def has_changed(old_data: dict, new_data: dict) -> bool:
    return sorted(old_data.get("fabricators", [])) != sorted(
        new_data.get("fabricators", [])
    ) or sort_ingredients(old_data.get("ingredients", {})) != sort_ingredients(
        new_data.get("ingredients", {})
    )


def swiper():
    # loads existing JSON data if it exists
    try:
        with open(ITEMS_FILE, "r", encoding="utf-16") as f:
            existing_items = json.load(f)
    except FileNotFoundError:
        existing_items = {}

    updated_items = {}
    seen_items = set()
    changes_made = False
    empty_items = []

    # clears previous log
    with open(LOG_FILE, "w", encoding="utf-16") as f:
        f.write(f"=== Update Log: {datetime.now().isoformat()} ===\n\n")

    item_links = get_item_links()

    for link in item_links:
        try:
            name, fabricators, ingredients = parse_item_page(link)
            if not name:
                continue

            if not ingredients:
                empty_items.append(name)

            seen_items.add(name)

            new_data = {
                "fabricators": sorted(
                    [s.replace(" (page does not exist)", "") for s in fabricators],
                    key=str.lower,
                ),
                "ingredients": sort_ingredients(ingredients),
            }

            if name not in existing_items:
                print(f"+ Added: {name}")
                log_change(name, "added", new=new_data)
                changes_made = True
            elif has_changed(existing_items[name], new_data):
                print(f"~ Updated: {name}")
                log_change(name, "updated", old=existing_items[name], new=new_data)
                changes_made = True
            else:
                print(f"= Unchanged: {name} -- Not logging")
                # log_change(name, "unchanged")

            updated_items[name] = new_data

        except Exception as e:
            print(f"Failed to parse {link}: {e}")
        time.sleep(0.5)

    # preserve missing items - for manually added or deleted (for any reason) from wiki
    missing = set(existing_items) - seen_items
    for name in missing:
        updated_items[name] = existing_items[name]
        print(f"- Missing from wiki (preserved): {name}")
        log_change(name, "missing (preserved)")

    # save to file sorted alphabetically both ingredients, fabricators and key themselves
    sorted_items = dict(sorted(updated_items.items(), key=lambda x: x[0].lower()))
    with open(ITEMS_FILE, "w", encoding="utf-16") as f:
        json.dump(sorted_items, f, indent=2, ensure_ascii=False)

    with open(EMPTY_ITEMS_FILE, "w", encoding="utf-16") as f:
        json.dump(empty_items, f, indent=2, ensure_ascii=False)

    if changes_made or missing:
        print(f"\nLog of changes written to: {LOG_FILE}")
    else:
        print(f"\nNo changes made. {LOG_FILE} still updated with status logs.")


if __name__ == "__main__":
    swiper()
