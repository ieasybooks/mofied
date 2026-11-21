// Draws the QR code that mofied.com/app shows on wide windows, for a visitor at
// a computer to scan with their phone. Dark modules on a light ground, inside
// the quiet zone scanners need: some scanners can't read a light code on dark.
import qrcode from "qrcode-generator";

/** The modules of light around a code that the standard asks for. */
const QUIET = 4;

/** A QR code of `text` as an SVG, one unit a module, its dark modules drawn as runs along each row. */
export function drawQr(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const side = n + 2 * QUIET;
  const runs: string[] = [];
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n;) {
      if (!qr.isDark(row, col)) {
        col++;
        continue;
      }
      let end = col;
      while (end < n && qr.isDark(row, end)) end++;
      runs.push(`M${col + QUIET} ${row + QUIET}h${end - col}v1h${col - end}z`);
      col = end;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="#f5f5f5"/><path fill="#0a0a0a" d="${runs.join("")}"/></svg>`;
}
