// CLTempo — Frontend SPA Reativo (Arquitetura Modular, 3 Interfaces e Responsivo)
// Disciplina de Empreendedorismo - UFRJ 2026.2

const appState = {
  mainView: "client", // client | restaurant | admin | split
  theme: localStorage.getItem("cltempo_theme") || "light",
  
  // Autenticação do Cliente
  clientAuth: {
    client: JSON.parse(localStorage.getItem("cltempo_client") || "null"),
    authTab: "login", // login | register
  },
  
  // Abas da Interface Cliente (Buscar | Fila | Perfil)
  clientActiveTab: "buscar", 
  
  // Filtros de Busca
  searchFilters: {
    name: "",
    cuisine_type: "TODOS",
    max_wait_min: 45,
    radius_km: 3.0,
    party_size: 2,
  },
  
  searchResults: [],
  selectedModalRestaurant: null,
  clientActiveTicket: null,
  clientHistory: [],

  // Interface do Restaurante
  selectedRestaurantId: 1,
  selectedRestCategoryFilter: "ALL", // ALL | 1-2 | 3-4 | 5+

  // Dados consolidados do backend
  data: null,
};

// ==================== TEMA E TOASTS ====================

function applyTheme(theme) {
  appState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("cltempo_theme", theme);
  const btn = document.getElementById("btnThemeToggle");
  if (btn) {
    btn.innerHTML = theme === "dark" ? "☀️ Claro" : "🌙 Escuro";
  }
}

function showToast(message, color = "var(--primary)") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.style.borderLeftColor = color;
  el.innerHTML = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ==================== COMUNICAÇÃO HTTP ====================

async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Erro na operação", "var(--rose)");
      return null;
    }
    return data;
  } catch (err) {
    showToast("Falha de comunicação com o servidor", "var(--rose)");
    return null;
  }
}

async function apiPost(url, payload = {}) {
  return apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ==================== SSE EM TEMPO REAL ====================

function initSSE() {
  const evtSource = new EventSource("/api/events");
  evtSource.onmessage = (e) => {
    try {
      const packet = JSON.parse(e.data);
      if (packet.state) {
        appState.data = packet.state;
        handleRealtimeEvent(packet.event, packet.meta || {});
        refreshClientState();
        renderApp();
      }
    } catch (err) {
      console.error("Erro SSE:", err);
    }
  };
}

function handleRealtimeEvent(event, meta) {
  const currentClientId = appState.clientAuth.client?.id;

  if (event === "queue_joined") {
    showToast(
      `<strong>${meta.customer_name}</strong> entrou na fila de <strong>Mesa ${meta.table_category}</strong> em ${meta.restaurant_name}`,
      "var(--primary)"
    );
  } else if (event === "queue_call") {
    const isMe = currentClientId && (meta.client_id === currentClientId || meta.user_id === currentClientId);
    if (isMe) {
      showToast(
        `🔔 <strong>SUA VEZ!</strong> ${meta.restaurant_name} chamou sua mesa (${meta.table_category} lug.)! Dirija-se ao balcão.`,
        "var(--emerald)"
      );
    } else {
      showToast(
        `🔔 <strong>Mesa pronta:</strong> ${meta.restaurant_name} chamou <strong>${meta.customer_name}</strong>`,
        "var(--emerald)"
      );
    }
  } else if (event === "queue_seat") {
    showToast(`Check-in confirmado: <strong>${meta.customer_name}</strong>`, "var(--emerald)");
  } else if (event === "queue_cancel") {
    showToast(`Reserva cancelada: <strong>${meta.customer_name}</strong>`, "var(--amber)");
  } else if (event === "demo_reset") {
    showToast("Dados do piloto restaurados!", "var(--blue)");
  }
}

// ==================== CARREGAMENTO DE DADOS DO CLIENTE ====================

async function refreshClientState() {
  const client = appState.clientAuth.client;
  if (!client) return;

  // 1. Atualizar restaurantes com filtros e score
  await executeSearch();

  // 2. Buscar ticket ativo
  const ticketRes = await apiFetch(`/api/client/ticket?client_id=${client.id}`);
  if (ticketRes && ticketRes.ok) {
    appState.clientActiveTicket = ticketRes.active_ticket;
  }

  // 3. Buscar histórico
  const histRes = await apiFetch(`/api/client/history?client_id=${client.id}`);
  if (histRes && histRes.ok) {
    appState.clientHistory = histRes.history;
  }
}

async function executeSearch() {
  const client = appState.clientAuth.client;
  const f = appState.searchFilters;
  const clientIdParam = client ? `&client_id=${client.id}` : "";
  const params = `name=${encodeURIComponent(f.name)}&cuisine_type=${encodeURIComponent(f.cuisine_type)}&max_wait_min=${f.max_wait_min}&radius_km=${f.radius_km}&party_size=${f.party_size}${clientIdParam}`;
  
  const res = await apiFetch(`/api/client/restaurants?${params}`);
  if (res && res.ok) {
    appState.searchResults = res.restaurants;
  }
}

// ==================== AÇÕES DE AUTENTICAÇÃO ====================

function setAuthTab(tab) {
  appState.clientAuth.authTab = tab;
  renderApp();
}

async function submitLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail")?.value;
  const password = document.getElementById("loginPassword")?.value;

  const res = await apiPost("/api/client/login", { email, password });
  if (res && res.ok) {
    appState.clientAuth.client = res.client;
    localStorage.setItem("cltempo_client", JSON.stringify(res.client));
    appState.clientActiveTab = "buscar";
    showToast(`Bem-vindo(a), <strong>${res.client.name}</strong>!`, "var(--emerald)");
    await refreshClientState();
    renderApp();
  }
}

let geocodeDebounceTimer = null;
const workplaceGeocache = { reg: null, prof: null };

function closeAllPlaceDropdowns() {
  document.querySelectorAll(".autocomplete-dropdown").forEach((el) => {
    el.style.display = "none";
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-wrap")) {
    closeAllPlaceDropdowns();
  }
});

