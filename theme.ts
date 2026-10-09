// Site themes. "ocean" is the original look: it adds no overrides at all, so nothing changes until the owner picks another one.
// Every other theme (and the custom one) is built from three colours: main accent, second accent and the dark background tone.
export type ThemeSettings = { preset: string; accent: string; accent2: string; bg: string }

export const DEFAULT_THEME: ThemeSettings = { preset: 'ocean', accent: '#43dcff', accent2: '#3b82f6', bg: '#06132a' }

export const THEME_PRESETS: { id: string; name: string; note: string; accent: string; accent2: string; bg: string }[] = [
  { id: 'ocean', name: 'Ocean', note: 'Normal (current look)', accent: '#43dcff', accent2: '#3b82f6', bg: '#06132a' },
  { id: 'emerald', name: 'Emerald', note: 'Fresh green', accent: '#3df5a0', accent2: '#14b8a6', bg: '#04140d' },
  { id: 'crimson', name: 'Crimson', note: 'Fiery red', accent: '#ff5a6a', accent2: '#fb7185', bg: '#14060a' },
  { id: 'royal', name: 'Royal Purple', note: 'Deep violet', accent: '#b388ff', accent2: '#7c6cff', bg: '#0c0720' },
  { id: 'sunset', name: 'Sunset Gold', note: 'Warm orange', accent: '#ffb347', accent2: '#ff5e62', bg: '#150a05' },
  { id: 'neon', name: 'Neon Pink', note: 'Bright magenta', accent: '#ff6bd6', accent2: '#8b5cf6', bg: '#12061a' },
]

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

const hexToRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

const hex = ([r, g, b]: [number, number, number]) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
const tri = (c: [number, number, number]) => c.join(', ')

/** CSS that overrides the colour variables for a theme. Empty for the original Ocean theme. */
export function themeCss(t?: Partial<ThemeSettings> | null): string {
  if (!t || !t.preset || t.preset === 'ocean') return ''
  const p = THEME_PRESETS.find((x) => x.id === t.preset)
  const accent = isHex(t.accent) ? t.accent : p?.accent ?? DEFAULT_THEME.accent
  const accent2 = isHex(t.accent2) ? t.accent2 : p?.accent2 ?? DEFAULT_THEME.accent2
  const bg = isHex(t.bg) ? t.bg : p?.bg ?? DEFAULT_THEME.bg

  const [ah, as, al] = rgbToHsl(hexToRgb(accent))
  const light = hslToRgb(ah, Math.min(100, as), Math.min(86, al + 16))
  const second = hexToRgb(accent2)
  const [sh, ss, sl] = rgbToHsl(second)
  const violet = hslToRgb(sh + 35, Math.max(55, ss), Math.min(70, Math.max(55, sl)))
  const [bh, bs0] = rgbToHsl(hexToRgb(bg))
  const bs = Math.min(80, Math.max(30, bs0))
  const at = (l: number) => hslToRgb(bh, bs, l)

  const rgb = hexToRgb(accent)
  const v: Record<string, string> = {
    '--cyan': accent, '--cyan-rgb': tri(rgb),
    '--cyan2': hex(light), '--cyan2-rgb': tri(light),
    '--line-rgb': tri(light),
    '--blue': accent2, '--blue-rgb': tri(second),
    '--violet': hex(violet), '--violet-rgb': tri(violet),
    '--bg': hex(at(4)), '--bg2': hex(at(9)), '--panel-solid': hex(at(11)),
    '--n0-rgb': tri(at(5)), '--n1-rgb': tri(at(14)), '--n2-rgb': tri(at(24)),
    '--bgA': hex(at(19)), '--bgB': hex(at(8)), '--bgC': hex(at(4)), '--thumb': hex(at(22)),
    '--hue': `${Math.round(ah - 191)}deg`,
  }
  return ':root{' + Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';') + '}'
}

/** Explicit Ocean values, used by the live preview in the admin panel so "Ocean" can be previewed over another saved theme. */
export const OCEAN_CSS = ':root{--cyan:#43dcff;--cyan-rgb:67, 220, 255;--cyan2:#8cecff;--cyan2-rgb:140, 236, 255;--line-rgb:110, 200, 255;--blue:#3b82f6;--blue-rgb:59, 130, 246;--violet:#7c6cff;--violet-rgb:124, 108, 255;--bg:#030a14;--bg2:#06132a;--panel-solid:#0a1a30;--n0-rgb:3, 10, 22;--n1-rgb:12, 32, 60;--n2-rgb:24, 58, 100;--bgA:#0b2550;--bgB:#051024;--bgC:#020710;--thumb:#16345a;--hue:0deg}'
export const themeCssPreview = (t?: Partial<ThemeSettings> | null) => (!t || !t.preset || t.preset === 'ocean' ? OCEAN_CSS : themeCss(t))
