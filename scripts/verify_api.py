"""
verify_api.py — Real-API verification smoke check (Task 1)

Makes ONE live get_forms_list call for sp_number=1, version=gen9a using only
the two required headers (Referer + User-Agent). No cookies, no main-page visit.

Asserts:
  - Response envelope is { success: true, data: [...] }
  - Each form has the verified English fields, capability flags, LevelMax,
    and sprite URLs

Prints a pass/fail schema report. If the schema drifted, reports clearly
before the full scraper is built.

Requirements traced: 13.1, 13.2, 13.3, 14.1, 14.4
"""

import sys
import json

try:
    import requests
except ImportError:
    # Fall back to urllib if requests is not installed
    import urllib.request
    import urllib.error

    class _FakeResponse:
        def __init__(self, data, status_code):
            self._data = data
            self.status_code = status_code

        def json(self):
            return json.loads(self._data)

        @property
        def ok(self):
            return 200 <= self.status_code < 300

    class _FakeRequests:
        @staticmethod
        def get(url, headers=None, timeout=None):
            req = urllib.request.Request(url, headers=headers or {})
            try:
                resp = urllib.request.urlopen(req, timeout=timeout)
                data = resp.read().decode("utf-8")
                return _FakeResponse(data, resp.status)
            except urllib.error.HTTPError as e:
                data = e.read().decode("utf-8") if e.fp else ""
                return _FakeResponse(data, e.code)

    requests = _FakeRequests()


# ─── Configuration ───────────────────────────────────────────────────────────

SP_NUMBER = 1
VERSION = "gen9a"
LANG = "en-US"

API_URL = (
    f"https://pokemon.zeldaxiaoma.com/pokemon/api.php"
    f"?action=get_forms_list&sp_number={SP_NUMBER}&version={VERSION}&lang={LANG}"
)

HEADERS = {
    "Referer": f"https://pokemon.zeldaxiaoma.com/pokemon/?lang={LANG}&version={VERSION}",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/149.0.0.0 Safari/537.36"
    ),
}

# ─── Expected Schema Fields ──────────────────────────────────────────────────

# Fields that MUST exist on each form object
REQUIRED_ENGLISH_FIELDS = ["SpNameEn", "FormsNameEn", "AbilityEn", "MoveEn"]
CAPABILITY_FLAGS = ["IsShiny", "CanAlpha", "CanAlphaShiny", "CanGigantamax"]
LEVEL_FIELD = "LevelMax"
SPRITE_FIELDS = ["SpImageURL", "SpImageURL_Shiny"]

ALL_REQUIRED_FIELDS = REQUIRED_ENGLISH_FIELDS + CAPABILITY_FLAGS + [LEVEL_FIELD] + SPRITE_FIELDS


# ─── Verification Logic ──────────────────────────────────────────────────────

def verify_envelope(data: dict) -> list[str]:
    """Check the top-level envelope structure."""
    errors = []
    if "success" not in data:
        errors.append("Missing 'success' field in envelope")
    elif data["success"] is not True:
        errors.append(f"'success' is not true: {data.get('success')}")

    if "data" not in data:
        errors.append("Missing 'data' field in envelope")
    elif not isinstance(data["data"], list):
        errors.append(f"'data' is not an array, got: {type(data['data']).__name__}")
    elif len(data["data"]) == 0:
        errors.append("'data' array is empty — expected at least one form")

    return errors


