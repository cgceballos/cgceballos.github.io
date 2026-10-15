// Centinela – service worker: reproduce los videos originales de Drive
// directamente en el navegador (sin pasar por la conversión de Google),
// agregando el permiso de acceso a cada pedido y permitiendo adelantar/atrasar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  const m = u.pathname.match(/\/video\/([A-Za-z0-9_-]+)$/);
  if (!m) return;                                   // todo lo demás, normal
  const token = u.searchParams.get("t");
  e.respondWith((async () => {
    const h = new Headers({ Authorization: "Bearer " + token });
    const rango = e.request.headers.get("Range");
    if (rango) h.set("Range", rango);
    const r = await fetch(
      "https://www.googleapis.com/drive/v3/files/" + m[1] + "?alt=media&supportsAllDrives=true",
      { headers: h });
    // Se reenvía tal cual (incluye 206 Partial Content para adelantar el video)
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers });
  })());
});
