"""Apply all necessary patches to app.js cleanly."""

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

patches = [
    # Fix sourceVersion for gen8/gen8a
    (
        "sourceVersion: currentVersion === 'gen9a' ? '52' : '50',",
        "sourceVersion: { gen9: '50', gen9a: '52', gen8: '44', gen8a: '47' }[currentVersion] || '50',"
    ),
    # Fix ability for gen8a
    (
        "ability: currentVersion === 'gen9a' ? '' : ability,  // ZA doesn't allow ability selection",
        "ability: (currentVersion === 'gen9a' || currentVersion === 'gen8a') ? '' : ability,  // Legends games don't allow ability"
    ),
    # Fix versionLabel
    (
        "    return v === 'gen9a' ? 'Legends: Z-A' : 'Scarlet/Violet';",
        "    return { gen9: 'Scarlet/Violet', gen9a: 'Legends: Z-A', gen8: 'Sword/Shield', gen8a: 'Legends Arceus' }[v] || v;"
    ),
    # Add getVersionLogoSrc function after versionLabel
    (
        "  function versionLabel(v) {\n    return { gen9: 'Scarlet/Violet', gen9a: 'Legends: Z-A', gen8: 'Sword/Shield', gen8a: 'Legends Arceus' }[v] || v;\n  }",
        "  function versionLabel(v) {\n    return { gen9: 'Scarlet/Violet', gen9a: 'Legends: Z-A', gen8: 'Sword/Shield', gen8a: 'Legends Arceus' }[v] || v;\n  }\n\n  function getVersionLogoSrc(v) {\n    return { gen9: '/img/sv.png', gen9a: '/img/za.png', gen8: '/img/swsh.png', gen8a: '/img/la.png' }[v] || '/img/sv.png';\n  }"
    ),
    # Fix versionLogo.src calls
    (
        "currentVersion === 'gen9a' ? '/img/za.png' : '/img/sv.png'",
        "getVersionLogoSrc(currentVersion)"
    ),
    # Fix clipboard in submitBetaOrder - use textarea fallback
    (
        "        await navigator.clipboard.writeText(code).catch(() => {});\n        UI.showToast(`คัดลอกแล้ว: %order ${data.order}`, 5000, 'success');",
        """        try {
          await navigator.clipboard.writeText(code);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta);
        }
        UI.showToast(`คัดลอกแล้ว: %order ${data.order}`, 5000, 'success');"""
    ),
]

count = 0
for old, new in patches:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f'  Patched: {old[:50]}...')
    else:
        print(f'  SKIP (not found): {old[:50]}...')

with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nApplied {count}/{len(patches)} patches')
