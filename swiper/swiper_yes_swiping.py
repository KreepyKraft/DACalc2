import re
import requests
from bs4 import BeautifulSoup
import json
import time
import random

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

def get_random_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        # "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        # "Accept-Encoding": "gzip, deflate, br",
        # "Accept-Language": "en-US,en;q=0.5",
        # "Connection": "keep-alive",
    }

def get_item_links():
    item_links = []
    next_page = CATEGORY_URL
    while next_page:
        response = requests.get(next_page, headers=get_random_headers())
        soup = BeautifulSoup(response.text, 'html.parser')
        for li in soup.select('div#mw-pages li a'):
            href = li.get('href')
            if href:
                item_links.append(BASE_URL + href)
        next_link = soup.find('a', string='next page')
        if next_link:
            next_page = BASE_URL + next_link.get('href')
            time.sleep(0.5)
        else:
            next_page = None
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

        # for the stations it can be crafted at
        stations = []
        for a in cols[0].find_all("a", title=True):
            stations.append(a['title'])

        # for ingredients and quantities including time and water
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
                if 'x' in text:
                    qty = int(text.split('x')[-1])
                elif re.search(r"\d+\s*mL", text):
                    qty = int(text.split('mL')[0].strip())
                elif text.endswith("s"):
                    qty = float(text[:-1])  # use float for seconds
                else:
                    qty = 1
            except ValueError:
                qty = 1  # fallback

            ingredients[name] = qty

        # only return the first matching recipe (too lazy to check if some items have more than one)
        return item_name, stations, ingredients

    return item_name, [], {}

def main():
    item_links = get_item_links()
    all_items = {}
    for link in item_links:
        try:
            name, crafting_stations, ingredients = parse_item_page(link)
            if name:
                print(name)
                all_items[name] = {"fabricators": crafting_stations, "ingredients": ingredients}
                print(all_items[name])
        except Exception as e:
            print(f"Failed to parse {link}: {e}")
        time.sleep(0.5)
    with open("items.json", "w", encoding="utf-8") as f:
        json.dump(all_items, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
