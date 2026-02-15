(function () {
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("status");
  const submitBtn = document.getElementById("submit-btn");

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = "status";
    if (type) statusEl.classList.add(type);
  }

  if (!window.APP_CONFIG) {
    setStatus("Truksta konfigracijos failo (config.js).", "error");
    submitBtn.disabled = true;
    return;
  }

  const apiBaseUrl = String(window.APP_CONFIG.apiBaseUrl || "").trim();
  const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/contact` : "/api/contact";

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("", "");

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const company = String(formData.get("company") || "").trim();

    if (!name || !email || !message) {
      setStatus("Uzpildyk visus laukus.", "error");
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
          company: company
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
    } catch (err) {
      setStatus(err.message || "Nepavyko issaugoti. Bandyk veliau.", "error");
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Siusti";
    }
  });
})();