function handleWorkplaceInput(prefix) {
  const input = document.getElementById(prefix === "reg" ? "regWorkplace" : "profWorkplace");
  const dropdown = document.getElementById(prefix === "reg" ? "regPlacesDropdown" : "profPlacesDropdown");
  const badge = document.getElementById(prefix === "reg" ? "regWorkplaceBadge" : "profWorkplaceBadge");
  if (!input) return;

  clearTimeout(geocodeDebounceTimer);
  const val = input.value.trim();
  if (!val || val.length < 2) {
    if (dropdown) dropdown.style.display = "none";
    if (badge && !val) {
      badge.style.display = "none";
      workplaceGeocache[prefix] = null;
    }
    return;
  }

  geocodeDebounceTimer = setTimeout(async () => {
    const res = await apiFetch(`/api/client/places/autocomplete?query=${encodeURIComponent(val)}`);
    if (res && res.ok && res.predictions && res.predictions.length > 0) {
      if (dropdown) {
        dropdown.innerHTML = `
          ${res.predictions.map((p) => `
            <div 
              class="autocomplete-item" 
              onclick="selectAutocompletePlace('${prefix}', '${p.main_text.replace(/'/g, "\\'")}', ${p.lat}, ${p.lng})"
            >
              <span class="autocomplete-icon">📍</span>
              <div>
                <div class="autocomplete-main">${p.main_text}</div>
                <div class="autocomplete-secondary">${p.secondary_text}</div>
              </div>
            </div>
          `).join("")}
          <div class="autocomplete-footer">
            <span>Sugestões Google Maps</span>
            <span>CLTempo</span>
          </div>
        `;
        dropdown.style.display = "block";
      }
    } else {
      if (dropdown) dropdown.style.display = "none";
    }
  }, 250);
}

function selectAutocompletePlace(prefix, mainText, lat, lng) {
  const input = document.getElementById(prefix === "reg" ? "regWorkplace" : "profWorkplace");
  const dropdown = document.getElementById(prefix === "reg" ? "regPlacesDropdown" : "profPlacesDropdown");
  const badge = document.getElementById(prefix === "reg" ? "regWorkplaceBadge" : "profWorkplaceBadge");

  if (input) input.value = mainText;
  workplaceGeocache[prefix] = { lat, lng };

  if (dropdown) dropdown.style.display = "none";

  if (badge) {
    badge.style.display = "block";
    badge.innerHTML = `
      <span style="color:var(--emerald-text); font-weight:600; font-size:0.73rem;">
        ✓ Localizado no Google Maps: <strong>${mainText}</strong> (${lat.toFixed(4)}, ${lng.toFixed(4)})
      </span>
    `;
  }
}

async function submitRegister(e) {
  e.preventDefault();
  const name = document.getElementById("regName")?.value;
  const email = document.getElementById("regEmail")?.value;
  const password = document.getElementById("regPassword")?.value;
  const phone = document.getElementById("regPhone")?.value;
  const workplace = document.getElementById("regWorkplace")?.value;

  // Coleta as 3 culinárias selecionadas
  const selectedCuisines = Array.from(document.querySelectorAll(".cuisine-chip.selected"))
    .map((c) => c.dataset.value);

  // Coleta os Vales-Refeição selecionados (multi-seleção)
  const selectedVRs = Array.from(document.querySelectorAll(".reg-vr-chip.selected"))
    .map((c) => c.dataset.value);

  const pref_food_1 = selectedCuisines[0] || "Executivo";
  const pref_food_2 = selectedCuisines[1] || "Buffet a Quilo";
  const pref_food_3 = selectedCuisines[2] || "Massas";

  const coords = workplaceGeocache.reg;

  const res = await apiPost("/api/client/register", {
    name,
    email,
    password,
    phone,
    workplace,
    pref_food_1,
    pref_food_2,
    pref_food_3,
    meal_vouchers: selectedVRs.length > 0 ? selectedVRs : ["Alelo", "Ticket"],
    lat: coords ? coords.lat : undefined,
    lng: coords ? coords.lng : undefined,
  });

  if (res && res.ok) {
    appState.clientAuth.client = res.client;
    localStorage.setItem("cltempo_client", JSON.stringify(res.client));
    appState.clientActiveTab = "buscar";
    showToast(`Conta criada com sucesso! Olá, <strong>${res.client.name}</strong>`, "var(--emerald)");
    await refreshClientState();
    renderApp();
  }
}

function quickLoginAs(clientId) {
  if (!appState.data || !appState.data.clients) return;
  const target = appState.data.clients.find((c) => c.id === clientId);
  if (target) {
    appState.clientAuth.client = target;
    localStorage.setItem("cltempo_client", JSON.stringify(target));
    appState.clientActiveTab = "buscar";
    showToast(`Logado como <strong>${target.name}</strong>`, "var(--blue)");
    refreshClientState();
    renderApp();
  }
}

function clientLogout() {
  appState.clientAuth.client = null;
  localStorage.removeItem("cltempo_client");
  appState.clientActiveTicket = null;
  appState.clientHistory = [];
  appState.clientActiveTab = "buscar";
  showToast("Você saiu da sua conta.", "var(--amber)");
  renderApp();
}

function toggleVRSelection(el) {
  el.classList.toggle("selected");
  const selected = document.querySelectorAll(".reg-vr-chip.selected");
  if (selected.length === 0) {
    el.classList.add("selected");
    showToast("Selecione pelo menos um vale-refeição.", "var(--amber)");
  }
}

function toggleProfileVRSelection(el) {
  el.classList.toggle("selected");
  const selected = document.querySelectorAll(".profile-vr-chip.selected");
  if (selected.length === 0) {
    el.classList.add("selected");
    showToast("Selecione pelo menos um vale-refeição.", "var(--amber)");
  }
}

