// Huong dan su dung + so do chan cho tung du an / tung ban.
// Noi dung nam trong thu muc huong-dan/ cua repo: chu trang sua bang GitHub (nut Sua o trang quan ly), Claude cung sua duoc.
// Cu phap huong dan: "## Tieu de", "1. buoc", "- y", **chu dam**, dong trong = xuong doan
// Cu phap so do chan: moi dong "Linh kien | Chan linh kien | Noi vao ESP32 | Ghi chu (khong bat buoc)"

import { GH_REPO } from "./config.js";

// Duong dan file huong dan / so do chan trong repo (thu muc huong-dan/<ma du an>/)
export function guidePath(id, tier, kind) {
  return `huong-dan/${id}/${tier === "pro" ? "pro" : "thuong"}${kind === "pins" ? "-chan.txt" : ".md"}`;
}
export const ghEdit = (path) => `https://github.com/${GH_REPO}/edit/main/${path}`;
export const ghNew = (path) => {
  const i = path.lastIndexOf("/");
  return `https://github.com/${GH_REPO}/new/main/${path.slice(0, i)}?filename=${encodeURIComponent(path.slice(i + 1))}`;
};

// Doc huong dan + so do chan. Uu tien file tren GitHub; neu chua co file thi dung chu luu trong Firestore (neu co)
async function getText(path) {
  try {
    const r = await fetch(path + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-cache" });
    if (r.ok) return await r.text();
  } catch {}
  return "";
}
export async function loadGuide(project, tier) {
  const [guide, pins] = await Promise.all([
    getText(guidePath(project.id, tier, "guide")), getText(guidePath(project.id, tier, "pins"))]);
  const t = project?.[tier] || {}, c = project?.content?.[tier] || {};
  // Uu tien noi dung chu trang sua trong trang quan ly (Firestore), roi toi file tren GitHub
  return { guide: c.guide || guide || t.guide || "", pins: c.pins || pins || t.pins || "" };
}

const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inline = (s) => escH(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

// Huong dan -> HTML
export function guideHtml(text, mark = false) {
  const out = []; let list = null, ln = -1;
  const at = () => mark ? ` data-ln="${ln}"` : "";
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(text || "").split("\n")) {
    ln++;
    const l = raw.trim();
    if (!l) { close(); continue; }
    let m;
    if ((m = l.match(/^##\s+(.*)/))) { close(); out.push(`<h4${at()}>${inline(m[1])}</h4>`); }
    else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li${at()}>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^[-*•]\s+(.*)/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li${at()}>${inline(m[1])}</li>`); }
    else { close(); out.push(`<p${at()}>${inline(l)}</p>`); }
  }
  close();
  return out.join("") || '<p class="tiny">Chưa có hướng dẫn.</p>';
}

export function parsePins(text) {
  return String(text || "").split("\n").map((l) => l.split("|").map((s) => s.trim()))
    .filter((r) => r.length >= 3 && r[0] && r[2]).map(([comp, pin, esp, note = ""]) => ({ comp, pin, esp, note }));
}

const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#f5b942", "#60a5fa", "#f472b6"];
const wireColor = (esp, comp) => /^gnd/i.test(esp) ? "#8fa0bf" : /^(3v3|3\.3v|5v|vin|vcc)/i.test(esp) ? "#f87171" : comp;

// So do chan -> bang + hinh noi day (SVG)
export function pinsHtml(text, chip = "ESP32") {
  const rows = parsePins(text);
  if (!rows.length) return '<p class="tiny">Chưa có sơ đồ chân.</p>';
  const comps = [...new Set(rows.map((r) => r.comp))];
  const cCol = Object.fromEntries(comps.map((c, i) => [c, PALETTE[i % PALETTE.length]]));
  const espPins = [...new Set(rows.map((r) => r.esp))];

  // --- Hinh ---
  const RH = 22, W = 680, ex = 20, ew = 150, cx = 430, cw = 230, top = 34;
  const espY = Object.fromEntries(espPins.map((p, i) => [p, top + 30 + i * RH]));
  const espH = 30 + espPins.length * RH + 10;
  let y = top, compSvg = "", lines = "";
  for (const c of comps) {
    const pr = rows.filter((r) => r.comp === c), h = 28 + pr.length * RH + 6;
    compSvg += `<rect x="${cx}" y="${y}" width="${cw}" height="${h}" rx="10" fill="#111a2e" stroke="${cCol[c]}" stroke-width="1.5"/>
      <text x="${cx + 12}" y="${y + 19}" fill="${cCol[c]}" font-size="13" font-weight="700">${escH(c)}</text>`;
    pr.forEach((r, i) => {
      const py = y + 28 + i * RH + 11, col = wireColor(r.esp, cCol[c]), ri = rows.indexOf(r);
      compSvg += `<g data-i="${ri}"><circle cx="${cx}" cy="${py}" r="4" fill="${col}"/><text x="${cx + 12}" y="${py + 4}" fill="#e8eef9" font-size="12">${escH(r.pin)}</text></g>`;
      const sy = espY[r.esp] + 11, mx = (ex + ew + cx) / 2;
      lines += `<path data-i="${ri}" d="M${ex + ew} ${sy} C${mx} ${sy} ${mx} ${py} ${cx} ${py}" fill="none" stroke="${col}" stroke-width="2" opacity=".85"/>`;
    });
    y += h + 12;
  }
  const H = Math.max(top + espH, y) + 10;
  let espSvg = `<rect x="${ex}" y="${top}" width="${ew}" height="${espH}" rx="10" fill="#16213a" stroke="#2c3d61" stroke-width="1.5"/>
    <text x="${ex + ew / 2}" y="${top + 20}" fill="#e8eef9" font-size="13" font-weight="700" text-anchor="middle">${escH(chip)}</text>`;
  espPins.forEach((p) => {
    const py = espY[p] + 11, col = wireColor(p, "#e8eef9");
    espSvg += `<text x="${ex + ew - 12}" y="${py + 4}" fill="${col}" font-size="12" text-anchor="end" font-family="ui-monospace,Consolas,monospace">${escH(p)}</text>
      <circle cx="${ex + ew}" cy="${py}" r="4" fill="${col}"/>`;
  });
  const svg = `<svg class="wire" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sơ đồ nối dây">${lines}${espSvg}${compSvg}</svg>`;

  // --- Bang ---
  const table = `<table class="tbl pins"><tr><th>Linh kiện</th><th>Chân linh kiện</th><th>Nối vào ${escH(chip)}</th><th>Ghi chú</th></tr>
    ${rows.map((r, i) => `<tr data-i="${i}"><td><span class="dot" style="background:${cCol[r.comp]}"></span>${escH(r.comp)}</td><td>${escH(r.pin)}</td>
      <td class="mono" style="color:${wireColor(r.esp, "inherit")}">${escH(r.esp)}</td><td class="small muted">${escH(r.note)}</td></tr>`).join("")}</table>`;
  return `<div class="wire-wrap">${svg}</div>${table}
    <p class="tiny" style="margin-top:10px">Dây <span style="color:#f87171">đỏ</span> = nguồn, dây <span style="color:#8fa0bf">xám</span> = GND. Mỗi nút bấm nối 1 chân vào GPIO, chân còn lại xuống GND.</p>`;
}
