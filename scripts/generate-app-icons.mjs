import fs from "node:fs";
import sharp from "sharp";

const roundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="nesa-stroke" x1="20" x2="44" y1="18" y2="47" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5eead4" />
      <stop offset="0.42" stop-color="#22d3ee" />
      <stop offset="0.68" stop-color="#f7c56b" />
      <stop offset="1" stop-color="#d36a2d" />
    </linearGradient>
    <clipPath id="round">
      <circle cx="32" cy="32" r="32" />
    </clipPath>
  </defs>
  <g clip-path="url(#round)">
    <circle cx="32" cy="32" r="32" fill="#06090a" />
    <circle cx="32" cy="32" r="27" fill="none" stroke="#2d3033" stroke-width="3" />
    <path d="M21 45V19h7v26z" fill="#5eead4" />
    <path d="M37 19h7v26h-7z" fill="#d36a2d" />
    <path d="M25 19h7l17 26h-7z" fill="url(#nesa-stroke)" />
  </g>
</svg>`;

fs.writeFileSync("public/favicon.svg", roundSvg);

async function writePng(size, out) {
  const { data, info } = await sharp(Buffer.from(roundSvg))
    .resize(size, size, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (dist > r - 0.5) {
        const t = Math.max(0, Math.min(1, r - dist + 0.5));
        data[i + 3] = Math.round(data[i + 3] * t);
      }
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(out);
  console.log("wrote", out, size);
}

await writePng(192, "public/icons/icon-192.png");
await writePng(512, "public/icons/icon-512.png");
await writePng(180, "public/icons/apple-touch-icon.png");
console.log("done");
