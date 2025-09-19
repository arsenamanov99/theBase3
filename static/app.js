const API = location.origin + "/api";

let state = { limit: 20, offset: 0, order: "recent", accepted: "", q: "", total: 0, page: 1, pages: 1 };

const els = {
  gridBody: document.querySelector("#grid tbody"),
  tpl: document.querySelector("#row-tpl"),
  pageInfo: document.querySelector("#pageInfo"),
  prev: document.querySelector("#prev"),
  next: document.querySelector("#next"),
  limit: document.querySelector("#limit"),
  accepted: document.querySelector("#accepted"),
  query: document.querySelector("#query"),
  order: document.querySelector("#order"),
  reload: document.querySelector("#reload"),
  createForm: document.querySelector("#createForm"),
  stats: document.querySelector("#stats"),
  csvLink: document.querySelector("#csvLink"),
  apiKeyBtn: document.querySelector("#apiKeyBtn"),
  mgrName: document.querySelector("#mgrName"),
};

const apiKeyStore = {
  get() { return localStorage.getItem("API_KEY") || ""; },
  set(v) { v ? localStorage.setItem("API_KEY", v) : localStorage.removeItem("API_KEY"); }
};

async function apiFetch(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  const key = apiKeyStore.get();
  if (key) headers["X-API-Key"] = key;
  const r = await fetch(`${API}${path}`, { ...opts, headers });
  if (r.status === 401) {
    alert("Нужен API-ключ менеджера. Нажми «API-ключ» вверху.");
    throw new Error("unauthorized");
  }
  return r;
}

async function probeMe() {
  const key = apiKeyStore.get();
  if (!key) { els.mgrName.textContent = ""; return; }
  try {
    const r = await apiFetch("/managers/me");
    if (r.ok) {
      const me = await r.json();
      els.mgrName.textContent = `вы: ${me.name}`;
    } else {
      els.mgrName.textContent = "";
    }
  } catch { els.mgrName.textContent = ""; }
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) p.set(k, v);
  return p.toString();
}

async function fetchLeads() {
  const url = `/api/leads?${qs({
    limit: state.limit,
    offset: state.offset,
    order: state.order,
    accepted: state.accepted || undefined,
    q: state.q || undefined
  })}`;
  const r = await apiFetch(url);
  if (!r.ok) throw new Error("load error");
  return r.json();
}

function renderRows(items) {
  els.gridBody.innerHTML = "";
  const hasKey = !!apiKeyStore.get();

  for (const it of items) {
    const row = els.tpl.content.firstElementChild.cloneNode(true);
    row.querySelector(".id").textContent = it.id;
    row.querySelector(".name").value = it.name ?? "";
    row.querySelector(".email").value = it.email ?? "";
    row.querySelector(".phone").value = it.phone ?? "";
    row.querySelector(".accepted_at").textContent = it.accepted_at ? new Date(it.accepted_at).toLocaleString() : "";
    row.querySelector(".accepted_by").textContent = it.accepted_by ?? "";

    const save = row.querySelector(".save");
    const accept = row.querySelector(".accept");
    const unaccept = row.querySelector(".unaccept");
    const del = row.querySelector(".del");
    [save, accept, unaccept, del].forEach(b => b.disabled = !hasKey);

    save.onclick = async () => {
      const payload = {
        name: row.querySelector(".name").value || null,
        email: row.querySelector(".email").value || null,
        phone: row.querySelector(".phone").value || null,
        note: null,
      };
      const r = await apiFetch(`/api/leads/${it.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (r.ok) load(); else alert("Ошибка сохранения");
    };

    accept.onclick = async () => {
      const r = await apiFetch(`/api/leads/${it.id}/accept`, { method: "POST" });

      if (r.ok) load(); else alert("Ошибка accept");
    };

    unaccept.onclick = async () => {
      const r = await apiFetch(`/api/leads/${it.id}/unaccept`, { method: "POST" });
      if (r.ok) load(); else alert("Ошибка unaccept");
    };

    del.onclick = async () => {
      if (!confirm("Удалить?")) return;
      const r = await apiFetch(`/api/leads/${it.id}`, { method: "DELETE" });
      if (r.status === 204) load(); else alert("Ошибка удаления");
    };

    els.gridBody.appendChild(row);
  }
}

async function load() {
  els.csvLink.href = `${API}/leads/export.csv?${qs({
    accepted: state.accepted || undefined,
    q: state.q || undefined
  })}`;

  const data = await fetchLeads();
  state.total = data.total; state.page = data.page; state.pages = data.pages;

  renderRows(data.items);
  els.pageInfo.textContent = `${state.page} / ${state.pages}`;
  els.prev.disabled = state.page <= 1;
  els.next.disabled = state.page >= state.pages;
  els.stats.textContent = `Всего: ${state.total}`;
}

function bind() {
  els.apiKeyBtn.onclick = async () => {
    const current = apiKeyStore.get();
    const v = prompt("Вставь API-ключ менеджера (пусто = удалить):", current || "");
    if (v === null) return;
    apiKeyStore.set((v || "").trim());
    await probeMe();
    load();
  };

  els.limit.onchange = () => { state.limit = +els.limit.value; state.offset = 0; load(); };
  els.prev.onclick = () => { state.offset = Math.max(0, state.offset - state.limit); load(); };
  els.next.onclick = () => { state.offset = state.offset + state.limit; load(); };
  els.accepted.onchange = () => { state.accepted = els.accepted.value; state.offset = 0; load(); };
  els.order.onchange = () => { state.order = els.order.value; state.offset = 0; load(); };
  els.query.onkeyup = e => { if (e.key === "Enter") { state.q = els.query.value.trim(); state.offset = 0; load(); } };
  els.reload.onclick = () => { state.q = els.query.value.trim(); state.offset = 0; load(); };

  els.createForm.onsubmit = async e => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(els.createForm).entries());
    const r = await apiFetch(`/leads`, { method: "POST", body: JSON.stringify(payload) });
    if (r.ok) { els.createForm.reset(); load(); } else { alert("Ошибка создания"); }
  };
}

bind();
probeMe().then(load);
