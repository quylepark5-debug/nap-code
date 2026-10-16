// Trang quan ly cua chu trang
import {
  auth, db, CHUNK, MAX_USES, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit,
  serverTimestamp, Bytes, Timestamp, esc, fmtTime, hex, normCode,
} from "./fb.js";
import { guidePath, ghEdit, ghNew } from "./guides.js";
import { openStudio } from "./studio.js";
import { UI_FIELDS, uiOf, fmt } from "./giaodien.js";

const $ = (id) => document.getElementById(id);
const P = (n) => document.querySelector(`[data-panel="${n}"]`);
const D = { visits: [], flashes: [], codes: [], projects: [], config: {} };
const DAY = 86400000;
const md5u8 = (u8) => SparkMD5.ArrayBuffer.hash(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
const toast = (t) => { const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2600); };
const tms = (ts) => ts?.toMillis ? ts.toMillis() : 0;
const pName = (id) => id === "*" ? "Tất cả dự án" : (D.projects.find((p) => p.id === id)?.name || id);
const siteUrl = () => location.href.replace(/admin\.html.*$/, "");

// ---------- Dang nhap ----------
// Trinh duyet trong ung dung (Zalo, Messenger, TikTok...) -> Google chan dang nhap
const IN_APP = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|Line\/|TikTok|musical_ly|Bytedance|; wv\)/i.test(navigator.userAgent);
const loginMsg = (t, cls = "bad") => { const m = $("loginMsg"); m.innerHTML = t; m.className = "note " + cls; };
if (IN_APP) {
  loginMsg(`Bạn đang mở trang trong <b>ứng dụng</b> (Zalo, Messenger, TikTok…). Google <b>không cho đăng nhập</b> ở đây.<br>
    Bấm <b>⋮</b> hoặc <b>…</b> ở góc màn hình → <b>Mở bằng trình duyệt</b> (Chrome / Safari).<br>
    <button class="btn sm" id="copyLink" style="margin-top:8px">📋 Chép link trang</button>`, "warn");
  $("copyLink").onclick = () => { navigator.clipboard?.writeText(location.href); $("copyLink").textContent = "Đã chép, dán vào Chrome/Safari"; };
}
const LOGIN_ERR = {
  "auth/popup-blocked": "Trình duyệt chặn cửa sổ đăng nhập. Cho phép <b>cửa sổ bật lên</b> (pop-up) cho trang này rồi bấm lại.",
  "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập. Bấm lại để thử.",
  "auth/cancelled-popup-request": "Bấm lại một lần nữa.",
  "auth/unauthorized-domain": "Tên miền chưa được cho phép trong Firebase (Authentication → Domaines autorisés).",
  "auth/network-request-failed": "Mất mạng, kiểm tra kết nối rồi thử lại.",
  "auth/operation-not-supported-in-this-environment": "Trình duyệt này không hỗ trợ đăng nhập. Mở bằng Chrome hoặc Safari.",
  "auth/web-storage-unsupported": "Trình duyệt đang chặn bộ nhớ trang (chế độ ẩn danh?). Mở bằng Chrome/Safari thường.",
};
$("gLogin").onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { loginMsg((LOGIN_ERR[e.code] || "Không đăng nhập được.") + `<br><span class="tiny">Mã lỗi: ${esc(e.code || e.message)}</span>`); }
};
$("out").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (u) => {
  // Khong ghi email chu trang trong ma nguon: thu doc danh sach ma Pro (luat Firebase chi cho chu trang) -> doc duoc = chu trang
  let owner = false;
  if (u && !u.isAnonymous) { try { await getDocs(query(collection(db, "codes"), limit(1))); owner = true; } catch {} }
  $("login").classList.toggle("hide", owner);
  $("appBox").classList.toggle("hide", !owner);
  $("who").classList.toggle("hide", !owner); $("out").classList.toggle("hide", !u || u.isAnonymous);
  if (u && !u.isAnonymous && !owner) {
    loginMsg(`Tài khoản <b>${esc(u.email)}</b> không có quyền quản lý. Bấm Đăng xuất rồi đăng nhập bằng email chủ trang.`);
  }
  if (owner) { $("who").textContent = u.email; await loadAll(); show("dash"); }
});

// ---------- Menu ----------
document.querySelectorAll("#nav button").forEach((b) => b.onclick = () => show(b.dataset.p));
function show(p) {
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.p === p));
  document.querySelectorAll("[data-panel]").forEach((e) => e.classList.toggle("hide", e.dataset.panel !== p));
  ({ dash, visits, flashes, boards, codes, projects, settings })[p]();
}

async function loadAll() {
  const since = Timestamp.fromMillis(Date.now() - 30 * DAY);
  const [v, f, c, p, cfg] = await Promise.all([
    getDocs(query(collection(db, "visits"), where("at", ">=", since), orderBy("at", "desc"), limit(5000))),
    getDocs(query(collection(db, "flashes"), orderBy("at", "desc"), limit(3000))),
    getDocs(collection(db, "codes")),
    getDocs(collection(db, "projects")),
    getDoc(doc(db, "config", "site")),
  ]);
  D.visits = v.docs.map((d) => ({ id: d.id, ...d.data() }));
  D.flashes = f.docs.map((d) => ({ id: d.id, ...d.data() }));
  D.codes = c.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => tms(b.createdAt) - tms(a.createdAt));
  D.projects = p.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  D.config = cfg.data() || {};
}
const refreshBtn = () => `<button class="btn sm" data-refresh>↻ Làm mới</button>`;
document.addEventListener("click", async (e) => {
  if (!e.target.closest("[data-refresh]")) return;
  await loadAll(); show(document.querySelector("#nav button.on").dataset.p); toast("Đã cập nhật");
});

