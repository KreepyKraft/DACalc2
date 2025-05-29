from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import json

app = FastAPI()

# mount static folder for HTML/JS
app.mount("/static", StaticFiles(directory="static"), name="static")

# load item data from file (can be replaced with a DB later)
with open("data/items.json") as f:
    ITEM_DATA = json.load(f)

@app.get("/")
def read_index():
    return FileResponse("static/index.html")

@app.get("/api/items")
def get_items():
    return list(ITEM_DATA.keys())

def resolve_ingredients(item, quantity, item_data, visited=None):
    if visited is None:
        visited = set()

    if item not in item_data or item in visited:
        return {item: quantity}  # base item or unknown item

    visited.add(item)
    result = {}

    ingredients = item_data[item].get("ingredients")
    if not ingredients:
        return {item: quantity}  # item has no ingredients, treat as base

    for sub_item, sub_qty in ingredients.items():
        sub_result = resolve_ingredients(sub_item, sub_qty * quantity, item_data, visited.copy())
        for k, v in sub_result.items():
            result[k] = result.get(k, 0) + v

    return result

@app.post("/api/calculate")
async def calculate(request: Request):
    payload = await request.json()
    selections = payload.get("items", [])

    total_materials = {}
    breakdown = {}

    for selection in selections:
        item = selection["item"]
        quantity = selection["quantity"]

        if item not in ITEM_DATA:
            continue

        breakdown[item] = resolve_ingredients(item, quantity, ITEM_DATA)

        for mat, amt in breakdown[item].items():
            total_materials[mat] = total_materials.get(mat, 0) + amt

    return JSONResponse({
        "total": total_materials,
        "breakdown": breakdown
    })
