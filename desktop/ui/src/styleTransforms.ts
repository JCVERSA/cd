function mapRange(text: string, upper: number, lower: number, digits?: number) {
  return [...text].map((char) => {
    const code = char.codePointAt(0) || 0
    if (code >= 65 && code <= 90) return String.fromCodePoint(upper + code - 65)
    if (code >= 97 && code <= 122) return String.fromCodePoint(lower + code - 97)
    if (digits !== undefined && code >= 48 && code <= 57) return String.fromCodePoint(digits + code - 48)
    return char
  }).join('')
}

const smallCaps: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
}

export const styles = [
  { id: 'bold', name: 'Bold', description: 'Strong mathematical sans', transform: (text: string) => mapRange(text, 0x1d5d4, 0x1d5ee, 0x1d7ec) },
  { id: 'italic', name: 'Italic', description: 'Slanted mathematical sans', transform: (text: string) => mapRange(text, 0x1d608, 0x1d622) },
  { id: 'mono', name: 'Monospace', description: 'Fixed-width characters', transform: (text: string) => mapRange(text, 0x1d670, 0x1d68a, 0x1d7f6) },
  { id: 'bubble', name: 'Bubble', description: 'Circled letters and numbers', transform: (text: string) => [...text].map((char) => {
    const code = char.codePointAt(0) || 0
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x24b6 + code - 65)
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x24d0 + code - 97)
    if (code === 48) return '⓪'
    if (code >= 49 && code <= 57) return String.fromCodePoint(0x2460 + code - 49)
    return char
  }).join('') },
  { id: 'gothic', name: 'Gothic', description: 'Classic Fraktur display', transform: (text: string) => mapRange(text, 0x1d56c, 0x1d586) },
  { id: 'smallcaps', name: 'Small caps', description: 'Compact social heading', transform: (text: string) => [...text].map((char) => smallCaps[char.toLowerCase()] || char).join('') },
] as const
