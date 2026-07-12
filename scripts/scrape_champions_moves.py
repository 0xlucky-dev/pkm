"""
scrape_champions_moves.py — Fetch move data from the Poké Champions API for
every Pokemon in its roster (~312 species, competitive-legal Pokemon only),
then merge NEW moves (ones we don't already have in
data/shared/move-types.json) into that shared file.

The Champions roster is NOT a full Pokedex — it only includes Pokemon
actually usable in Pokemon Champions (VGC-style game). We match roster
entries to our own species list by national dex number, then fetch moves
using the roster's exact `apiName` slug.

Usage:
    python scripts/scrape_champions_moves.py
"""

import json
import os
import time
import logging

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger(__name__)

API_BASE = "https://poke-api-878796745474.asia-east1.run.app/api/roster/pokemon"
API_KEY = "f6d8340168e7271847b98edd66b3d804d622ca6b1d908d32"
RATE_LIMIT_DELAY = 0.6

HEADERS = {
    "accept": "application/json, text/plain, */*",
    "origin": "https://victorpoke-champions.com",
    "referer": "https://victorpoke-champions.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "x-api-key": API_KEY,
}

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
MOVE_TYPES_PATH = os.path.join(DATA_DIR, "shared", "move-types.json")
CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_champions_moves_cache.json")


def fetch_roster():
    resp = requests.get(API_BASE, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.json()


def load_cache():
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def fetch_moves(api_name: str):
    url = f"{API_BASE}/{api_name}/moves"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None, f"HTTP {resp.status_code}"
        return resp.json(), None
    except requests.RequestException as e:
        return None, str(e)


def main():
    logger.info("Fetching Champions roster...")
    roster = fetch_roster()
    logger.info(f"Roster has {len(roster)} entries (competitive-legal Pokemon forms)")

    cache = load_cache()
    logger.info(f"Cache has {len(cache)} already-processed entries")

    with open(MOVE_TYPES_PATH, "r", encoding="utf-8") as f:
        move_types = json.load(f)
    existing_moves_lower = {k.lower(): k for k in move_types.keys()}
    logger.info(f"Existing move-types.json has {len(move_types)} moves")

    new_moves = {}
    errors = []

    for idx, entry in enumerate(roster, 1):
        api_name = entry.get("apiName")
        display_name = entry.get("displayName")
        if not api_name:
            continue
        if api_name in cache:
            continue

        logger.info(f"[{idx}/{len(roster)}] {display_name} ({api_name})")
        time.sleep(RATE_LIMIT_DELAY)

        moves_data, err = fetch_moves(api_name)
        if err:
            logger.warning(f"  SKIP ({err})")
            cache[api_name] = {"error": err}
            errors.append(api_name)
            continue

        if not isinstance(moves_data, list):
            cache[api_name] = {"error": "bad shape"}
            continue

        found_new = 0
        for mv in moves_data:
            mv_display_name = mv.get("displayName")
            move_type = mv.get("type")
            if not mv_display_name or not move_type:
                continue
            if mv_display_name.lower() not in existing_moves_lower:
                type_titled = move_type.capitalize()
                new_moves[mv_display_name] = type_titled
                existing_moves_lower[mv_display_name.lower()] = mv_display_name
                found_new += 1

        cache[api_name] = {"count": len(moves_data), "new": found_new}
        if found_new:
            logger.info(f"  +{found_new} new moves")

        if idx % 20 == 0:
            save_cache(cache)

    save_cache(cache)

    if new_moves:
        move_types.update(new_moves)
        sorted_moves = dict(sorted(move_types.items()))
        with open(MOVE_TYPES_PATH, "w", encoding="utf-8") as f:
            json.dump(sorted_moves, f, ensure_ascii=False)
        logger.info(f"Added {len(new_moves)} NEW moves to move-types.json")
        for name, mtype in sorted(new_moves.items()):
            logger.info(f"  + {name}: {mtype}")
    else:
        logger.info("No new moves found — move-types.json already complete for this roster")

    if errors:
        logger.warning(f"{len(errors)} entries failed: {errors[:20]}{'...' if len(errors) > 20 else ''}")

    logger.info("Done.")


if __name__ == "__main__":
    main()