function openEditVRModal() {
  const client = appState.clientAuth.client;
  if (!client) return;

  const currentVRStr = client.meal_vouchers || client.vr_card || "Alelo, Ticket";
  const currentVRs = currentVRStr.split(",").map((v) => v.trim().toLowerCase());

  const availableVRs = [
    "Alelo",
    "Ticket",
    "Sodexo / Pluxee",
    "VR Refeição",
    "Flash",
    "Caju",
    "Swile",
    "iFood Benefícios",
  ];

  const modalContainer = document.getElementById("modalContainer");
  const overlay = document.getElementById("modalOverlay");
  if (!modalContainer || !overlay) return;

  modalContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
      <h3 style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
        💳 Alterar VRs
      </h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>

    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
      Selecione quais cartões ou bandeiras você utiliza para almoçar (pode marcar mais de um):
    </p>

    <div class="vr-grid" id="modalVRGrid" style="margin-bottom:1.25rem;">
      ${availableVRs.map((vr) => {
        const isSel = currentVRs.some((cv) => cv.includes(vr.toLowerCase().split("/")[0].trim()) || vr.toLowerCase().includes(cv));
        return `
          <div 
            class="vr-chip modal-vr-chip ${isSel ? "selected" : ""}" 
            data-value="${vr}"
            onclick="this.classList.toggle('selected')"
          >
            💳 ${vr}
          </div>
        `;
      }).join("")}
    </div>

    <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
      <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn btn-primary" onclick="saveModalVRs()">Salvar VRs</button>
    </div>
  `;

  overlay.style.display = "flex";
}

async function saveModalVRs() {
  const client = appState.clientAuth.client;
  if (!client) return;

  const selectedVRs = Array.from(document.querySelectorAll(".modal-vr-chip.selected"))
    .map((el) => el.dataset.value);

  if (selectedVRs.length === 0) {
    showToast("Selecione pelo menos um cartão VR.", "var(--rose)");
    return;
  }

  const res = await apiPost("/api/client/profile/vr", {
    client_id: client.id,
    meal_vouchers: selectedVRs,
  });

  if (res && res.ok) {
    appState.clientAuth.client = res.client;
    localStorage.setItem("cltempo_client", JSON.stringify(res.client));
    closeModal();
    showToast("Vales-refeição atualizados com sucesso!", "var(--emerald)");
    renderApp();
  }
}

async function submitProfileUpdate(e) {
  e.preventDefault();
  const client = appState.clientAuth.client;
  if (!client) return;

  const name = document.getElementById("profName")?.value;
  const phone = document.getElementById("profPhone")?.value;
  const workplace = document.getElementById("profWorkplace")?.value;
  const password = document.getElementById("profPassword")?.value;

  const selectedCuisines = Array.from(document.querySelectorAll(".profile-cuisine-chip.selected"))
    .map((c) => c.dataset.value);

  const selectedVRs = Array.from(document.querySelectorAll(".profile-vr-chip.selected"))
    .map((c) => c.dataset.value);

  const coords = workplaceGeocache.prof;

  const payload = {
    client_id: client.id,
    name,
    phone,
    workplace,
    pref_food_1: selectedCuisines[0] || client.pref_food_1,
    pref_food_2: selectedCuisines[1] || client.pref_food_2,
    pref_food_3: selectedCuisines[2] || client.pref_food_3,
    meal_vouchers: selectedVRs.length > 0 ? selectedVRs : (client.meal_vouchers || "Alelo, Ticket"),
    password: password || undefined,
    lat: coords ? coords.lat : undefined,
    lng: coords ? coords.lng : undefined,
  };

  const res = await apiPost("/api/client/profile/update", payload);
  if (res && res.ok) {
    appState.clientAuth.client = res.client;
    localStorage.setItem("cltempo_client", JSON.stringify(res.client));
    showToast("Perfil atualizado com sucesso!", "var(--emerald)");
    renderApp();
  }
}

async function submitProfileDelete() {
  const client = appState.clientAuth.client;
  if (!client) return;

  if (!confirm("Tem certeza que deseja apagar seu perfil cadastrado? Essa ação não pode ser desfeita.")) {
    return;
  }

  const res = await apiPost("/api/client/profile/delete", { client_id: client.id });
  if (res && res.ok) {
    clientLogout();
    showToast("Perfil excluído com sucesso.", "var(--rose)");
  }
}

// ==================== CONTROLE DE NAVEGAÇÃO ====================

function switchMainView(view) {
  appState.mainView = view;
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  renderApp();
}

function switchClientTab(tab) {
  appState.clientActiveTab = tab;
  renderApp();
}

function toggleCuisineSelection(chipEl) {
  const selected = document.querySelectorAll(".cuisine-chip.selected");
  if (!chipEl.classList.contains("selected") && selected.length >= 3) {
    showToast("Você já selecionou o limite de 3 tipos de comida preferida.", "var(--amber)");
    return;
  }
  chipEl.classList.toggle("selected");
}

function toggleProfileCuisineSelection(chipEl) {
  const selected = document.querySelectorAll(".profile-cuisine-chip.selected");
  if (!chipEl.classList.contains("selected") && selected.length >= 3) {
    showToast("Selecione até 3 tipos de comida.", "var(--amber)");
    return;
  }
  chipEl.classList.toggle("selected");
}

// ==================== AÇÕES DE BUSCA E FILA DO CLIENTE ====================

async function onSearchInput(val) {
  appState.searchFilters.name = val;
  await executeSearch();
  renderApp();
}

async function onCuisineFilter(val) {
  appState.searchFilters.cuisine_type = val;
  await executeSearch();
  renderApp();
}

async function onMaxWaitFilter(val) {
  appState.searchFilters.max_wait_min = Number(val);
  await executeSearch();
  renderApp();
}

async function onRadiusFilter(val) {
  appState.searchFilters.radius_km = Number(val);
  await executeSearch();
  renderApp();
}

async function onPartySizeFilter(val) {
  appState.searchFilters.party_size = Number(val);
  await executeSearch();
  renderApp();
}

function openRestaurantModal(restId) {
  const rest = appState.searchResults.find((r) => r.id === restId) ||
    appState.data?.restaurants.find((r) => r.id === restId);
  if (!rest) return;

  appState.selectedModalRestaurant = rest;
  const overlay = document.getElementById("modalOverlay");
  const container = document.getElementById("modalContainer");

  container.innerHTML = `
    <div class="modal-header">
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${rest.category}</div>
        <div style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">${rest.name}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button>
    </div>

    <div class="modal-body">
      <!-- Google Maps Embed Interativo -->
      <iframe
        class="map-frame"
        src="${rest.maps_embed_url || `https://maps.google.com/maps?q=${rest.lat},${rest.lng}&hl=pt-BR&z=16&output=embed`}"
        allowfullscreen=""
        loading="lazy"
        title="Localização de ${rest.name}"
      ></iframe>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; font-size:0.8rem;">
        <span style="color:var(--text-muted);">📍 ${rest.address}</span>
        <a href="${rest.maps_external_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rest.name)}`}" target="_blank" class="btn btn-outline btn-sm" style="font-size:0.72rem;">
          🗺️ Abrir Maps
        </a>
      </div>

      <div style="background:var(--bg-surface); padding:0.85rem; border-radius:12px; margin-bottom:1rem; border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="font-weight:700; font-size:0.85rem;">Tempo de Espera Atual:</span>
          <span class="badge badge-emerald">~${rest.estimated_wait_min ?? 15} min</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted);">
          Distância: <strong>${rest.distance_meters ?? 300}m</strong> (${rest.distance_walk_min} min a pé do seu escritório)
        </div>
      </div>

      <!-- Seletor de Mesa (Quantidade de Pessoas) -->
      <div style="margin-bottom:1.15rem;">
        <label class="form-label">Selecione o tamanho da mesa:</label>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.4rem;">
          ${[
            { n: 2, lbl: "1-2 lug.", cat: "1-2" },
            { n: 4, lbl: "3-4 lug.", cat: "3-4" },
            { n: 6, lbl: "5-6 lug.", cat: "5+" },
            { n: 8, lbl: "8+ lug.", cat: "5+" },
          ]
            .map(
              (item) => `
            <button 
              type="button"
              class="btn btn-sm ${appState.searchFilters.party_size === item.n ? "btn-primary" : "btn-outline"}"
              onclick="selectModalPartySize(${item.n})"
            >
              ${item.lbl}
            </button>
          `
            )
            .join("")}
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.6rem;">
        <button class="btn btn-primary btn-block btn-lg" onclick="confirmReservation(${rest.id})">
          ✓ Confirmar Reserva (Entrar na Fila)
        </button>
        <a href="${rest.whatsapp_url}" target="_blank" class="btn btn-whatsapp btn-block">
          💬 Falar com o Restaurante (WhatsApp)
        </a>
      </div>
    </div>
  `;

  overlay.style.display = "flex";
}

function selectModalPartySize(size) {
  appState.searchFilters.party_size = size;
  if (appState.selectedModalRestaurant) {
    openRestaurantModal(appState.selectedModalRestaurant.id);
  }
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
  appState.selectedModalRestaurant = null;
}

function closeModalOnOverlay(e) {
  if (e.target.id === "modalOverlay") {
    closeModal();
  }
}

async function confirmReservation(restaurantId) {
  const client = appState.clientAuth.client;
  const partySize = appState.searchFilters.party_size || 2;

  const res = await apiPost("/api/client/queue/join", {
    restaurant_id: restaurantId,
    client_id: client ? client.id : null,
    customer_name: client ? client.name : "Cliente CLT",
    party_size: partySize,
  });

  if (res && res.ok) {
    closeModal();
    showToast(`Reserva confirmada! Código: <strong>#${res.checkin_code}</strong>`, "var(--emerald)");
    await refreshClientState();
    // VAI AUTOMATICAMENTE PARA A ABA FILA
    switchClientTab("fila");
  }
}

