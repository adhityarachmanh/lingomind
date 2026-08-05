import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const out = "public/icons";
await mkdir(out, { recursive: true });

const size = 512;
const pad = Math.round(size * 0.1);
const logoSize = size - pad * 2;

const bg = Buffer.from(
  `<svg width="${size}" height="${size}"><rect width="100%" height="100%" fill="#161a20"/></svg>`,
);

const maskableLogo = await sharp("public/icon.svg")
  .resize(logoSize, logoSize)
  .png()
  .toBuffer();

await sharp(bg)
  .composite([{ input: maskableLogo, left: pad, top: pad }])
  .png()
  .toFile(`${out}/icon-maskable-512.png`);
console.log(`generated ${out}/icon-maskable-512.png (${size})`);

for (const [name, s] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp("public/icon.svg").resize(s, s).png().toFile(`${out}/${name}`);
  console.log(`generated ${out}/${name} (${s})`);
}
