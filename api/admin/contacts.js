const crypto = require("node:crypto");
const { list, head } = require("@vercel/blob");

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

function getEncKey() {
  const raw = String(process.env.DATA_ENC_KEY || "").trim();
  if (!raw) throw new Error("DATA_ENC_KEY nenustatytas serveryje.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("DATA_ENC_KEY turi buti 32B base64.");
  return key;
}

function decryptEnc(enc, key) {
  if (!enc || enc.v !== 1 || enc.alg !== "A256GCM") return null;
  const iv = Buffer.from(String(enc.iv || ""), "base64");
  const tag = Buffer.from(String(enc.tag || ""), "base64");
  const data = Buffer.from(String(enc.data || ""), "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext);
}

function seenMarkerPath(pathname) {
  const hash = crypto.createHash("sha256").update(String(pathname || ""), "utf8").digest("hex");
  return `seen/${hash}.json`;
}

async function exists(pathname) {
  try {
    await head(pathname);
    return true;
  } catch (_err) {
    return false;
  }
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

  let encKey;
  try {
    encKey = getEncKey();
  } catch (err) {
    return json(res, 500, { error: err && err.message ? err.message : "DATA_ENC_KEY klaida." });
  }

  const limitRaw = String(req.query && req.query.limit ? req.query.limit : "").trim();
  let limit = Number(limitRaw || "50");
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 50) limit = 50;

  try {
    const result = await list({ prefix: "contacts/", limit: limit });
    const blobs = (result && result.blobs) ? result.blobs : [];

    blobs.sort(function (a, b) {
      return String(b.pathname || "").localeCompare(String(a.pathname || ""));
    });

    const items = [];
    for (const blob of blobs) {
      let data = null;
      try {
        const r = await fetch(blob.url);
        const raw = await r.json();

        if (raw && raw.enc) {
          data = decryptEnc(raw.enc, encKey);
        } else if (raw && raw.name) {
          // Backward compatibility (old plain record)
          data = raw;
        } else if (raw && raw.data) {
          data = raw.data;
        } else {
          data = null;
        }
      } catch (_err) {
        data = null;
      }

      const marker = seenMarkerPath(blob.pathname);
      const isSeen = await exists(marker);

      items.push({
        pathname: blob.pathname,
        uploadedAt: blob.uploadedAt,
        size: blob.size,
        seen: isSeen,
        data: data
      });
    }

    return json(res, 200, { ok: true, items: items });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Serverio klaida." });
  }
};
