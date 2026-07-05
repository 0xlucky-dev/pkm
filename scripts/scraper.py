"""
scraper.py — Phase 1 Data Acquisition Script

Calls the reference site's JSON API (api.php) directly using only Referer +
User-Agent headers (no cookies, no main-page visit), downloads sprites, and
writes static JSON files for the Pokemon Generator web app.

Requirements traced: 13.1, 13.2, 13.7, 13.8
"""

import argparse
import json
import logging
import os
import re
import sys
import time

import requests

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Constants ───────────────────────────────────────────────────────────────

BASE_API_URL = "https://pokemon.zeldaxiaoma.com/pokemon/api.php"
LANG = "en-US"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/149.0.0.0 Safari/537.36"
)

RATE_LIMIT_DELAY = 0.5  # seconds between successive API calls

MAX_RETRIES = 3
BACKOFF_DELAYS = [1, 2, 4]  # exponential backoff delays in seconds


# ─── Session Builder ─────────────────────────────────────────────────────────

def build_session(version: str = "gen9a") -> requests.Session:
    """
    Build and return a requests.Session configured with the required headers.

    The session sets:
      - Referer: https://pokemon.zeldaxiaoma.com/pokemon/?lang=en-US&version={version}
      - User-Agent: browser-like Chrome UA string

    No cookies are set or bootstrapped. No main-page visit is performed.
    The session is used purely for connection reuse (keep-alive).

    Requirements: 13.1, 13.2
    """
    session = requests.Session()
    session.headers.update({
        "Referer": f"https://pokemon.zeldaxiaoma.com/pokemon/?lang={LANG}&version={version}",
        "User-Agent": USER_AGENT,
    })
    # Explicitly clear any cookies to ensure no cookie bootstrap
    session.cookies.clear()
    return session


# ─── Rate Limiting ───────────────────────────────────────────────────────────

def rate_limit():
    """
    Enforce a delay between successive API calls (~0.5s).

    Requirement: 13.7
    """
    time.sleep(RATE_LIMIT_DELAY)


# ─── Retry with Exponential Backoff ─────────────────────────────────────────

def call_with_backoff(fn, *args, **kwargs):
    """
    Call `fn(*args, **kwargs)` with retry logic on failure.

    Retries up to 3 times with exponential backoff (1s, 2s, 4s) when:
      - A network error occurs (ConnectionError, Timeout)
      - The response has a 5xx status code

    On success (2xx/3xx/4xx non-5xx), returns the response immediately.
    On exhausting all retries, raises the last exception or returns the
    last 5xx response.

    Requirement: 13.8
    """
    last_exception = None
    last_response = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = fn(*args, **kwargs)
            # If it's a 5xx server error, treat as retryable
            if response.status_code >= 500:
                last_response = response
                if attempt < MAX_RETRIES:
                    delay = BACKOFF_DELAYS[attempt]
                    logger.warning(
                        f"Server error {response.status_code}, "
                        f"retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})"
                    )
                    time.sleep(delay)
                    continue
                else:
                    logger.error(
                        f"Server error {response.status_code} after "
                        f"{MAX_RETRIES} retries, giving up"
                    )
                    return response
            # Non-5xx response — success (even if 4xx, that's not retryable)
            return response

        except (requests.ConnectionError, requests.Timeout) as e:
            last_exception = e
            if attempt < MAX_RETRIES:
                delay = BACKOFF_DELAYS[attempt]
                logger.warning(
                    f"Network error: {type(e).__name__}, "
                    f"retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})"
                )
                time.sleep(delay)
            else:
                logger.error(
                    f"Network error after {MAX_RETRIES} retries: {e}"
                )
                raise

    # Should not reach here, but just in case
    if last_exception:
        raise last_exception
    return last_response


# ─── Per-Pokemon API Calls ────────────────────────────────────────────────────

