const crypto = require("node:crypto");
const { put, del } = require("@vercel/blob");

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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  return true;
}

function seenMarkerPath(pathname) {
  const hash = crypto.createHash("sha256").update(String(pathname || ""), "utf8").digest("hex");
  return `seen/${hash}.json`;
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

  if (req.method !== "POST") {
    return json(res, 405, { error: "Leidziamas tik POST." });
  }

  const adminKey = String(req.headers["x-admin-key"] || "").trim();
  const expected = String(process.env.ADMIN_KEY || "").trim();
  if (!expected) return json(res, 500, { error: "ADMIN_KEY nenustatytas serveryje." });
  if (!adminKey || adminKey !== expected) return json(res, 401, { error: "Neteisingas ADMIN_KEY." });

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_err) {
      return json(res, 400, { error: "Neteisingas JSON formatas." });
    }
  }

  const pathname = String(body.pathname || "").trim();
  const seen = !!body.seen;
  if (!pathname || !pathname.startsWith("contacts/")) {
    return json(res, 400, { error: "Neteisingas pathname." });
  }

  const marker = seenMarkerPath(pathname);

  try {
    if (seen) {
      await put(marker, JSON.stringify({ pathname: pathname, seenAt: new Date().toISOString() }), {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
        allowOverwrite: true
      });
    } else {
      await del(marker);
    }
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Serverio klaida." });
  }
};

