// Tuy chon khach chinh truoc khi nap (doc tu huong-dan/<ma du an>/tuy-chon.json).
// Gia tri duoc ghep thanh khoi cau hinh "UCF1" va ghi vao flash 0xF000 cung luc nap - khong gui len may chu.
import { CITIES } from "./cities.js";

export const UCFG_ADDR = 0xF000;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let schema = null, projId = null;

// p = du an (uu tien tuy chon chu trang sua trong trang quan ly), hoac ma du an
export async function loadOptions(p) {
  const id = typeof p === "string" ? p : p.id;
  projId = id; schema = null;
  if (typeof p === "object" && Array.isArray(p.options) && p.options.length) { schema = p.options; return true; }
  try {
    const r = await fetch(`huong-dan/${id}/tuy-chon.json?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-cache" });
    if (r.ok) schema = (await r.json()).options || null;
  } catch {}
  return !!(schema && schema.length);
}

const store = (k, v) => { try { localStorage.setItem(`opt_${projId}_${k}`, JSON.stringify(v)); } catch {} };
const recall = (k) => { try { const v = localStorage.getItem(`opt_${projId}_${k}`); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } };

// Dung cho trang quan ly: xem truoc voi danh sach tuy chon dang sua
export function setSchema(list, id) { schema = list; projId = id; }

// Ve form; tier = "free" | "pro" (muc Pro bi khoa khi chon ban thuong); preview = khong doc/ghi gia tri da luu
export function renderOptions(box, tier, proAvail = true, preview = false) {
  if (!schema) { box.innerHTML = ""; return; }
  // Ban thuong: an han cac muc Pro (chi ghi 1 dong "ban Pro co them...") cho form gon
  const proOnly = schema.filter((o) => o.tier === "pro");
  const more = tier !== "pro" && proAvail && proOnly.length
    ? `<div class="opt-more tiny">Bản Pro có thêm: ${proOnly.map((o) => esc(o.label)).join(", ")}.</div>` : "";
  box.innerHTML = schema.filter((o) => o.tier !== "pro" || (proAvail && tier === "pro")).map((o) => {
    const lock = o.tier === "pro" && tier !== "pro";
    const saved = o.type === "password" || preview ? undefined : recall(o.key);
    const v = saved !== undefined ? saved : o.default;
    const id = "opt_" + o.key;
    const tag = o.tier === "pro" ? ' <span class="pill pro" style="padding:1px 7px">PRO</span>' : "";
    let input;
    if (o.type === "select") input = `<select id="${id}">${o.choices.map(([cv, cl]) => `<option value="${esc(cv)}" ${String(v) === String(cv) ? "selected" : ""}>${esc(cl)}</option>`).join("")}</select>`;
    else if (o.type === "city") input = `<select id="${id}">${CITIES.map((c) => `<option ${c[0] === v ? "selected" : ""}>${esc(c[0])}</option>`).join("")}</select>`;
    else if (o.type === "range") input = `<div class="rng"><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${esc(v)}"><b id="${id}_v">${esc(v)}${esc(o.unit || "")}</b></div>`;
    else if (o.type === "check") input = `<label class="chk"><input type="checkbox" id="${id}" ${v ? "checked" : ""}> Bật</label>`;
    // Mat khau WiFi: dung o chu thuong + che dau cham -> trinh duyet khong hoi "luu mat khau" / canh bao lo mat khau
    else if (o.type === "password") input = `<div class="pwrap"><input type="text" class="pw" id="${id}" value="" maxlength="${o.max || 64}" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other"><button type="button" class="pweye" tabindex="-1" title="Hiện/ẩn">👁</button></div>`;
    else input = `<input type="text" id="${id}" value="${esc(v)}" maxlength="${o.max || 64}" autocomplete="off" spellcheck="false" data-lpignore="true" data-form-type="other">`;
    return `<div class="opt ${lock ? "lock" : ""}" data-key="${esc(o.key)}">
      <label class="field"><span>${esc(o.label)}${tag}</span>${input}</label>
      ${lock ? '<div class="tiny">Có ở bản Pro</div>' : o.help ? `<div class="tiny">${esc(o.help)}</div>` : ""}</div>`;
  }).join("") + more + '<div class="opt-act"><button class="btn sm ghost" id="optReset" type="button">↺ Về mặc định</button></div>';
  schema.forEach((o) => {
    const el = box.querySelector("#opt_" + o.key);
    if (!el) return;
    if (o.tier === "pro" && tier !== "pro") el.disabled = true;
    const save = () => {
      const val = o.type === "check" ? el.checked : el.value;
      if (o.type === "range") box.querySelector(`#opt_${o.key}_v`).textContent = val + (o.unit || "");
      if (o.type !== "password" && !preview) store(o.key, val);
    };
    el.addEventListener(o.type === "range" ? "input" : "change", save);
  });
  box.querySelectorAll(".pweye").forEach((b) => b.onclick = () => b.previousElementSibling.classList.toggle("show"));
  box.querySelector("#optReset").onclick = () => {
    schema.forEach((o) => { try { localStorage.removeItem(`opt_${projId}_${o.key}`); } catch {} });
    renderOptions(box, tier, proAvail, preview);
  };
}