def get_forms_list(session, sp_number, version):
    """
    PRIMARY per-Pokemon data source.

    GET api.php?action=get_forms_list&sp_number={sp_number}&version={version}&lang=en-US

    Returns the parsed JSON response as-is — a dict with `success` (bool) and
    `data` (list of form objects). Each form carries English fields (SpNameEn,
    FormsNameEn, AbilityEn, MoveEn), capability flags (IsShiny, CanAlpha,
    CanAlphaShiny, CanGigantamax), LevelMax, and sprite URLs.

    Requirement: 13.3
    """
    url = (
        f"{BASE_API_URL}?action=get_forms_list"
        f"&sp_number={sp_number}&version={version}&lang={LANG}"
    )
    resp = call_with_backoff(session.get, url, timeout=30)
    return resp.json()


def get_pokemon_info(session, sp_number, version):
    """
    OPTIONAL / supplementary per-Pokemon call.

    GET api.php?action=get_pokemon_info&sp_number={sp_number}&version={version}&lang=en-US

    Returns the parsed JSON response as-is — a dict with `success` (bool) and
    `data` (a single summary object containing forms_count, default images,
    level_max, etc.). Largely redundant given get_forms_list.

    Requirement: 13.3
    """
    url = (
        f"{BASE_API_URL}?action=get_pokemon_info"
        f"&sp_number={sp_number}&version={version}&lang={LANG}"
    )
    resp = call_with_backoff(session.get, url, timeout=30)
    return resp.json()


def get_form_info(session, sp_number, form_index, version):
    """
    OPTIONAL per-Pokemon/form call.

    GET api.php?action=get_form_info&sp_number={sp_number}&forms={form_index}&version={version}&lang=en-US

    Returns the parsed JSON response as-is — info for a single specific form.
    Use when only one form's detail is needed rather than the full get_forms_list array.

    Requirement: 13.3
    """
    url = (
        f"{BASE_API_URL}?action=get_form_info"
        f"&sp_number={sp_number}&forms={form_index}&version={version}&lang={LANG}"
    )
    resp = call_with_backoff(session.get, url, timeout=30)
    return resp.json()


# ─── Form Extraction ─────────────────────────────────────────────────────────

def _clean_move_name(move: str) -> str:
    """
    Remove any [type] prefix from a move name if present.

    The MoveEn field should already have clean English names, but MoveCh/MoveTw
    sometimes use "[type] name" format. This handles any edge cases where a
    prefix like "[Normal] Tackle" might appear in MoveEn.

    Returns the cleaned move name with leading/trailing whitespace stripped.
    """
    # Remove leading [anything] prefix (e.g. "[Normal] Tackle" → "Tackle")
    cleaned = re.sub(r"^\[.*?\]\s*", "", move)
    return cleaned.strip()