async function cancelTicket(entryId) {
  if (!confirm("Deseja realmente sair da fila?")) return;
  const res = await apiPost("/api/restaurant/action", {
    entry_id: entryId,
    action: "cancel",
    cancel_reason: "Cancelado pelo cliente no app",
  });
  if (res && res.ok) {
    showToast("Você saiu da fila.", "var(--amber)");
    await refreshClientState();
    renderApp();
  }
}

async function confirmCheckin(entryId) {
  const res = await apiPost("/api/restaurant/action", {
    entry_id: entryId,
    action: "seat",
  });
  if (res && res.ok) {
    showToast("Check-in confirmado! Bom almoço!", "var(--emerald)");
    await refreshClientState();
    renderApp();
  }
}

// ==================== RENDERS DA INTERFACE CLIENTE ====================

function renderAuthScreen() {
  const isLogin = appState.clientAuth.authTab === "login";

  const popularCuisines = [
    "Executivo", "Buffet a Quilo", "Massas", "Japonês", 
    "Saladas & Saudável", "Grelhados", "Hambúrguer", "Árabe"
  ];

  const availableVRs = [
    "Alelo", "Ticket", "Sodexo / Pluxee", "VR Refeição",
    "Flash", "Caju", "Swile", "iFood Benefícios"
  ];

  return `
    <div class="auth-box card">
      <div style="text-align:center; margin-bottom:1.25rem;">
        <div class="brand-logo" style="margin:0 auto 0.75rem auto; width:52px; height:52px; font-size:1.35rem;">CLT</div>
        <h2 style="font-size:1.25rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">CLTempo</h2>
        <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">
          Você com tempo e sem fome.
        </p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab ${isLogin ? "active" : ""}" onclick="setAuthTab('login')">Entrar</button>
        <button class="auth-tab ${!isLogin ? "active" : ""}" onclick="setAuthTab('register')">Cadastrar-se</button>
      </div>

      ${isLogin ? `
        <form onsubmit="submitLogin(event)">
          <div class="form-group">
            <label class="form-label">E-mail:</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="seu.email@gmail.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha:</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:0.85rem;">
            Acessar o CLTempo
          </button>
        </form>
      ` : `
        <form onsubmit="submitRegister(event)">
          <div class="form-group">
            <label class="form-label">Nome Completo:</label>
            <input type="text" id="regName" class="form-input" placeholder="Seu Nome" required />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail:</label>
            <input type="email" id="regEmail" class="form-input" placeholder="seu.email@gmail.com" required />
          </div>
          <div class="form-group">
            <label class="form-label">Senha:</label>
            <input type="password" id="regPassword" class="form-input" placeholder="Mínimo 4 caracteres" required />
          </div>
          <div class="form-group">
            <label class="form-label">Telefone (WhatsApp):</label>
            <input type="tel" id="regPhone" class="form-input" placeholder="21987654321" required />
          </div>
          <div class="form-group autocomplete-wrap">
            <label class="form-label">Local de Trabalho:</label>
            <input 
              type="text" 
              id="regWorkplace" 
              class="form-input" 
              placeholder="Digite o nome ou endereço do edifício..." 
              required 
              autocomplete="off"
              oninput="handleWorkplaceInput('reg')"
              onfocus="handleWorkplaceInput('reg')"
            />
            <div id="regPlacesDropdown" class="autocomplete-dropdown" style="display:none;"></div>
            <div id="regWorkplaceBadge" style="margin-top:0.35rem; display:none;"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Quais as três comidas que você mais AMA?</label>
            <div class="cuisine-grid">
              ${popularCuisines.map((c, i) => `
                <div 
                  class="cuisine-chip ${i < 3 ? "selected" : ""}" 
                  data-value="${c}"
                  onclick="toggleCuisineSelection(this)"
                >
                  ${c}
                </div>
              `).join("")}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>Quais VRs você possui? </span>
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">Pode marcar mais de um ;)</span>
            </label>
            <div class="vr-grid">
              ${availableVRs.map((vr, i) => `
                <div 
                  class="vr-chip reg-vr-chip ${i < 2 ? "selected" : ""}" 
                  data-value="${vr}"
                  onclick="toggleVRSelection(this)"
                >
                  💳 ${vr}
                </div>
              `).join("")}
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:1rem;">
            Concluir Cadastro
          </button>
        </form>
      `}

      <!-- Atalhos de Demonstração Rápida -->
      <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px dashed var(--border); text-align:center;">
        <div style="font-size:0.72rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-bottom:0.45rem;">
          Acesso Rápido para a Banca (Demo):
        </div>
        <div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(1)">Vivian</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(2)">Arthur</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(3)">Carolina</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(4)">Fernando</button>
        </div>
      </div>
    </div>
  `;
}

