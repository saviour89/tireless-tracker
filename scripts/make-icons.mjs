// Draws the app icon, inspired by the card Tireless Tracker: a scout's tricorn hat against a
// moonlit night in the woods, with a trail of footprints leading to it.
// Writes public/icon.svg plus the PNG app icons from the same shapes, with no dependencies.
// Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// --- Design, in a 64×64 space ----------------------------------------------------------------

const SKY_TOP = '#2c1f45'
const SKY_BOTTOM = '#10201a'
const MOON = '#ecc9ef'
const GLOW = '#c98bd6'
const TREE = '#0b1410'
const HAT = '#0b0c0f'
const GOLD = '#e8b04a'
const TRACKS = '#d7b4e4'

const GROUND = '#1b3024'

// Tricorn, seen from the front: the turned-up brim's trimmed edge dips in a V to the front corner,
// the side corners stand up as horns, and the crown rises behind.
const crown = [
  ['M', 18.5, 28],
  ['C', 19, 17, 25, 11, 32, 11],
  ['C', 39, 11, 45, 17, 45.5, 28],
  // Dips into the V so no moon shows between the crown and the brim's front corner.
  ['L', 37, 28],
  ['L', 32, 34],
  ['L', 27, 28],
  ['Z'],
]
const brimEdge = [
  ['M', 6, 16],
  ['C', 14, 20, 24, 25, 32, 31.5],
  ['C', 40, 25, 50, 20, 58, 16],
]
const brimUnder = [
  ['M', 58, 16],
  ['C', 58, 27, 47, 35, 32, 37.5],
  ['C', 17, 35, 6, 27, 6, 16],
]
const brim = [...brimEdge, ...brimUnder.slice(1), ['Z']]
// Shrunk around the moon so the horn tips stay inside the circle Android crops icons to.
const HAT_SCALE = 0.86
const fit = (cmds) => cmds.map(([c, ...n]) => [c, ...n.map((v, i) => +((i % 2 ? 26 : 32) + (v - (i % 2 ? 26 : 32)) * HAT_SCALE).toFixed(2))])
const leftTree = [['M', -1, -1], ['L', 8, -1], ['C', 6.5, 20, 5.5, 42, 9, 65], ['L', -1, 65], ['Z']]
const rightTree = [['M', 65, -1], ['L', 56.5, -1], ['C', 58, 22, 58.5, 44, 55, 65], ['L', 65, 65], ['Z']]
// Boot prints (sole + heel), alternating left and right, walking up toward the tracker.
const prints = [
  { x: 25.5, y: 57.5, a: 16 },
  { x: 32.5, y: 53, a: 10 },
  { x: 27, y: 47.5, a: 16 },
]

const bootPrint = ({ x, y, a }) => {
  const parts = [
    { cx: x, cy: y - 1.3, rx: 1.45, ry: 2.05 },
    { cx: x, cy: y + 2, rx: 1.15, ry: 1.05 },
  ]
  return {
    svg: `<g transform="rotate(${a} ${x} ${y})" fill="${TRACKS}" opacity="0.75">${parts.map((e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"/>`).join('')}</g>`,
    paint: (px, py) => (parts.some((e) => inEllipse(px, py, e.cx, e.cy, e.rx, e.ry, a, x, y)) ? [hex(TRACKS), 0.75] : null),
  }
}

const layers = [
  {
    svg: `<circle cx="32" cy="27" r="28" fill="url(#glow)"/>`,
    paint: (x, y) => {
      const t = Math.hypot(x - 32, y - 27) / 28
      return t < 1 ? [hex(GLOW), 0.45 * (1 - t) ** 1.6] : null
    },
  },
  { svg: `<circle cx="32" cy="27" r="15.5" fill="${MOON}"/>`, paint: (x, y) => (Math.hypot(x - 32, y - 27) <= 15.5 ? [hex(MOON), 1] : null) },
  {
    svg: `<ellipse cx="32" cy="67" rx="34" ry="22" fill="${GROUND}"/>`,
    paint: (x, y) => (((x - 32) / 34) ** 2 + ((y - 67) / 22) ** 2 <= 1 ? [hex(GROUND), 1] : null),
  },
  solid(leftTree, TREE),
  solid(rightTree, TREE),
  ...prints.map(bootPrint),
  solid(fit(crown), HAT),
  solid(fit(brim), HAT),
  stroke(fit(brimEdge), GOLD, 1.6),
]

// --- SVG ---------------------------------------------------------------------------------------

function toPath(cmds) {
  return cmds.map(([c, ...n]) => c + n.join(' ')).join('')
}

function svg(rounded) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY_TOP}"/><stop offset="1" stop-color="${SKY_BOTTOM}"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="${GLOW}" stop-opacity="0.45"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient>
<clipPath id="frame"><rect width="64" height="64" rx="${rounded ? 14 : 0}"/></clipPath>
</defs>
<g clip-path="url(#frame)">
<rect width="64" height="64" fill="url(#sky)"/>
${layers.map((l) => l.svg).join('\n')}
</g>
</svg>
`
}