def extract_forms(forms_response: dict) -> list:
    """
    Map get_forms_list response `data[]` into Form objects using ENGLISH-ONLY fields.

    Input: the full response dict from get_forms_list ({"success": true, "data": [...]}).
    Output: a list of Form dicts.

    Each Form dict contains:
      - name: from SpNameEn
      - formName: FormsNameEn or FormsName (fall back when FormsNameEn is "")
      - formIndex: from Forms (integer)
      - abilities: [a for a in AbilityEn if a] (filter empty strings from 3-slot array)
      - moves: MoveEn (clean move names, no [type] prefix)
      - canShiny: from IsShiny
      - canAlpha: from CanAlpha
      - canAlphaShiny: from CanAlphaShiny
      - canGigantamax: from CanGigantamax
      - levelMax: from LevelMax
      - spriteNormal: from SpImageURL
      - spriteShiny: from SpImageURL_Shiny
      - spriteGmax: from SpImageURL_GMax
      - spriteShinyGmax: from SpImageURL_Shiny_GMax

    All *Ch / *Tw fields are DISCARDED.

    Requirements: 14.1, 14.2, 14.3, 14.4
    """
    data = forms_response.get("data", [])
    forms = []

    for raw_form in data:
        # Name from SpNameEn
        name = raw_form.get("SpNameEn", "")

        # Form name: prefer FormsNameEn, fall back to FormsName when empty
        form_name_en = raw_form.get("FormsNameEn", "")
        form_name = form_name_en if form_name_en else raw_form.get("FormsName", "")

        # Form index from Forms (integer)
        form_index = int(raw_form.get("Forms", 0))

        # Abilities: filter out empty strings from the 3-slot AbilityEn array
        ability_en = raw_form.get("AbilityEn", [])
        abilities = [a for a in ability_en if a]

        # Moves: use MoveEn, clean any [type] prefix if present
        move_en = raw_form.get("MoveEn", [])
        moves = [_clean_move_name(m) for m in move_en if m]

        # Capability flags
        can_shiny = bool(raw_form.get("IsShiny", False))
        can_alpha = bool(raw_form.get("CanAlpha", False))
        can_alpha_shiny = bool(raw_form.get("CanAlphaShiny", False))
        can_gigantamax = bool(raw_form.get("CanGigantamax", False))

        # Level max
        level_max = int(raw_form.get("LevelMax", 100))

        # Sprite URLs
        sprite_normal = raw_form.get("SpImageURL", "")
        sprite_shiny = raw_form.get("SpImageURL_Shiny", "")
        sprite_gmax = raw_form.get("SpImageURL_GMax", "")
        sprite_shiny_gmax = raw_form.get("SpImageURL_Shiny_GMax", "")

        form = {
            "name": name,
            "formName": form_name,
            "formIndex": form_index,
            "abilities": abilities,
            "moves": moves,
            "canShiny": can_shiny,
            "canAlpha": can_alpha,
            "canAlphaShiny": can_alpha_shiny,
            "canGigantamax": can_gigantamax,
            "levelMax": level_max,
            "spriteNormal": sprite_normal,
            "spriteShiny": sprite_shiny,
            "spriteGmax": sprite_gmax,
            "spriteShinyGmax": sprite_shiny_gmax,
        }
        forms.append(form)

    return forms


# ─── Pokemon List Acquisition ────────────────────────────────────────────────

def get_pokemon_list(session: requests.Session, version: str) -> list:
    """
    PRIMARY list source. Call api.php?action=get_pokemon_list&version={version}&lang=en-US
    to obtain the per-version Pokemon list.

    Returns [{"sp_number": int, "dex": int, "name": str}, ...].

    The API response shape is { success: true, data: [...] }. Each element in
    data contains at minimum a sp_number and name. Since the exact field names
    from the API haven't been fully captured in the design, we handle common
    variations (sp_number/SpNumber, dex/Dex/DexNumber, name/Name/SpNameEn).

    Requirements: 12.1
    """
    url = f"{BASE_API_URL}?action=get_pokemon_list&version={version}&lang={LANG}"
    rate_limit()
    response = call_with_backoff(session.get, url)
    response.raise_for_status()

    payload = response.json()
    if not payload.get("success"):
        logger.error(f"get_pokemon_list failed: {payload.get('message', 'unknown error')}")
        return []

    raw_data = payload.get("data", [])
    pokemon_list = []

    for entry in raw_data:
        # Extract sp_number — try common field names
        sp_number = (
            entry.get("sp_number")
            or entry.get("SpNumber")
            or entry.get("sp")
            or entry.get("value")
        )
        if sp_number is None:
            continue
        sp_number = int(sp_number)

        # Extract name — try common field names
        name = (
            entry.get("name")
            or entry.get("Name")
            or entry.get("SpNameEn")
            or entry.get("SpName")
            or ""
        )

        # Extract dex — may be same as sp_number, or may be a separate field
        dex = entry.get("dex") or entry.get("Dex") or entry.get("DexNumber")
        if dex is not None:
            dex = int(dex)
        else:
            # Default: dex equals sp_number (they're the same for standard Pokemon)
            dex = sp_number

        pokemon_list.append({
            "sp_number": sp_number,
            "dex": dex,
            "name": name,
        })

    logger.info(f"get_pokemon_list({version}): retrieved {len(pokemon_list)} Pokemon")
    return pokemon_list