// Kiem tra gia tri; tra ve chuoi loi hoac ""
export function checkOptions(box) {
  if (!schema) return "";
  for (const o of schema) {
    const el = box.querySelector("#opt_" + o.key);
    if (!el || el.disabled || o.type === "check" || o.type === "select" || o.type === "city" || o.type === "range") continue;
    const v = el.value;
    if (!v && o.allowEmpty) continue;
    if (!v && o.key === "ap_ssid") return `Nhập "${o.label}".`;
    if (v && o.min && v.length < o.min) return `"${o.label}" cần ít nhất ${o.min} ký tự.`;
    if (o.max && v.length > o.max) return `"${o.label}" tối đa ${o.max} ký tự.`;
  }
  const s = box.querySelector("#opt_sta_ssid"), p = box.querySelector("#opt_sta_pass");
  if (s && p && !s.value && p.value) return "Đã nhập mật khẩu WiFi nhà nhưng chưa nhập tên WiFi nhà.";
  return "";
}

// Tao khoi cau hinh de ghi vao flash (Uint8Array) hoac null neu du an khong co tuy chon
export function buildConfig(box, tier) {
  if (!schema) return null;
  const enc = (s) => encodeURIComponent(String(s));
  const lines = ["UCF1", "t=" + Math.floor(Date.now() / 1000)];
  for (const o of schema) {
    if (o.tier === "pro" && tier !== "pro") continue;
    const el = box.querySelector("#opt_" + o.key);
    if (!el) continue;
    if (o.type === "check") lines.push(`${o.key}=${el.checked ? 1 : 0}`);
    else if (o.type === "city") {
      const c = CITIES.find((x) => x[0] === el.value);
      if (c) lines.push(`city=${enc(c[0])}`, `lat=${c[1]}`, `lon=${c[2]}`);
    } else if (o.key === "sta_ssid" || o.key === "sta_pass") { if (el.value) lines.push(`${o.key}=${enc(el.value)}`); }
    else lines.push(`${o.key}=${enc(el.value)}`);
  }
  const txt = lines.join("\n") + "\n";
  const u8 = new TextEncoder().encode(txt);
  if (u8.length > 1000) throw new Error("Cấu hình quá dài");
  const out = new Uint8Array(u8.length + 1);       // them byte 0 ket thuc
  out.set(u8);
  return out;
}

// Ghep khoi cau hinh vao danh sach file nap: neu co file phu vung 0xF000 (vd merged.bin) thi ghi de vao do, khong thi them 1 muc rieng
export function attachConfig(files, blob) {
  if (!blob) return files;
  for (const f of files) {
    if (f.address <= UCFG_ADDR && f.address + f.data.length >= UCFG_ADDR + 4096) {
      const o = UCFG_ADDR - f.address;
      f.data.fill(0xFF, o, o + 4096);
      f.data.set(blob, o);
      return files;
    }
  }
  const pad = new Uint8Array(4096).fill(0xFF);
  pad.set(blob);
  return [...files, { data: pad, address: UCFG_ADDR }].sort((a, b) => a.address - b.address);
}
