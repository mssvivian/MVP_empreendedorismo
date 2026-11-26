// CLTempo — Backend da demo estática (GitHub Pages)
//
// O GitHub Pages só serve arquivos estáticos, então esta camada roda o backend
// Python real (pasta ./backend) dentro do navegador com Pyodide e intercepta as
// chamadas do app.js:
//   - fetch("/api/...")      -> chama o roteamento do app.py via backend/bridge.py
//   - new EventSource(...)   -> recebe os mesmos eventos que o SSE do servidor envia
// Com isso o app.js publicado é uma cópia exata do static/app.js do repositório.
// Os dados ficam em memória: recarregar a página volta ao estado inicial do piloto.

(function () {
  const PYODIDE_VERSION = "0.26.4";
  const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  const BACKEND_FILES = ["db.py", "client_api.py", "restaurant_api.py", "admin_api.py", "app.py", "bridge.py"];
  const BACKEND_DIR = new URL("./backend/", document.currentScript?.src || window.location.href).href;

  const realFetch = window.fetch.bind(window);
  const eventSources = new Set();

  // ---------- Aviso de carregamento ----------
  function showLoading() {
    const el = document.createElement("div");
    el.id = "demoLoading";
    el.setAttribute("role", "status");
    el.style.cssText =
      "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;" +
      "background:#111827;color:#fff;padding:10px 16px;border-radius:999px;" +
      "font:600 13px Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);";
    el.textContent = "⏳ Carregando a demo…";
    const attach = () => document.body.appendChild(el);
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);
    return el;
  }

  // ---------- Inicialização do Python ----------
  const loadingEl = showLoading();

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(s);
    });
  }

  const ready = (async () => {
    await loadScript(`${PYODIDE_BASE}pyodide.js`);
    const pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE });
    await pyodide.loadPackage("sqlite3");

    pyodide.FS.mkdirTree("/home/pyodide/cltempo");
    pyodide.FS.mkdirTree("/tmp/cltempo");
    const sources = await Promise.all(
      BACKEND_FILES.map(async (name) => {
        const res = await realFetch(BACKEND_DIR + name, { cache: "no-cache" });
        if (!res.ok) throw new Error(`Falha ao carregar backend/${name}`);
        return [name, await res.text()];
      })
    );
    for (const [name, code] of sources) {
      pyodide.FS.writeFile(`/home/pyodide/cltempo/${name}`, code);
    }

    pyodide.runPython(`
import sys
sys.path.insert(0, "/home/pyodide/cltempo")
import bridge
`);
    const bridge = pyodide.pyimport("bridge");
    loadingEl.remove();
    return bridge;
  })().catch((err) => {
    console.error("[demo] Erro ao iniciar o backend:", err);
    loadingEl.textContent = "⚠️ Não foi possível carregar a demo. Recarregue a página.";
    loadingEl.style.background = "#b91c1c";
    throw err;
  });

  // ---------- Entrega de eventos (substitui o SSE) ----------
  function dispatch(packet) {
    const data = JSON.stringify(packet);
    for (const es of eventSources) {
      setTimeout(() => es._emit(data), 0);
    }
  }

  class DemoEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.onmessage = null;
      this.onopen = null;
      this.onerror = null;
      this._listeners = {};
      eventSources.add(this);
      ready
        .then((bridge) => {
          this.readyState = 1;
          this.onopen && this.onopen(new Event("open"));
          this._emit(JSON.stringify({ event: "connected", meta: {}, state: JSON.parse(bridge.build_state_json()) }));
        })
        .catch(() => {
          this.readyState = 2;
          this.onerror && this.onerror(new Event("error"));
        });
    }
    _emit(data) {
      if (this.readyState === 2) return;
      const evt = new MessageEvent("message", { data });
      this.onmessage && this.onmessage(evt);
      (this._listeners.message || []).forEach((fn) => fn(evt));
    }
    addEventListener(type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    }
    removeEventListener(type, fn) {
      this._listeners[type] = (this._listeners[type] || []).filter((f) => f !== fn);
    }
    close() {
      this.readyState = 2;
      eventSources.delete(this);
    }
  }
  window.EventSource = DemoEventSource;

  // ---------- Interceptação do fetch ----------
  function apiPathOf(input) {
    const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return null;
    const idx = url.pathname.indexOf("/api/");
    if (idx === -1) return null;
    return url.pathname.slice(idx) + url.search;
  }

  window.fetch = async function (input, init = {}) {
    const apiPath = apiPathOf(input);
    if (!apiPath) return realFetch(input, init);

    const bridge = await ready;
    const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = typeof init.body === "string" ? init.body : "";

    const result = JSON.parse(bridge.handle_request(method, apiPath, body));
    result.events.forEach(dispatch);

    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };

  // ---------- Links de WhatsApp ----------
  // Os telefones do seed são fictícios: na demo pública o botão só avisa.
  document.addEventListener(
    "click",
    (e) => {
      const link = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="whatsapp.com"]');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.showToast === "function") {
        window.showToast("Contato via WhatsApp indisponível na demo estática.", "var(--amber)");
      }
    },
    true
  );

  window.CLTEMPO_DEMO = { ready };
})();
