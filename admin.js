(function () {
  const form = document.getElementById("admin-form");
  const keyInput = document.getElementById("adminKey");
  const loadBtn = document.getElementById("load-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const exportXlsxBtn = document.getElementById("export-xlsx-btn");
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("list");

  const qEl = document.getElementById("q");
  const fromEl = document.getElementById("from");
  const toEl = document.getElementById("to");
  const unreadOnlyEl = document.getElementById("unreadOnly");
  const autoSeenEl = document.getElementById("autoSeen");
  const sortEl = document.getElementById("sort");
  const limitEl = document.getElementById("limit");

  let rawItems = [];
  let filteredItems = [];
  const openSet = new Set();

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

  function getApiBaseUrl() {
    return (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) ? String(window.APP_CONFIG.apiBaseUrl).trim() : "";
  }

  function getListEndpoint(limit) {
    const apiBaseUrl = getApiBaseUrl();
    const base = apiBaseUrl ? `${apiBaseUrl}/api/admin/contacts` : "/api/admin/contacts";
    const n = Number(limit || 50);
    return `${base}?limit=${encodeURIComponent(String(n))}`;
  }

  function getSeenEndpoint() {
    const apiBaseUrl = getApiBaseUrl();
    return apiBaseUrl ? `${apiBaseUrl}/api/admin/seen` : "/api/admin/seen";
  }

  function getStoredKey() {
    return sessionStorage.getItem("ADMIN_KEY") || "";
  }

  function setStoredKey(value) {
    if (!value) sessionStorage.removeItem("ADMIN_KEY");
    else sessionStorage.setItem("ADMIN_KEY", value);
  }

  function toDateInputValue(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  async function loadContacts(adminKey) {
    const limit = Number(limitEl.value || "50");
    const endpoint = getListEndpoint(limit);
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

  async function setSeen(adminKey, pathname, seen) {
    const endpoint = getSeenEndpoint();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify({
        pathname: pathname,
        seen: !!seen
      })
    });

    const payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "Nepavyko atnaujinti.");
    }
  }

  function applyFilters() {
    const q = String(qEl.value || "").trim().toLowerCase();
    const from = fromEl.value ? new Date(`${fromEl.value}T00:00:00.000Z`) : null;
    const to = toEl.value ? new Date(`${toEl.value}T23:59:59.999Z`) : null;
    const unreadOnly = !!unreadOnlyEl.checked;
    const sort = String(sortEl.value || "new");

    filteredItems = rawItems.filter(function (item) {
      const data = item.data || {};
      const createdAt = new Date(data.createdAt || item.uploadedAt || 0);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;
      if (unreadOnly && item.seen) return false;

      if (!q) return true;
      const hay = [
        data.name || "",
        data.email || "",
        data.message || "",
        item.pathname || ""
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });

    filteredItems.sort(function (a, b) {
      const da = new Date((a.data && a.data.createdAt) || a.uploadedAt || 0).getTime();
      const db = new Date((b.data && b.data.createdAt) || b.uploadedAt || 0).getTime();
      if (sort === "old") return da - db;
      return db - da;
    });

    render();
  }

  function render() {
    if (!filteredItems.length) {
      listEl.innerHTML = "<div class=\"badge\">Nera irasu</div>";
      return;
    }

    const html = filteredItems.map(function (item) {
      const data = item.data || {};
      const name = escapeHtml(data.name || "");
      const email = escapeHtml(data.email || "");
      const message = escapeHtml(data.message || "");
      const createdAt = escapeHtml(data.createdAt || item.uploadedAt || "");
      const id = escapeHtml(item.pathname || "");
      const seen = !!item.seen;
      const isOpen = openSet.has(item.pathname || "");

      const seenBadge = seen
        ? "<span class=\"badge\">Perziureta</span>"
        : "<span class=\"badge\" style=\"border-color:var(--accent);color:var(--accent-strong)\">Nauja</span>";

      const fullMessage = message;
      const shortMessage = message.length > 240 ? `${message.slice(0, 240)}...` : message;
      const msgToShow = isOpen ? fullMessage : shortMessage;
      const toggleLabel = isOpen ? "Sutraukti" : "Rodyti pilnai";

      return `
        <div class="card" style="cursor:default">
          <div class="row" style="justify-content:space-between;gap:10px">
            <div class="meta">${createdAt}</div>
            <div class="row" style="gap:6px">
              ${seenBadge}
              <button class="b2 js-toggle-seen" data-pathname="${id}" type="button" style="margin:0;padding:8px 10px">
                ${seen ? "Zymeti kaip nauja" : "Zymeti kaip perziureta"}
              </button>
            </div>
          </div>
          <h3 style="margin:10px 0 6px">${name} <span style="font-weight:600;color:var(--muted)">&lt;${email}&gt;</span></h3>
          <div style="white-space:pre-wrap;line-height:1.35">${msgToShow}</div>
          <div class="row" style="margin-top:10px;justify-content:space-between;gap:10px">
            <div class="meta" style="font-family:'Space Mono',monospace">${id}</div>
            <div class="row" style="gap:8px">
              <button class="b2 js-toggle-open" data-pathname="${id}" type="button" style="margin:0;padding:8px 10px">${toggleLabel}</button>
              <button class="b2 js-copy-email" data-email="${email}" type="button" style="margin:0;padding:8px 10px">Kopijuoti el.p.</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    listEl.innerHTML = html;
  }

  function buildRows(items) {
    return items.map(function (item) {
      const data = item.data || {};
      return {
        createdAt: data.createdAt || item.uploadedAt || "",
        name: data.name || "",
        email: data.email || "",
        message: data.message || "",
        id: item.pathname || "",
        seen: item.seen ? "yes" : "no"
      };
    });
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
  }

  function toCsv(rows) {
    const cols = ["createdAt", "name", "email", "message", "id", "seen"];
    const escape = function (value) {
      const s = String(value == null ? "" : value);
      const needs = /[\",\n\r]/.test(s);
      const v = s.replaceAll("\"", "\"\"");
      return needs ? `"${v}"` : v;
    };
    const header = cols.join(",");
    const body = rows.map(function (r) {
      return cols.map(function (c) { return escape(r[c]); }).join(",");
    }).join("\n");
    return `${header}\n${body}\n`;
  }

  function exportCsv() {
    const rows = buildRows(filteredItems);
    const csv = toCsv(rows);
    downloadText(`kontaktai-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportXlsx() {
    if (!window.XLSX) {
      setStatus("Nepavyko: XLSX biblioteka neuzkrauta.", "error");
      return;
    }
    const rows = buildRows(filteredItems);
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "contacts");
    window.XLSX.writeFile(wb, `kontaktai-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function runLoad(key) {
    setStatus("", "");
    listEl.innerHTML = "";
    loadBtn.disabled = true;
    loadBtn.textContent = "Kraunama...";
    try {
      rawItems = await loadContacts(key);

      // Initialize date range based on loaded data (only if empty)
      if (!fromEl.value && rawItems.length) {
        const newest = rawItems[0];
        const oldest = rawItems[rawItems.length - 1];
        const newestAt = (newest.data && newest.data.createdAt) || newest.uploadedAt || "";
        const oldestAt = (oldest.data && oldest.data.createdAt) || oldest.uploadedAt || "";
        fromEl.value = toDateInputValue(oldestAt);
        toEl.value = toDateInputValue(newestAt);
      }

      applyFilters();
      setStatus(`Uzkrauta: ${rawItems.length}`, "ok");
    } catch (err) {
      setStatus(err.message || "Nepavyko uzkrauti.", "error");
      console.error(err);
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = "Uzkrauti";
    }
  }

  listEl.addEventListener("click", async function (event) {
    const target = event.target;
    if (!target) return;

    const storedKey = getStoredKey();
    if (!storedKey) return;

    if (target.classList && target.classList.contains("js-toggle-open")) {
      const pathname = target.getAttribute("data-pathname") || "";
      if (!pathname) return;

      const item = rawItems.find(function (x) { return x.pathname === pathname; });
      const willOpen = !openSet.has(pathname);
      if (willOpen) openSet.add(pathname);
      else openSet.delete(pathname);

      // Auto-mark as seen when opening.
      if (willOpen && item && !item.seen && autoSeenEl.checked) {
        target.disabled = true;
        try {
          await setSeen(storedKey, pathname, true);
          item.seen = true;
        } catch (err) {
          setStatus(err.message || "Nepavyko atnaujinti.", "error");
        } finally {
          target.disabled = false;
        }
      }

      applyFilters();
      return;
    }

    if (target.classList && target.classList.contains("js-copy-email")) {
      const email = target.getAttribute("data-email") || "";
      try {
        await navigator.clipboard.writeText(email);
        setStatus("Nukopijuota.", "ok");
      } catch (_err) {
        setStatus("Nepavyko nukopijuoti.", "error");
      }
      return;
    }

    if (target.classList && target.classList.contains("js-toggle-seen")) {
      const pathname = target.getAttribute("data-pathname") || "";
      if (!pathname) return;

      const item = rawItems.find(function (x) { return x.pathname === pathname; });
      const nextSeen = item ? !item.seen : true;

      target.disabled = true;
      try {
        await setSeen(storedKey, pathname, nextSeen);
        if (item) item.seen = nextSeen;
        applyFilters();
      } catch (err) {
        setStatus(err.message || "Nepavyko atnaujinti.", "error");
      } finally {
        target.disabled = false;
      }
      return;
    }
  });

  logoutBtn.addEventListener("click", function () {
    setStoredKey("");
    keyInput.value = "";
    rawItems = [];
    filteredItems = [];
    listEl.innerHTML = "";
    setStatus("Atsijungta.", "ok");
  });

  exportCsvBtn.addEventListener("click", function () {
    if (!filteredItems.length) {
      setStatus("Nera ka eksportuoti.", "error");
      return;
    }
    exportCsv();
  });

  exportXlsxBtn.addEventListener("click", function () {
    if (!filteredItems.length) {
      setStatus("Nera ka eksportuoti.", "error");
      return;
    }
    exportXlsx();
  });

  qEl.addEventListener("input", applyFilters);
  fromEl.addEventListener("change", applyFilters);
  toEl.addEventListener("change", applyFilters);
  unreadOnlyEl.addEventListener("change", applyFilters);
  sortEl.addEventListener("change", applyFilters);

  limitEl.addEventListener("change", function () {
    const key = getStoredKey();
    if (key) runLoad(key);
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
