function json(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function pickAllowedOrigin(reqOrigin) {
  const configured = process.env.ALLOWED_ORIGIN || "";
  if (!configured) return "*";
  return configured === reqOrigin ? configured : "";
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
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Serverio env kintamieji nesukonfiguruoti.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify([payload])
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert klaida: ${errorText}`);
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
      message: message
    });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Serverio klaida. Bandyk veliau." });
  }
};
