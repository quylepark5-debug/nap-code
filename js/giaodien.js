// Chu + mau tren trang nap. Chu trang sua trong trang quan ly (Cai dat -> Giao dien trang nap), luu o Firestore config/site.ui
// Cu phap: **chu dam**, [chu](https://link), {mach} = ten mach cua du an dang chon. Danh sach: moi dong 1 y.
export const UI_DEFAULT = {
  pageTitle: "Nạp code ESP32 · @tapsualoa",
  heroTitle: "Nạp code ESP32 **bằng 1 nút bấm**",
  heroSub: "Không cần cài Arduino. Cắm mạch vào máy tính, chọn dự án, bấm nạp.",
  steps: "Chọn dự án\nChọn bản\nCắm mạch & nạp",
  projTitle: "Dự án",
  reqTitle: "Cần chuẩn bị",
  reqList: "**Máy tính** + trình duyệt **Chrome** hoặc **Edge**\nMạch: **{mach}**\nCáp USB **có dây dữ liệu** (không dùng cáp chỉ sạc)\nWindows chưa nhận cổng COM? Cài driver [CH340](https://www.wch-ic.com/downloads/CH341SER_EXE.html) hoặc [CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)",
  fixTitle: "Không kết nối được?",
  fixList: "Giữ nút **BOOT**, nhấn rồi thả **RST**, sau đó thả **BOOT**\nBấm nạp lại\nNạp xong nhấn **RST** một lần",
  goBtn: "⚡ Kết nối mạch & nạp",
  contactTitle: "Liên hệ",
  contactSub: "Hỏi cách lắp mạch, góp ý hoặc báo lỗi",
  footer: "Trang ghi nhận lượt truy cập (loại máy, trình duyệt, quốc gia) và mã định danh của mạch khi nạp, để thống kê và hỗ trợ.\nFirmware thuộc bản quyền của @tapsualoa. Không sao chép, phát hành lại khi chưa được phép.",
  color1: "#2de2e6",
  color2: "#ff4fa8",
};

// Ten o + nhan hien trong trang quan ly (thu tu = thu tu tren form)
export const UI_FIELDS = [
  ["pageTitle", "Tiêu đề tab trình duyệt", "text"],
  ["heroTitle", "Tiêu đề lớn (**chữ** = chữ màu)", "text"],
  ["heroSub", "Dòng mô tả dưới tiêu đề", "area"],
  ["steps", "Các bước (mỗi dòng 1 bước)", "area"],
  ["projTitle", "Tiêu đề danh sách dự án", "text"],
  ["goBtn", "Chữ trên nút nạp", "text"],
  ["reqTitle", "Tiêu đề khung chuẩn bị", "text"],
  ["reqList", "Cần chuẩn bị (mỗi dòng 1 ý, {mach} = tên mạch)", "area"],
  ["fixTitle", "Tiêu đề khung khắc phục", "text"],
  ["fixList", "Các bước khắc phục (mỗi dòng 1 bước)", "area"],
  ["contactTitle", "Tiêu đề khung liên hệ", "text"],
  ["contactSub", "Mô tả khung liên hệ", "text"],
  ["footer", "Chân trang (mỗi dòng 1 dòng)", "area"],
  ["color1", "Màu chủ đạo 1", "color"],
  ["color2", "Màu chủ đạo 2", "color"],
];

const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function fmt(s, vars = {}) {
  return escH(s)
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? escH(vars[k]) : m))
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
export const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
export const uiOf = (cfg) => ({ ...UI_DEFAULT, ...Object.fromEntries(Object.entries(cfg?.ui || {}).filter(([, v]) => v !== "" && v != null)) });
const okColor = (c) => /^#[0-9a-f]{6}$/i.test(c || "");

// Ap dung len trang nap
export function applyUI(cfg, board = "ESP32") {
  const u = uiOf(cfg), $ = (id) => document.getElementById(id);
  document.title = u.pageTitle;
  const set = (id, html) => { const e = $(id); if (e) e.innerHTML = html; };
  set("uiHeroT", fmt(u.heroTitle));
  set("uiHeroP", fmt(u.heroSub));
  set("uiSteps", lines(u.steps).map((s, i) => `<span><b>${i + 1}</b>${fmt(s)}</span>`).join(""));
  set("uiProjT", fmt(u.projTitle));
  const go = $("go");                              // nut nap: chi doi chu khi da chon phien ban (chua chon thi giu loi nhac)
  if (go) { go.dataset.label = fmt(u.goBtn); if (!go.disabled) go.innerHTML = go.dataset.label; }
  set("uiReqT", fmt(u.reqTitle));
  set("uiReqL", lines(u.reqList).map((s) => `<li>${fmt(s, { mach: board })}</li>`).join(""));
  set("uiFixT", fmt(u.fixTitle));
  set("uiFixL", lines(u.fixList).map((s) => `<li>${fmt(s)}</li>`).join(""));
  set("uiContT", fmt(u.contactTitle));
  set("uiContP", fmt(u.contactSub));
  set("uiFoot", lines(u.footer).map(fmt).join("<br>"));
  const r = document.documentElement.style;
  if (okColor(u.color1)) r.setProperty("--a1", u.color1);
  if (okColor(u.color2)) r.setProperty("--a2", u.color2);
}
