"""Second patch pass for app.js."""
import re

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

patches = [
    # Fix gen8 version code 45->44
    (
        "gen8: '45'",
        "gen8: '44'"
    ),
    # Fix versionLogo.src calls (multiple occurrences)
    (
        "versionLogo.src = currentVersion === 'gen9a' ? '/img/za.png' : '/img/sv.png'",
        "versionLogo.src = getVersionLogoSrc(currentVersion)"
    ),
    # Fix batch logo src
    (
        "if (batchLogo) batchLogo.src = currentVersion === 'gen9a' ? '/img/za.png' : '/img/sv.png'",
        "if (batchLogo) batchLogo.src = getVersionLogoSrc(currentVersion)"
    ),
    # Fix sourceVersion if old pattern
    (
        "sourceVersion: currentVersion === 'gen9a' ? '52' : '50',",
        "sourceVersion: { gen9: '50', gen9a: '52', gen8: '44', gen8a: '47' }[currentVersion] || '50',"
    ),
    # Fix ability
    (
        "ability: currentVersion === 'gen9a' ? '' : ability,  // ZA doesn't allow ability selection",
        "ability: (currentVersion === 'gen9a' || currentVersion === 'gen8a') ? '' : ability,"
    ),
]

count = 0
for old, new in patches:
    occurrences = content.count(old)
    if occurrences > 0:
        content = content.replace(old, new)
        count += occurrences
        print(f'  Fixed {occurrences}x: {old[:60]}')
    else:
        print(f'  SKIP: {old[:60]}')

with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nTotal fixes: {count}')
