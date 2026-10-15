// Centinela – service worker: reproduce los videos originales de Drive
// directamente en el navegador (sin la conversión de Google), con permiso de
// acceso en cada pedido y soporte para adelantar/atrasar (pedidos por rango).
const DRIVE = "https://www.googleapis.com/drive/v3/files/";
const tamanos = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

async function tamano(id, token) {
  if (tamanos.has(id)) return tamanos.get(id);
  const r = await fetch(DRIVE + id + "?fields=size&supportsAllDrives=true",
                        { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const t = Number((await r.json()).size);
  if (t > 0) tamanos.set(id, t);
  return t > 0 ? t : null;
}

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  const m = u.pathname.match(/\/video\/([A-Za-z0-9_-]+)$/);
  if (!m) return;                                   // todo lo demás, normal
  const id = m[1], token = u.searchParams.get("t");
  e.respondWith((async () => {
    const total = await tamano(id, token);
    if (total === null) return new Response("sin acceso", { status: 401 });

    // Rango pedido por el reproductor (o el archivo completo)
    let ini = 0, fin = total - 1;
    const rango = e.request.headers.get("Range");
    const mr = rango && rango.match(/bytes=(\d*)-(\d*)/);
    if (mr) { ini = mr[1] ? +mr[1] : 0; fin = mr[2] ? Math.min(+mr[2], total - 1) : total - 1; }

    const r = await fetch(DRIVE + id + "?alt=media&supportsAllDrives=true", {
      headers: { Authorization: "Bearer " + token, Range: `bytes=${ini}-${fin}` } });
    if (r.status !== 200 && r.status !== 206) return new Response("error " + r.status, { status: r.status });

    // Google no deja leer todos sus encabezados desde la página, así que los
    // armamos nosotros: el reproductor necesita Content-Range para adelantar.
    const h = new Headers({
      "Content-Type": r.headers.get("Content-Type") || "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Length": String(fin - ini + 1)
    });
    if (mr) { h.set("Content-Range", `bytes ${ini}-${fin}/${total}`); return new Response(r.body, { status: 206, headers: h }); }
    return new Response(r.body, { status: 200, headers: h });
  })());
});
