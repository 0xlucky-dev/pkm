"""Fix versionLogo() call conflict with DOM ref."""

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all versionLogo(currentVersion) calls with getVersionLogoSrc
import re

content, n1 = re.subn(r'versionLogo\.src\s*=\s*versionLogo\(currentVersion\)', 
                       'versionLogo.src = getVersionLogoSrc(currentVersion)', content)
content, n2 = re.subn(r'batchLogo\.src\s*=\s*versionLogo\(currentVersion\)',
                       'batchLogo.src = getVersionLogoSrc(currentVersion)', content)

print(f'Fixed versionLogo.src calls: {n1}')
print(f'Fixed batchLogo.src calls: {n2}')

# Verify no conflicts remain  
remaining = re.findall(r'versionLogo\(', content)
print(f'Remaining versionLogo() calls: {len(remaining)}')

with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
