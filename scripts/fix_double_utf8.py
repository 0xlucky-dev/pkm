"""Fix double-encoded UTF-8 (UTF-8 bytes interpreted as Latin-1 then re-encoded as UTF-8)."""

with open('public/js/app.js', 'rb') as f:
    raw = f.read()

# Try to fix double-encoded UTF-8: decode as UTF-8, then fix sequences
# where Thai chars were encoded as Latin-1 then re-encoded as UTF-8
content = raw.decode('utf-8')

# Double-encoded UTF-8: the bytes were read as latin-1 then written as utf-8
# Fix by encoding back to latin-1 bytes, then decoding as utf-8
fixed_parts = []
i = 0
changed = 0
while i < len(content):
    # Check if this looks like a double-encoded sequence
    try:
        # Try to encode this character as latin-1 - if it's a latin-1 extension char
        ch = content[i]
        byte_val = ord(ch)
        if 0xC0 <= byte_val <= 0xFF:
            # This might be a double-encoded UTF-8 lead byte
            # Collect the sequence
            seq = ch
            j = i + 1
            while j < len(content) and 0x80 <= ord(content[j]) <= 0xFF:
                seq += content[j]
                j += 1
            # Try to decode as latin-1 -> utf-8
            try:
                decoded = seq.encode('latin-1').decode('utf-8')
                fixed_parts.append(decoded)
                changed += len(seq)
                i = j
                continue
            except (UnicodeDecodeError, UnicodeEncodeError):
                pass
        fixed_parts.append(ch)
        i += 1
    except Exception:
        fixed_parts.append(content[i])
        i += 1

result = ''.join(fixed_parts)

with open('public/js/app.js', 'w', encoding='utf-8') as f:
    f.write(result)

print(f'Fixed {changed} double-encoded chars')

# Verify - show the submitBetaOrder area
idx = result.find('submitBetaOrder')
print('Sample:', result[idx:idx+200])
