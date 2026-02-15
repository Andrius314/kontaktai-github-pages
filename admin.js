(function () {
  const form = document.getElementById("admin-form");
  const keyInput = document.getElementById("adminKey");
  const loadBtn = document.getElementById("load-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("list");

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = "status";
    if (type) statusEl.classList.add(type);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getEndpoint() {
    const apiBaseUrl = (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) ? String(window.APP_CONFIG.apiBaseUrl).trim() : "";
    return apiBaseUrl ? `${apiBaseUrl}/api/admin/contacts` : "/api/admin/contacts";
  }

  function getStoredKey() {
    return sessionStorage.getItem("ADMIN_KEY") || "";
  }

  function setStoredKey(value) {
    if (!value) sessionStorage.removeItem("ADMIN_KEY");
    else sessionStorage.setItem("ADMIN_KEY", value);
  }

  async function loadContacts(adminKey) {
    const endpoint = getEndpoint();
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-admin-key": adminKey
      }
    });

    const payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "Nepavyko uzkrauti.");
    }

    return payload.items || [];
  }

  function render(items) {
    if (!items.length) {
      listEl.innerHTML = "<div class=\"badge\">Nera irasu</div>";
      return;
    }

    const html = items.map(function (item) {
      const data = item.data || {};
      const name = escapeHtml(data.name || "");
      const email = escapeHtml(data.email || "");
      const message = escapeHtml(data.message || "");
      const createdAt = escapeHtml(data.createdAt || item.uploadedAt || "");
      const id = escapeHtml(item.pathname || "");

      return `
        <div class="card" style="cursor:default">
          <div class="meta">${createdAt}</div>
          <h3 style="margin:0 0 6px">${name} <span style="font-weight:600;color:var(--muted)">&lt;${email}&gt;</span></h3>
          <div style="white-space:pre-wrap;line-height:1.35">${message}</div>
          <div class="meta" style="margin-top:8px;font-family:'Space Mono',monospace">${id}</div>
        </div>
      `;
    }).join("");

    listEl.innerHTML = html;
  }

  async function runLoad(key) {
    setStatus("", "");
    listEl.innerHTML = "";
    loadBtn.disabled = true;
    loadBtn.textContent = "Kraunama...";
    try {
      const items = await loadContacts(key);
      render(items);
      setStatus(`Uzkrauta: ${items.length}`, "ok");
    } catch (err) {
      setStatus(err.message || "Nepavyko uzkrauti.", "error");
      console.error(err);
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = "Uzkrauti";
    }
  }

  logoutBtn.addEventListener("click", function () {
    setStoredKey("");
    keyInput.value = "";
    listEl.innerHTML = "";
    setStatus("Atsijungta.", "ok");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const key = String(keyInput.value || "").trim();
    if (!key) {
      setStatus("Ivesk ADMIN_KEY.", "error");
      return;
    }
    setStoredKey(key);
    runLoad(key);
  });

  const existing = getStoredKey();
  if (existing) {
    keyInput.value = existing;
    runLoad(existing);
  }
})();

