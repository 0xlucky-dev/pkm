"""
Submit a Pokémon trade order to the zeldaxiaoma save_order.php endpoint.

WARNING: This calls a third-party API (pokemon.zeldaxiaoma.com) that is not
ours and has no public documentation. Use for personal/manual testing only —
do not run this in a loop or as part of automated mass requests, as that could
overload their server or violate their terms of use.

Usage:
    python scripts/submit_order.py
    python scripts/submit_order.py --command-file my_order.txt
"""

import argparse
import json
import sys

import requests

API_URL = "https://poke.zeldaxiaoma.com/pokemon/api/save_order.php"
REFERRER_SV  = "https://poke.zeldaxiaoma.com/pokemon/?lang=en-US&version=gen9"
REFERRER_ZA  = "https://poke.zeldaxiaoma.com/pokemon/?lang=en-US&version=gen9a"
REFERRER = REFERRER_SV  # default

# Default multi-Pokémon command block, exactly as captured from the browser
# request (no leading "%h " prefix — the endpoint does not require it).
DEFAULT_COMMAND = """Bulbasaur (M)
Level: 70
Shiny: Yes
Alpha: Yes
.Version=52
Ball: Master Ball
.Nature=Hardy
Hardy Nature
Friendship: 255
EVs: 252 HP / 252 Atk / 6 Def
IVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe
OT: 0xLuckyDev
Language: English
-Body Slam
-Double-Edge
-Endure
-Facade

Charizard (M)
Level: 100
Shiny: Yes
Alpha: Yes
.Version=52
Ball: Net Ball
IVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe
OT: 0xLuckyDev
Language: English

Venusaur (M)
Level: 100
Shiny: Yes
Alpha: Yes
.Version=52
Ball: Ultra Ball
Friendship: 255
EVs: 252 HP / 252 Atk / 6 Def
IVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe
OT: 0xLuckyDev
OTGender: Male
Language: English

Weedle (M)
Level: 50
.Version=52
Ball: Great Ball
.Nature=Hardy
Hardy Nature
Language: English

Squirtle (M)
Level: 63
.Version=52
Language: English

Pidgeotto (M)
Level: 51
.Version=52
Language: English

Clefable (M)
Level: 64
.Version=52
Language: English"""


def build_headers():
    """Mirror the headers seen in the captured browser fetch() call."""
    return {
        "accept": "*/*",
        "accept-language": "th,en-US;q=0.9,en;q=0.8,kri;q=0.7",
        "content-type": "application/json",
        "referer": REFERRER,
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    }


def submit_order(command: str, mode: str = "home", version: str = "gen9") -> dict:
    """
    POST a command block to save_order.php.
    """
    referrer = REFERRER_ZA if version in ("gen9a", "za") else REFERRER_SV
    payload = {"command": command, "mode": mode}
    resp = requests.post(
        API_URL,
        headers={**build_headers(), "referer": referrer},
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description="Submit a trade order to save_order.php")
    parser.add_argument(
        "--command-file",
        help="Path to a text file containing the %%h-style command block. "
             "If omitted, uses the built-in DEFAULT_COMMAND.",
    )
    parser.add_argument(
        "--mode",
        default="home",
        help="Value for the 'mode' field (default: home).",
    )
    parser.add_argument(
        "--version",
        default="gen9",
        choices=["gen9", "gen9a", "sv", "za"],
        help="Game version: gen9/sv = Scarlet/Violet, gen9a/za = Legends Z-A (default: gen9)",
    )
    args = parser.parse_args()

    if args.command_file:
        with open(args.command_file, "r", encoding="utf-8") as f:
            command = f.read().rstrip("\n")
    else:
        command = DEFAULT_COMMAND

    try:
        result = submit_order(command, mode=args.mode, version=args.version)
    except requests.RequestException as err:
        print(f"Request failed: {err}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result.get("success") and result.get("order"):
        print(f"\n%order {result['order']}")


if __name__ == "__main__":
    main()