def parse_pokemon_list(pkdata_path: str) -> list:
    """
    OPTIONAL FALLBACK / cross-check only. Parse the local HTML dropdown file
    (pkdata/violet or pkdata/pokemon za).

    Each Pokemon entry is a <div> element like:
      <div data-value="{sp_number}" class="option" ...>#{dex} {name}</div>

    Where:
      - data-value is the sp_number (internal ID)
      - The text content is "#{dex:03d} {name}" (dex is zero-padded)
      - sp_number and dex can differ

    Returns [{"sp_number": int, "dex": int, "name": str}, ...].

    Requirements: 12.2, 12.3
    """
    import re

    with open(pkdata_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Match pattern: data-value="{sp_number}" ... class="option" ... >#{dex} {name}</div>
    # The div may have extra attributes (data-selectable, role, id, aria-selected)
    pattern = re.compile(
        r'data-value="(\d+)"[^>]*class="option[^"]*"[^>]*>'
        r'#(\d+)\s+(.+?)</div>',
        re.DOTALL,
    )

    pokemon_list = []
    for match in pattern.finditer(content):
        sp_number = int(match.group(1))
        dex = int(match.group(2))
        name = match.group(3).strip()
        pokemon_list.append({
            "sp_number": sp_number,
            "dex": dex,
            "name": name,
        })

    logger.info(f"parse_pokemon_list({pkdata_path}): parsed {len(pokemon_list)} Pokemon")
    return pokemon_list


def validate_against_csv(pokemon_list: list, csv_dir: str = None) -> None:
    """
    Cross-reference the parsed Pokemon list against PokemonData/*.csv files
    for name/dex COMPLETENESS ONLY. No base stats are imported.

    Reads all gen01.csv through gen09.csv in the csv_dir. For each Pokemon in
    pokemon_list, checks that its dex number (ID) exists in the combined CSV
    dataset. Logs a warning for any missing IDs but does not fail.

    Requirements: 12.4
    """
    import csv
    import glob

    if csv_dir is None:
        # Default path relative to the workspace root
        csv_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "PokemonData",
        )

    # Collect all IDs from CSV files
    csv_ids = set()
    csv_pattern = os.path.join(csv_dir, "gen*.csv")
    csv_files = sorted(glob.glob(csv_pattern))

    if not csv_files:
        logger.warning(f"No CSV files found at {csv_pattern}; skipping completeness check")
        return

    for csv_file in csv_files:
        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        csv_ids.add(int(row["ID"]))
                    except (ValueError, KeyError):
                        continue
        except OSError as e:
            logger.warning(f"Could not read CSV file {csv_file}: {e}")

    logger.info(f"CSV completeness check: loaded {len(csv_ids)} unique IDs from {len(csv_files)} files")

    # Check each Pokemon's dex against the CSV IDs
    missing_count = 0
    for pokemon in pokemon_list:
        dex = pokemon.get("dex")
        if dex is not None and dex not in csv_ids:
            logger.warning(
                f"Pokemon '{pokemon.get('name', '?')}' (dex={dex}) not found in CSV files"
            )
            missing_count += 1

    if missing_count:
        logger.warning(f"CSV completeness check: {missing_count} Pokemon missing from CSV data")
    else:
        logger.info("CSV completeness check: all Pokemon IDs found in CSV data")


# ─── CLI Argument Parsing ────────────────────────────────────────────────────

def parse_args(argv=None):
    """
    Parse command-line arguments for the scraper.

    --version: Game version to scrape (gen9 or gen9a)
    --output:  Output directory for data files (default: ./data)
    """
    parser = argparse.ArgumentParser(
        description="Pokemon data acquisition script — scrapes the reference API "
                    "and writes static JSON files for the web app.",
    )
    parser.add_argument(
        "--version",
        type=str,
        choices=["gen9", "gen9a"],
        required=True,
        help="Game version to scrape: gen9 (Scarlet/Violet) or gen9a (Pokemon ZA)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./data",
        help="Output directory for data files (default: ./data)",
    )
    return parser.parse_args(argv)


