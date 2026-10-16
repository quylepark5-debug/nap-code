// Tai ve cho khach ban Pro: so do dau noi (anh PNG) va huong dan + so do (PDF qua hop thoai in cua trinh duyet)
import { guideHtml, pinsHtml } from "./guides.js";
import { BRAND } from "./config.js";

const fname = (p, t, ext) => `${p.id}-${t === "pro" ? "pro" : "thuong"}-${ext}`;
const title = (p, t) => `${p.name} · ${t === "pro" ? "Bản Pro" : "Bản thường"}`;

// So do -> PNG (nen toi giong tren trang, kem tieu de + ten kenh)
export async function downloadPins(pinsText, p, t) {
  const box = document.createElement("div");
  box.innerHTML = pinsHtml(pinsText, p.chip || "ESP32");
  const svg = box.querySelector("svg");
  if (!svg) return alert("Dự án này chưa có sơ đồ chân.");
  const [, , w, h] = svg.getAttribute("viewBox").split(" ").map(Number);
  const pad = 30, head = 50, foot = 30, S = 2;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", w); svg.setAttribute("height", h);
  svg.setAttribute("font-family", "Be Vietnam Pro, Segoe UI, Arial, sans-serif");
  const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml" }));
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const c = document.createElement("canvas");
  c.width = (w + pad * 2) * S; c.height = (h + head + foot) * S;
  const g = c.getContext("2d"); g.scale(S, S);
  g.fillStyle = "#0b1220"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#e8eef9"; g.font = "700 18px Be Vietnam Pro, Segoe UI, Arial";
  g.fillText("Sơ đồ đấu nối · " + title(p, t), pad, 32);
  g.drawImage(img, pad, head, w, h);
  g.fillStyle = "#8fa0bf"; g.font = "12px Be Vietnam Pro, Segoe UI, Arial";
  g.fillText("Đỏ = nguồn · Xám = GND · " + BRAND.handle, pad, head + h + 20);
  URL.revokeObjectURL(url);
  c.toBlob((b) => save(b, fname(p, t, "so-do.png")), "image/png");
}

function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Huong dan + so do -> trang in (khach chon "Luu duoi dang PDF")
export function downloadGuide(g, p, t) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${fname(p, t, "huong-dan")}</title>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm}
body{font-family:"Be Vietnam Pro",Segoe UI,Arial,sans-serif;color:#111;font-size:12.5px;line-height:1.55;margin:0}
h1{font-size:20px;margin:0 0 2px}.sub{color:#666;margin-bottom:14px}
h2{font-size:16px;margin:20px 0 8px;border-bottom:2px solid #22d3ee;padding-bottom:3px}
h4{font-size:14px;margin:14px 0 4px;color:#0e7490}p{margin:4px 0}ol,ul{margin:4px 0;padding-left:20px}li{margin:2px 0}
a{color:#0e7490}code{background:#eef;padding:0 4px;border-radius:3px}
.wire-wrap{background:#0b1220;border-radius:10px;padding:10px;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
svg{width:100%;height:auto;display:block}
table{border-collapse:collapse;width:100%;margin-top:10px;break-inside:avoid}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
th{background:#f1f5f9}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mono{font-family:Consolas,monospace}.tiny,.muted{color:#555;font-size:11px}
.foot{margin-top:24px;color:#888;font-size:10.5px;border-top:1px solid #ddd;padding-top:6px}
</style></head><body>
<h1>${title(p, t)}</h1><div class="sub">Hướng dẫn sử dụng và sơ đồ đấu nối · ${BRAND.handle}</div>
<h2>Hướng dẫn sử dụng</h2>${guideHtml(g.guide)}
<h2>Sơ đồ đấu nối</h2>${pinsHtml(g.pins, p.chip || "ESP32")}
<div class="foot">Tài liệu dành cho khách dùng bản Pro · ${BRAND.handle} · Không chia sẻ lại khi chưa được phép.</div>
</body></html>`;
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  f.onload = () => setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { console.warn(e); }
    setTimeout(() => f.remove(), 60000);
  }, 600);
  f.srcdoc = html;
}