// ---------- Bieu do nho ----------
function countBy(arr, key) {
  const m = {}; arr.forEach((x) => { const k = (typeof key === "function" ? key(x) : x[key]) || "Không rõ"; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function barsHtml(rows, top = 6) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="bars">${rows.slice(0, top).map(([k, n]) =>
    `<div class="b"><span title="${esc(k)}">${esc(k)}</span><div class="t"><i style="width:${(n / max) * 100}%"></i></div><span>${n}</span></div>`).join("") || '<div class="tiny">Chưa có dữ liệu</div>'}</div>`;
}
function dayChart(days = 14) {
  const start = new Date(); start.setHours(0, 0, 0, 0); const t0 = start.getTime() - (days - 1) * DAY;
  const v = Array(days).fill(0), f = Array(days).fill(0);
  D.visits.forEach((x) => { const i = Math.floor((tms(x.at) - t0) / DAY); if (i >= 0 && i < days) v[i]++; });
  D.flashes.forEach((x) => { const i = Math.floor((tms(x.at) - t0) / DAY); if (i >= 0 && i < days && x.ok) f[i]++; });
  const W = 640, H = 200, pad = 26, bw = (W - pad) / days, max = Math.max(4, ...v);
  let s = `<svg viewBox="0 0 ${W} ${H + 24}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>`;
  for (let k = 0; k <= 4; k++) { const y = H - (H - 10) * k / 4; s += `<line x1="${pad}" x2="${W}" y1="${y}" y2="${y}" stroke="#22304d" stroke-dasharray="3 4"/><text x="0" y="${y + 4}" fill="#5d6d8c" font-size="10">${Math.round(max * k / 4)}</text>`; }
  for (let i = 0; i < days; i++) {
    const x = pad + i * bw, hv = (H - 10) * v[i] / max, hf = (H - 10) * f[i] / max, d = new Date(t0 + i * DAY);
    s += `<rect x="${x + bw * .15}" y="${H - hv}" width="${bw * .38}" height="${hv}" rx="3" fill="url(#g)"><title>${v[i]} lượt vào</title></rect>`;
    s += `<rect x="${x + bw * .55}" y="${H - hf}" width="${bw * .3}" height="${hf}" rx="3" fill="#34d399"><title>${f[i]} lượt nạp OK</title></rect>`;
    if (i % 2 === days % 2 || days <= 7) s += `<text x="${x + bw / 2}" y="${H + 16}" fill="#8fa0bf" font-size="10" text-anchor="middle">${d.getDate()}/${d.getMonth() + 1}</text>`;
  }
  return s + "</svg>";
}

// ---------- Tong quan ----------
function dash() {
  const now = Date.now(), today = new Date().setHours(0, 0, 0, 0);
  const vT = D.visits.filter((x) => tms(x.at) >= today).length;
  const v7 = D.visits.filter((x) => tms(x.at) >= now - 7 * DAY).length;
  const people30 = new Set(D.visits.map((x) => x.uid)).size;
  const f30 = D.flashes.filter((x) => tms(x.at) >= now - 30 * DAY);
  const ok30 = f30.filter((x) => x.ok).length;
  const boards = new Set(D.flashes.filter((x) => x.ok && x.mac).map((x) => x.mac)).size;
  const proOk = D.flashes.filter((x) => x.ok && x.tier === "pro").length;
  const codesLeft = D.codes.filter((c) => c.active && (c.uses || 0) < (c.maxUses || MAX_USES)).length;
  const kpi = (l, v, d = "") => `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  P("dash").innerHTML = `
    <div class="toolbar"><h2>Tổng quan</h2>${refreshBtn()}</div>
    <div class="kpis">
      ${kpi("Lượt vào hôm nay", vT)}${kpi("Lượt vào 7 ngày", v7)}${kpi("Người vào (30 ngày)", people30, "theo trình duyệt")}
      ${kpi("Nạp thành công (30 ngày)", ok30, f30.length ? `${Math.round(ok30 / f30.length * 100)}% thành công` : "")}
      ${kpi("Mạch đã nạp", boards, "mạch khác nhau")}${kpi("Lần nạp Pro", proOk, `${codesLeft} mã còn lượt`)}
    </div>
    <div class="row2">
      <div class="card chart"><div class="small muted" style="margin-bottom:8px">14 ngày gần đây · <span style="color:#22d3ee">■</span> lượt vào · <span style="color:#34d399">■</span> nạp thành công</div>${dayChart()}</div>
      <div class="card"><div class="small muted">Quốc gia</div>${barsHtml(countBy(D.visits, "country"))}</div>
    </div>
    <div class="row2" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card"><div class="small muted">Thiết bị</div>${barsHtml(countBy(D.visits, (x) => `${x.device} · ${x.os}`))}</div>
      <div class="card"><div class="small muted">Trình duyệt</div>${barsHtml(countBy(D.visits, "browser"))}</div>
      <div class="card"><div class="small muted">Dự án được nạp</div>${barsHtml(countBy(D.flashes.filter((x) => x.ok), (x) => pName(x.project) + (x.tier === "pro" ? " (Pro)" : "")))}</div>
    </div>
    <div class="card" style="margin-top:12px"><div class="small muted" style="margin-bottom:6px">Lượt nạp mới nhất</div>${flashTable(D.flashes.slice(0, 6))}</div>`;
}

// ---------- Luot truy cap ----------
function visits() {
  P("visits").innerHTML = `<div class="toolbar"><h2>Lượt truy cập (30 ngày)</h2><span class="pill">${D.visits.length}</span>${refreshBtn()}</div>
    <div class="card tscroll"><table class="tbl"><tr><th>Thời gian</th><th>Quốc gia</th><th>Thiết bị</th><th>Trình duyệt</th><th>Màn hình</th><th>Nạp được?</th><th>Đến từ</th><th>Khách</th></tr>
    ${D.visits.slice(0, 1000).map((x) => `<tr><td>${fmtTime(x.at)}</td><td>${esc(x.country || "—")}</td><td>${esc(x.device)} · ${esc(x.os)}</td>
      <td>${esc(x.browser)}</td><td class="mono">${esc(x.screen)}</td><td>${x.serial ? '<span class="pill ok">Có</span>' : '<span class="pill">Không</span>'}</td>
      <td class="small" style="max-width:220px;word-break:break-all">${esc(x.ref || (x.hash ? "#" + x.hash : "Gõ trực tiếp"))}</td><td class="mono tiny">${esc((x.uid || "").slice(0, 6))}</td></tr>`).join("")}
    </table></div>`;
}

// ---------- Luot nap ----------
function flashTable(rows) {
  return `<table class="tbl"><tr><th>Thời gian</th><th>Dự án</th><th>Bản</th><th>Kết quả</th><th>Mạch (MAC)</th><th>Mã Pro</th><th>Thời gian nạp</th></tr>
  ${rows.map((x) => `<tr><td>${fmtTime(x.at)}</td><td>${esc(pName(x.project))}<div class="tiny">${esc(x.ver)}</div></td>
    <td>${x.tier === "pro" ? '<span class="pill pro">Pro</span>' : '<span class="pill">Thường</span>'}</td>
    <td>${x.ok ? '<span class="pill ok">Thành công</span>' : `<span class="pill bad">Lỗi: ${esc(x.stage)}</span><div class="tiny" style="max-width:240px">${esc(x.err)}</div>`}</td>
    <td class="mono">${esc(x.mac || "—")}<div class="tiny">${esc(x.chip)}</div></td><td class="mono">${esc(x.code || "")}</td>
    <td>${x.ms ? (x.ms / 1000).toFixed(0) + " s" : ""}</td></tr>`).join("") || '<tr><td colspan="7" class="tiny">Chưa có lượt nạp</td></tr>'}</table>`;
}
function flashes() {
  const ok = D.flashes.filter((x) => x.ok).length;
  P("flashes").innerHTML = `<div class="toolbar"><h2>Lượt nạp</h2><span class="pill ok">${ok} thành công</span><span class="pill bad">${D.flashes.length - ok} lỗi</span>${refreshBtn()}</div>
    <div class="card"><div class="small muted">Lỗi hay gặp ở bước</div>${barsHtml(countBy(D.flashes.filter((x) => !x.ok), "stage"), 5)}</div>
    <div class="card tscroll" style="margin-top:12px">${flashTable(D.flashes.slice(0, 1000))}</div>`;
}

// ---------- Mach da nap ----------
function boards() {
  const m = {};
  D.flashes.filter((x) => x.ok && x.mac).forEach((x) => {
    const b = m[x.mac] ||= { mac: x.mac, chip: x.chip, n: 0, first: x.at, last: x.at, proj: new Set(), pro: false, codes: new Set() };
    b.n++; if (tms(x.at) < tms(b.first)) b.first = x.at; if (tms(x.at) > tms(b.last)) b.last = x.at;
    b.proj.add(pName(x.project)); if (x.tier === "pro") b.pro = true; if (x.code) b.codes.add(x.code);
  });
  const rows = Object.values(m).sort((a, b) => tms(b.last) - tms(a.last));
  P("boards").innerHTML = `<div class="toolbar"><h2>Mạch đã nạp</h2><span class="pill">${rows.length} mạch</span>${refreshBtn()}</div>
    <p class="muted small" style="margin-top:0">Mỗi mạch ESP32 có một mã MAC riêng, nên đếm được chính xác số mạch đang chạy code của bạn.</p>
    <div class="card tscroll"><table class="tbl"><tr><th>MAC</th><th>Chip</th><th>Dự án</th><th>Bản</th><th>Số lần nạp</th><th>Lần đầu</th><th>Lần cuối</th><th>Mã Pro</th></tr>
    ${rows.map((b) => `<tr><td class="mono">${esc(b.mac)}</td><td>${esc(b.chip)}</td><td>${esc([...b.proj].join(", "))}</td>
      <td>${b.pro ? '<span class="pill pro">Pro</span>' : '<span class="pill">Thường</span>'}</td><td>${b.n}</td><td>${fmtTime(b.first)}</td><td>${fmtTime(b.last)}</td>
      <td class="mono tiny">${esc([...b.codes].join(" "))}</td></tr>`).join("") || '<tr><td colspan="8" class="tiny">Chưa có mạch nào</td></tr>'}</table></div>`;
}

// ---------- Ma Pro ----------
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  const r = crypto.getRandomValues(new Uint8Array(12));
  return normCode([...r].map((x) => ALPHA[x % 32]).join(""));
}
function shareText(c) {
  return `Mã Pro của bạn: ${c.id}\nDự án: ${pName(c.project)}\nNạp được cho ${c.maxUses || MAX_USES} mạch (nạp lại mạch đã nạp không tính thêm).\nNạp tại: ${siteUrl()}${c.project !== "*" ? "#" + c.project : ""}`;
}
function codes() {
  const opts = D.projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  P("codes").innerHTML = `<div class="toolbar"><h2>Mã Pro</h2>${refreshBtn()}</div>
    <div class="card"><h3 style="font-size:16px">Tạo mã mới</h3>
      <div class="grid2">
        <label class="field"><span>Dự án</span><select id="cProj">${opts}<option value="*">Tất cả dự án</option></select></label>
        <label class="field"><span>Ghi chú (tên khách, Zalo…)</span><input type="text" id="cNote" maxlength="120"></label>
        ${(D.config.packs || []).length ? `<label class="field"><span>Gói (tự điền số lần nạp)</span><select id="cPack"><option value="">— Chọn gói —</option>${D.config.packs.map((x, i) => `<option value="${i}">${esc(x.name)} · ${x.uses} lần · ${esc(x.price || "")}</option>`).join("")}</select></label>` : ""}
        <label class="field"><span>Số mạch mỗi mã nạp được</span><input type="number" id="cMax" value="${MAX_USES}" min="1" max="50"></label>
        <label class="field"><span>Số mã cần tạo</span><input type="number" id="cN" value="1" min="1" max="20"></label>
      </div>
      <button class="btn pri" id="cMake">＋ Tạo mã</button>
      <div id="cNew"></div>
    </div>
    <div class="card tscroll" style="margin-top:12px"><table class="tbl"><tr><th>Mã</th><th>Dự án</th><th>Ghi chú</th><th>Đã dùng</th><th>Mạch đã nạp</th><th>Lần cuối</th><th>Trạng thái</th><th></th></tr>
    ${D.codes.map((c) => {
      const max = c.maxUses || MAX_USES, u = c.uses || 0;
      const st = !c.active ? '<span class="pill bad">Đã khoá</span>' : u >= max ? '<span class="pill warn">Hết lượt</span>' : '<span class="pill ok">Còn lượt</span>';
      return `<tr><td class="mono">${esc(c.id)}</td><td>${esc(pName(c.project))}</td><td class="small">${esc(c.note)}</td>
        <td><b>${u}</b>/${max}</td><td class="mono tiny">${esc((c.macs || []).join(" "))}</td><td>${fmtTime(c.usedAt)}</td><td>${st}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-copy="${esc(c.id)}" title="Chép tin nhắn gửi khách">📋</button>
          <button class="btn sm" data-add="${esc(c.id)}" title="Thêm 5 mạch">+5</button>
          <button class="btn sm" data-lock="${esc(c.id)}">${c.active ? "Khoá" : "Mở"}</button>
          <button class="btn sm danger" data-del="${esc(c.id)}">Xoá</button></td></tr>`;
    }).join("") || '<tr><td colspan="8" class="tiny">Chưa có mã</td></tr>'}</table></div>`;

  if ($("cPack")) $("cPack").onchange = () => {
    const x = D.config.packs[$("cPack").value]; if (!x) return;
    $("cMax").value = x.uses;
    if (!$("cNote").value.trim()) $("cNote").value = x.name + " " + (x.price || "");
  };
  $("cMake").onclick = async () => {
    const n = Math.min(20, Math.max(1, +$("cN").value || 1)), max = Math.min(50, Math.max(1, +$("cMax").value || MAX_USES));
    const made = [];
    for (let i = 0; i < n; i++) {
      const id = newCode();
      const c = { project: $("cProj").value, note: $("cNote").value.trim().slice(0, 120), active: true, uses: 0, maxUses: max,
        macs: [], lastMac: "", uid: "", usedAt: null, createdAt: serverTimestamp() };
      await setDoc(doc(db, "codes", id), c);
      made.push({ id, ...c });
    }
    await loadAll(); codes();
    $("cNew").innerHTML = `<div class="note ok" style="white-space:pre-wrap">${esc(made.map(shareText).join("\n\n"))}</div>
      <button class="btn sm" id="cCopyAll" style="margin-top:8px">📋 Chép để gửi khách</button>`;
    $("cCopyAll").onclick = () => { navigator.clipboard.writeText(made.map(shareText).join("\n\n")); toast("Đã chép"); };
  };
  P("codes").querySelectorAll("[data-copy]").forEach((b) => b.onclick = () => {
    navigator.clipboard.writeText(shareText(D.codes.find((c) => c.id === b.dataset.copy))); toast("Đã chép tin nhắn gửi khách");
  });
  P("codes").querySelectorAll("[data-add]").forEach((b) => b.onclick = async () => {
    const c = D.codes.find((x) => x.id === b.dataset.add);
    await updateDoc(doc(db, "codes", c.id), { maxUses: (c.maxUses || MAX_USES) + 5 }); await loadAll(); codes(); toast("Đã thêm 5 lượt");
  });
  P("codes").querySelectorAll("[data-lock]").forEach((b) => b.onclick = async () => {
    const c = D.codes.find((x) => x.id === b.dataset.lock);
    await updateDoc(doc(db, "codes", c.id), { active: !c.active }); await loadAll(); codes();
  });
  P("codes").querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirm("Xoá mã " + b.dataset.del + "? Khách sẽ không dùng được nữa.")) return;
    await deleteDoc(doc(db, "codes", b.dataset.del)); await loadAll(); codes();
  });
}

// ---------- Du an & firmware ----------
let editId = null;
function projects() {
  P("projects").innerHTML = `<div class="toolbar"><h2>Dự án & firmware</h2><button class="btn pri sm" id="pNew">＋ Dự án mới</button></div>
    <div class="grid">${D.projects.map((p) => `<div class="card"><div style="font-size:30px">${esc(p.emoji || "🔧")}</div>
      <h3 style="font-size:17px;margin:6px 0">${esc(p.name)}</h3><div class="tiny mono">#${esc(p.id)}</div>
      <div class="meta" style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
        ${p.visible === false ? '<span class="pill bad">Đang ẩn</span>' : '<span class="pill ok">Hiện</span>'}
        <span class="pill">Thường: ${p.free?.parts?.length ? esc(p.free.ver || "có") : "chưa có"}</span>
        <span class="pill pro">Pro: ${p.pro?.parts?.length ? esc(p.pro.ver || "có") : "chưa có"}</span></div>
      <button class="btn sm" data-edit="${esc(p.id)}">Sửa / tải firmware</button>
      <button class="btn sm" data-link="${esc(p.id)}" title="Chép link riêng của dự án">🔗</button></div>`).join("")}</div>
    <div id="pEdit"></div>`;
  $("pNew").onclick = () => editProject(null);
  P("projects").querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => editProject(b.dataset.edit));
  P("projects").querySelectorAll("[data-link]").forEach((b) => b.onclick = () => { navigator.clipboard.writeText(siteUrl() + "#" + b.dataset.link); toast("Đã chép link dự án"); });
  if (editId) editProject(editId);
}

// Tu doan dia chi nap theo ten file Arduino xuat ra (ESP32-S3)
function guessOffset(name) {
  const n = name.toLowerCase();
  if (n.includes("merged")) return 0x0;
  if (n.includes("bootloader")) return 0x0;
  if (n.includes("partitions")) return 0x8000;
  if (n.includes("boot_app0")) return 0xe000;
  return 0x10000;
}

function editProject(id) {
  editId = id;
  const p = id ? D.projects.find((x) => x.id === id) : { chip: "ESP32-S3", visible: true, order: D.projects.length + 1, emoji: "🔧" };
  const f = (k, label, extra = "") => `<label class="field"><span>${label}</span><input type="text" id="e_${k}" value="${esc(p[k] ?? "")}" ${extra}></label>`;
  const tierBox = (t, title) => `<div class="card" style="margin-top:12px" data-tier="${t}">
    <h3 style="font-size:16px">${title}</h3>
    <div class="tiny">${p[t]?.parts?.length ? `Đang có: ${esc(p[t].ver)} · ${p[t].parts.map((x) => `${esc(x.name)} @${hex(x.offset)} (${Math.round(x.size / 1024)} KB)`).join(", ")} · ${fmtTime(p[t].updatedAt)}` : "Chưa có firmware"}</div>
    <div class="grid2">
      <label class="field"><span>Phiên bản</span><input type="text" data-k="ver" value="${esc(p[t]?.ver || "")}" placeholder="vd: gif2"></label>
      <label class="field"><span>Tính năng (mỗi dòng 1 ý)</span><textarea data-k="features">${esc((p[t]?.features || []).join("\n"))}</textarea></label>
    </div>

    <label class="field"><span>File firmware (.bin) — chọn cùng lúc 1 file merged, hoặc 4 file: bootloader, partitions, boot_app0, ino.bin</span>
      <input type="file" accept=".bin" multiple data-k="files"></label>
    <div class="parts" data-k="parts"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn pri sm" data-k="up">⬆ Lưu (và tải firmware nếu có chọn file)</button>
      ${p[t]?.parts?.length ? '<button class="btn sm danger" data-k="rm">Xoá bản này</button>' : ""}
    </div>
    <div class="prog hide" data-k="prog"><i></i></div><div class="tiny" data-k="msg"></div>
  </div>`;
  $("pEdit").innerHTML = `<div class="card" style="margin-top:16px">
    <div class="toolbar"><h2 style="font-size:18px">${id ? "Sửa: " + esc(p.name) : "Dự án mới"}</h2><button class="btn sm ghost" id="eClose">Đóng</button></div>
    <div class="grid2">
      ${f("id", "Mã dự án (chữ thường, không dấu, vd: gif-wifi)", id ? "disabled" : 'pattern="[a-z0-9-]+"')}
      ${f("name", "Tên dự án")}
      ${f("emoji", "Biểu tượng (emoji)")}${f("cover", "Ảnh bìa (link ảnh, không bắt buộc)")}
      ${f("desc", "Mô tả ngắn (hiện trên thẻ)")}${f("board", "Mạch cần dùng (vd: ESP32-S3 N16R8 + màn ST7789 2.4\")")}
      <label class="field"><span>Loại chip (trang sẽ chặn nếu cắm sai chip)</span><select id="e_chip">
        ${["ESP32-S3", "ESP32", "ESP32-C3", "ESP32-S2", "ESP32-C6"].map((c) => `<option ${p.chip === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      ${f("order", "Thứ tự hiển thị", 'inputmode="numeric"')}
    </div>
    <label class="field"><span>Mô tả chi tiết</span><textarea id="e_longDesc">${esc(p.longDesc || "")}</textarea></label>
    <label class="field"><span>Lưu ý cho khách (vd: sơ đồ chân, cách bấm nút)</span><textarea id="e_note">${esc(p.note || "")}</textarea></label>
    <div class="grid2">
      <label class="field"><span>Flash tối thiểu (MB) · 0 = không kiểm tra</span><input type="number" id="e_minFlash" min="0" max="128" value="${esc(p.minFlash ?? 0)}"></label>
      <label class="field"><span>PSRAM tối thiểu (MB) · 0 = không kiểm tra</span><input type="number" id="e_minPsram" min="0" max="32" value="${esc(p.minPsram ?? 0)}"></label>
    </div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin:6px 0">
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="e_visible" ${p.visible !== false ? "checked" : ""}> Hiện trên trang nạp</label>
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="e_freeOn" ${p.freeOn !== false ? "checked" : ""}> Bật <b>Bản thường</b></label>
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="e_proOn" ${p.proOn !== false ? "checked" : ""}> Bật <b>Bản Pro</b></label>
      <label class="small" style="display:flex;gap:8px;align-items:center" title="Bản Pro vẫn hiện, ai cũng nạp được không cần mã (vd khuyến mãi)"><input type="checkbox" id="e_proFree" ${p.proFree === true ? "checked" : ""}> Pro <b>không cần mã</b> (mở miễn phí)</label>
    </div>
    <div class="tiny">Tắt một bản thì khách không thấy bản đó (firmware vẫn giữ, bật lại lúc nào cũng được). "Pro không cần mã": bản Pro vẫn hiện và ai cũng nạp được, bỏ ô nhập mã.</div>
    ${id ? `<div class="note" style="margin:12px 0 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">📖 <b>Hướng dẫn · sơ đồ chân · tùy chỉnh trước khi nạp</b><br><span class="tiny">Mở trình sửa: bên trái sửa, bên phải hiện y như trang khách thấy. Bấm vào chỗ nào bên phải là nhảy tới chỗ sửa.</span></div>
      <button class="btn pri" id="eStudio">🎨 Sửa nội dung (xem như khách)</button>
      <a class="btn ghost" target="_blank" rel="noopener" href="${esc(siteUrl())}#${esc(id)}">👁 Trang thật</a></div>` : ""}
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="eSave">Lưu thông tin dự án</button>
      ${id ? '<button class="btn danger" id="eDel">Xoá dự án</button>' : ""}</div>
    ${id ? tierBox("free", "Bản thường (miễn phí)") + tierBox("pro", "Bản Pro (cần mã)") : '<p class="tiny">Lưu dự án trước, sau đó tải firmware lên.</p>'}
  </div>`;
  $("pEdit").scrollIntoView({ behavior: "smooth" });
  $("eClose").onclick = () => { editId = null; $("pEdit").innerHTML = ""; };
  $("eSave").onclick = async () => {
    const pid = id || $("e_id").value.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(pid)) return toast("Mã dự án chỉ gồm chữ thường, số, dấu gạch");
    if (!id && D.projects.some((x) => x.id === pid)) return toast("Mã dự án đã tồn tại");
    const data = { visible: $("e_visible").checked, freeOn: $("e_freeOn").checked, proOn: $("e_proOn").checked, proFree: $("e_proFree").checked,
      minFlash: Math.max(0, +$("e_minFlash").value || 0), minPsram: Math.max(0, +$("e_minPsram").value || 0), chip: $("e_chip").value, order: +$("e_order").value || 99, longDesc: $("e_longDesc").value, note: $("e_note").value };
    ["name", "emoji", "cover", "desc", "board"].forEach((k) => data[k] = $("e_" + k).value.trim());
    if (!data.name) return toast("Nhập tên dự án");
    await setDoc(doc(db, "projects", pid), data, { merge: true });
    await loadAll(); editId = pid; projects(); toast("Đã lưu dự án");
  };
  if (id) $("eDel").onclick = async () => {
    if (!confirm("Xoá dự án và toàn bộ firmware?")) return;
    for (const t of ["free", "pro"]) await clearChunks(id, t);
    await deleteDoc(doc(db, "projects", id)); editId = null; await loadAll(); projects();
  };
  if (id) document.querySelectorAll("[data-tier]").forEach((box) => wireTier(box, id, box.dataset.tier));
  if (id) $("eStudio").onclick = () => openStudio(p, async () => { await loadAll(); toast("Đã lưu nội dung, trang khách cập nhật ngay"); });
  // Nut Sua: file da co -> mo trinh sua; chua co -> mo trang tao file moi
  document.querySelectorAll("[data-gh]").forEach(async (a) => {
    const path = a.dataset.gh;
    a.href = ghEdit(path);
    try { const r = await fetch(path, { method: "HEAD", cache: "no-cache" }); if (!r.ok) { a.href = ghNew(path); a.textContent = a.textContent.replace("Sửa", "Tạo"); } } catch {}
  });
}

async function clearChunks(pid, t) {
  const s = await getDocs(collection(db, "projects", pid, t));
  for (const d of s.docs) await deleteDoc(d.ref);
}

function wireTier(box, pid, t) {
  const q = (k) => box.querySelector(`[data-k="${k}"]`);
  let files = [];
  const drawParts = () => {
    q("parts").innerHTML = files.map((f, i) => `<div class="pr"><span class="small mono">${esc(f.file.name)} · ${Math.round(f.file.size / 1024)} KB</span>
      <input type="text" class="mono" value="${hex(f.offset)}" data-i="${i}"><button class="btn sm" data-x="${i}">✕</button></div>`).join("");
    q("parts").querySelectorAll("input").forEach((inp) => inp.onchange = () => files[+inp.dataset.i].offset = parseInt(inp.value, 16) || 0);
    q("parts").querySelectorAll("[data-x]").forEach((b) => b.onclick = () => { files.splice(+b.dataset.x, 1); drawParts(); });
  };
  q("files").onchange = () => {
    files = [...q("files").files].map((file) => ({ file, offset: guessOffset(file.name) })).sort((a, b) => a.offset - b.offset);
    drawParts();
  };
  const msg = (s) => q("msg").textContent = s;
  q("up").onclick = async () => {
    const info = { ver: q("ver").value.trim(), features: q("features").value.split("\n").map((s) => s.trim()).filter(Boolean) };
    const cur = D.projects.find((x) => x.id === pid)[t] || {};
    if (!files.length) {                       // chi sua ten phien ban / tinh nang
      if (!cur.parts?.length) return toast("Chọn file firmware .bin");
      await updateDoc(doc(db, "projects", pid), { [t]: { ...cur, ...info } }); await loadAll(); toast("Đã lưu"); return;
    }
    if (new Set(files.map((f) => f.offset)).size !== files.length) return toast("Hai file trùng địa chỉ nạp");
    q("up").disabled = true; q("prog").classList.remove("hide"); const bar = q("prog").firstElementChild;
    try {
      msg("Đang đọc file…");
      const bins = await Promise.all(files.map(async (f) => new Uint8Array(await f.file.arrayBuffer())));
      const total = bins.reduce((a, b) => a + Math.ceil(b.length / CHUNK), 0); let n = 0;
      msg("Đang xoá firmware cũ…"); await clearChunks(pid, t);
      const parts = [];
      for (let i = 0; i < bins.length; i++) {
        const b = bins[i], chunks = Math.ceil(b.length / CHUNK);
        for (let j = 0; j < chunks; j++) {
          await setDoc(doc(db, "projects", pid, t, `${i}_${j}`), { d: Bytes.fromUint8Array(b.subarray(j * CHUNK, (j + 1) * CHUNK)) });
          bar.style.width = (++n / total * 100) + "%"; msg(`Đang tải lên ${n}/${total}…`);
        }
        parts.push({ name: files[i].file.name, offset: files[i].offset, size: b.length, md5: md5u8(b), chunks });
      }
      await updateDoc(doc(db, "projects", pid), { [t]: { ...info, parts, updatedAt: serverTimestamp() } });
      msg("✓ Đã tải firmware lên"); toast("Đã tải firmware lên"); await loadAll(); files = []; projects();
    } catch (e) { msg("Lỗi: " + e.message); } finally { q("up").disabled = false; }
  };
  if (q("rm")) q("rm").onclick = async () => {
    if (!confirm("Xoá firmware bản này?")) return;
    await clearChunks(pid, t); await updateDoc(doc(db, "projects", pid), { [t]: null }); await loadAll(); projects();
  };
}

// ---------- Cai dat ----------
function settings() {
  const c = D.config, f = (k, l, ph = "") => `<label class="field"><span>${l}</span><input type="text" id="s_${k}" value="${esc(c[k] || "")}" placeholder="${ph}"></label>`;
  P("settings").innerHTML = `<div class="toolbar"><h2>Cài đặt</h2></div>
    <div class="card"><h3 style="font-size:16px">Thông tin liên hệ (hiện trên trang nạp)</h3>
      <div class="grid2">
        ${f("zalo", "Zalo: link nhóm / Zalo OA / link QR (hoặc số điện thoại, số không hiện ra trang)", "https://zalo.me/g/...")}${f("zaloName", "Chữ hiện cạnh nút Zalo (để trống = chỉ hiện chữ Zalo)", "Nhóm hỗ trợ")}
        ${f("facebook", "Facebook: link trang", "https://facebook.com/...")}${f("facebookName", "Chữ hiện cạnh nút Facebook", "Tên trang")}
        ${f("tiktok", "TikTok", "@tapsualoa")}<div></div>
        ${f("otherName", "Liên hệ khác: tên nút", "Shopee")}${f("other", "Liên hệ khác: link")}
      </div>
      <button class="btn pri" id="sSave">Lưu</button></div>
    <div class="card" style="margin-top:12px"><h3 style="font-size:16px">Ảnh nền trang nạp</h3>
      <p class="muted small" style="margin:4px 0 10px">"Tự đổi mỗi ngày": mỗi ngày trang tự lấy 1 ảnh phong cảnh đẹp (giống trang chủ Google), mọi khách cùng ngày thấy cùng ảnh. Ảnh miễn phí bản quyền từ Picsum/Unsplash.</p>
      <div class="grid2">
        <div>
          <label class="field"><span>Kiểu nền</span><select id="gbMode"><option value="none">Không dùng ảnh (nền tối như cũ)</option><option value="daily">Ảnh tự đổi mỗi ngày</option><option value="own">Ảnh của bạn</option></select></label>
          <label class="field" id="gbFileRow"><span>Ảnh của bạn (trang tự thu nhỏ)</span><input type="file" id="gbFile" accept="image/*"></label>
          <label class="field"><span>Độ tối phủ lên ảnh (để chữ dễ đọc): <b id="gbDarkV">60%</b></span><input type="range" id="gbDark" min="20" max="90" value="60"></label>
          <label class="small" style="display:flex;gap:8px;align-items:center;cursor:pointer;margin:6px 0"><input type="checkbox" id="gbBlur"> Làm mờ ảnh nền</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="gbSave">Lưu ảnh nền</button><button class="btn" id="gbNext" title="Đổi sang ảnh khác cho hôm nay">🎲 Đổi ảnh khác</button></div>
          <div class="tiny" id="gbMsg" style="margin-top:6px"></div>
        </div>
        <div><div class="small muted" style="margin-bottom:6px">Xem trước</div>
          <div id="gbPv" style="aspect-ratio:16/9;border-radius:12px;border:1px solid var(--line2);background:#070b14 center/cover;position:relative;overflow:hidden">
            <div id="gbPvDim" style="position:absolute;inset:0;background:rgba(7,11,20,.6)"></div>
            <div style="position:absolute;inset:auto 12px 12px 12px;padding:10px;border-radius:10px;background:rgba(17,26,46,.82);font-size:12px">Khung chữ mẫu trên trang nạp</div>
          </div></div>
      </div></div>
    <div class="card" style="margin-top:12px"><h3 style="font-size:16px">QR ủng hộ (donate)</h3>
      <p class="muted small" style="margin:4px 0 10px">Chọn ảnh QR ngân hàng (chụp màn hình từ app ngân hàng cũng được). Hiện ở cuối trang nạp (cạnh Liên hệ). Sau khi nạp thành công chỉ hiện 1 dòng cảm ơn kèm link tới mã QR.</p>
      <div class="grid2">
        <div>
          <label class="small" style="display:flex;gap:8px;align-items:center;cursor:pointer;margin-bottom:8px"><input type="checkbox" id="dOn"> Hiện QR trên trang nạp</label>
          <label class="field"><span>Ảnh QR</span><input type="file" id="dImg" accept="image/*"></label>
          <label class="field"><span>Tiêu đề</span><input type="text" id="dT" maxlength="60" placeholder="☕ Ủng hộ mình"></label>
          <label class="field"><span>Lời nhắn (ngân hàng, tên chủ TK… nếu muốn)</span><textarea id="dP" maxlength="300" style="min-height:70px" placeholder="Nếu thấy dự án hữu ích, bạn có thể ủng hộ mình một ly cà phê…"></textarea></label>
          <label class="small" style="display:flex;gap:8px;align-items:center;cursor:pointer;margin:6px 0"><input type="checkbox" id="dAfter" checked> Hiện lời cảm ơn + link "Xem mã QR" sau khi nạp thành công</label>
          <label class="field"><span>Câu cảm ơn sau khi nạp</span><input type="text" id="dThx" maxlength="100" placeholder="Thấy hữu ích thì ủng hộ mình 1 ly cà phê nhé ☕"></label>
          <button class="btn pri" id="dSave">Lưu QR</button> <span class="tiny" id="dMsg"></span>
        </div>
        <div><div class="small muted" style="margin-bottom:6px">Xem trước</div>
          <img id="dPv" alt="" style="width:200px;height:200px;object-fit:contain;background:#fff;border-radius:12px;padding:8px;display:block"></div>
      </div></div>
    <div class="card" style="margin-top:12px"><h3 style="font-size:16px">Gói mã Pro (hiện ở ô nhập mã trên trang nạp)</h3>
      <p class="muted small" style="margin:4px 0 10px">Mỗi gói: tên, số lần nạp, giá (ghi tự do, vd "59k"), ghi chú ngắn. Tick ⭐ để làm nổi gói đó. Khi tạo mã, chọn gói là tự điền số lần nạp. Không có gói nào = trang chỉ ghi "5 lần nạp".</p>
      <div class="pkrow tiny muted"><span>Tên gói</span><span>Số lần</span><span>Giá</span><span class="pk-nt">Ghi chú</span><span>⭐</span><span></span></div>
      <div id="pkList"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <button class="btn" id="pkAdd">＋ Thêm gói</button><button class="btn pri" id="pkSave">Lưu gói</button>
        <button class="btn ghost" id="pkSample">Điền mẫu gợi ý</button>
      </div></div>
    <div class="card" style="margin-top:12px"><h3 style="font-size:16px">Giới hạn nạp bản thường</h3>
      <p class="muted small" style="margin:4px 0 10px">Mỗi máy (trình duyệt) của khách chỉ nạp được số lần này trong khung giờ. Hết lượt, trang hiện đồng hồ đếm ngược và gợi ý bản Pro. Áp dụng cho bản thường và bản Pro đang mở miễn phí (dùng chung 1 bộ đếm). Pro có mã thì không bị giới hạn. Nạp lỗi bấm "Thử lại" không bị trừ thêm.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
        <label class="small" style="display:flex;gap:8px;align-items:center;cursor:pointer;margin-bottom:10px"><input type="checkbox" id="lOn"> Bật giới hạn</label>
        <label class="field" style="width:120px"><span>Số lần nạp</span><input type="number" id="lN" min="1" max="100" value="5"></label>
        <label class="field" style="width:160px"><span>Trong</span><select id="lM">
          ${[[30, "30 phút"], [60, "1 giờ"], [120, "2 giờ"], [180, "3 giờ"], [360, "6 giờ"], [720, "12 giờ"], [1440, "1 ngày"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        <button class="btn pri" id="lSave" style="margin-bottom:10px">Lưu</button>
      </div>
      <div class="tiny" id="lMsg"></div></div>
    <div class="card" style="margin-top:12px"><h3 style="font-size:16px">Ảnh nền đồng hồ theo ngày <span class="pill pro">Bản Pro</span></h3>
      <p class="muted small" style="margin:4px 0 10px">Đăng tối đa 14 ảnh. Mỗi ngày máy khách tự tải 1 ảnh về làm nền màn đồng hồ, lần lượt theo thứ tự (hết vòng thì lặp lại). Ảnh tự cắt vừa 320×240. Khách vẫn đặt được ảnh riêng hoặc nền có sẵn.</p>
      <div id="bgGrid" class="bggrid"><div class="tiny">Đang tải…</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
        <label class="btn pri" style="cursor:pointer">＋ Thêm ảnh<input type="file" id="bgAdd" accept="image/*" multiple hidden></label>
        <span class="tiny" id="bgMsg"></span>
      </div></div>
    <div class="card" style="margin-top:12px"><div class="toolbar" style="margin:0 0 4px"><h3 style="font-size:16px;flex:1">Giao diện trang nạp</h3>
        <a class="btn sm ghost" href="${esc(siteUrl())}" target="_blank" rel="noopener">👁 Xem trang</a></div>
      <p class="muted small" style="margin:0 0 8px">Sửa mọi chữ và màu trên trang khách. <b>**chữ**</b> = chữ đậm (ở tiêu đề lớn: chữ màu), <span class="mono">[chữ](https://link)</span> = đường link. Để trống ô nào = dùng chữ mặc định.</p>
      <div class="grid2" id="uiForm">${UI_FIELDS.map(([k, l, t]) => {
        const u = uiOf(D.config), v = (D.config.ui || {})[k] ?? "";
        if (t === "color") return `<label class="field"><span>${esc(l)}</span><input type="color" data-ui="${k}" value="${esc(v || u[k])}" style="width:64px;height:38px;border:0;background:none;padding:0"></label>`;
        if (t === "area") return `<label class="field"><span>${esc(l)}</span><textarea data-ui="${k}" placeholder="${esc(u[k])}" style="min-height:${k.endsWith("List") || k === "footer" ? 110 : 70}px">${esc(v)}</textarea></label>`;
        return `<label class="field"><span>${esc(l)}</span><input type="text" data-ui="${k}" value="${esc(v)}" placeholder="${esc(u[k])}"></label>`;
      }).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <button class="btn pri" id="uiSave">Lưu giao diện</button>
        <button class="btn" id="uiFill">Điền chữ mặc định để sửa</button>
        <button class="btn danger" id="uiReset">Về mặc định</button>
      </div>
      <div class="tiny" style="margin-top:6px">Xem nhanh tiêu đề: <span id="uiPrev" style="font-weight:700;font-size:15px"></span></div></div>
    <div class="card" style="margin-top:12px"><h3 style="font-size:16px">Link trang nạp</h3>
      <p class="mono small">${esc(siteUrl())}</p><button class="btn sm" id="sCopy">📋 Chép link</button></div>
    <div class="card" style="margin-top:12px"><h3 style="font-size:16px">Logo khởi động trên máy khách</h3>
      <p class="muted small" style="margin:4px 0 10px">Đổi logo ở đây, mọi mạch đã nạp code (cả 2 bản) tự tải về khi nối WiFi nhà: lúc bật máy, lúc bật lại WiFi, khi đồng bộ thời tiết (Pro) và mỗi 6 giờ. Khách bản Pro đã tự đặt logo riêng thì giữ logo của họ.</p>
      <div class="grid2">
        <div>
          <label class="field"><span>Ảnh logo (PNG, JPG… bất kỳ cỡ, trang tự thu về 320×240)</span><input type="file" id="bImg" accept="image/*"></label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
            <label class="field" style="flex:1;min-width:120px"><span>Kiểu</span><select id="bFit"><option value="contain">Vừa khung</option><option value="cover">Lấp đầy</option></select></label>
            <label class="field"><span>Màu nền</span><input type="color" id="bBg" value="#070b14" style="width:56px;height:38px;border:0;background:none;padding:0"></label>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <button class="btn pri" id="bSave" disabled>⬆ Đăng logo</button>
            <button class="btn danger" id="bDel">Xoá (về logo mặc định)</button>
          </div>
          <div class="tiny" id="bMsg" style="margin-top:8px"></div>
        </div>
        <div>
          <div class="small muted" style="margin-bottom:6px">Xem trước trên màn 320×240</div>
          <canvas id="bPv" width="320" height="240" style="width:100%;max-width:320px;border-radius:10px;border:1px solid var(--line2);background:#000;display:block"></canvas>
        </div>
      </div></div>`;
  $("sSave").onclick = async () => {
    const d = {}; ["zalo", "zaloName", "facebook", "facebookName", "tiktok", "otherName", "other"].forEach((k) => d[k] = $("s_" + k).value.trim());
    await setDoc(doc(db, "config", "site"), d, { merge: true }); Object.assign(D.config, d); toast("Đã lưu liên hệ");
  };
  // ----- Anh nen trang nap -----
  const gb = Object.assign({ mode: "none", dark: 60, blur: false, seed: 0 }, D.config.pagebg || {});
  let gbImg = null;
  const gbUrl = async () => {
    if (gb.mode === "daily") { const d = new Date(); return `https://picsum.photos/seed/tsl${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}${gb.seed || ""}/800/450`; }
    if (gb.mode === "own") { if (gbImg) return gbImg; try { return (await getDoc(doc(db, "config", "pagebg"))).data()?.img || ""; } catch { return ""; } }
    return "";
  };
  const gbDraw = async () => {
    $("gbMode").value = gb.mode; $("gbDark").value = gb.dark; $("gbDarkV").textContent = gb.dark + "%"; $("gbBlur").checked = !!gb.blur;
    $("gbFileRow").style.display = gb.mode === "own" ? "" : "none";
    $("gbNext").style.display = gb.mode === "daily" ? "" : "none";
    const u = await gbUrl();
    $("gbPv").style.backgroundImage = u ? `url("${u}")` : "none";
    $("gbPv").style.filter = "";
    $("gbPvDim").style.background = `rgba(7,11,20,${gb.dark / 100})`;
    $("gbPvDim").style.backdropFilter = gb.blur ? "blur(3px)" : "";
  };
  $("gbMode").onchange = () => { gb.mode = $("gbMode").value; gbDraw(); };
  $("gbDark").oninput = () => { gb.dark = +$("gbDark").value; $("gbDarkV").textContent = gb.dark + "%"; $("gbPvDim").style.background = `rgba(7,11,20,${gb.dark / 100})`; };
  $("gbBlur").onchange = () => { gb.blur = $("gbBlur").checked; gbDraw(); };
  $("gbNext").onclick = () => { gb.seed = (gb.seed || 0) + 1; gbDraw(); $("gbMsg").textContent = "Bấm Lưu để dùng ảnh này"; };
  $("gbFile").onchange = async () => {
    const f = $("gbFile").files[0]; if (!f) return;
    const im = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(im.width, im.height));
    const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    let q = 0.82; gbImg = c.toDataURL("image/jpeg", q);
    while (gbImg.length > 900000 && q > 0.4) { q -= 0.1; gbImg = c.toDataURL("image/jpeg", q); }
    gbDraw(); $("gbMsg").textContent = "Bấm Lưu để đăng ảnh";
  };
  $("gbSave").onclick = async () => {
    try {
      if (gb.mode === "own") {
        if (gbImg) await setDoc(doc(db, "config", "pagebg"), { img: gbImg, updatedAt: serverTimestamp() });
        else if (!(await gbUrl())) return toast("Chọn ảnh trước");
      }
      const pagebg = { mode: gb.mode, dark: gb.dark, blur: !!gb.blur, seed: gb.seed || 0 };
      await setDoc(doc(db, "config", "site"), { pagebg }, { merge: true }); D.config.pagebg = pagebg; gbImg = null;
      $("gbMsg").textContent = "Đã lưu, mở trang nạp (Ctrl+F5) để xem"; toast("Đã lưu ảnh nền");
    } catch (e) { toast("Lỗi lưu: " + e.message); }
  };
  gbDraw();
  // ----- QR ung ho -----
  let donImg = "";
  getDoc(doc(db, "config", "donate")).then((d) => {
    const v = d.data() || {};
    donImg = v.img || ""; $("dPv").src = donImg || "";
    $("dOn").checked = !!v.on; $("dT").value = v.title || ""; $("dP").value = v.text || "";
    $("dAfter").checked = v.afterFlash !== false; $("dThx").value = v.thanks || "";
  }).catch(() => {});
  $("dImg").onchange = async () => {
    const f = $("dImg").files[0]; if (!f) return;
    const img = await createImageBitmap(f);
    const k = Math.min(1, 520 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    donImg = c.toDataURL("image/png");
    if (donImg.length > 700000) donImg = c.toDataURL("image/jpeg", 0.9);
    $("dPv").src = donImg; $("dOn").checked = true; $("dMsg").textContent = "Bấm Lưu QR để đăng";
  };
  $("dSave").onclick = async () => {
    if ($("dOn").checked && !donImg) return toast("Chọn ảnh QR trước");
    try {
      await setDoc(doc(db, "config", "donate"), { on: $("dOn").checked, img: donImg, title: $("dT").value.trim(), text: $("dP").value.trim(),
        afterFlash: $("dAfter").checked, thanks: $("dThx").value.trim(), updatedAt: serverTimestamp() });
      $("dMsg").textContent = $("dOn").checked ? "Đang hiện trên trang nạp" : "Đang ẩn"; toast("Đã lưu QR");
    } catch (e) { toast("Lỗi lưu: " + e.message); }
  };
  // ----- Goi ma Pro -----
  const pkRow = (x = {}) => `<div class="pkrow"><input type="text" class="pk-nm" value="${esc(x.name || "")}" placeholder="Gói cơ bản" maxlength="30">
    <input type="number" class="pk-us" value="${x.uses || ""}" min="1" max="50" placeholder="5">
    <input type="text" class="pk-pr" value="${esc(x.price || "")}" placeholder="59k" maxlength="20">
    <input type="text" class="pk-nt" value="${esc(x.note || "")}" placeholder="Cho 1–2 mạch" maxlength="60">
    <input type="checkbox" class="pk-hot" ${x.hot ? "checked" : ""}><button class="btn sm danger pk-del" type="button">✕</button></div>`;
  const pkDraw = (list) => {
    $("pkList").innerHTML = list.map(pkRow).join("");
    $("pkList").querySelectorAll(".pk-del").forEach((b) => b.onclick = () => b.closest(".pkrow").remove());
  };
  pkDraw(D.config.packs || []);
  $("pkAdd").onclick = () => pkDraw([...pkRead(true), {}]);
  $("pkSample").onclick = () => pkDraw([
    { name: "Gói thử", uses: 1, price: "29k", note: "Nạp 1 mạch" },
    { name: "Gói cơ bản", uses: 5, price: "79k", note: "Nạp lại thoải mái khi đổi mạch", hot: true },
    { name: "Gói thợ", uses: 20, price: "199k", note: "Cho người lắp bán lại" },
  ]);
  const pkRead = (all) => [...$("pkList").querySelectorAll(".pkrow")].map((r) => ({
    name: r.querySelector(".pk-nm").value.trim(), uses: Math.max(0, Math.min(50, parseInt(r.querySelector(".pk-us").value, 10) || 0)),
    price: r.querySelector(".pk-pr").value.trim(), note: r.querySelector(".pk-nt").value.trim(), hot: r.querySelector(".pk-hot").checked,
  })).filter((x) => all || (x.name && x.uses));
  $("pkSave").onclick = async () => {
    const packs = pkRead();
    try { await setDoc(doc(db, "config", "site"), { packs }, { merge: true }); D.config.packs = packs; pkDraw(packs); toast("Đã lưu " + packs.length + " gói"); }
    catch (e) { toast("Lỗi lưu: " + e.message); }
  };
  // ----- Gioi han nap ban thuong -----
  getDoc(doc(db, "config", "limit")).then((d) => {
    const L = d.data() || { on: false, n: 5, mins: 60 };
    $("lOn").checked = !!L.on; $("lN").value = L.n || 5; $("lM").value = String(L.mins || 60);
    $("lMsg").textContent = L.on ? `Đang bật: ${L.n} lần / ${$("lM").selectedOptions[0]?.text}` : "Đang tắt";
  }).catch(() => { $("lMsg").textContent = "Chưa đọc được (đã dán luật Firebase mới chưa?)"; });
  $("lSave").onclick = async () => {
    const n = Math.max(1, Math.min(100, Math.round(Number($("lN").value) || 5))), mins = parseInt($("lM").value, 10);
    try {
      await setDoc(doc(db, "config", "limit"), { on: $("lOn").checked, n, mins, updatedAt: serverTimestamp() });
      $("lMsg").textContent = $("lOn").checked ? `Đang bật: ${n} lần / ${$("lM").selectedOptions[0].text}` : "Đang tắt";
      toast("Đã lưu giới hạn nạp");
    } catch (e) { toast("Lỗi lưu: " + e.message); }
  };
  $("sCopy").onclick = () => { navigator.clipboard.writeText(siteUrl()); toast("Đã chép link"); };
  wireBrand();
  wireBgSet();
  // ----- Giao dien trang nap -----
  const uiEls = [...document.querySelectorAll("[data-ui]")];
  const prev = () => { const t = document.querySelector('[data-ui="heroTitle"]'); $("uiPrev").innerHTML = fmt(t.value || t.placeholder); };
  uiEls.forEach((e) => e.addEventListener("input", prev)); prev();
  $("uiFill").onclick = () => { const u = uiOf(D.config); uiEls.forEach((e) => { if (e.type !== "color" && !e.value) e.value = u[e.dataset.ui]; }); prev(); };
  $("uiSave").onclick = async () => {
    const ui = {}; uiEls.forEach((e) => { const v = e.value.trim(); if (v) ui[e.dataset.ui] = v.slice(0, 2000); });
    await saveUi(ui); D.config.ui = ui; toast("Đã lưu giao diện");
  };
  $("uiReset").onclick = async () => {
    if (!confirm("Đưa toàn bộ chữ và màu trang nạp về mặc định?")) return;
    await saveUi({}); D.config.ui = {}; settings(); toast("Đã về mặc định");
  };
}

// ---------- Bo anh nen dong ho theo ngay: config/bgset { ver, n } + config/bg0..bg13 { img } ----------
const BG_MAX = 14;
let bgImgs = [];                                     // Uint8Array RGB565 320x240
const u8ToCanvas = (u8) => {
  const c = document.createElement("canvas"); c.width = 320; c.height = 240;
  const g = c.getContext("2d"), im = g.createImageData(320, 240);
  for (let i = 0, j = 0; j < u8.length; i += 4, j += 2) {
    const k = u8[j] | (u8[j + 1] << 8);
    im.data[i] = ((k >> 11) & 31) * 255 / 31; im.data[i + 1] = ((k >> 5) & 63) * 255 / 63; im.data[i + 2] = (k & 31) * 255 / 31; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
};
async function fileToRgb565(f) {
  const bm = await createImageBitmap(f), c = document.createElement("canvas"); c.width = 320; c.height = 240;
  const g = c.getContext("2d", { willReadFrequently: true }), sc = Math.max(320 / bm.width, 240 / bm.height);
  const w = bm.width * sc, h = bm.height * sc; g.imageSmoothingQuality = "high"; g.drawImage(bm, (320 - w) / 2, (240 - h) / 2, w, h);
  const d = g.getImageData(0, 0, 320, 240).data, out = new Uint8Array(320 * 240 * 2);
  for (let i = 0, j = 0; i < d.length; i += 4, j += 2) { const k = ((d[i] >> 3) << 11) | ((d[i + 1] >> 2) << 5) | (d[i + 2] >> 3); out[j] = k & 255; out[j + 1] = k >> 8; }
  return out;
}
function drawBgGrid() {
  const grid = $("bgGrid"), day = Math.floor((Date.now() / 1000 + 7 * 3600) / 86400), today = bgImgs.length ? day % bgImgs.length : -1;
  grid.innerHTML = bgImgs.length ? "" : '<div class="tiny">Chưa có ảnh: máy khách dùng nền có sẵn (Đêm sao).</div>';
  bgImgs.forEach((u8, i) => {
    const box = document.createElement("div"); box.className = "bgitem" + (i === today ? " today" : "");
    const cv = u8ToCanvas(u8); box.appendChild(cv);
    box.insertAdjacentHTML("beforeend", `<div class="bgbar"><span>${i === today ? "Hôm nay" : "Ngày " + (((i - today) % bgImgs.length + bgImgs.length) % bgImgs.length === 1 ? "mai" : "+" + (((i - today) % bgImgs.length + bgImgs.length) % bgImgs.length))}</span>
      <button class="btn sm" data-up="${i}" title="Lên trước" ${i ? "" : "disabled"}>↑</button><button class="btn sm danger" data-rm="${i}" title="Xoá">✕</button></div>`);
    grid.appendChild(box);
  });
  grid.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { if (confirm("Xoá ảnh này?")) { bgImgs.splice(+b.dataset.rm, 1); saveBgSet(+b.dataset.rm); } });
  grid.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => { const i = +b.dataset.up; [bgImgs[i - 1], bgImgs[i]] = [bgImgs[i], bgImgs[i - 1]]; saveBgSet(i - 1); });
}
// Ghi lai tu vi tri 'from' tro di + bang chi muc
async function saveBgSet(from = 0) {
  const msg = (t) => $("bgMsg").textContent = t;
  try {
    for (let i = from; i < bgImgs.length; i++) { msg(`Đang lưu ảnh ${i + 1}/${bgImgs.length}…`); await setDoc(doc(db, "config", "bg" + i), { img: Bytes.fromUint8Array(bgImgs[i]) }); }
    for (let i = bgImgs.length; i < BG_MAX; i++) { try { await deleteDoc(doc(db, "config", "bg" + i)); } catch {} if (i > bgImgs.length + 1) break; }
    await setDoc(doc(db, "config", "bgset"), { ver: Math.floor(Date.now() / 1000), n: bgImgs.length, updatedAt: serverTimestamp() });
    msg("✓ Đã lưu. Máy khách cập nhật ở lần đồng bộ tới."); toast("Đã lưu bộ ảnh nền");
  } catch (e) { msg("Lỗi: " + e.message); }
  drawBgGrid();
}
async function wireBgSet() {
  try {
    const set = (await getDoc(doc(db, "config", "bgset"))).data();
    const n = Math.min(BG_MAX, set?.n || 0);
    bgImgs = [];
    for (let i = 0; i < n; i++) { const d = (await getDoc(doc(db, "config", "bg" + i))).data(); if (d?.img) bgImgs.push(d.img.toUint8Array()); }
  } catch (e) { $("bgMsg").textContent = "Không đọc được bộ ảnh: " + e.message; }
  drawBgGrid();
  $("bgAdd").onchange = async () => {
    const files = [...$("bgAdd").files].slice(0, BG_MAX - bgImgs.length);
    if (!files.length) return toast(`Tối đa ${BG_MAX} ảnh`);
    const from = bgImgs.length;
    for (const f of files) { try { bgImgs.push(await fileToRgb565(f)); } catch (e) { toast("Không đọc được " + f.name); } }
    $("bgAdd").value = "";
    saveBgSet(from);
  };
}

// Ghi de ca truong ui (updateDoc thay ca map, xoa duoc o da bo trong); tai lieu chua co thi tao moi
async function saveUi(ui) {
  try { await updateDoc(doc(db, "config", "site"), { ui }); }
  catch { await setDoc(doc(db, "config", "site"), { ui }, { merge: true }); }
}

// ---------- Logo dong bo ve may khach (Firestore config/brand) ----------
let brandPx = null;
async function wireBrand() {
  const pv = $("bPv"), g = pv.getContext("2d", { willReadFrequently: true }), msg = (t) => $("bMsg").textContent = t;
  // Hien logo dang dung (doc tu Firestore)
  try {
    const s = await getDoc(doc(db, "config", "brand"));
    const d = s.data();
    if (d?.has && d.img) {
      const u8 = d.img.toUint8Array(), im = g.createImageData(320, 240);
      for (let i = 0, j = 0; j < u8.length; i += 4, j += 2) {
        const k = u8[j] | (u8[j + 1] << 8);
        im.data[i] = ((k >> 11) & 31) * 255 / 31; im.data[i + 1] = ((k >> 5) & 63) * 255 / 63; im.data[i + 2] = (k & 31) * 255 / 31; im.data[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      msg(`Đang dùng logo đăng lúc ${fmtTime(d.updatedAt)}.`);
    } else { g.fillStyle = "#111"; g.fillRect(0, 0, 320, 240); msg("Chưa đăng logo: máy khách đang dùng logo mặc định có sẵn trong code."); }
  } catch (e) { msg("Không đọc được logo hiện tại: " + e.message); }

  const draw = async () => {
    const f = $("bImg").files[0]; if (!f) return;
    const bm = await createImageBitmap(f);
    g.fillStyle = $("bBg").value; g.fillRect(0, 0, 320, 240);
    const sc = $("bFit").value === "cover" ? Math.max(320 / bm.width, 240 / bm.height) : Math.min(320 / bm.width, 240 / bm.height);
    const w = bm.width * sc, h = bm.height * sc;
    g.imageSmoothingQuality = "high"; g.drawImage(bm, (320 - w) / 2, (240 - h) / 2, w, h);
    const d = g.getImageData(0, 0, 320, 240).data;
    brandPx = new Uint8Array(320 * 240 * 2);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 2) {
      const k = ((d[i] >> 3) << 11) | ((d[i + 1] >> 2) << 5) | (d[i + 2] >> 3);
      brandPx[j] = k & 255; brandPx[j + 1] = k >> 8;
    }
    $("bSave").disabled = false; msg("Xem trước bên cạnh. Bấm Đăng logo để gửi về các máy.");
  };
  $("bImg").onchange = $("bFit").onchange = $("bBg").onchange = () => draw().catch((e) => msg("Lỗi: " + e.message));
  $("bSave").onclick = async () => {
    if (!brandPx) return;
    $("bSave").disabled = true; msg("Đang đăng…");
    try {
      await setDoc(doc(db, "config", "brand"), { ver: Math.floor(Date.now() / 1000), has: true, img: Bytes.fromUint8Array(brandPx), w: 320, h: 240, updatedAt: serverTimestamp() });
      msg("✓ Đã đăng. Các máy sẽ tự cập nhật khi nối WiFi nhà."); toast("Đã đăng logo mới");
    } catch (e) { msg("Lỗi: " + e.message); }
    $("bSave").disabled = false;
  };
  $("bDel").onclick = async () => {
    if (!confirm("Xoá logo? Các máy sẽ quay về logo mặc định có sẵn trong code.")) return;
    try {
      await setDoc(doc(db, "config", "brand"), { ver: Math.floor(Date.now() / 1000), has: false, updatedAt: serverTimestamp() });
      brandPx = null; g.fillStyle = "#111"; g.fillRect(0, 0, 320, 240); msg("Đã xoá. Máy khách về logo mặc định."); toast("Đã xoá logo");
    } catch (e) { msg("Lỗi: " + e.message); }
  };
}
