content = open('public/js/app.js', encoding='utf-8').read()
checks = [
    ('\u0e21\u0e35\u0e15\u0e31\u0e27', 'Thai text OK'),
    ('getVersionLogoSrc', 'getVersionLogoSrc function exists'),
    ("gen8: '44'", 'gen8 version code 44'),
    ("gen8a: '47'", 'gen8a version code 47'),
    ('textarea', 'clipboard fallback exists'),
    ('\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e41\u0e25\u0e49\u0e27', 'Thai toast text OK'),
    ('versionLogo(', 'NO versionLogo() conflict'),
]
for text, label in checks:
    if text == 'versionLogo(':
        found = text in content
        print(('CONFLICT!' if found else 'OK') + f': {label}')
    else:
        print(('OK' if text in content else 'MISSING') + f': {label}')
