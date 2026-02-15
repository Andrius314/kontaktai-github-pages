const { list } = require("@vercel/blob");

function json(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function pickAllowedOrigin(reqOrigin) {
  const configured = String(process.env.ALLOWED_ORIGIN || "").trim();
  if (!configured) return "*";
  const allowed = configured
    .split(",")
    .map(function (value) {
      return value.trim();
    })
    .filter(Boolean);
  return allowed.includes(reqOrigin) ? reqOrigin : "";
}

function setCors(res, reqOrigin) {
  const origin = pickAllowedOrigin(reqOrigin);
  if (!origin) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  return true;
}

module.exports = async function handler(req, res) {
  const reqOrigin = req.headers.origin || "";
  const corsAllowed = setCors(res, reqOrigin);

  if (req.method === "OPTIONS") {
    if (!corsAllowed) return json(res, 403, { error: "Origin neleidziamas." });
    return res.status(204).end();
  }

  if (!corsAllowed) {
    return json(res, 403, { error: "Origin neleidziamas." });
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Leidziamas tik GET." });
  }

  const adminKey = String(req.headers["x-admin-key"] || "").trim();
  const expected = String(process.env.ADMIN_KEY || "").trim();
  if (!expected) {
    return json(res, 500, { error: "ADMIN_KEY nenustatytas serveryje." });
  }

  if (!adminKey || adminKey !== expected) {
    return json(res, 401, { error: "Neteisingas ADMIN_KEY." });
  }

  const limitRaw = String(req.query && req.query.limit ? req.query.limit : "").trim();
  let limit = Number(limitRaw || "20");
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;

  try {
    const result = await list({ prefix: "contacts/", limit: limit });
    const blobs = (result && result.blobs) ? result.blobs : [];

    // Newest first (pathname includes ISO-like timestamp at start)
    blobs.sort(function (a, b) {
      return String(b.pathname || "").localeCompare(String(a.pathname || ""));
    });

    const items = [];
    for (const blob of blobs) {
      let data = null;
      try {
        // Blobs are stored as JSON; for public blobs this is directly readable.
        const r = await fetch(blob.url);
        data = await r.json();
      } catch (_err) {
        data = null;
      }
      items.push({
        pathname: blob.pathname,
        uploadedAt: blob.uploadedAt,
        size: blob.size,
        data: data
      });
    }

    return json(res, 200, { ok: true, items: items });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Serverio klaida." });
  }
};

