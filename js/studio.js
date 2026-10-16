// Trinh sua noi dung trang nap "xem nhu khach": ben trai sua, ben phai hien y het trang khach.
// Bam vao cho nao ben phai -> nhay toi dong/o can sua ben trai (va nguoc lai).
// Luu vao Firestore: projects/<id>.content.{free|pro}.{guide|pins} va projects/<id>.options
import { db, doc, updateDoc, esc } from "./fb.js";
import { loadGuide, guideHtml, pinsHtml, parsePins } from "./guides.js";
import { setSchema, renderOptions } from "./tuychon.js";

const $ = (id) => document.getElementById(id);
const ESP_PINS = ["3V3", "5V", "GND", ...Array.from({ length: 49 }, (_, i) => "GPIO" + i)];
const TYPE_NAME = { text: "Ô chữ", password: "Mật khẩu", select: "Chọn 1 mục", city: "Thành phố", range: "Thanh kéo", check: "Bật/tắt" };

export async function openStudio(p, onSaved) {
  // ---- Du lieu dang sua ----
  const st = { tier: "free", tab: "guide", dirty: false, p };
  const [gF, gP] = await Promise.all([loadGuide(p, "free"), loadGuide(p, "pro")]);
  st.text = { free: { guide: gF.guide, pins: gF.pins }, pro: { guide: gP.guide, pins: gP.pins } };
  const opts = Array.isArray(p.options) && p.options.length ? p.options : await fetchJsonOpts(p.id);
  st.opts = JSON.parse(JSON.stringify(opts || []));

  // ---- Khung ----
  const ov = document.createElement("div");
  ov.className = "studio";
  ov.innerHTML = `<div class="st-top">
      <b class="st-name">🎨 ${esc(p.name)}</b>
      <div class="st-seg" id="stTier"><button data-t="free" class="on">Bản thường</button><button data-t="pro">Bản Pro</button></div>
      <div class="st-seg" id="stTab"><button data-v="guide" class="on">📖 Hướng dẫn</button><button data-v="pins">🔌 Sơ đồ chân</button><button data-v="opts">⚙️ Tùy chỉnh trước khi nạp</button></div>
      <div style="flex:1"></div>
      <span class="tiny" id="stState"></span>
      <button class="btn pri sm" id="stSave">💾 Lưu</button><button class="btn sm ghost" id="stClose">Đóng</button>
    </div>
    <div class="st-body">
      <div class="st-col st-ed"><div class="st-h">✏️ Ô sửa <span class="tiny" id="stHint"></span></div><div id="stEd"></div></div>
      <div class="st-col st-pv"><div class="st-h">👁 Khách sẽ thấy <span class="tiny">· bấm vào chỗ nào để sửa chỗ đó</span></div><div id="stPv"></div></div>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";

  const mark = (d = true) => { st.dirty = d; $("stState").textContent = d ? "● Chưa lưu" : "✓ Đã lưu"; $("stState").style.color = d ? "var(--pro)" : "var(--ok)"; };
  mark(false); $("stState").textContent = "";

  const close = () => {
    if (st.dirty && !confirm("Có thay đổi chưa lưu. Đóng luôn?")) return;
    ov.remove(); document.body.style.overflow = "";
  };
  $("stClose").onclick = close;
  $("stSave").onclick = async () => {
    $("stSave").disabled = true;
    try {
      const data = {
        "content.free.guide": st.text.free.guide, "content.free.pins": st.text.free.pins,
        "content.pro.guide": st.text.pro.guide, "content.pro.pins": st.text.pro.pins,
        options: st.opts,
      };
      await updateDoc(doc(db, "projects", p.id), data);
      mark(false);
      onSaved && onSaved();
    } catch (e) { alert("Lưu không được: " + e.message); }
    $("stSave").disabled = false;
  };
  const seg = (id, key, attr) => $(id).querySelectorAll("button").forEach((b) => b.onclick = () => {
    $(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    st[key] = b.dataset[attr]; draw();
  });
  seg("stTier", "tier", "t"); seg("stTab", "tab", "v");

  // ---- Ve lai ----
  function draw() {
    if (st.tab === "guide") drawGuide();
    else if (st.tab === "pins") drawPins();
    else drawOpts();
  }
  // Khung xem truoc giong y trang nap
  const infoFrame = (active, inner) => `<section class="card">
      <div class="toolbar" style="margin-bottom:6px"><div class="tabs">
        <button class="tab ${active === "guide" ? "on" : ""}">📖 Hướng dẫn sử dụng</button><button class="tab ${active === "pins" ? "on" : ""}">🔌 Sơ đồ chân</button></div></div>
      ${inner}</section>`;

  // ===== Huong dan =====
  function drawGuide() {
    $("stHint").textContent = "· ## = tiêu đề, 1. = bước, - = gạch đầu dòng, **chữ** = đậm";
    $("stEd").innerHTML = `<div class="st-tools">
        <button class="btn sm" data-ins="## ">Tiêu đề</button><button class="btn sm" data-ins="1. ">Bước 1, 2, 3</button>
        <button class="btn sm" data-ins="- ">Gạch đầu dòng</button><button class="btn sm" data-wrap="**">Chữ đậm</button></div>
      <textarea id="gTa" class="st-ta" spellcheck="false"></textarea>`;
    const ta = $("gTa");
    ta.value = st.text[st.tier].guide;
    const pv = () => { $("stPv").innerHTML = infoFrame("guide", `<div class="guide">${guideHtml(ta.value, true)}</div>`); wire(); hl(); };
    const lineAt = () => ta.value.slice(0, ta.selectionStart).split("\n").length - 1;
    const hl = () => {
      const n = lineAt();
      $("stPv").querySelectorAll("[data-ln]").forEach((e) => e.classList.toggle("st-hl", +e.dataset.ln === n));
      const el = $("stPv").querySelector(`[data-ln="${n}"]`); if (el) el.scrollIntoView({ block: "nearest" });
    };
    const wire = () => $("stPv").querySelectorAll("[data-ln]").forEach((e) => e.onclick = () => {
      const ls = ta.value.split("\n"), n = +e.dataset.ln;
      const a = ls.slice(0, n).reduce((s, l) => s + l.length + 1, 0);
      ta.focus(); ta.setSelectionRange(a, a + ls[n].length);
      ta.scrollTop = Math.max(0, n * 22 - ta.clientHeight / 3);
      hl();
    });
    ta.oninput = () => { st.text[st.tier].guide = ta.value; mark(); pv(); };
    ["click", "keyup"].forEach((ev) => ta.addEventListener(ev, hl));
    $("stEd").querySelectorAll("[data-ins]").forEach((b) => b.onclick = () => {
      const ls = ta.value.split("\n"), n = lineAt();
      ls[n] = b.dataset.ins + ls[n].replace(/^(##\s+|\d+[.)]\s+|[-*•]\s+)/, "");
      ta.value = ls.join("\n"); ta.oninput(); ta.focus();
    });
    $("stEd").querySelector("[data-wrap]").onclick = () => {
      const a = ta.selectionStart, b = ta.selectionEnd; if (a === b) return;
      ta.value = ta.value.slice(0, a) + "**" + ta.value.slice(a, b) + "**" + ta.value.slice(b); ta.oninput(); ta.focus();
    };
    pv();
  }

  // ===== So do chan =====
  function drawPins() {
    $("stHint").textContent = "· mỗi hàng là 1 sợi dây";
    let rows = parsePins(st.text[st.tier].pins);
    const save = () => {
      st.text[st.tier].pins = rows.filter((r) => r.comp || r.pin || r.esp)
        .map((r) => [r.comp, r.pin, r.esp, r.note].map((x) => String(x || "").replace(/\|/g, "/").trim()).join(" | ").replace(/ \| $/, "")).join("\n");
      mark(); pv();
    };
    const ed = () => {
      $("stEd").innerHTML = `<datalist id="espPins">${ESP_PINS.map((x) => `<option value="${x}">`).join("")}</datalist>
        <div class="st-pin st-pin-h tiny muted"><span>Linh kiện</span><span>Chân linh kiện</span><span>Nối vào ${esc(p.chip || "ESP32")}</span><span>Ghi chú</span><span></span></div>
        ${rows.map((r, i) => `<div class="st-pin" data-i="${i}">
          <input value="${esc(r.comp)}" data-f="comp" placeholder="Màn ST7789"><input value="${esc(r.pin)}" data-f="pin" placeholder="SDA">
          <input value="${esc(r.esp)}" data-f="esp" list="espPins" placeholder="GPIO11"><input value="${esc(r.note)}" data-f="note" placeholder="">
          <span class="st-act"><button class="btn sm" data-up title="Lên">↑</button><button class="btn sm" data-dn title="Xuống">↓</button><button class="btn sm danger" data-rm title="Xoá">✕</button></span></div>`).join("")}
        <button class="btn sm" id="pinAdd" style="margin-top:6px">＋ Thêm dây</button>
        <p class="tiny">Cùng tên linh kiện = gom chung 1 khung bên phải. Nối vào 3V3/5V = dây đỏ, GND = dây xám.</p>`;
      $("stEd").querySelectorAll(".st-pin[data-i]").forEach((row) => {
        const i = +row.dataset.i;
        row.querySelectorAll("input").forEach((inp) => {
          inp.oninput = () => { rows[i][inp.dataset.f] = inp.value; save(); };
          inp.onfocus = () => hl(i);
        });
        row.querySelector("[data-up]").onclick = () => { if (i > 0) { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; save(); ed(); } };
        row.querySelector("[data-dn]").onclick = () => { if (i < rows.length - 1) { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; save(); ed(); } };
        row.querySelector("[data-rm]").onclick = () => { rows.splice(i, 1); save(); ed(); };
      });
      $("pinAdd").onclick = () => {
        const last = rows[rows.length - 1];
        rows.push({ comp: last?.comp || "", pin: "", esp: "", note: "" }); ed();
        const r = $("stEd").querySelector(`.st-pin[data-i="${rows.length - 1}"] input[data-f="pin"]`); r && r.focus();
      };
    };
    // Chi so hang trong bang xem truoc = chi so trong rows da loc (bo hang trong)
    const pvIdx = () => { const m = []; rows.forEach((r, i) => { if (r.comp && r.esp) m.push(i); }); return m; };
    const hl = (i) => {
      const k = pvIdx().indexOf(i);
      $("stPv").querySelectorAll("[data-i]").forEach((e) => e.classList.toggle("st-hl", +e.dataset.i === k));
      $("stEd").querySelectorAll(".st-pin[data-i]").forEach((e) => e.classList.toggle("st-hl", +e.dataset.i === i));
      const el = $("stPv").querySelector(`tr[data-i="${k}"]`); if (el) el.scrollIntoView({ block: "nearest" });
    };
    const pv = () => {
      $("stPv").innerHTML = infoFrame("pins", pinsHtml(st.text[st.tier].pins, p.chip || "ESP32"));
      const m = pvIdx();
      $("stPv").querySelectorAll("[data-i]").forEach((e) => e.onclick = () => {
        const i = m[+e.dataset.i]; if (i == null) return;
        const inp = $("stEd").querySelector(`.st-pin[data-i="${i}"] input`); inp && inp.focus(); hl(i);
        inp && inp.scrollIntoView({ block: "nearest" });
      });
    };
    ed(); pv();
  }

  // ===== Tuy chinh truoc khi nap (dung chung 2 ban) =====
  function drawOpts() {
    $("stHint").textContent = "· dùng chung cho 2 bản, đổi Bản thường/Pro ở trên để xem khác nhau";
    if (!st.opts.length) { $("stEd").innerHTML = '<p class="tiny">Dự án này chưa có tùy chỉnh trước khi nạp (cần Claude thêm vào firmware trước).</p>'; $("stPv").innerHTML = ""; return; }
    const ed = () => {
      $("stEd").innerHTML = st.opts.map((o, i) => {
        let def;
        if (o.type === "select") def = `<select data-f="default">${o.choices.map(([v, l]) => `<option value="${esc(v)}" ${String(o.default) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
        else if (o.type === "check") def = `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="default" ${o.default ? "checked" : ""}> Bật sẵn</label>`;
        else if (o.type === "range") def = `<input type="number" data-f="default" value="${esc(o.default)}" min="${o.min}" max="${o.max}">`;
        else if (o.type === "password") def = '<span class="tiny muted">Mật khẩu khách tự nhập, không có sẵn</span>';
        else if (o.type === "city") def = `<input data-f="default" value="${esc(o.default)}">`;
        else def = `<input data-f="default" value="${esc(o.default)}" maxlength="${o.max || 64}">`;
        return `<div class="st-opt" data-key="${esc(o.key)}">
          <div class="st-opt-h"><span class="pill">${TYPE_NAME[o.type] || o.type}</span>
            <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="pro" ${o.tier === "pro" ? "checked" : ""}> Chỉ bản Pro</label>
            <span style="flex:1"></span><button class="btn sm" data-up>↑</button><button class="btn sm" data-dn>↓</button></div>
          <label class="field"><span>Tên ô</span><input data-f="label" value="${esc(o.label)}"></label>
          <label class="field"><span>Dòng giải thích nhỏ</span><input data-f="help" value="${esc(o.help || "")}"></label>
          <label class="field"><span>Giá trị có sẵn</span>${def}</label></div>`;
      }).join("") + '<p class="tiny">Không đổi được loại ô và mã bên trong (phải khớp với firmware).</p>';
      $("stEd").querySelectorAll(".st-opt").forEach((box, i) => {
        const o = st.opts[i];
        box.querySelectorAll("[data-f]").forEach((el) => {
          const f = el.dataset.f;
          const set = () => {
            if (f === "pro") o.tier = el.checked ? "pro" : "all";
            else if (f === "default") o.default = el.type === "checkbox" ? el.checked : o.type === "range" ? Number(el.value) : el.value;
            else o[f] = el.value;
            mark(); pv();
          };
          el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input", set);
          el.addEventListener("focus", () => hl(o.key));
        });
        box.querySelector("[data-up]").onclick = () => { if (i > 0) { [st.opts[i - 1], st.opts[i]] = [st.opts[i], st.opts[i - 1]]; mark(); ed(); pv(); } };
        box.querySelector("[data-dn]").onclick = () => { if (i < st.opts.length - 1) { [st.opts[i + 1], st.opts[i]] = [st.opts[i], st.opts[i + 1]]; mark(); ed(); pv(); } };
      });
    };
    const hl = (key) => {
      $("stPv").querySelectorAll(".opt").forEach((e) => e.classList.toggle("st-hl", e.dataset.key === key));
      $("stEd").querySelectorAll(".st-opt").forEach((e) => e.classList.toggle("st-hl", e.dataset.key === key));
    };
    const pv = () => {
      $("stPv").innerHTML = `<div class="card"><details class="opts" open>
        <summary>⚙️ Tùy chỉnh máy trước khi nạp <span class="tiny">(không bắt buộc)</span></summary>
        <div class="tiny" style="margin:6px 0 10px">Các lựa chọn được ghi thẳng vào mạch lúc nạp, không gửi lên máy chủ. Sau này vẫn đổi lại được trên máy.</div>
        <div id="stOptForm" class="opt-grid"></div></details></div>`;
      setSchema(st.opts, p.id);
      renderOptions($("stOptForm"), st.tier, true, true);
      $("stPv").querySelectorAll(".opt").forEach((e) => e.addEventListener("click", () => {
        hl(e.dataset.key);
        const box = $("stEd").querySelector(`.st-opt[data-key="${e.dataset.key}"]`);
        if (box) { box.scrollIntoView({ block: "center", behavior: "smooth" }); box.querySelector('[data-f="label"]').focus(); }
      }, true));
    };
    ed(); pv();
  }

  draw();
}

async function fetchJsonOpts(id) {
  try {
    const r = await fetch(`huong-dan/${id}/tuy-chon.json?t=${Date.now()}`, { cache: "no-cache" });
    if (r.ok) return (await r.json()).options || [];
  } catch {}
  return [];
}
