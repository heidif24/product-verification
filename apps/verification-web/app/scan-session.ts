export function getScanSession() {
  if (typeof window === "undefined") return "";
  const key = "pan_scan_session";
  let session = window.sessionStorage.getItem(key);
  if (!session) {
    session = window.crypto.randomUUID();
    window.sessionStorage.setItem(key, session);
  }
  return session;
}