# ─── JSON File Writer ────────────────────────────────────────────────────────

def write_json(path: str, data) -> None:
    """
    Write `data` as JSON to `path` with UTF-8 encoding and 2-space indentation.

    Creates parent directories if they do not exist.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info(f"Wrote {path}")


# ─── Sprite Download ─────────────────────────────────────────────────────────

def download_sprite(session: requests.Session, url: str, out_dir: str) -> str:
    """
    Download a sprite PNG from the embedded SpImageURL* field into out_dir.

    - If url is empty or None, returns empty string (some sprites like
      SpImageURL_GMax may be "").
    - Extracts the filename from the URL path (e.g.
      poke_capture_0001_000_mf_n_00000000_f_n.png).
    - If the file already exists locally (same filename), skips re-downloading.
    - Uses call_with_backoff for retries on failure.
    - Returns the local relative path (e.g. sprites/poke_capture_0001_...png)
      for embedding in the JSON output.
    - On final failure after retries, logs a warning and returns empty string.

    Requirements: 14.5, 14.6
    """
    if not url:
        return ""

    # Extract filename from URL path
    filename = url.rsplit("/", 1)[-1]
    if not filename:
        return ""

    # Ensure output directory exists
    os.makedirs(out_dir, exist_ok=True)

    local_path = os.path.join(out_dir, filename)

    # Skip if already cached locally
    if os.path.exists(local_path):
        return f"sprites/{filename}"

    # Download with retry/backoff
    try:
        response = call_with_backoff(session.get, url, timeout=30)
        if response.status_code != 200:
            logger.warning(
                f"Sprite download failed (HTTP {response.status_code}): {url}"
            )
            return ""
        with open(local_path, "wb") as f:
            f.write(response.content)
        return f"sprites/{filename}"
    except (requests.ConnectionError, requests.Timeout, requests.RequestException) as e:
        logger.warning(f"Sprite download failed after retries: {url} — {e}")
        return ""


# ─── Option-List Acquisition ────────────────────────────────────────────────

def get_balls_list(session: requests.Session, version: str) -> list:
    """
    Fetch the per-version Poke Ball list from the reference API.

    GET api.php?action=get_balls_list&version={version}&lang=en-US

    Returns a list of ball entries: [{"value": int, "name": str, "icon": str}, ...]
    The result is also written to data/{version}/balls.json.

    Requirements: 13.4, 14.8, 15.2
    """
    url = f"{BASE_API_URL}?action=get_balls_list&version={version}&lang={LANG}"
    logger.info(f"Fetching balls list for version={version}")

    response = call_with_backoff(session.get, url, timeout=30)
    response.raise_for_status()

    payload = response.json()

    # Extract ball entries from the response
    # Expected: { "success": true, "data": [...] }
    raw_data = payload.get("data", payload)

    # If raw_data is not a list (e.g. the response is just the array), handle it
    if isinstance(raw_data, dict):
        # Fallback: maybe the whole payload is the list
        raw_data = payload if isinstance(payload, list) else []

    balls = []
    for entry in raw_data:
        ball = {
            "value": int(entry.get("value", entry.get("Value", 0))),
            "name": str(entry.get("name", entry.get("Name", entry.get("NameEn", "")))),
            "icon": str(entry.get("icon", entry.get("Icon", entry.get("img", "")))),
        }
        balls.append(ball)

    logger.info(f"Fetched {len(balls)} balls for version={version}")
    return balls


def get_version_codes(session: requests.Session) -> dict:
    """
    Fetch the static Version_Code.json and extract data[0] as the version codes.

    URL: https://pokemon.zeldaxiaoma.com/pokemon/Version_Code.json

    This is a static JSON file, NOT an api.php call. The response is an array;
    we use data[0] (the first element) as the version codes mapping.
    Written to data/shared/versionCodes.json.

    Requirements: 13.5, 14.9, 15.3
    """
    url = "https://pokemon.zeldaxiaoma.com/pokemon/Version_Code.json"
    logger.info("Fetching Version_Code.json")

    response = call_with_backoff(session.get, url, timeout=30)
    response.raise_for_status()

    payload = response.json()

    # The response is an array; use data[0] as the version codes mapping
    if isinstance(payload, list) and len(payload) > 0:
        version_codes = payload[0]
    else:
        # Fallback: use the whole payload if it's already an object
        version_codes = payload

    logger.info(f"Fetched version codes ({type(version_codes).__name__})")
    return version_codes


# ─── Version Orchestration ────────────────────────────────────────────────────

# Mapping from version to local pkdata file for optional cross-check
PKDATA_MAP = {
    "gen9": os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "pkdata", "violet",
    ),
    "gen9a": os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "pkdata", "pokemon za",
    ),
}


def scrape_version(version: str, output_dir: str) -> None:
    """
    Orchestrate the full data acquisition for one game version.

    Steps:
      1. Build session with proper headers
      2. Get Pokemon list from API (primary source)
      3. Optionally cross-check against local pkdata
      4. Run CSV completeness check
      5. Fetch per-version ball list → data/{version}/balls.json
      6. Fetch version codes → data/shared/versionCodes.json
      7. Write data/{version}/pokemon-list.json
      8. Loop over each Pokemon: fetch forms, download sprites, write per-Pokemon JSON
      9. Print end-of-run summary

    Requirements: 13.7, 13.8, 13.9, 13.10, 14.7, 14.8, 14.9, 14.10, 18.1
    """
    start_time = time.time()
    skipped = []

    # ── 1. Build session ──────────────────────────────────────────────────────
    logger.info(f"Building session for version={version}")
    session = build_session(version=version)

    # ── 2. Get Pokemon list from API (PRIMARY source) ─────────────────────────
    logger.info("Fetching Pokemon list from API (primary source)...")
    pokemon_list = get_pokemon_list(session, version)
    if not pokemon_list:
        logger.error("Failed to retrieve Pokemon list from API. Aborting.")
        return

    # ── 3. Optional cross-check against local pkdata ──────────────────────────
    pkdata_path = PKDATA_MAP.get(version)
    if pkdata_path and os.path.exists(pkdata_path):
        logger.info(f"Cross-checking against local pkdata: {pkdata_path}")
        local_list = parse_pokemon_list(pkdata_path)
        api_sp_numbers = {p["sp_number"] for p in pokemon_list}
        local_sp_numbers = {p["sp_number"] for p in local_list}
        missing_from_api = local_sp_numbers - api_sp_numbers
        extra_in_api = api_sp_numbers - local_sp_numbers
        if missing_from_api:
            logger.warning(
                f"pkdata has {len(missing_from_api)} sp_numbers not in API list: "
                f"{sorted(missing_from_api)[:10]}{'...' if len(missing_from_api) > 10 else ''}"
            )
        if extra_in_api:
            logger.info(
                f"API has {len(extra_in_api)} sp_numbers not in pkdata "
                f"(API is authoritative, this is expected)"
            )
    else:
        logger.info("pkdata file not found; skipping local cross-check")

    # ── 4. CSV completeness check ─────────────────────────────────────────────
    logger.info("Running CSV completeness check...")
    validate_against_csv(pokemon_list)

    # ── 5. Fetch per-version ball list ────────────────────────────────────────
    logger.info(f"Fetching balls list for version={version}...")
    rate_limit()
    balls = get_balls_list(session, version)
    balls_path = os.path.join(output_dir, version, "balls.json")
    write_json(balls_path, balls)

    # ── 6. Fetch version codes ────────────────────────────────────────────────
    logger.info("Fetching version codes...")
    rate_limit()
    version_codes = get_version_codes(session)
    version_codes_path = os.path.join(output_dir, "shared", "versionCodes.json")
    write_json(version_codes_path, version_codes)

    # ── 7. Write pokemon-list.json ────────────────────────────────────────────
    pokemon_list_path = os.path.join(output_dir, version, "pokemon-list.json")
    write_json(pokemon_list_path, pokemon_list)

    # ── 8. Loop over each Pokemon ─────────────────────────────────────────────
    sprites_dir = os.path.join(
        os.path.dirname(output_dir) if os.path.basename(output_dir) == "data" else os.path.dirname(os.path.abspath(output_dir)),
        "public", "sprites",
    )
    # Normalize: if output_dir is "./data", sprites go to "./public/sprites"
    # The project root is one level up from output_dir when output_dir ends with "data"
    project_root = os.path.dirname(os.path.abspath(output_dir))
    sprites_dir = os.path.join(project_root, "public", "sprites")

    total = len(pokemon_list)
    scraped_count = 0

    for idx, pokemon_entry in enumerate(pokemon_list, start=1):
        sp_number = pokemon_entry["sp_number"]
        name = pokemon_entry.get("name", f"sp#{sp_number}")
        dex = pokemon_entry.get("dex", sp_number)

        logger.info(f"[{idx}/{total}] Processing sp_number={sp_number} ({name})...")

        # Rate limit before the API call
        rate_limit()

        # Fetch forms list
        forms_response = get_forms_list(session, sp_number, version)

        # Check for success: false → skip
        if not forms_response.get("success", False):
            msg = forms_response.get("message", "unknown error")
            logger.warning(f"  SKIPPED sp_number={sp_number} ({name}): success=false — {msg}")
            skipped.append(sp_number)
            continue

        # Extract forms
        forms = extract_forms(forms_response)

        # Download sprites for each form and replace URLs with local paths
        for form in forms:
            for sprite_key in ("spriteNormal", "spriteShiny", "spriteGmax", "spriteShinyGmax"):
                sprite_url = form.get(sprite_key, "")
                if sprite_url:
                    local_path = download_sprite(session, sprite_url, sprites_dir)
                    form[sprite_key] = local_path

        # Build the detail dict
        pokemon_detail = {
            "id": sp_number,
            "name": name,
            "dexNum": dex,
            "forms": forms,
        }

        # Write per-Pokemon JSON file
        pokemon_json_path = os.path.join(output_dir, version, "pokemon", f"{sp_number}.json")
        write_json(pokemon_json_path, pokemon_detail)

        scraped_count += 1

    # ── 9. End-of-run summary ─────────────────────────────────────────────────
    elapsed = time.time() - start_time
    logger.info("=" * 60)
    logger.info(f"SCRAPE COMPLETE for version={version}")
    logger.info(f"  Total in list:  {total}")
    logger.info(f"  Scraped:        {scraped_count}")
    logger.info(f"  Skipped:        {len(skipped)}")
    if skipped:
        logger.info(f"  Skipped sp_numbers: {skipped}")
    logger.info(f"  Elapsed time:   {elapsed:.1f}s")
    logger.info("=" * 60)


# ─── Main Entry Point ────────────────────────────────────────────────────────

def main():
    """
    Main entry point for the scraper.

    Parses CLI args, ensures output directories exist, and calls scrape_version()
    to orchestrate the full data acquisition pipeline.

    Requirements: 18.1
    """
    start_time = time.time()
    args = parse_args()

    logger.info(f"Starting scraper for version: {args.version}")
    logger.info(f"Output directory: {args.output}")

    # Ensure output directories exist
    version_pokemon_dir = os.path.join(args.output, args.version, "pokemon")
    shared_dir = os.path.join(args.output, "shared")
    project_root = os.path.dirname(os.path.abspath(args.output))
    sprites_dir = os.path.join(project_root, "public", "sprites")

    os.makedirs(version_pokemon_dir, exist_ok=True)
    os.makedirs(shared_dir, exist_ok=True)
    os.makedirs(sprites_dir, exist_ok=True)

    logger.info(f"  Pokemon data dir: {version_pokemon_dir}")
    logger.info(f"  Shared data dir:  {shared_dir}")
    logger.info(f"  Sprites dir:      {sprites_dir}")

    # Run the scraper
    scrape_version(args.version, args.output)

    # Log completion time
    elapsed = time.time() - start_time
    logger.info(f"Total execution time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