def verify_form(form: dict, index: int) -> list[str]:
    """Check a single form object for required fields and types."""
    errors = []

    # Check all required fields exist
    for field in ALL_REQUIRED_FIELDS:
        if field not in form:
            errors.append(f"Form[{index}]: missing field '{field}'")

    # Type checks for English fields
    if "SpNameEn" in form and not isinstance(form["SpNameEn"], str):
        errors.append(f"Form[{index}]: 'SpNameEn' is not a string")

    if "FormsNameEn" in form and not isinstance(form["FormsNameEn"], str):
        errors.append(f"Form[{index}]: 'FormsNameEn' is not a string")

    if "AbilityEn" in form:
        if not isinstance(form["AbilityEn"], list):
            errors.append(f"Form[{index}]: 'AbilityEn' is not an array")
        elif len(form["AbilityEn"]) != 3:
            errors.append(
                f"Form[{index}]: 'AbilityEn' expected 3 slots, got {len(form['AbilityEn'])}"
            )

    if "MoveEn" in form:
        if not isinstance(form["MoveEn"], list):
            errors.append(f"Form[{index}]: 'MoveEn' is not an array")
        elif len(form["MoveEn"]) == 0:
            errors.append(f"Form[{index}]: 'MoveEn' is empty — expected at least one move")

    # Capability flags must be booleans
    for flag in CAPABILITY_FLAGS:
        if flag in form and not isinstance(form[flag], bool):
            errors.append(f"Form[{index}]: '{flag}' is not a boolean, got {type(form[flag]).__name__}")

    # LevelMax must be an integer
    if LEVEL_FIELD in form and not isinstance(form[LEVEL_FIELD], int):
        errors.append(f"Form[{index}]: '{LEVEL_FIELD}' is not an integer")

    # Sprite URLs must be strings (may be empty for GMax variants, but the main ones should have content)
    for sprite_field in SPRITE_FIELDS:
        if sprite_field in form:
            if not isinstance(form[sprite_field], str):
                errors.append(f"Form[{index}]: '{sprite_field}' is not a string")
            elif form[sprite_field] == "":
                errors.append(f"Form[{index}]: '{sprite_field}' is empty — expected a URL")

    return errors


def print_report(errors: list[str], form_count: int, sample_form: dict | None):
    """Print the pass/fail schema report."""
    print("=" * 60)
    print("  REAL-API VERIFICATION SMOKE CHECK")
    print(f"  Endpoint: get_forms_list (sp_number={SP_NUMBER}, version={VERSION})")
    print("=" * 60)
    print()

    if not errors:
        print(f"  ✅ PASS — Schema matches verified design")
        print(f"     Forms returned: {form_count}")
        if sample_form:
            print(f"     Pokemon name:   {sample_form.get('SpNameEn', '?')}")
            print(f"     LevelMax:       {sample_form.get('LevelMax', '?')}")
            print(f"     IsShiny:        {sample_form.get('IsShiny', '?')}")
            print(f"     CanAlpha:       {sample_form.get('CanAlpha', '?')}")
            abilities = [a for a in sample_form.get("AbilityEn", []) if a]
            print(f"     Abilities:      {abilities}")
            moves = sample_form.get("MoveEn", [])
            print(f"     Moves count:    {len(moves)}")
            print(f"     Sprite URL:     {sample_form.get('SpImageURL', '?')[:60]}...")
        print()
        print("  Schema is stable. Safe to build the full scraper.")
    else:
        print(f"  ❌ FAIL — Schema has DRIFTED ({len(errors)} issue(s))")
        print()
        for i, err in enumerate(errors, 1):
            print(f"     {i}. {err}")
        print()
        print("  ⚠️  STOP: Do NOT build the full scraper until this is resolved.")
        print("     The API response no longer matches the verified design.")

    print()
    print("=" * 60)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print(f"\nCalling: {API_URL}")
    print(f"Headers: Referer + User-Agent (no cookies)\n")

    try:
        resp = requests.get(API_URL, headers=HEADERS, timeout=30)
    except Exception as e:
        print(f"❌ Network error: {e}")
        sys.exit(1)

    if not resp.ok:
        print(f"❌ HTTP {resp.status_code} — request failed")
        sys.exit(1)

    try:
        data = resp.json()
    except (json.JSONDecodeError, ValueError) as e:
        print(f"❌ Response is not valid JSON: {e}")
        sys.exit(1)

    # Verify envelope
    errors = verify_envelope(data)

    # Verify each form
    form_count = 0
    sample_form = None
    if not errors and isinstance(data.get("data"), list):
        form_count = len(data["data"])
        for i, form in enumerate(data["data"]):
            errors.extend(verify_form(form, i))
        if form_count > 0:
            sample_form = data["data"][0]

    # Print report
    print_report(errors, form_count, sample_form)

    # Exit code: 0 = pass, 1 = fail
    sys.exit(0 if not errors else 1)


if __name__ == "__main__":
    main()
