// Tu kiem tra he thong sau moi lan sua trang: dong vai KHACH (tai khoan an danh rieng) de thu cac quyen doc / chan,
// va xem tung ma Pro con dung duoc khong. Khong tru luot ma, khong ghi gi len may chu.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, limit } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

let app2 = null;
const denied = (e) => e?.code === "permission-denied";

// Tra ve danh sach { ten, ok: true|false|"info", chi tiet }
export async function runChecks(D) {
  const out = [];
  const add = (name, ok, detail = "") => out.push({ name, ok, detail });
  if (!app2) app2 = initializeApp(firebaseConfig, "kiem-tra");
  const auth = getAuth(app2), db = getFirestore(app2);
  try { await signInAnonymously(auth); add("Khách vào trang (đăng nhập ẩn danh)", true); }
  catch (e) { add("Khách vào trang (đăng nhập ẩn danh)", false, "Bật Anonymous trong Firebase Authentication. " + (e.code || e.message)); return out; }
  const uid = auth.currentUser.uid;

  // Doc / chan dung nhu luat bao mat
  const tryGet = async (name, ref, expectOk, okText = "", badText = "") => {
    try { await getDoc(ref); add(name, expectOk, expectOk ? okText : badText || "Lẽ ra phải bị chặn"); }
    catch (e) { add(name, denied(e) ? !expectOk : false, denied(e) ? (expectOk ? badText || "Bị chặn (luật Firebase cũ?)" : okText || "Bị chặn đúng") : (e.code || e.message)); }
  };
  await tryGet("Đọc cấu hình trang (liên hệ, giao diện)", doc(db, "config", "site"), true);
  try { const s = await getDocs(collection(db, "projects")); add("Đọc danh sách dự án", true, s.size + " dự án"); }
  catch (e) { add("Đọc danh sách dự án", false, e.code || e.message); }

  // Luat moi nhat da duoc dan chua: cac duong dan moi phai doc duoc (tra ve "chua co" chu khong bi chan)
  await tryGet("Luật mới: bản quyền theo mạch (lic)", doc(db, "lic", "000000000000"), true, "Đã có", "Chưa dán luật mới nhất: mạch nạp Pro v5 sẽ bị khoá");
  await tryGet("Luật mới: giới hạn lượt nạp (quota)", doc(db, "quota", uid), true, "Đã có", "Chưa dán luật có phần giới hạn lượt");

  // Bao mat: khach khong duoc liet ke ma, khong doc duoc firmware Pro khi chua kich hoat
  try { await getDocs(query(collection(db, "codes"), limit(1))); add("Khách KHÔNG xem được danh sách mã", false, "Đang lộ danh sách mã!"); }
  catch (e) { add("Khách KHÔNG xem được danh sách mã", denied(e), denied(e) ? "Bị chặn đúng" : e.code || e.message); }

  let lim = null;
  try { lim = (await getDoc(doc(db, "config", "limit"))).data() || null; } catch {}
  for (const p of D.projects) {
    if (p.free?.parts?.length) {
      const exp = !(lim && lim.on);
      try { await getDoc(doc(db, "projects", p.id, "free", "0_0")); add(`${p.name}: tải firmware bản thường`, true, exp ? "OK" : "OK"); }
      catch (e) { add(`${p.name}: tải firmware bản thường`, denied(e) && !exp ? "info" : false, denied(e) && !exp ? "Đang bật giới hạn lượt: khách phải bấm nạp mới tải được (đúng)" : e.code || e.message); }
    }
    if (p.pro?.parts?.length) {
      const free = p.proFree === true, lon = !!(lim && lim.on);
      try { await getDoc(doc(db, "projects", p.id, "pro", "0_0")); add(`${p.name}: firmware Pro khi chưa có mã`, free, free ? "Pro đang mở miễn phí: tải được (đúng)" : "Lộ firmware Pro!"); }
      catch (e) {
        if (!denied(e)) add(`${p.name}: firmware Pro khi chưa có mã`, false, e.code || e.message);
        else if (!free) add(`${p.name}: firmware Pro khi chưa có mã`, true, "Bị chặn đúng, cần mã");
        else add(`${p.name}: firmware Pro khi chưa có mã`, lon, lon ? "Pro miễn phí + giới hạn lượt: phải bấm nạp mới tải (đúng)" : "Pro miễn phí nhưng bị chặn: dán luật mới");
      }
    }
  }

  // Tung ma: khach doc duoc ma (de kiem tra khi nhap) + du dieu kien nap
  const codes = D.codes || [];
  if (codes.length) {
    const c0 = codes.find((c) => c.active) || codes[0];
    await tryGet("Khách kiểm tra được mã khi nhập", doc(db, "codes", c0.id), true, "OK (thử với " + c0.id + ")");
  }
  try { await signOut(auth); } catch {}
  return out;
}

// Tinh trang tung ma Pro (tu du lieu trang quan ly)
export function codeStatus(c, D, MAX_USES) {
  const max = c.maxUses || MAX_USES, used = c.uses || 0, left = max - used;
  const projs = c.project === "*" ? D.projects : D.projects.filter((p) => p.id === c.project);
  if (!c.active) return { ok: false, text: "Đã khoá" };
  if (!projs.length) return { ok: false, text: "Dự án của mã không còn" };
  const p = projs.find((x) => x.pro?.parts?.length);
  if (!p) return { ok: false, text: "Dự án chưa có firmware Pro" };
  if (p.proOn === false) return { ok: "info", text: `Còn ${left}/${max} mạch · Bản Pro đang tắt (khách chưa thấy)` };
  if (left <= 0) return { ok: "info", text: `Hết lượt mạch mới · vẫn nạp lại được ${max} mạch cũ` };
  return { ok: true, text: `Dùng được · còn ${left}/${max} mạch` };
}
