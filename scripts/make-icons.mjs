// Renders the app icons (public/*.png) from simple shapes, with no dependencies.
// Same design as public/icon.svg: a gold magnifying glass (a clue!) on a dark square.
// Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x15, 0x17, 0x1c]
const GOLD = [0xe8, 0xb0, 0x4a]
const INK = [0xec, 0xea, 0xe6]

// Shapes in the 64-unit design space, as signed distance functions (negative = inside).
const ring = (x, y) => Math.abs(Math.hypot(x - 28, y - 28) - 13) - 2.5
function capsule(x, y, ax, ay, bx, by, r) {
  const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - dx * t, py - dy * t) - r
}
const handle = (x, y) => capsule(x, y, 37.5, 37.5, 48, 48, 3)
const plus = (x, y) => Math.min(capsule(x, y, 22, 28, 34, 28, 1.75), capsule(x, y, 28, 22, 28, 34, 1.75))

function render(size, pad) {
  const scale = (64 - 2 * pad) / 64
  const px = Buffer.alloc(size * size * 3)
  const S = 4 // supersampling per axis
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (((i + (sx + 0.5) / S) / size) * 64 - pad) / scale
          const y = (((j + (sy + 0.5) / S) / size) * 64 - pad) / scale
          const c = plus(x, y) < 0 ? INK : ring(x, y) < 0 || handle(x, y) < 0 ? GOLD : BG
          r += c[0]; g += c[1]; b += c[2]
        }
      }
      const o = (j * size + i) * 3
      px[o] = r / (S * S); px[o + 1] = g / (S * S); px[o + 2] = b / (S * S)
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

// Maskable icons are cropped to a circle, so the art stays inside the middle 80%.
writeFileSync('public/icon-512.png', render(512, 8))
writeFileSync('public/icon-192.png', render(192, 8))
writeFileSync('public/apple-touch-icon.png', render(180, 6))
console.log('icons written')
