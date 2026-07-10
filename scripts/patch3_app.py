"""Find and fix remaining issues using regex search."""
import re

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Show current state of key sections
print("=== Current state ===")
for keyword in ['versionLogo.src', 'sourceVersion', 'ability.*gen9a', 'batchLogo']:
    for m in re.finditer(keyword, content):
        start = max(0, m.start()-10)
        end = min(len(content), m.end()+80)
        print(f"  [{m.start()}] {repr(content[start:end][:100])}")
    
print("\n=== Applying regex patches ===")

# Fix versionLogo.src - use regex to handle any quotes variant
content, n = re.subn(
    r"versionLogo\.src\s*=\s*currentVersion\s*===\s*['\"]gen9a['\"]\s*\?\s*['\"][^'\"]+['\"\s]*:['\"][^'\"]+['\"]",
    "versionLogo.src = getVersionLogoSrc(currentVersion)",
    content
)
print(f"  versionLogo.src: {n} replacements")

# Fix batchLogo.src
content, n = re.subn(
    r"batchLogo\.src\s*=\s*currentVersion\s*===\s*['\"]gen9a['\"]\s*\?\s*['\"][^'\"]+['\"\s]*:['\"][^'\"]+['\"]",
    "batchLogo.src = getVersionLogoSrc(currentVersion)",
    content
)
print(f"  batchLogo.src: {n} replacements")

# Fix sourceVersion  
content, n = re.subn(
    r"sourceVersion:\s*currentVersion\s*===\s*['\"]gen9a['\"]\s*\?\s*'52'\s*:\s*'50'",
    "sourceVersion: { gen9: '50', gen9a: '52', gen8: '44', gen8a: '47' }[currentVersion] || '50'",
    content
)
print(f"  sourceVersion: {n} replacements")

# Fix ability
content, n = re.subn(
    r"ability:\s*currentVersion\s*===\s*['\"]gen9a['\"]\s*\?\s*''\s*:\s*ability[^,\n]*",
    "ability: (currentVersion === 'gen9a' || currentVersion === 'gen8a') ? '' : ability,",
    content
)
print(f"  ability: {n} replacements")

with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone")
