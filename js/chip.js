// Nhan dang mach truoc khi nap: ESP32 (esptool-js) va Arduino AVR (STK500 - Uno R3 / Nano / Pro Mini)
import { ESPLoader, Transport } from "https://cdn.jsdelivr.net/npm/esptool-js@0.7.0/bundle.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");
export const VENDORS = { 0x2341: "Arduino", 0x2A03: "Arduino.org", 0x1A86: "CH340 / CH9102", 0x10C4: "CP210x", 0x0403: "FTDI", 0x303A: "Espressif (USB trực tiếp)" };
const AVR_SIGS = { "1E950F": "ATmega328P", "1E9514": "ATmega328", "1E9516": "ATmega328PB", "1E940B": "ATmega168P", "1E9406": "ATmega168", "1E930F": "ATmega88P" };

export function usbInfo(port) {
  const i = port.getInfo(), vid = i.usbVendorId, pid = i.usbProductId;
  return { vid, pid, usb: vid ? `${hex4(vid)}:${hex4(pid)}` : "không rõ", usbName: VENDORS[vid] || "" };
}

// Doc thong tin chi tiet tu ESP da ket noi (dung chung cho buoc kiem tra va luc nap)
export async function espDetails(loader) {
  const chip = loader.chip.CHIP_NAME;
  let desc = chip, features = [], mac = "", flashMB = 0, psramMB = 0;
  try { desc = await loader.chip.getChipDescription(loader); } catch {}
  try { features = (await loader.chip.getChipFeatures(loader)).map((s) => s.trim()); } catch {}
  try { mac = String(await loader.chip.readMac(loader)).toUpperCase(); } catch {}
  try { const fs = await loader.detectFlashSize(); flashMB = parseInt(fs) || 0; } catch {}
  const ps = features.join(" ").match(/PSRAM\s*(\d+)\s*MB/i);
  if (ps) psramMB = +ps[1];
  return { kind: "esp", chip, desc, features, mac, flashMB, psramMB };
}

async function tryEsp(port, log) {
  const transport = new Transport(port, true);
  const term = { clean() {}, write() {}, writeLine: (s) => log && log(s) };
  try {
    const loader = new ESPLoader({ transport, baudrate: 115200, romBaudrate: 115200, terminal: term });
    await loader.main();
    const d = await espDetails(loader);
    try { await loader.after("hard_reset"); } catch {}
    return d;
  } finally { try { await transport.disconnect(); } catch {} }
}

async function tryAvr(port, baud) {
  await port.open({ baudRate: baud });
  const buf = []; let alive = true;
  const reader = port.readable.getReader(), writer = port.writable.getWriter();
  const pump = (async () => { try { while (alive) { const { value, done } = await reader.read(); if (done) break; if (value) for (const b of value) buf.push(b); } } catch {} })();
  const send = (b) => writer.write(new Uint8Array(b));
  const take = async (n, ms) => { const t = Date.now() + ms; while (buf.length < n && Date.now() < t) await sleep(5); return buf.length >= n ? buf.splice(0, n) : null; };
  try {
    await port.setSignals({ dataTerminalReady: true, requestToSend: true }); await sleep(250);
    await port.setSignals({ dataTerminalReady: false, requestToSend: false }); await sleep(50);
    let ok = false;
    for (let i = 0; i < 12 && !ok; i++) { buf.length = 0; await send([0x30, 0x20]); const r = await take(2, 100); ok = !!(r && r[0] === 0x14 && r[1] === 0x10); }
    if (!ok) return null;
    buf.length = 0; await send([0x75, 0x20]);
    const sig = await take(5, 300);
    if (!sig || sig[0] !== 0x14 || sig[4] !== 0x10) return null;
    return hex2(sig[1]) + hex2(sig[2]) + hex2(sig[3]);
  } finally {
    alive = false;
    try { await reader.cancel(); } catch {} try { await pump; } catch {}
    try { reader.releaseLock(); } catch {} try { writer.releaseLock(); } catch {}
    try { await port.close(); } catch {}
  }
}

// Nhan dang mach tren cong da chon. Tra ve { kind: "esp"|"avr"|"r4"|"unknown", ... }
export async function identify(port, log) {
  const u = usbInfo(port);
  log && log(`USB ID: ${u.usb}${u.usbName ? " (" + u.usbName + ")" : ""}`);
  if (u.vid === 0x2341 && (u.pid === 0x0069 || u.pid === 0x1002))
    return { ...u, kind: "r4", chip: "Renesas RA4M1", desc: u.pid === 0x0069 ? "Arduino Uno R4 Minima" : "Arduino Uno R4 WiFi" };
  // ESP truoc (pho bien nhat), sau do moi thu Arduino AVR
  try { log && log("Đang hỏi chip ESP32…"); return { ...u, ...(await tryEsp(port, log)) }; }
  catch (e) { log && log("Không phải ESP32 hoặc chưa vào được chế độ nạp: " + (e.message || e)); }
  if (u.vid !== 0x303A) {
    for (const baud of [115200, 57600]) {
      log && log(`Thử Arduino AVR ở ${baud} baud…`);
      try {
        const sig = await tryAvr(port, baud);
        if (sig) {
          const board = u.vid === 0x2341 ? "Arduino Uno R3" : baud === 57600 ? "Arduino Nano (bootloader cũ) / Pro Mini" : "Arduino Nano / Uno (bản sao)";
          return { ...u, kind: "avr", chip: AVR_SIGS[sig] || "AVR " + sig, desc: board, sig };
        }
      } catch (e) { log && log("Lỗi: " + (e.message || e)); }
    }
  }
  return { ...u, kind: "unknown", chip: "", desc: "Không nhận dạng được" };
}

// So voi yeu cau cua du an. Tra ve { ok, problems: [] }
export function checkFit(info, proj) {
  const p = [];
  if (info.kind !== "esp") p.push(`Dự án này cần ${proj.chip || "ESP32"}, mạch của bạn là ${info.desc || "loại khác"}.`);
  else {
    if (proj.chip && info.chip !== proj.chip) p.push(`Cần chip ${proj.chip}, mạch của bạn là ${info.chip}.`);
    if (proj.minFlash && info.flashMB && info.flashMB < proj.minFlash) p.push(`Cần flash ${proj.minFlash}MB, mạch của bạn chỉ có ${info.flashMB}MB.`);
  }
  const warn = [];                                 // PSRAM gan ngoai (khong nam trong chip) khong doc duoc -> chi canh bao
  if (info.kind === "esp" && proj.minPsram && info.psramMB < proj.minPsram)
    warn.push(info.psramMB ? `Dự án cần PSRAM ${proj.minPsram}MB, chip báo ${info.psramMB}MB.`
      : `Không thấy PSRAM trong chip (dự án cần ${proj.minPsram}MB, ví dụ mạch N16R8). Nếu chắc mạch có PSRAM thì vẫn nạp được.`);
  return { ok: !p.length, problems: p, warn };
}
