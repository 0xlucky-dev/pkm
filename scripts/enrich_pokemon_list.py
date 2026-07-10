"""
enrich_pokemon_list.py — Add sprite fields to pokemon-list.json from per-pokemon JSON files.
Usage: python scripts/enrich_pokemon_list.py --version gen8
       python scripts/enrich_pokemon_list.py --version gen8a
"""
import argparse, json, os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    parser.add_argument('--output', default='./data')
    args = parser.parse_args()

    list_path = os.path.join(args.output, args.version, 'pokemon-list.json')
    pokemon_dir = os.path.join(args.output, args.version, 'pokemon')

    with open(list_path, 'r', encoding='utf-8') as f:
        pokemon_list = json.load(f)

    enriched = 0
    for entry in pokemon_list:
        sp = entry.get('sp_number') or entry.get('sp')
        pokemon_path = os.path.join(pokemon_dir, f'{sp}.json')
        if not os.path.exists(pokemon_path):
            continue
        with open(pokemon_path, 'r', encoding='utf-8') as f:
            detail = json.load(f)
        forms = detail.get('forms', [])
        if not forms:
            continue
        form0 = forms[0]
        entry['sprite'] = form0.get('spriteNormal', '')
        entry['spriteShiny'] = form0.get('spriteShiny', '')
        enriched += 1

    with open(list_path, 'w', encoding='utf-8') as f:
        json.dump(pokemon_list, f, ensure_ascii=False, indent=2)

    print(f"Enriched {enriched}/{len(pokemon_list)} entries for {args.version}")

if __name__ == '__main__':
    main()
