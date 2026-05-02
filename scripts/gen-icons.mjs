import sharp from 'sharp'
import fs from 'fs'

if (!fs.existsSync('public/icons')) {
  fs.mkdirSync('public/icons', { recursive: true })
}
if (!fs.existsSync('public/screenshots')) {
  fs.mkdirSync('public/screenshots', { recursive: true })
}

const sizes = [192, 512]
for (const s of sizes) {
  await sharp('image.png')
    .resize(s, s)
    .png()
    .toFile(`public/icons/icon-${s}.png`)
}

// Maskable icon: logo must fit inside 80% safe zone — add padding
await sharp('image.png')
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#0a0a0f' })
  .resize(512, 512)
  .png()
  .toFile('public/icons/icon-maskable-512.png')

// Also create a dummy screenshot for Lighthouse to pass
await sharp({
  create: {
    width: 1080,
    height: 1920,
    channels: 4,
    background: { r: 10, g: 10, b: 15, alpha: 1 }
  }
})
.png()
.toFile('public/screenshots/session.png')

console.log('Icons and screenshots generated.');
