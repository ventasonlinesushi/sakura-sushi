/* ============================================================
   KDS - Pantalla de cocina para Mandala Sushi.
   Columnas: Nuevos | Preparando | Listos
   Mapeo de estados: nuevo→Nuevos, recibido→Preparando, listo→Listos
   ============================================================ */
const SUPABASE_URL = "https://edquyomwiiaawqslsisd.supabase.co";
const SUPABASE_KEY = "sb_publishable_aIIwHt4T8cDIeZjy48hRxQ_sdY7_QIf";

(function () {
  "use strict";

  const API = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/orders";
  const HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY
  };

  const SESSION = "sakuraKds";
  const POLL_MS = 3000;
  const LIMITE_AMARILLO = 5 * 60;  // 5 min
  const LIMITE_ROJO = 10 * 60;     // 10 min

  const BRAND = (window.PosApp && window.PosApp.brandConfig) || {
    business: "Mandala Sushi Caucel", marca: "mandala"
  };

  const STATUS = { nuevo: "Nuevo", recibido: "Preparando", listo: "Listo" };
  const COLS = [
    { id: "colNuevo",     status: "nuevo",    label: "Nuevos",     dot: "dot-red",    cnt: "cntNuevo" },
    { id: "colPreparando",status: "recibido", label: "Preparando", dot: "dot-yellow", cnt: "cntPreparando" },
    { id: "colListo",     status: "listo",    label: "Listos",     dot: "dot-green",  cnt: "cntListo" }
  ];

  let state = { orders: [], seen: new Set(), soundOn: true, autoNext: false, pollTimer: null, user: null };
  const $ = id => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 3500);
  }

  function beep(tipo) {
    if (!state.soundOn) return;
    try {
      const ctx = beep._ctx || (beep._ctx = new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = tipo === "nuevo" ? 1100 : 660;
      g.gain.value = 0.2;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + (tipo === "nuevo" ? 0.6 : 0.3));
    } catch (e) {}
  }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = n => "$" + Number(n || 0).toLocaleString("es-MX");
  const fmtHora = d => d.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" });

  /* ---------- Reloj ---------- */
  function tickClock() {
    $("hdClock").textContent = new Date().toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  }

  /* ---------- API ---------- */
  async function fetchOrders() {
    const q = API + "?select=*&marca=eq." + encodeURIComponent(BRAND.marca || "") + "&status=in.(nuevo,recibido,listo)&order=created_at.asc&limit=100";
    const r = await fetch(q, { headers: HEADERS });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const rows = await r.json();
    // mostrar también pedidos recientes de hoy para la transición nuevo→recibido
    return rows;
  }

  async function setStatus(id, status) {
    const r = await fetch(API + "?id=eq." + id, {
      method: "PATCH",
      headers: Object.assign({ "Content-Type":"application/json", "Prefer":"return=minimal" }, HEADERS),
      body: JSON.stringify({ status })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }

  /* ---------- Render ---------- */
  function tiempoHace(iso) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 0) return "0:00";
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function timerClass(iso) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff > LIMITE_ROJO) return "t-urg";
    if (diff > LIMITE_AMARILLO) return "t-warn";
    return "t-ok";
  }

  function urgenteClass(iso) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff > LIMITE_ROJO) return " urgente";
    if (diff > LIMITE_AMARILLO + 60) return " alerta";
    return "";
  }

  function cardHtml(o) {
    const items = (o.items || []).map(i =>
      '<div class="kcard-item"><span><span class="ki-qty">' + i.qty + '</span>' + esc(i.name) +
      (i.desc ? ' <span style="font-size:11px;opacity:.6">(' + esc(i.desc) + ')</span>' : '') + '</span></div>'
    ).join("");

    const typeIcon = o.order_type === "domicilio" ? "🛵" : o.order_type === "restaurante" ? "🍽" : "🛍";
    const actions = o.status === "nuevo"
      ? '<button class="kact-iniciar" data-id="' + o.id + '" data-s="recibido">▶ Iniciar</button>'
      : o.status === "recibido"
        ? '<button class="kact-listo" data-id="' + o.id + '" data-s="listo">✅ Listo</button>'
        : '';

    return '<div class="kcard' + urgenteClass(o.created_at) + '" data-id="' + o.id + '">' +
      '<div class="kcard-top">' +
        '<span class="kcard-folio">#' + esc(o.folio) + '</span>' +
        '<span class="kcard-timer ' + timerClass(o.created_at) + '">' + tiempoHace(o.created_at) + '</span>' +
      '</div>' +
      '<div class="kcard-meta">' +
        '<span>' + typeIcon + ' ' + (o.order_type === "domicilio" ? "Domicilio" : o.order_type === "restaurante" ? "Mesa " + (o.address || "?") : "Llevar") + '</span>' +
        '<span>' + esc(o.name) + '</span>' +
        (o.payment ? '<span>' + esc(o.payment) + '</span>' : '') +
      '</div>' +
      (o.items && o.items.length ? '<div class="kcard-items">' + items + '</div>' : '') +
      (o.notes ? '<div class="kcard-notes">📝 ' + esc(o.notes) + '</div>' : '') +
      (o.salsas ? '<div class="kcard-notes">🥫 ' + esc(o.salsas) + '</div>' : '') +
      (actions ? '<div class="kcard-actions">' + actions + '</div>' : '') +
    '</div>';
  }

  function render() {
    const orders = state.orders.filter(o => ["nuevo", "recibido", "listo"].includes(o.status));
    COLS.forEach(col => {
      const colOrders = orders.filter(o => o.status === col.status);
      $(col.cnt).textContent = colOrders.length;
      const body = $(col.id);
      if (!colOrders.length) {
        body.innerHTML = '<div class="empty-col">— Sin pedidos —</div>';
      } else {
        body.innerHTML = colOrders.map(cardHtml).join("");
      }
    });
    // reconectar event listeners a los botones
    document.querySelectorAll(".kact-iniciar, .kact-listo").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const s = btn.dataset.s;
        try {
          await setStatus(id, s);
          beep(s === "listo" ? "listo" : "nuevo");
          if (state.autoNext && s === "recibido") {
            // programar auto-listo tras 3 segundos (para flujo rápido)
            setTimeout(async () => {
              try { await setStatus(id, "listo"); } catch(e) {}
              refresh();
            }, 3000);
          }
          refresh();
        } catch (e) { toast("Error al cambiar estado"); }
      });
    });
  }

  /* ---------- Ciclo ---------- */
  async function refresh() {
    try {
      const orders = await fetchOrders();
      const antes = state.orders.length;
      const isFirst = state.seen.size === 0;
      state.orders = orders;
      orders.forEach(o => {
        if (!state.seen.has(o.id)) {
          state.seen.add(o.id);
          if (!isFirst && o.status === "nuevo") beep("nuevo");
        }
      });
      $("refreshNote").textContent = "Actualizado " + fmtHora(new Date());
      render();
    } catch (e) {
      $("refreshNote").textContent = "Error de conexión";
    }
  }

  function start() {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(refresh, POLL_MS);
  }

  /* ---------- Fullscreen ---------- */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  /* ---------- Auth ---------- */
  function sha256(text) {
    var encoder = new TextEncoder();
    var data = encoder.encode(text);
    return crypto.subtle.digest("SHA-256", data).then(function(hash) {
      return Array.from(new Uint8Array(hash)).map(function(b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }
  async function doLogin() {
    const u = $("loginUser").value.trim();
    const p = $("loginPass").value;
    if (!u || !p) return;
    try {
      const hash = await sha256(p);
      const r = await fetch(API.replace("/orders","/usuarios") + "?username=eq." + encodeURIComponent(u) + "&select=*&limit=1", { headers: HEADERS });
      const rows = await r.json();
      const user = rows[0];
      if (!user || user.password_hash !== hash || !user.activo) throw new Error("invalid");
      const sess = { username: user.username, nombre: user.nombre, rol: user.rol };
      sessionStorage.setItem(SESSION, JSON.stringify(sess));
      showApp(sess);
    } catch (e) {
      $("loginErr").classList.remove("hidden");
      $("loginPass").value = "";
    }
  }

  function showApp(user) {
    state.user = user;
    $("pinScreen").classList.add("hidden");
    $("kdsApp").classList.remove("hidden");
    $("hdUser").textContent = user.nombre + " (" + user.rol + ")";
    refresh();
    start();
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ---------- Init ---------- */
  function init() {
    $("loginBtn").addEventListener("click", doLogin);
    $("loginPass").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

    $("soundToggle").addEventListener("change", e => {
      state.soundOn = e.target.checked;
      $("soundWarn").classList.toggle("hidden", state.soundOn);
    });
    $("autoNextToggle").addEventListener("change", e => { state.autoNext = e.target.checked; });
    $("fullscreenBtn").addEventListener("click", toggleFullscreen);
    $("logoutBtn").addEventListener("click", () => {
      clearInterval(state.pollTimer);
      sessionStorage.removeItem(SESSION);
      location.reload();
    });

    const raw = sessionStorage.getItem(SESSION);
    try {
      const user = JSON.parse(raw);
      if (user && user.username) return showApp(user);
    } catch (e) {}
  }

  init();
})();
