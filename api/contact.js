const crypto = require("node:crypto");
const { put } = require("@vercel/blob");

const RATE_STATE = globalThis.__kontaktai_rate_state || new Map();
globalThis.__kontaktai_rate_state = RATE_STATE;

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").trim();
  if (xff) return xff.split(",")[0].trim();
  const realIp = String(req.headers["x-real-ip"] || "").trim();
  if (realIp) return realIp;
  return (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : "";
}

function checkRateLimit(ip) {
  if (!ip) return true;
  const now = Date.now();
  const entry = RATE_STATE.get(ip) || { last: 0, hits: [] };

  // Keep last hour only.
  entry.hits = entry.hits.filter(function (t) {
    return now - t < 60 * 60 * 1000;
  });

  // Burst limit: 1 request / 8s.
  if (entry.last && now - entry.last < 8000) {
    return false;
  }

  // Hourly limit: 20 requests / hour.
  if (entry.hits.length >= 20) {
    return false;
  }

  entry.last = now;
  entry.hits.push(now);
  RATE_STATE.set(ip, entry);
  return true;
}

async function verifyTurnstile(turnstileToken, ip) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY nenustatytas serveryje.");
  }

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", String(turnstileToken || ""));
  if (ip) params.set("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const j = await r.json().catch(function () {
    return null;
  });

  if (!j || !j.success) {
    throw new Error("CAPTCHA nepavyko. Pabandyk dar karta.");
  }
}

function getEncKey() {
  const raw = String(process.env.DATA_ENC_KEY || "").trim();
  if (!raw) throw new Error("DATA_ENC_KEY nenustatytas serveryje.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("DATA_ENC_KEY turi buti 32B base64.");
  return key;
}

function encryptObject(obj) {
  const key = getEncKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: "A256GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  };
}

async function insertContact(payloadPlain) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN nenustatytas serveryje.");
  }

  const createdAt = payloadPlain.createdAt;
  const timestamp = createdAt.replace(/[:.]/g, "-");
  const suffix = crypto.randomBytes(8).toString("hex");
  const pathname = `contacts/${timestamp}-${suffix}.json`;

  const record = {
    v: 1,
    createdAt: createdAt,
    enc: encryptObject(payloadPlain)
  };

  await put(pathname, JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json"
  });

  return pathname;
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

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return json(res, 429, { error: "Per daug uzklausu. Pabandyk veliau." });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_err) {
      return json(res, 400, { error: "Neteisingas JSON formatas." });
    }
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const message = String(body.message || "").trim();
  const company = String(body.company || "").trim();
  const turnstileToken = String(body.turnstileToken || "").trim();

  if (company) {
    // Honeypot laukas: jei uzpildytas, laikome spamu.
    return json(res, 200, { ok: true });
  }

  if (!name || !email || !message) {
    return json(res, 400, { error: "Truksta privalomu lauku." });
  }

  if (name.length < 2 || name.length > 80) {
    return json(res, 400, { error: "Netinkamas vardo ilgis." });
  }

  if (!isValidEmail(email) || email.length > 160) {
    return json(res, 400, { error: "Netinkamas el. pastas." });
  }

  if (message.length < 3 || message.length > 2000) {
    return json(res, 400, { error: "Netinkamas zinutes ilgis." });
  }

  if (!turnstileToken) {
    return json(res, 400, { error: "Truksta CAPTCHA." });
  }

  try {
    await verifyTurnstile(turnstileToken, ip);
    const createdAt = new Date().toISOString();
    const id = await insertContact({
      name: name,
      email: email,
      message: message,
      createdAt: createdAt
    });
    return json(res, 200, { ok: true, id: id, createdAt: createdAt });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error && error.message ? error.message : "Serverio klaida." });
  }
};

