(function () {
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("status");
  const submitBtn = document.getElementById("submit-btn");
  const resultEl = document.getElementById("result");
  const resultIdEl = document.getElementById("resultId");
  const resultTimeEl = document.getElementById("resultTime");

  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const messageEl = document.getElementById("message");
  const nameHint = document.getElementById("nameHint");
  const emailHint = document.getElementById("emailHint");
  const messageHint = document.getElementById("messageHint");
  const turnstileBox = document.getElementById("turnstile");

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = "status";
    if (type) statusEl.classList.add(type);
  }

  function setHint(el, message) {
    el.textContent = message || "";
    el.className = "hint";
    if (message) el.classList.add("error");
  }

  function isValidEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }

  function validate() {
    const name = String(nameEl.value || "").trim();
    const email = String(emailEl.value || "").trim();
    const message = String(messageEl.value || "").trim();

    let ok = true;

    if (name.length < 2) {
      setHint(nameHint, "Vardas per trumpas.");
      ok = false;
    } else {
      setHint(nameHint, "");
    }

    if (!isValidEmail(email)) {
      setHint(emailHint, "Neteisingas el. pasto formatas.");
      ok = false;
    } else {
      setHint(emailHint, "");
    }

    if (message.length < 3) {
      setHint(messageHint, "Zinute per trumpa.");
      ok = false;
    } else {
      setHint(messageHint, "");
    }

    return ok;
  }

  if (!window.APP_CONFIG) {
    setStatus("Truksta konfigracijos failo (config.js).", "error");
    submitBtn.disabled = true;
    return;
  }

  const apiBaseUrl = String(window.APP_CONFIG.apiBaseUrl || "").trim();
  const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/contact` : "/api/contact";
  const turnstileSiteKey = String(window.APP_CONFIG.turnstileSiteKey || "").trim();

  let turnstileToken = "";
  let turnstileWidgetId = null;

  function initTurnstile() {
    if (!turnstileSiteKey) {
      setStatus("Nesukonfiguruota CAPTCHA (turnstileSiteKey).", "error");
      submitBtn.disabled = true;
      return;
    }

    if (!window.turnstile) {
      setTimeout(initTurnstile, 150);
      return;
    }

    try {
      turnstileWidgetId = window.turnstile.render(turnstileBox, {
        sitekey: turnstileSiteKey,
        callback: function (token) {
          turnstileToken = String(token || "");
        },
        "expired-callback": function () {
          turnstileToken = "";
        },
        "error-callback": function () {
          turnstileToken = "";
        }
      });
    } catch (err) {
      console.error(err);
      setStatus("Nepavyko inicializuoti CAPTCHA.", "error");
      submitBtn.disabled = true;
    }
  }

  initTurnstile();

  nameEl.addEventListener("input", validate);
  emailEl.addEventListener("input", validate);
  messageEl.addEventListener("input", validate);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("", "");
    resultEl.classList.add("hidden");

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const company = String(formData.get("company") || "").trim();

    if (!validate()) {
      setStatus("Patikrink laukus.", "error");
      return;
    }

    if (!turnstileToken) {
      setStatus("Patvirtink CAPTCHA.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Siunciama...";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
          company: company,
          turnstileToken: turnstileToken
        })
      });

      const payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        const errorMessage = payload.error || "Nepavyko issaugoti.";
        throw new Error(errorMessage);
      }

      form.reset();
      setStatus("Zinute issiusta sekmingai.", "ok");

      const createdAt = payload.createdAt || "";
      const id = payload.id || "";
      resultIdEl.textContent = id ? `ID: ${id}` : "";
      resultTimeEl.textContent = createdAt ? `Laikas: ${createdAt}` : "";
      resultEl.classList.remove("hidden");

      turnstileToken = "";
      if (window.turnstile) {
        try {
          if (turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
          else window.turnstile.reset();
        } catch (_err) {
          // ignore
        }
      }
    } catch (err) {
      setStatus(err.message || "Nepavyko issaugoti. Bandyk veliau.", "error");
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Siusti";
    }
  });
})();
