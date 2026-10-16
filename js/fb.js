// Khoi tao Firebase + ham dung chung cho 2 trang
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection,
  query, where, orderBy, limit, serverTimestamp, increment, Bytes, Timestamp, writeBatch,
  getCountFromServer, arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig, BRAND } from "./config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { BRAND };
export {
  signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy,
  limit, serverTimestamp, increment, Bytes, Timestamp, writeBatch, getCountFromServer, arrayUnion,
};
export const MAX_USES = 5; // so lan nap mac dinh cua 1 ma Pro

export const CHUNK = 900000; // byte moi khoi luu trong Firestore (gioi han 1 tai lieu ~1MB)

// Cho dang nhap xong (tra ve user)
export function authReady() {
  return new Promise((ok) => { const off = onAuthStateChanged(auth, (u) => { off(); ok(u); }); });
}

// Thong tin may cua khach (khong lay gi ca nhan)
export function deviceInfo() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Khác";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Khác";
  const device = /Mobi|Android|iPhone|iPod/.test(ua) ? "Điện thoại" : /iPad|Tablet/.test(ua) ? "Máy tính bảng" : "Máy tính";
  return {
    ua: ua.slice(0, 300), browser, os, device,
    lang: (navigator.language || "").slice(0, 20),
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || "").slice(0, 60),
    screen: `${screen.width}x${screen.height}`,
    serial: "serial" in navigator,
  };
}

// Quoc gia (uoc luong qua Cloudflare, khong bat buoc)
export async function country() {
  try {
    const c = new AbortController(); setTimeout(() => c.abort(), 2500);
    const t = await (await fetch("https://www.cloudflare.com/cdn-cgi/trace", { signal: c.signal })).text();
    return (t.match(/^loc=(\w+)/m) || [])[1] || "";
  } catch { return ""; }
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtTime = (ts) => {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
};
export const hex = (n) => "0x" + Number(n).toString(16);

// Chuan hoa ma Pro: chu hoa, bo dau cach, nhom 4 ky tu
export function normCode(s) {
  const c = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return c.match(/.{1,4}/g)?.join("-") || "";
}
