const crypto = require("node:crypto");
const { put } = require("@vercel/blob");

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

async function insertContact(payload) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Serverio BLOB env kintamieji nesukonfiguruoti.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = crypto.randomBytes(6).toString("hex");
  const pathname = `contacts/${timestamp}-${suffix}.json`;

  await put(pathname, JSON.stringify(payload), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json"
  });
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

  try {
    await insertContact({
      name: name,
      email: email,
      message: message,
      createdAt: new Date().toISOString()
    });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Serverio klaida. Bandyk veliau." });
  }
};
