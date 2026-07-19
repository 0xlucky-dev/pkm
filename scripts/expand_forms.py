"""
expand_forms.py — Expand pokemon-list.json for each version so that every form
gets its own entry (card) in the grid. Replaces the current 1-entry-per-species
structure with 1-entry-per-form.

Each entry gets:
  sp_number, dex, name, formIndex, formName, sprite, spriteShiny

"Default Form" entries keep the base name; non-default forms append "-FormName".
"""

import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
VERSIONS = ["gen8", "gen8a", "gen9", "gen9a"]


def expand_version(version):
    list_path = os.path.join(DATA_DIR, version, "pokemon-list.json")
    pokemon_dir = os.path.join(DATA_DIR, version, "pokemon")

    with open(list_path, "r", encoding="utf-8") as f:
        original_list = json.load(f)

    expanded = []

    for entry in original_list:
        sp = entry["sp_number"]
        dex = entry.get("dex", sp)
        base_name = entry["name"]

        # Load per-pokemon detail JSON for forms
        detail_path = os.path.join(pokemon_dir, f"{sp}.json")
        if not os.path.exists(detail_path):
            # No detail file — keep single entry as-is
            expanded.append({
                "sp_number": sp,
                "dex": dex,
                "name": base_name,
                "formIndex": 0,
                "formName": "",
                "sprite": entry.get("sprite", ""),
                "spriteShiny": entry.get("spriteShiny", ""),
            })
            continue

        with open(detail_path, "r", encoding="utf-8") as f:
            detail = json.load(f)

        forms = detail.get("forms", [])
        if not forms:
            expanded.append({
                "sp_number": sp,
                "dex": dex,
                "name": base_name,
                "formIndex": 0,
                "formName": "",
                "sprite": entry.get("sprite", ""),
                "spriteShiny": entry.get("spriteShiny", ""),
            })
            continue

        for form in forms:
            form_index = form.get("formIndex", 0)
            form_name_raw = form.get("formName", "")
            is_default = (not form_name_raw) or form_name_raw == "Default Form"

            if is_default:
                display_name = base_name
                form_name = ""
            else:
                display_name = f"{base_name}-{form_name_raw}"
                form_name = form_name_raw

            sprite = form.get("spriteNormal", "")
            sprite_shiny = form.get("spriteShiny", "")

            expanded.append({
                "sp_number": sp,
                "dex": dex,
                "name": display_name,
                "formIndex": form_index,
                "formName": form_name,
                "sprite": sprite,
                "spriteShiny": sprite_shiny,
            })

    # Write expanded list
    with open(list_path, "w", encoding="utf-8") as f:
        json.dump(expanded, f, ensure_ascii=False, indent=2)

    print(f"{version}: {len(original_list)} -> {len(expanded)} entries")


def main():
    for v in VERSIONS:
        expand_version(v)
    print("Done.")


if __name__ == "__main__":
    main()
