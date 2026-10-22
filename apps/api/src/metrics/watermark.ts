import sharp from 'sharp';

function esc(value: string) {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] || char);
}

export async function stampImage(input: Buffer, text: string) {
  const meta = await sharp(input).rotate().metadata();
  const width = meta.width || 960;
  const height = meta.height || 540;
  const safe = esc(text);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="wm" width="420" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)">
      <text x="0" y="90" fill="rgba(214,21,60,0.18)" font-size="18" font-family="sans-serif">${safe}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
  <rect x="0" y="${Math.max(0, height - 44)}" width="${width}" height="44" fill="rgba(0,0,0,0.58)"/>
  <text x="16" y="${height - 16}" fill="#ffffff" font-size="16" font-family="sans-serif">${safe}</text>
</svg>`;
  return sharp(input).rotate().composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

export function shanghaiStamp(now = new Date()) {
  const text = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  return `${text} UTC+8`;
}
