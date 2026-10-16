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

// Huong dan + so do -> file PDF tai thang ve may (html2pdf). Neu thu vien chua tai duoc thi mo hop thoai in.
const PDF_CSS = `
.pdfdoc{font-family:"Be Vietnam Pro",Segoe UI,Arial,sans-serif;color:#111;font-size:12.5px;line-height:1.55;background:#fff;width:680px;padding:6px 4px;box-sizing:border-box}
.pdfdoc h1{font-size:20px;margin:0 0 2px;color:#111}.pdfdoc .sub{color:#666;margin-bottom:14px}
.pdfdoc h2{font-size:16px;margin:18px 0 8px;border-bottom:2px solid #22d3ee;padding-bottom:3px;color:#111}
.pdfdoc h4{font-size:14px;margin:12px 0 4px;color:#0e7490}.pdfdoc p{margin:4px 0;color:#222}.pdfdoc ol,.pdfdoc ul{margin:4px 0;padding-left:20px;color:#222}.pdfdoc li{margin:2px 0}
.pdfdoc b{color:#000}.pdfdoc .wire-wrap{background:#0b1220;border-radius:10px;padding:10px;page-break-inside:avoid}
.pdfdoc svg{width:100%;height:auto;display:block}
.pdfdoc table{border-collapse:collapse;width:100%;margin-top:10px;page-break-inside:avoid}.pdfdoc th,.pdfdoc td{border:1px solid #ccc;padding:5px 7px;text-align:left;color:#222}
.pdfdoc th{background:#f1f5f9}.pdfdoc .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
.pdfdoc .mono{font-family:Consolas,monospace}.pdfdoc .tiny,.pdfdoc .muted{color:#555;font-size:11px}
.pdfdoc .foot{margin-top:22px;color:#888;font-size:10.5px;border-top:1px solid #ddd;padding-top:6px}`;
const docHtml = (g, p, t) => `<div class="pdfdoc"><h1>${title(p, t)}</h1><div class="sub">Hướng dẫn sử dụng và sơ đồ đấu nối · ${BRAND.handle}</div>
  <h2>Hướng dẫn sử dụng</h2>${guideHtml(g.guide)}
  <h2>Sơ đồ đấu nối</h2>${pinsHtml(g.pins, p.chip || "ESP32")}
  <div class="foot">Tài liệu dành cho khách dùng bản Pro · ${BRAND.handle} · Không chia sẻ lại khi chưa được phép.</div></div>`;

export async function downloadGuide(g, p, t, btn) {
  if (window.html2pdf) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff";
    wrap.innerHTML = `<style>${PDF_CSS}</style>${docHtml(g, p, t)}`;
    document.body.appendChild(wrap);
    const old = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Đang tạo PDF…"; }
    try {
      await window.html2pdf().set({
        margin: [12, 12, 14, 12], filename: fname(p, t, "huong-dan.pdf"),
        image: { type: "jpeg", quality: 0.95 }, html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] },
      }).from(wrap.querySelector(".pdfdoc")).save();
    } catch (e) { console.warn(e); printFallback(g, p, t); }
    wrap.remove();
    if (btn) { btn.disabled = false; btn.textContent = old; }
    return;
  }
  printFallback(g, p, t);
}

function printFallback(g, p, t) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${fname(p, t, "huong-dan")}</title>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:14mm}body{margin:0}${PDF_CSS}.pdfdoc{width:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${docHtml(g, p, t)}</body></html>`;
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  f.onload = () => setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { console.warn(e); }
    setTimeout(() => f.remove(), 60000);
  }, 600);
  f.srcdoc = html;
}