// --- Rasterizer ----------------------------------------------------------------------------------

function hex(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** Flattens M/L/C commands into a polyline. */
function flatten(cmds) {
  const pts = []
  let cx = 0, cy = 0
  for (const [c, ...n] of cmds) {
    if (c === 'M' || c === 'L') {
      ;[cx, cy] = n
      pts.push([cx, cy])
    } else if (c === 'C') {
      const [x1, y1, x2, y2, x, y] = n
      for (let i = 1; i <= 24; i++) {
        const t = i / 24, u = 1 - t
        pts.push([
          u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ])
      }
      ;[cx, cy] = [x, y]
    }
  }
  return pts
}

function inPolygon(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function nearPolyline(x, y, pts, r) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
    if (Math.hypot(x - ax - dx * t, y - ay - dy * t) <= r) return true
  }
  return false
}

/** Point in an ellipse rotated by `deg` around (px, py), defaulting to its own center. */
function inEllipse(x, y, cx, cy, rx, ry, deg, px = cx, py = cy) {
  const a = (-deg * Math.PI) / 180
  const dx = x - px, dy = y - py
  const u = dx * Math.cos(a) - dy * Math.sin(a) + px - cx
  const v = dx * Math.sin(a) + dy * Math.cos(a) + py - cy
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1
}

function solid(cmds, color) {
  const pts = flatten(cmds)
  return { svg: `<path d="${toPath(cmds)}" fill="${color}"/>`, paint: (x, y) => (inPolygon(x, y, pts) ? [hex(color), 1] : null) }
}

function stroke(cmds, color, width) {
  const pts = flatten(cmds)
  return {
    svg: `<path d="${toPath(cmds)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    paint: (x, y) => (nearPolyline(x, y, pts, width / 2) ? [hex(color), 1] : null),
  }
}

function render(size) {
  const top = hex(SKY_TOP), bottom = hex(SKY_BOTTOM)
  const px = Buffer.alloc(size * size * 3)
  const S = 4 // supersampling per axis
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const acc = [0, 0, 0]
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = ((i + (sx + 0.5) / S) / size) * 64
          const y = ((j + (sy + 0.5) / S) / size) * 64
          const t = y / 64
          let c = top.map((v, k) => v + (bottom[k] - v) * t)
          for (const l of layers) {
            const p = l.paint(x, y)
            if (p) c = c.map((v, k) => v + (p[0][k] - v) * p[1])
          }
          for (let k = 0; k < 3; k++) acc[k] += c[k]
        }
      }
      const o = (j * size + i) * 3
      for (let k = 0; k < 3; k++) px[o + k] = Math.round(acc[k] / (S * S))
    }
  }
  return png(size, px)
}

function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// The PNGs are full-bleed squares: iOS and Android apply their own rounded mask, and the hat and
// moon sit inside the middle 80% that maskable icons keep.
if (process.argv[2] === '--preview') {
  writeFileSync(process.argv[3], render(Number(process.argv[4] ?? 192)))
  process.exit(0)
}
writeFileSync('public/icon.svg', svg(true))
writeFileSync('public/icon-512.png', render(512))
writeFileSync('public/icon-192.png', render(192))
writeFileSync('public/apple-touch-icon.png', render(180))
console.log('icons written')