function renderClientBuscarTab() {
  const client = appState.clientAuth.client;
  const f = appState.searchFilters;

  const cuisines = [
    "TODOS", "Executivo", "Buffet a Quilo", "Massas", 
    "Japonês", "Saladas & Saudável"
  ];

  const resultsHTML = appState.searchResults.length === 0 ? `
    <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); font-size:0.85rem; background:var(--bg-surface); border-radius:14px;">
      Nenhum restaurante encontrado com os filtros selecionados.<br>
      <span style="font-size:0.75rem;">Tente aumentar o raio geográfico ou o tempo de espera.</span>
    </div>
  ` : appState.searchResults.map((r) => {
    return `
      <div class="restaurant-card" onclick="openRestaurantModal(${r.id})">
        <div class="restaurant-card-header">
          <div>
            <div style="font-weight:700; font-size:0.95rem;">${r.name}</div>
            <div style="font-size:0.74rem; color:var(--text-muted);">
              ${r.category} • 📍 ${r.distance_meters ?? 300}m (${r.distance_walk_min} min a pé)
            </div>
          </div>
          <span class="badge badge-score" title="Score de relevância baseado no seu perfil e filtros (máximo 100)">
            ★ Score ${Math.min(100, Math.round(r.score))}/100
          </span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.75rem; flex-wrap:wrap; gap:0.4rem;">
          <div style="display:flex; gap:0.35rem; align-items:center;">
            <span class="badge ${r.waiting_in_category > 0 ? "badge-orange" : "badge-emerald"}">
              ${r.waiting_in_category === 0 ? "Fila livre" : `${r.waiting_in_category} grupos na fila`}
            </span>
            <span style="font-size:0.74rem; color:var(--text-muted);">
              ~${r.estimated_wait_min} min
            </span>
          </div>

          <div style="display:flex; gap:0.35rem;">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openRestaurantModal(${r.id})">
              Ver Mesa & Entrar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <!-- Teaser de Recomendações Futuras -->
    <div class="promo-banner">
      <div style="font-size:1.25rem;">✨</div>
      <div>
        <div style="font-weight:700;">Recomendações para você</div>
        <div style="font-size:0.72rem; color:var(--text-muted);">
          Com base em: <strong>${client.pref_food_1}</strong>, <strong>${client.pref_food_2}</strong> e <strong>${client.pref_food_3}</strong>
        </div>
      </div>
    </div>

    <!-- Controles de Busca com Filtros -->
    <div class="search-controls">
      <div class="form-group" style="margin-bottom:0.5rem;">
        <input 
          type="text" 
          class="form-input" 
          placeholder="🔍 Buscar restaurante" 
          value="${f.name}"
          oninput="onSearchInput(this.value)"
        />
      </div>

      <!-- Filtro por Culinária (Chips) -->
      <div class="chips-row">
        ${cuisines.map((c) => `
          <div 
            class="filter-chip ${f.cuisine_type === c ? "active" : ""}"
            onclick="onCuisineFilter('${c}')"
          >
            ${c}
          </div>
        `).join("")}
      </div>

      <!-- Sliders: Tempo Máximo e Raio Geográfico -->
      <div class="range-wrap">
        <span>Tempo Máximo: <strong>${f.max_wait_min} min</strong></span>
        <input 
          type="range" 
          class="range-input" 
          min="10" 
          max="60" 
          step="5" 
          value="${f.max_wait_min}" 
          oninput="onMaxWaitFilter(this.value)" 
        />
      </div>

      <div class="range-wrap">
        <span>Raio Geográfico: <strong>${f.radius_km.toFixed(1)} km</strong></span>
        <input 
          type="range" 
          class="range-input" 
          min="0.5" 
          max="5.0" 
          step="0.5" 
          value="${f.radius_km}" 
          oninput="onRadiusFilter(this.value)" 
        />
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem;">
      <span style="font-size:0.74rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
        Restaurantes Encontrados (${appState.searchResults.length})
      </span>
      <span style="font-size:0.72rem; color:var(--text-muted);">Ordenado por Score (máx. 100) ★</span>
    </div>

    <div class="restaurants-list">
      ${resultsHTML}
    </div>
  `;
}

function renderClientFilaTab() {
  const ticket = appState.clientActiveTicket;
  const history = appState.clientHistory || [];

  return `
    <!-- Parte Superior: Reserva Atual -->
    <div style="margin-bottom:1.5rem;">
      <div style="font-size:0.74rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.55rem;">
        Reserva Atual
      </div>

      ${ticket ? `
        <div class="active-ticket ${ticket.status === "CALLED" ? "called" : ""}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="badge ${ticket.status === "CALLED" ? "badge-emerald" : "badge-orange"}">
              ${ticket.status === "CALLED" ? "🔔 Mesa Pronta no Balcão!" : `Fila Mesa ${ticket.table_category} lugares`}
            </span>
            <span style="font-family:monospace; font-weight:800; font-size:0.9rem;">
              #${ticket.checkin_code}
            </span>
          </div>

          <div style="margin:0.75rem 0 0.35rem 0;">
            <div style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
              ${ticket.restaurant_name}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              Mesa para ${ticket.party_size} pessoa(s) • Entrou às ${ticket.joined_at}
            </div>
          </div>

          <div class="ticket-metrics-grid">
            <div class="ticket-metric-box">
              <div class="ticket-metric-val">${ticket.status === "CALLED" ? "Agora" : `${ticket.position}º`}</div>
              <div class="ticket-metric-lbl">Posição</div>
            </div>
            <div class="ticket-metric-box">
              <div class="ticket-metric-val">${ticket.status === "CALLED" ? "0m" : `~${ticket.estimated_wait_min}m`}</div>
              <div class="ticket-metric-lbl">Tempo Restante</div>
            </div>
            <div class="ticket-metric-box">
              <div class="ticket-metric-val">${ticket.party_size}p</div>
              <div class="ticket-metric-lbl">Tamanho</div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.85rem;">
            <a href="${ticket.whatsapp_url}" target="_blank" class="btn btn-whatsapp btn-block">
              💬 Falar com o Restaurante (WhatsApp)
            </a>

            ${ticket.status === "CALLED" ? `
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-emerald btn-block" onclick="confirmCheckin(${ticket.id})">
                  Confirmar Chegada
                </button>
                <button class="btn btn-rose btn-sm" onclick="cancelTicket(${ticket.id})">
                  Cancelar
                </button>
              </div>
            ` : `
              <button class="btn btn-outline btn-block btn-sm" onclick="cancelTicket(${ticket.id})">
                Sair da Fila
              </button>
            `}
          </div>
        </div>
      ` : `
        <div style="text-align:center; padding:2rem 1.25rem; background:var(--bg-surface); border-radius:16px; border:1px dashed var(--border);">
          <div style="font-size:2rem; margin-bottom:0.5rem;">☕</div>
          <div style="font-weight:700; font-size:0.95rem;">Nenhuma reserva ativa</div>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:0.35rem 0 0.85rem 0;">
            Você está livre no momento. Que tal escolher onde almoçar hoje?
          </p>
          <button class="btn btn-primary btn-sm" onclick="switchClientTab('buscar')">
            🔍 Buscar Restaurantes
          </button>
        </div>
      `}
    </div>

    <!-- Parte Inferior: Histórico de Reservas -->
    <div>
      <div style="font-size:0.74rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.55rem;">
        Histórico de Reservas
      </div>

      ${history.length === 0 ? `
        <div style="font-size:0.78rem; color:var(--text-muted); text-align:center; padding:1.5rem; background:var(--bg-card); border-radius:12px; border:1px solid var(--border);">
          Seu histórico de reservas concluídas aparecerá aqui.
        </div>
      ` : `
        <div class="card" style="padding:0.5rem; overflow-x:auto;">
          <table class="history-table">
            <thead>
              <tr>
                <th>Restaurante</th>
                <th>Mesa</th>
                <th>Status</th>
                <th>Horário</th>
              </tr>
            </thead>
            <tbody>
              ${history.map((h) => {
                let badge = `<span class="badge badge-emerald">Atendido</span>`;
                if (h.status === "CANCELLED") badge = `<span class="badge badge-amber">Cancelado</span>`;
                if (h.status === "NO_SHOW") badge = `<span class="badge badge-rose">Ausente</span>`;
                return `
                  <tr>
                    <td><strong>${h.restaurant_name}</strong></td>
                    <td>${h.party_size}p (${h.table_category})</td>
                    <td>${badge}</td>
                    <td style="color:var(--text-muted);">${h.joined_at}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

function renderClientPerfilTab() {
  const client = appState.clientAuth.client;

  const popularCuisines = [
    "Executivo", "Buffet a Quilo", "Massas", "Japonês", 
    "Saladas & Saudável", "Grelhados", "Hambúrguer", "Árabe"
  ];

  const availableVRs = [
    "Alelo", "Ticket", "Sodexo / Pluxee", "VR Refeição",
    "Flash", "Caju", "Swile", "iFood Benefícios"
  ];

  const currentPrefs = [client.pref_food_1, client.pref_food_2, client.pref_food_3].filter(Boolean);
  const currentVRStr = client.meal_vouchers || client.vr_card || "Alelo, Ticket";
  const currentVRList = currentVRStr.split(",").map((v) => v.trim().toLowerCase());

  return `
    <div class="card" style="margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Meu Perfil CLTempo</div>
          <div style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">${client.name}</div>
        </div>
        <div 
          class="vr-badge-clickable badge badge-blue" 
          onclick="openEditVRModal()" 
          title="Clique para alterar seus cartões VR"
        >
          💳 ${client.meal_vouchers || client.vr_card}
        </div>
      </div>

      <form onsubmit="submitProfileUpdate(event)">
        <div class="form-group">
          <label class="form-label">Nome Completo:</label>
          <input type="text" id="profName" class="form-input" value="${client.name}" required />
        </div>

        <div class="form-group">
          <label class="form-label">E-mail:</label>
          <input type="email" class="form-input" value="${client.email || ""}" disabled style="opacity:0.7;" />
        </div>

        <div class="form-group">
          <label class="form-label">Telefone (WhatsApp):</label>
          <input type="tel" id="profPhone" class="form-input" value="${client.phone || ""}" required />
        </div>

        <div class="form-group autocomplete-wrap">
          <label class="form-label">Local de Trabalho:</label>
          <input 
            type="text" 
            id="profWorkplace" 
            class="form-input" 
            value="${client.workplace || client.company || ""}" 
            required 
            autocomplete="off"
            oninput="handleWorkplaceInput('prof')"
            onfocus="handleWorkplaceInput('prof')"
          />
          <div id="profPlacesDropdown" class="autocomplete-dropdown" style="display:none;"></div>
          <div id="profWorkplaceBadge" style="font-size:0.73rem; margin-top:0.35rem; color:var(--text-muted);">
            📍 Google Maps: <strong>${client.lat ? Number(client.lat).toFixed(4) : "-22.9035"}, ${client.lng ? Number(client.lng).toFixed(4) : "-43.1780"}</strong> (localizado)
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">3 comidas que você mais gosta:</label>
          <div class="cuisine-grid">
            ${popularCuisines.map((c) => {
              const isSelected = currentPrefs.includes(c);
              return `
                <div 
                  class="cuisine-chip profile-cuisine-chip ${isSelected ? "selected" : ""}" 
                  data-value="${c}"
                  onclick="toggleProfileCuisineSelection(this)"
                >
                  ${c}
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nova Senha:</label>
          <input type="password" id="profPassword" class="form-input" placeholder="Deixe em branco para não alterar" />
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:0.85rem;">
          Salvar Alterações
        </button>
      </form>
    </div>

    <!-- Zona de Ações da Conta -->
    <div class="card" style="border-color:var(--border);">
      <div style="display:flex; flex-direction:column; gap:0.65rem;">
        <button type="button" class="btn btn-outline btn-block" onclick="clientLogout()">
          🚪 Deslogar da Conta
        </button>
        <button type="button" class="btn btn-rose btn-block" onclick="submitProfileDelete()">
          🗑️ Apagar Perfil Cadastrado
        </button>
      </div>
    </div>
  `;
}

function renderClientAppView() {
  const client = appState.clientAuth.client;
  if (!client) {
    return renderAuthScreen();
  }

  const activeTab = appState.clientActiveTab;
  const hasActiveTicket = !!appState.clientActiveTicket;

  let bodyHTML = "";
  if (activeTab === "buscar") bodyHTML = renderClientBuscarTab();
  else if (activeTab === "fila") bodyHTML = renderClientFilaTab();
  else if (activeTab === "perfil") bodyHTML = renderClientPerfilTab();

  return `
    <div class="phone-frame">
      <!-- Topo do Celular -->
      <div class="phone-header">
        <div>
          <div style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">
            📍 ${client.workplace || client.company || "Polo Centro"}
          </div>
          <div style="font-weight:800; font-size:0.95rem; font-family:'Plus Jakarta Sans', sans-serif;">
            ${client.name}
          </div>
        </div>
        <div style="display:flex; gap:0.35rem; align-items:center;">
          <span class="badge badge-emerald">Online</span>
        </div>
      </div>

      <!-- Corpo da Aba Selecionada -->
      <div class="phone-body">
        ${bodyHTML}
      </div>

      <!-- Barra de Navegação Inferior (3 Abas) -->
      <div class="client-bottom-nav">
        <button 
          class="client-tab-btn ${activeTab === "buscar" ? "active" : ""}" 
          onclick="switchClientTab('buscar')"
        >
          <span class="client-tab-icon">🔍</span>
          <span>Buscar</span>
        </button>

        <button 
          class="client-tab-btn ${activeTab === "fila" ? "active" : ""}" 
          onclick="switchClientTab('fila')"
          style="position:relative;"
        >
          <span class="client-tab-icon">⏳</span>
          <span>Fila</span>
          ${hasActiveTicket ? `<span style="position:absolute; top:4px; right:20%; width:8px; height:8px; background:var(--emerald); border-radius:50%;"></span>` : ""}
        </button>

        <button 
          class="client-tab-btn ${activeTab === "perfil" ? "active" : ""}" 
          onclick="switchClientTab('perfil')"
        >
          <span class="client-tab-icon">👤</span>
          <span>Perfil</span>
        </button>
      </div>
    </div>
  `;
}

// ==================== INTERFACE RESTAURANTE ====================

function renderRestaurantView() {
  const { restaurants, active_queue, recent_history } = appState.data || {};
  if (!restaurants) return `<div class="card">Carregando painel do restaurante...</div>`;

  const currentRest = restaurants.find((r) => r.id === Number(appState.selectedRestaurantId)) || restaurants[0];
  const allRestQueue = (active_queue || []).filter((q) => q.restaurant_id === currentRest.id);
  const filteredQueue = appState.selectedRestCategoryFilter === "ALL"
    ? allRestQueue
    : allRestQueue.filter((q) => q.table_category === appState.selectedRestCategoryFilter);

  const restTabs = restaurants.map((r) => `
    <button 
      class="btn btn-sm ${r.id === currentRest.id ? "btn-primary" : "btn-outline"}"
      onclick="selectAdminRestaurant(${r.id})"
    >
      ${r.name}
      <span style="opacity:0.8;">(${r.waiting_count + r.called_count})</span>
    </button>
  `).join("");

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">
            Painel Operacional do Restaurante
          </div>
          <h2 style="font-size:1.35rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
            ${currentRest.name}
          </h2>
          <div style="font-size:0.78rem; color:var(--text-muted);">
            📞 WhatsApp: <strong>${currentRest.phone_whatsapp || "5521999998888"}</strong> • 📍 ${currentRest.address}
          </div>
        </div>

        <div style="display:flex; gap:0.45rem;">
          <button class="btn ${currentRest.is_open ? "btn-emerald" : "btn-rose"} btn-sm" onclick="toggleRestOpen(${currentRest.id})">
            ${currentRest.is_open ? "🟢 Fila Aberta" : "🔴 Fila Pausada"}
          </button>
        </div>
      </div>

      <!-- Seletor de Restaurantes Parceiros -->
      <div style="display:flex; gap:0.4rem; overflow-x:auto; padding-bottom:0.5rem; margin-bottom:1rem;">
        ${restTabs}
      </div>

      <!-- Filas por Categoria de Mesa -->
      <div style="display:flex; gap:0.35rem; margin-bottom:1rem;">
        ${["ALL", "1-2", "3-4", "5+"].map((cat) => `
          <button 
            class="btn btn-sm ${appState.selectedRestCategoryFilter === cat ? "btn-primary" : "btn-outline"}"
            onclick="setRestCategoryFilter('${cat}')"
          >
            ${cat === "ALL" ? "Todas as Mesas" : `Mesas ${cat} lug.`}
          </button>
        `).join("")}
      </div>

      <!-- Lista de Espera Ativa -->
      <div style="margin-bottom:1.5rem;">
        ${filteredQueue.length === 0 ? `
          <div style="text-align:center; padding:2rem; background:var(--bg-surface); border-radius:12px; color:var(--text-muted); font-size:0.85rem;">
            Nenhum cliente aguardando nesta categoria de mesa.
          </div>
        ` : filteredQueue.map((q) => {
          const isCalled = q.status === "CALLED";
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface); padding:0.85rem; border-radius:12px; margin-bottom:0.5rem; border-left:4px solid ${isCalled ? "var(--emerald)" : "var(--primary)"};">
              <div>
                <div style="font-weight:700; font-size:0.95rem;">
                  ${isCalled ? "🔔 " : `${q.position}º `}${q.customer_name} 
                  <span class="badge badge-orange">Mesa ${q.table_category} (${q.party_size}p)</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted);">
                  Código #${q.checkin_code} • Entrou às ${q.joined_at}
                  ${isCalled ? ` • <strong style="color:var(--emerald-text);">Chamado no balcão</strong>` : ` • ~${q.estimated_wait_min}m de espera`}
                </div>
              </div>

              <div style="display:flex; gap:0.4rem;">
                ${!isCalled ? `
                  <button class="btn btn-primary btn-sm" onclick="triggerQueueAction(${q.id}, 'call')">
                    Chamar
                  </button>
                ` : `
                  <button class="btn btn-emerald btn-sm" onclick="triggerQueueAction(${q.id}, 'seat')">
                    Check-in
                  </button>
                `}
                <button class="btn btn-outline btn-sm" onclick="triggerQueueAction(${q.id}, 'noshow')">
                  Ausente
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Adicionar Walk-in Presencial -->
      <div style="padding:1rem; background:var(--bg-surface); border-radius:12px; border:1px solid var(--border);">
        <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.45rem;">
          Adicionar Cliente Presencial (Balcão):
        </div>
        <form onsubmit="submitWalkin(event, ${currentRest.id})" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <input type="text" id="walkinName" class="form-input" placeholder="Nome do cliente presencial" required style="flex:2;" />
          <select id="walkinParty" class="form-select" style="flex:1;">
            <option value="2">2 pessoas (1-2)</option>
            <option value="4">4 pessoas (3-4)</option>
            <option value="6">6 pessoas (5+)</option>
            <option value="8">8 pessoas (5+)</option>
          </select>
          <button type="submit" class="btn btn-primary btn-sm">Adicionar</button>
        </form>
      </div>
    </div>
  `;
}

function selectAdminRestaurant(id) {
  appState.selectedRestaurantId = id;
  renderApp();
}

function setRestCategoryFilter(cat) {
  appState.selectedRestCategoryFilter = cat;
  renderApp();
}

async function triggerQueueAction(entryId, action) {
  const res = await apiPost("/api/restaurant/action", { entry_id: entryId, action });
  if (res && res.ok) {
    refreshClientState();
    renderApp();
  }
}

async function toggleRestOpen(restaurantId) {
  const res = await apiPost("/api/restaurant/toggle", { restaurant_id: restaurantId });
  if (res && res.ok) {
    showToast("Status da fila digital alterado.", "var(--blue)");
  }
}

async function submitWalkin(e, restaurantId) {
  e.preventDefault();
  const nameInput = document.getElementById("walkinName");
  const partyInput = document.getElementById("walkinParty");
  if (!nameInput) return;

  const res = await apiPost("/api/restaurant/walkin", {
    restaurant_id: restaurantId,
    customer_name: nameInput.value,
    party_size: Number(partyInput.value || 2),
  });

  if (res && res.ok) {
    showToast(`Cliente presencial adicionado! Código #${res.checkin_code}`, "var(--emerald)");
    nameInput.value = "";
  }
}

// ==================== INTERFACE ADMINISTRADOR ====================

function renderAdminView() {
  const metrics = appState.data?.metrics;
  if (!metrics) return `<div class="card">Carregando métricas de validação do Canvas...</div>`;

  const m1 = metrics.m1_restaurant_conversion;
  const m2 = metrics.m2_weekly_entries_per_user;
  const m3 = metrics.m3_dropout_rate;
  const m4 = metrics.m4_standing_wait_reduction;

  return `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div class="card">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">
          Painel de Validação das 4 Métricas do MVP Canvas
        </div>
        <h2 style="font-size:1.35rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
          CLTempo — Empreendedorismo UFRJ
        </h2>
      </div>

      <!-- Grid das 4 Métricas do Canvas -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:1rem;">
        <div class="card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">M1. Conversão Restaurantes</div>
          <div style="font-size:1.75rem; font-weight:800; color:var(--primary);">${m1.conversion_pct}%</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            Meta: >${m1.target_pct}% • ${m1.onboarded} de ${m1.total_approached} aderiram
          </div>
        </div>

        <div class="card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">M2. Frequência CLT / Semana</div>
          <div style="font-size:1.75rem; font-weight:800; color:var(--emerald);">${m2.avg_entries_per_week}x</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            Meta: >${m2.target_entries}x • ${m2.total_entries} entradas totais
          </div>
        </div>

        <div class="card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">M3. Taxa de Desistência</div>
          <div style="font-size:1.75rem; font-weight:800; color:${m3.dropout_pct <= m3.max_acceptable_pct ? "var(--emerald)" : "var(--rose)"};">
            ${m3.dropout_pct}%
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            Teto aceitável: <${m3.max_acceptable_pct}% • ${m3.cancelled_count} cancelamentos
          </div>
        </div>

        <div class="card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">M4. Redução de Espera em Pé</div>
          <div style="font-size:1.75rem; font-weight:800; color:var(--blue);">${m4.reduction_pct}%</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            Reduziu de ${m4.avg_standing_without_app_min}m para ~${m4.avg_standing_with_app_min}m (${m4.minutes_saved_per_lunch} min salvos)
          </div>
        </div>
      </div>

      <!-- Funil de Prospecção de Restaurantes -->
      <div class="card">
        <h3 style="font-size:1.05rem; font-weight:800; margin-bottom:0.75rem;">Funil de Parcerias do Polo</h3>
        <div style="overflow-x:auto;">
          <table class="history-table">
            <thead>
              <tr>
                <th>Restaurante</th>
                <th>Contato</th>
                <th>Status</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              ${(m1.leads || []).map((l) => `
                <tr>
                  <td><strong>${l.restaurant_name}</strong></td>
                  <td>${l.contact_person}</td>
                  <td><span class="badge ${l.status === "ONBOARDED" ? "badge-emerald" : (l.status === "IN_NEGOTIATION" ? "badge-blue" : "badge-amber")}">${l.status}</span></td>
                  <td style="color:var(--text-muted); font-size:0.75rem;">${l.notes || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ==================== VISÃO GERAL (DEMO SPLIT) ====================

function renderSplitView() {
  return `
    <div class="split-grid">
      <div>
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem; text-align:center;">
          📱 Interface Cliente (Mobile Responsivo)
        </div>
        ${renderClientAppView()}
      </div>

      <div style="display:flex; flex-direction:column; gap:1.25rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">
          🧑‍🍳 Painel do Restaurante (Tablet / Balcão)
        </div>
        ${renderRestaurantView()}
      </div>
    </div>
  `;
}

// ==================== RENDER PRINCIPAL ====================

function renderApp() {
  const root = document.getElementById("appRoot");
  if (!root) return;

  const view = appState.mainView;
  if (view === "client") {
    root.innerHTML = renderClientAppView();
  } else if (view === "restaurant") {
    root.innerHTML = renderRestaurantView();
  } else if (view === "admin") {
    root.innerHTML = renderAdminView();
  } else if (view === "split") {
    root.innerHTML = renderSplitView();
  }
}

// ==================== EXPORTAÇÕES GLOBAIS PARA O DOM ====================
Object.assign(window, {
  appState,
  switchMainView,
  switchClientTab,
  setAuthTab,
  submitLogin,
  submitRegister,
  handleWorkplaceInput,
  selectAutocompletePlace,
  closeAllPlaceDropdowns,
  quickLoginAs,
  clientLogout,
  submitProfileUpdate,
  submitProfileDelete,
  toggleCuisineSelection,
  toggleProfileCuisineSelection,
  toggleVRSelection,
  toggleProfileVRSelection,
  openEditVRModal,
  saveModalVRs,
  onSearchInput,
  onCuisineFilter,
  onMaxWaitFilter,
  onRadiusFilter,
  onPartySizeFilter,
  openRestaurantModal,
  selectModalPartySize,
  closeModal,
  closeModalOnOverlay,
  confirmReservation,
  cancelTicket,
  confirmCheckin,
  selectAdminRestaurant,
  setRestCategoryFilter,
  triggerQueueAction,
  toggleRestOpen,
  submitWalkin,
  renderApp,
});

// ==================== INICIALIZAÇÃO ====================

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(appState.theme);

  // Garante que o app sempre inicie na aba Buscar ao carregar
  appState.clientActiveTab = "buscar";

  // Botões do Topbar
  document.getElementById("btnThemeToggle")?.addEventListener("click", () => {
    applyTheme(appState.theme === "dark" ? "light" : "dark");
  });

  document.getElementById("btnResetDemo")?.addEventListener("click", async () => {
    if (confirm("Deseja restaurar os dados originais do piloto do CLTempo?")) {
      await apiPost("/api/admin/demo/reset");
    }
  });

  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchMainView(btn.dataset.view);
    });
  });

  // Renderiza imediatamente para nunca deixar a tela branca
  renderApp();

  // Carregar dados iniciais e conectar SSE
  initSSE();
  try {
    const stateRes = await apiFetch("/api/state");
    if (stateRes) {
      appState.data = stateRes;
    }
    await refreshClientState();
  } catch (err) {
    console.warn("Aviso na carga inicial de dados:", err);
  }

  // Atualiza a tela com os dados carregados
  renderApp();
});
