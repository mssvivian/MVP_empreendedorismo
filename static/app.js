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
    max_wait_min: 60,
    radius_km: 3.0,
    party_size: 2,
  },
  
  searchResults: [],
  selectedModalRestaurant: null,
  clientActiveTicket: null,
  clientHistory: [],

  // Interface do Restaurante (Gestão de Salão, Fila e Mesas)
  restaurantAuth: {
    restaurant: JSON.parse(localStorage.getItem("cltempo_restaurant") || "null"),
    authTab: "login", // login | register
    registerVRs: ["Alelo", "Sodexo", "Ticket Restaurante", "VR Refeição"],
    profileVRs: [],
    registerCuisine: "Executivo",
  },
  restaurantActiveTab: "fila", // fila | mesas | perfil
  restaurantCallingModal: null, // { entryId, customerName, partySize, tableCategory, suggestedTable }
  restaurantChangeTableModal: null, // { entryId, currentTableNumber, customerName }
  selectedRestaurantId: 1,
  selectedRestCategoryFilter: "ALL", // ALL | 1-2 | 3-4 | 5+

  // Estado visual (seções recolhíveis, filtros abertos etc.) — sobrevive aos re-renders do SSE
  ui: {
    showFilters: false,
    showHistory: false,
    showWalkin: false,
    tableFilter: "ALOCADA", // ALOCADA | LIVRE | INDISPONÍVEL
    open: {}, // seções recolhíveis abertas, por chave
  },

  // Dados consolidados do backend
  data: null,
};

function getAvailableCuisines() {
  if (appState.data && appState.data.cuisines && appState.data.cuisines.length > 0) {
    return appState.data.cuisines;
  }
  return [
    { id: 1, name: "Executivo", icon: "💼" },
    { id: 2, name: "Buffet a Quilo", icon: "⚖️" },
    { id: 3, name: "Massas & Italiana", icon: "🍝" },
    { id: 4, name: "Japonês & Poke", icon: "🍣" },
    { id: 5, name: "Saladas & Saudável", icon: "🥗" },
    { id: 6, name: "Grelhados & Carnes", icon: "🥩" },
    { id: 7, name: "Hambúrguer & Artesanal", icon: "🍔" },
    { id: 8, name: "Árabe & Contemporânea", icon: "🥙" },
    { id: 9, name: "Brasileira & Típica", icon: "🍲" },
    { id: 10, name: "Frutos do Mar", icon: "🍤" },
    { id: 11, name: "Vegano & Vegetariano", icon: "🌱" },
    { id: 12, name: "Cafeteria & Doces", icon: "☕" },
  ];
}

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
  evtSource.onmessage = async (e) => {
    try {
      const packet = JSON.parse(e.data);
      if (packet.state) {
        appState.data = packet.state;
        handleRealtimeEvent(packet.event, packet.meta || {});
        await refreshClientState();
        // Em telas de formulário (login, cadastro, perfil) o re-render apagaria o que a
        // pessoa está digitando; os dados novos aparecem na próxima troca de aba.
        if (!isOnFormScreen()) renderApp();
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
  } else if (event === "queue_call" || event === "queue_called") {
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
  } else if (event === "queue_seat" || event === "queue_seated") {
    showToast(`Check-in confirmado: <strong>${meta.customer_name}</strong>`, "var(--emerald)");
  } else if (event === "queue_cancel" || event === "queue_cancelled") {
    const isMe =
      currentClientId &&
      (meta.client_id === currentClientId ||
        meta.user_id === currentClientId ||
        meta.entry_id === appState.clientActiveTicket?.id);
    if (isMe) {
      appState.clientActiveTicket = null;
      showToast(
        `⚠️ <strong>Atenção:</strong> Sua chamada/reserva em <strong>${meta.restaurant_name || "CLTempo"}</strong> foi cancelada (${meta.cancel_reason || "pelo restaurante"}).`,
        "var(--rose)"
      );
      renderApp();
    } else {
      showToast(`Reserva cancelada: <strong>${meta.customer_name}</strong>`, "var(--amber)");
    }
  } else if (event === "demo_reset") {
    alertedCallEntries.clear();
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
  if (ticketRes) {
    const previous = appState.clientActiveTicket;
    const current = ticketRes.active_ticket || null;
    appState.clientActiveTicket = current;
    detectCallTransition(previous, current);
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
const restaurantGeocache = { reg: null, prof: null };

function calcElapsedMinutes(timeStr) {
  if (!timeStr) return 1;
  try {
    const parts = String(timeStr).split(" ").pop().split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const now = new Date();
      const curM = now.getHours() * 60 + now.getMinutes();
      const targetM = h * 60 + m;
      let diff = curM - targetM;
      if (diff < 0) diff += 1440;
      return Math.max(1, diff);
    }
  } catch (e) {
    return 1;
  }
  return 1;
}

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
            <span>Sugestões de endereço</span>
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
        ✓ Localizado: <strong>${mainText}</strong> (${lat.toFixed(4)}, ${lng.toFixed(4)})
      </span>
    `;
  }
}

function handleRestaurantAddressInput(prefix) {
  const input = document.getElementById(prefix === "reg" ? "regRestAddress" : "profRestAddress");
  const dropdown = document.getElementById(prefix === "reg" ? "regRestPlacesDropdown" : "profRestPlacesDropdown");
  const badge = document.getElementById(prefix === "reg" ? "regRestAddressBadge" : "profRestAddressBadge");
  if (!input) return;

  clearTimeout(geocodeDebounceTimer);
  const val = input.value.trim();
  if (!val || val.length < 2) {
    if (dropdown) dropdown.style.display = "none";
    if (badge && !val) {
      badge.style.display = "none";
      restaurantGeocache[prefix] = null;
    }
    return;
  }

  geocodeDebounceTimer = setTimeout(async () => {
    const res = await apiFetch(`/api/client/places/autocomplete?query=${encodeURIComponent(val)}`);
    if (res && res.ok && res.predictions && res.predictions.length > 0) {
      if (dropdown) {
        dropdown.innerHTML = `
          ${res.predictions.map((p) => {
            const chosenText = p.secondary_text ? p.secondary_text : p.main_text;
            return `
              <div 
                class="autocomplete-item" 
                onclick="selectRestaurantAutocompletePlace('${prefix}', '${chosenText.replace(/'/g, "\\'")}', ${p.lat}, ${p.lng})"
              >
                <span class="autocomplete-icon">📍</span>
                <div>
                  <div class="autocomplete-main">${p.main_text}</div>
                  <div class="autocomplete-secondary">${p.secondary_text}</div>
                </div>
              </div>
            `;
          }).join("")}
          <div class="autocomplete-footer">
            <span>Sugestões de endereço</span>
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

function selectRestaurantAutocompletePlace(prefix, addressText, lat, lng) {
  const input = document.getElementById(prefix === "reg" ? "regRestAddress" : "profRestAddress");
  const dropdown = document.getElementById(prefix === "reg" ? "regRestPlacesDropdown" : "profRestPlacesDropdown");
  const badge = document.getElementById(prefix === "reg" ? "regRestAddressBadge" : "profRestAddressBadge");

  if (input) input.value = addressText;
  restaurantGeocache[prefix] = { lat, lng };

  if (dropdown) dropdown.style.display = "none";

  if (badge) {
    badge.style.display = "block";
    badge.innerHTML = `
      <span style="color:var(--emerald-text); font-weight:600; font-size:0.73rem;">
        ✓ Localizado: <strong>${addressText}</strong> (${lat.toFixed(4)}, ${lng.toFixed(4)})
      </span>
    `;
  }
}

async function submitRegister(e) {
  e.preventDefault();
  if (advanceIfNotLastStep(e)) return;
  const name = document.getElementById("regName")?.value;
  const email = document.getElementById("regEmail")?.value;
  const password = document.getElementById("regPassword")?.value;
  const phone = document.getElementById("regPhone")?.value;
  const workplace = document.getElementById("regWorkplace")?.value;
  const baseline = document.getElementById("regBaseline")?.value;

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
    baseline_standing_wait_min: baseline || undefined,
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
  const baseline = document.getElementById("profBaseline")?.value;

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
    baseline_standing_wait_min: baseline || undefined,
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

// ==================== HELPERS DE INTERFACE (MENOS INFORMAÇÃO POR TELA) ====================

function isOnFormScreen() {
  const view = appState.mainView;
  if (view === "client") {
    return !appState.clientAuth.client || appState.clientActiveTab === "perfil";
  }
  if (view === "restaurant") {
    return !appState.restaurantAuth.restaurant || appState.restaurantActiveTab === "perfil";
  }
  return false;
}

// Liga/desliga um flag de appState.ui e re-renderiza (filtros, histórico, walk-in...)
function toggleUIFlag(flag) {
  appState.ui[flag] = !appState.ui[flag];
  renderApp();
}

function setTableFilter(status) {
  appState.ui.tableFilter = status;
  renderApp();
}

// Seção recolhível de formulário: alterna só no DOM para não perder o que foi digitado
function toggleSection(key) {
  appState.ui.open[key] = !appState.ui.open[key];
  const el = document.querySelector(`[data-section="${key}"]`);
  if (el) el.classList.toggle("open", appState.ui.open[key]);
}

// Antes de enviar: abre as seções recolhidas que tenham campo inválido (senão o navegador não consegue mostrar o erro)
function openInvalidSections(form) {
  if (!form) return;
  form.querySelectorAll("input, select, textarea").forEach((field) => {
    if (field.checkValidity()) return;
    const section = field.closest("[data-section]");
    if (section && !section.classList.contains("open")) toggleSection(section.dataset.section);
  });
}

function renderSection(key, title, subtitle, bodyHTML) {
  const isOpen = !!appState.ui.open[key];
  return `
    <div class="collapsible ${isOpen ? "open" : ""}" data-section="${key}">
      <button type="button" class="collapsible-head" onclick="toggleSection('${key}')">
        <span>
          <span class="collapsible-title">${title}</span>
          ${subtitle ? `<span class="collapsible-sub">${subtitle}</span>` : ""}
        </span>
        <span class="collapsible-chevron">▾</span>
      </button>
      <div class="collapsible-body">${bodyHTML}</div>
    </div>`;
}

// Cadastro em etapas: troca de etapa só no DOM, validando os campos da etapa atual
function goFormStep(btn, delta) {
  const form = btn.closest("form");
  if (!form) return;
  const steps = Array.from(form.querySelectorAll(".form-step"));
  const current = steps.findIndex((s) => s.classList.contains("active"));
  if (delta > 0) {
    const fields = steps[current].querySelectorAll("input, select, textarea");
    for (const field of fields) {
      if (!field.reportValidity()) return;
    }
  }
  const next = Math.min(steps.length - 1, Math.max(0, current + delta));
  steps.forEach((s, i) => s.classList.toggle("active", i === next));
  form.querySelectorAll(".step-dot").forEach((d, i) => d.classList.toggle("active", i <= next));
}

// Enter numa etapa intermediária avança a etapa em vez de enviar o cadastro incompleto
function advanceIfNotLastStep(e) {
  const form = e.target;
  const steps = Array.from(form.querySelectorAll(".form-step"));
  if (steps.length === 0) return false;
  const current = steps.findIndex((s) => s.classList.contains("active"));
  if (current < steps.length - 1) {
    const btn = steps[current].querySelector("[data-step-next]");
    if (btn) goFormStep(btn, 1);
    return true;
  }
  return false;
}

function renderStepDots(labels) {
  return `
    <div class="step-dots">
      ${labels.map((l, i) => `<span class="step-dot ${i === 0 ? "active" : ""}">${i + 1}. ${l}</span>`).join("")}
    </div>`;
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

      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:1rem; font-size:0.82rem;">
        <span>
          <strong>~${rest.estimated_wait_min ?? 15} min</strong> de espera • ${rest.distance_walk_min} min a pé
        </span>
        <a href="${rest.maps_external_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rest.name)}`}" target="_blank" class="btn-link" style="white-space:nowrap;">
          Abrir mapa
        </a>
      </div>

      <!-- Seletor de Mesa (Quantidade de Pessoas) -->
      <div style="margin-bottom:1.15rem;">
        <label class="form-label">Quantas pessoas?</label>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.4rem;">
          ${[
            { n: 2, lbl: "1-2", cat: "1-2" },
            { n: 4, lbl: "3-4", cat: "3-4" },
            { n: 6, lbl: "5-6", cat: "5+" },
            { n: 8, lbl: "8+", cat: "5+" },
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
          Entrar na fila
        </button>
        <a href="${rest.whatsapp_url}" target="_blank" class="btn-link" style="text-align:center;">
          💬 Falar com o restaurante
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
    unlockAudio();
    requestCallNotificationPermission();
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

// ==================== ALERTAS DE CHAMADA (SOM, VIBRAÇÃO E NOTIFICAÇÃO) ====================

const CALLED_STATUSES = ["CHAMADO", "CALLED"];
const SERVED_STATUSES = ["SENTADO", "SEATED", "ENCERRADO"];
const alertedCallEntries = new Set();
const ORIGINAL_TITLE = document.title;
let audioCtx = null;
let titleFlashTimer = null;

function isCalledStatus(status) {
  return CALLED_STATUSES.includes((status || "").toUpperCase());
}

function isServedStatus(status) {
  return SERVED_STATUSES.includes((status || "").toUpperCase());
}

// Navegadores só liberam áudio depois de uma interação do usuário
function unlockAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) {
    audioCtx = null;
  }
}
document.addEventListener("pointerdown", unlockAudio);
document.addEventListener("keydown", unlockAudio);

function playCallChime() {
  if (!audioCtx) return;
  const start = audioCtx.currentTime;
  for (let round = 0; round < 2; round++) {
    [880, 1175, 1568].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = start + round * 0.9 + i * 0.2;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }
}

function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function requestCallNotificationPermission() {
  if (!notificationsSupported() || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch (err) {
    /* navegador sem suporte à API baseada em Promise */
  }
  renderApp();
}

function flashTitle(message) {
  clearInterval(titleFlashTimer);
  let on = false;
  titleFlashTimer = setInterval(() => {
    document.title = on ? ORIGINAL_TITLE : message;
    on = !on;
  }, 1000);
  const stop = () => {
    if (document.visibilityState === "visible") {
      clearInterval(titleFlashTimer);
      document.title = ORIGINAL_TITLE;
      document.removeEventListener("visibilitychange", stop);
    }
  };
  document.addEventListener("visibilitychange", stop);
  if (document.visibilityState === "visible") setTimeout(stop, 6000);
}

function alertClientCalled(ticket) {
  if (!ticket || alertedCallEntries.has(ticket.id)) return;
  alertedCallEntries.add(ticket.id);

  const tableTxt = ticket.table_number ? ` — Mesa ${ticket.table_number}` : "";
  const body = `${ticket.restaurant_name} chamou você${tableTxt}. Pode ir para o restaurante!`;

  playCallChime();
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
  flashTitle("🔔 Sua mesa está pronta!");

  if (notificationsSupported() && Notification.permission === "granted") {
    try {
      const n = new Notification("🔔 Sua mesa está pronta!", {
        body,
        tag: `cltempo-call-${ticket.id}`,
        requireInteraction: true,
      });
      n.onclick = () => {
        window.focus();
        appState.mainView = "client";
        appState.clientActiveTab = "fila";
        renderApp();
        n.close();
      };
    } catch (err) {
      /* alguns navegadores móveis só permitem notificações via Service Worker */
    }
  }

  showCalledModal(ticket, body);
}

function showCalledModal(ticket, body) {
  const modalContainer = document.getElementById("modalContainer");
  const overlay = document.getElementById("modalOverlay");
  if (!modalContainer || !overlay) return;
  appState.selectedModalRestaurant = null;
  modalContainer.innerHTML = `
    <div style="text-align:center; padding:0.5rem 0;">
      <div style="font-size:3rem; line-height:1;">🔔</div>
      <h3 style="font-size:1.35rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif; margin:0.6rem 0 0.35rem;">
        Sua mesa está pronta!
      </h3>
      <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1.1rem;">${body}</p>
      ${ticket.table_number ? `<div class="badge badge-purple" style="font-size:1rem; font-weight:800; padding:0.45rem 0.9rem; margin-bottom:1.1rem;">🪑 Mesa ${ticket.table_number}</div>` : ""}
      <button type="button" class="btn btn-emerald btn-block btn-lg" onclick="closeModal(); switchMainView('client'); switchClientTab('fila');">
        Ver minha reserva
      </button>
    </div>
  `;
  overlay.style.display = "flex";
}

// Dispara o alerta quando o ticket do cliente logado muda de AGUARDANDO para CHAMADO
function detectCallTransition(previous, current) {
  if (!current || !isCalledStatus(current.status)) return;
  if (previous && previous.id === current.id && !isCalledStatus(previous.status)) {
    alertClientCalled(current);
  } else {
    // Já estava chamado ao carregar a página: não toca de novo
    alertedCallEntries.add(current.id);
  }
}

function renderCallAlertsHint() {
  if (!notificationsSupported()) return "";
  if (Notification.permission === "default") {
    return `
      <button type="button" class="btn btn-outline btn-block btn-sm" onclick="unlockAudio(); requestCallNotificationPermission()">
        🔔 Me avisar quando a mesa ficar pronta
      </button>`;
  }
  if (Notification.permission === "denied") {
    return `
      <div style="font-size:0.72rem; color:var(--text-muted); text-align:center;">
        Notificações bloqueadas no navegador — você ainda recebe som e aviso na tela com esta aba aberta.
      </div>`;
  }
  return `
    <div style="font-size:0.72rem; color:var(--text-muted); text-align:center;">
      🔔 Alertas ativos: avisaremos com som e notificação quando sua mesa for chamada.
    </div>`;
}

// ==================== FEEDBACK DE TEMPO EM PÉ (MÉTRICA M4) ====================

function clientNeedsBaseline() {
  const c = appState.clientAuth.client;
  return !!c && (c.baseline_standing_wait_min === null || c.baseline_standing_wait_min === undefined);
}

function setFeedbackValue(inputId, value) {
  const input = document.getElementById(inputId);
  if (input) input.value = value;
  document.querySelectorAll(`[data-target="${inputId}"]`).forEach((chip) => {
    chip.classList.toggle("selected", String(chip.dataset.value) === String(value));
  });
}

function renderMinuteChips(inputId, values) {
  return `
    <div class="cuisine-grid" style="margin-bottom:0.5rem;">
      ${values.map((v) => `
        <div class="cuisine-chip" data-target="${inputId}" data-value="${v}" onclick="setFeedbackValue('${inputId}', ${v})">
          ${v === 0 ? "Nada" : `${v} min`}
        </div>
      `).join("")}
    </div>`;
}

function openFeedbackModal(entryId) {
  const entry =
    (appState.clientActiveTicket && appState.clientActiveTicket.id === entryId && appState.clientActiveTicket) ||
    (appState.clientHistory || []).find((h) => h.id === entryId);
  const restaurantName = entry ? entry.restaurant_name : "o restaurante";
  const askBaseline = clientNeedsBaseline();

  const modalContainer = document.getElementById("modalContainer");
  const overlay = document.getElementById("modalOverlay");
  if (!modalContainer || !overlay) return;
  appState.selectedModalRestaurant = null;

  modalContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
      <h3 style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
        ⏱️ Como foi sua espera?
      </h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form onsubmit="submitFeedback(event, ${entryId})">
      <div class="form-group">
        <label class="form-label">
          Quanto tempo você ficou <strong>em pé</strong> esperando a mesa em ${restaurantName}?
        </label>
        ${renderMinuteChips("fbPerceived", [0, 2, 5, 10, 15, 20])}
        <input type="number" id="fbPerceived" class="form-input" min="0" max="120" placeholder="Minutos (ex.: 3)" required />
      </div>
      ${askBaseline ? `
        <div class="form-group">
          <label class="form-label">
            E antes do CLTempo, quanto tempo você costumava esperar em pé na fila do almoço?
          </label>
          ${renderMinuteChips("fbBaseline", [10, 20, 30, 40, 50])}
          <input type="number" id="fbBaseline" class="form-input" min="0" max="120" placeholder="Minutos (ex.: 35)" required />
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
            Perguntamos só uma vez. Você pode mudar depois no Perfil.
          </div>
        </div>
      ` : ""}
      <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Agora não</button>
        <button type="submit" class="btn btn-primary">Enviar resposta</button>
      </div>
    </form>
  `;
  overlay.style.display = "flex";
}

async function submitFeedback(e, entryId) {
  e.preventDefault();
  const client = appState.clientAuth.client;
  const perceived = document.getElementById("fbPerceived")?.value;
  const baseline = document.getElementById("fbBaseline")?.value;

  const res = await apiPost("/api/client/feedback", {
    entry_id: entryId,
    client_id: client ? client.id : null,
    perceived_standing_wait_min: perceived,
    baseline_standing_wait_min: baseline || undefined,
  });

  if (res && res.ok) {
    if (res.client) {
      appState.clientAuth.client = res.client;
      localStorage.setItem("cltempo_client", JSON.stringify(res.client));
    }
    closeModal();
    showToast(res.message || "Obrigado pela resposta!", "var(--emerald)");
    await refreshClientState();
    renderApp();
  }
}

function pendingFeedbackEntries() {
  return (appState.clientHistory || []).filter(
    (h) => isServedStatus(h.status) && (h.perceived_standing_wait_min === null || h.perceived_standing_wait_min === undefined)
  );
}

// ==================== RENDERS DA INTERFACE CLIENTE ====================

function renderAuthScreen() {
  const isLogin = appState.clientAuth.authTab === "login";

  const popularCuisines = getAvailableCuisines();

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
            <label class="form-label">E-mail</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="seu.email@gmail.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:0.85rem;">
            Entrar
          </button>
        </form>
      ` : `
        <form onsubmit="submitRegister(event)">
          ${renderStepDots(["Sua conta", "Seu almoço"])}

          <div class="form-step active">
            <div class="form-group">
              <label class="form-label">Nome</label>
              <input type="text" id="regName" class="form-input" placeholder="Seu nome" required />
            </div>
            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input type="email" id="regEmail" class="form-input" placeholder="seu.email@gmail.com" required />
            </div>
            <div class="form-group">
              <label class="form-label">Senha</label>
              <input type="password" id="regPassword" class="form-input" placeholder="Mínimo 4 caracteres" required />
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp</label>
              <input type="tel" id="regPhone" class="form-input" placeholder="21987654321" required />
            </div>
            <div class="form-group autocomplete-wrap">
              <label class="form-label">Onde você trabalha?</label>
              <input
                type="text"
                id="regWorkplace"
                class="form-input"
                placeholder="Nome ou endereço do prédio"
                required
                autocomplete="off"
                oninput="handleWorkplaceInput('reg')"
                onfocus="handleWorkplaceInput('reg')"
              />
              <div id="regPlacesDropdown" class="autocomplete-dropdown" style="display:none;"></div>
              <div id="regWorkplaceBadge" style="margin-top:0.35rem; display:none;"></div>
            </div>
            <button type="button" class="btn btn-primary btn-block btn-lg" data-step-next onclick="goFormStep(this, 1)">
              Continuar
            </button>
          </div>

          <div class="form-step">
            <div class="form-group">
              <label class="form-label">Escolha até 3 comidas favoritas</label>
              <div class="cuisine-grid">
                ${popularCuisines.map((c, i) => `
                  <div
                    class="cuisine-chip ${i < 3 ? "selected" : ""}"
                    data-value="${c.name}"
                    onclick="toggleCuisineSelection(this)"
                  >
                    ${c.icon ? c.icon + " " : ""}${c.name}
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Quais vales-refeição você tem?</label>
              <div class="vr-grid">
                ${availableVRs.map((vr, i) => `
                  <div
                    class="vr-chip reg-vr-chip ${i < 2 ? "selected" : ""}"
                    data-value="${vr}"
                    onclick="toggleVRSelection(this)"
                  >
                    ${vr}
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Sem o app, quantos minutos você espera em pé na fila? <span class="form-hint">(opcional)</span></label>
              <input type="number" id="regBaseline" class="form-input" min="0" max="120" placeholder="Ex.: 35" />
            </div>

            <div style="display:flex; gap:0.5rem;">
              <button type="button" class="btn btn-outline btn-lg" onclick="goFormStep(this, -1)">Voltar</button>
              <button type="submit" class="btn btn-primary btn-block btn-lg">Criar conta</button>
            </div>
          </div>
        </form>
      `}

      ${isLogin ? `
        <!-- Atalhos de Demonstração Rápida -->
        <div class="demo-shortcuts">
          <div class="demo-shortcuts-title">Acesso rápido (demo)</div>
          <div class="demo-shortcuts-row">
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(1)">Vivian</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(2)">Arthur</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(3)">Carolina</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginAs(4)">Fernando</button>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderClientBuscarTab() {
  const f = appState.searchFilters;
  const showFilters = appState.ui.showFilters;

  const cuisines = [
    "TODOS",
    ...getAvailableCuisines().map((c) => c.name),
  ];

  const hasCustomFilters = f.max_wait_min < 60 || f.radius_km !== 3.0;

  const resultsHTML = appState.searchResults.length === 0 ? `
    <div class="empty-state">
      Nenhum restaurante com esses filtros.<br>
      <span style="font-size:0.75rem;">Tente aumentar a distância ou o tempo de espera.</span>
    </div>
  ` : appState.searchResults.map((r) => `
      <div class="restaurant-card" onclick="openRestaurantModal(${r.id})">
        <div class="restaurant-card-header">
          <div>
            <div style="font-weight:700; font-size:0.95rem;">${r.name}</div>
            <div style="font-size:0.74rem; color:var(--text-muted);">
              ${r.category} • ${r.distance_walk_min} min a pé
            </div>
          </div>
          <span class="badge ${r.waiting_in_category > 0 ? "badge-orange" : "badge-emerald"}">
            ${r.waiting_in_category === 0 ? "Sem fila" : `~${r.estimated_wait_min} min`}
          </span>
        </div>
      </div>
    `).join("");

  return `
    <!-- Busca + culinária (sempre visíveis) -->
    <div class="search-controls">
      <div style="display:flex; gap:0.4rem; margin-bottom:0.5rem;">
        <input
          type="text"
          class="form-input"
          placeholder="🔍 Buscar restaurante"
          value="${f.name}"
          oninput="onSearchInput(this.value)"
        />
        <button
          type="button"
          class="btn btn-sm ${showFilters || hasCustomFilters ? "btn-primary" : "btn-outline"}"
          style="white-space:nowrap;"
          onclick="toggleUIFlag('showFilters')"
          title="Tempo máximo e distância"
        >
          ⚙️ Filtros
        </button>
      </div>

      <div class="chips-row">
        ${cuisines.map((c) => `
          <div
            class="filter-chip ${f.cuisine_type === c ? "active" : ""}"
            onclick="onCuisineFilter('${c}')"
          >
            ${c === "TODOS" ? "Todos" : c}
          </div>
        `).join("")}
      </div>

      ${showFilters ? `
        <div class="range-wrap">
          <span>Espera de até <strong>${f.max_wait_min} min</strong></span>
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
          <span>Até <strong>${f.radius_km.toFixed(1)} km</strong> do trabalho</span>
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
      ` : ""}
    </div>

    <div class="section-label">
      ${appState.searchResults.length} restaurante(s) para você
    </div>

    <div class="restaurants-list">
      ${resultsHTML}
    </div>
  `;
}

function renderClientTicketCard(ticket) {
  const st = (ticket.status || "").toUpperCase();
  const isCalled = st === "CHAMADO" || st === "CALLED";
  const isSeated = st === "SENTADO" || st === "SEATED";

  let statusBadge = `<span class="badge badge-orange">⏳ Na fila</span>`;
  if (isCalled) statusBadge = `<span class="badge badge-emerald">🔔 Sua mesa está pronta</span>`;
  else if (isSeated) statusBadge = `<span class="badge badge-blue">🍽️ Bom apetite</span>`;

  // Informação principal muda conforme o momento: posição na fila, ou a mesa
  let highlight = "";
  if (isCalled || isSeated) {
    highlight = `
      <div class="ticket-highlight">
        <div class="ticket-highlight-val">Mesa ${ticket.table_number || "—"}</div>
        <div class="ticket-highlight-lbl">${isCalled ? "Dirija-se à mesa" : "Você está sentado"}</div>
      </div>`;
  } else {
    highlight = `
      <div class="ticket-metrics-grid" style="grid-template-columns:repeat(2, 1fr);">
        <div class="ticket-metric-box">
          <div class="ticket-metric-val">${ticket.position}º</div>
          <div class="ticket-metric-lbl">Posição</div>
        </div>
        <div class="ticket-metric-box">
          <div class="ticket-metric-val">~${ticket.estimated_wait_min} min</div>
          <div class="ticket-metric-lbl">Espera</div>
        </div>
      </div>`;
  }

  let actions = "";
  if (isCalled) {
    actions = `
      <button class="btn btn-emerald btn-block btn-lg" onclick="confirmCheckin(${ticket.id})">
        Cheguei
      </button>
      <button class="btn-link" onclick="cancelTicket(${ticket.id})">Cancelar reserva</button>`;
  } else if (isSeated) {
    actions = (ticket.perceived_standing_wait_min === null || ticket.perceived_standing_wait_min === undefined) ? `
      <button class="btn btn-primary btn-block" onclick="openFeedbackModal(${ticket.id})">
        ⏱️ Quanto tempo você ficou em pé?
      </button>
    ` : `
      <div style="font-size:0.75rem; color:var(--text-muted); text-align:center;">
        ✅ Obrigado pela resposta!
      </div>`;
  } else {
    actions = `
      ${renderCallAlertsHint()}
      <button class="btn-link" onclick="cancelTicket(${ticket.id})">Sair da fila</button>`;
  }

  return `
    <div class="active-ticket ${isCalled ? "called" : ""}">
      ${statusBadge}
      <div style="margin:0.6rem 0 0.75rem 0;">
        <div style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
          ${ticket.restaurant_name}
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted);">
          ${ticket.party_size} pessoa(s) •
          <a href="${ticket.whatsapp_url}" target="_blank" style="color:var(--text-muted);">💬 WhatsApp</a>
        </div>
      </div>
      ${highlight}
      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.85rem;">
        ${actions}
      </div>
    </div>`;
}

function renderClientFilaTab() {
  const ticket = appState.clientActiveTicket;
  const history = appState.clientHistory || [];
  const showHistory = appState.ui.showHistory;
  const pending = pendingFeedbackEntries();

  return `
    <div style="margin-bottom:1.25rem;">
      ${ticket ? renderClientTicketCard(ticket) : `
        <div class="empty-state" style="padding:2rem 1.25rem;">
          <div style="font-size:2rem; margin-bottom:0.5rem;">☕</div>
          <div style="font-weight:700; font-size:0.95rem; color:var(--text);">Você não está em nenhuma fila</div>
          <button class="btn btn-primary btn-sm" style="margin-top:0.85rem;" onclick="switchClientTab('buscar')">
            Escolher restaurante
          </button>
        </div>
      `}
    </div>

    ${!ticket && pending.length > 0 ? `
      <div class="card" style="margin-bottom:0.85rem; border-color:var(--primary); display:flex; justify-content:space-between; align-items:center; gap:0.6rem;">
        <div style="font-size:0.8rem;">
          <strong>Como foi sua espera em ${pending[0].restaurant_name}?</strong>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openFeedbackModal(${pending[0].id})">Responder</button>
      </div>
    ` : ""}

    ${history.length > 0 ? `
      <button type="button" class="btn btn-outline btn-block btn-sm" onclick="toggleUIFlag('showHistory')">
        ${showHistory ? "Ocultar histórico ▴" : `Ver histórico (${history.length}) ▾`}
      </button>
      ${showHistory ? `
        <div class="history-list">
          ${history.map((h) => {
            const st = (h.status || "").toUpperCase();
            const cancelled = st === "CANCELADO" || st === "CANCELLED" || st === "NO_SHOW";
            const needsFeedback = !cancelled && isServedStatus(h.status) &&
              (h.perceived_standing_wait_min === null || h.perceived_standing_wait_min === undefined);
            return `
              <div class="history-item">
                <div>
                  <div style="font-weight:700; font-size:0.85rem;">${h.restaurant_name}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${h.joined_at}</div>
                </div>
                ${cancelled
                  ? `<span class="badge badge-amber">Cancelado</span>`
                  : needsFeedback
                    ? `<button class="btn btn-outline btn-sm" onclick="openFeedbackModal(${h.id})">Avaliar</button>`
                    : `<span class="badge badge-emerald">Atendido</span>`}
              </div>`;
          }).join("")}
        </div>
      ` : ""}
    ` : ""}
  `;
}

function renderClientPerfilTab() {
  const client = appState.clientAuth.client;

  const popularCuisines = getAvailableCuisines();
  const currentPrefs = [client.pref_food_1, client.pref_food_2, client.pref_food_3].filter(Boolean);
  const vrText = client.meal_vouchers || client.vr_card || "—";

  const dadosHTML = `
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" id="profName" class="form-input" value="${client.name}" required />
    </div>
    <div class="form-group">
      <label class="form-label">WhatsApp</label>
      <input type="tel" id="profPhone" class="form-input" value="${client.phone || ""}" required />
    </div>
    <div class="form-group autocomplete-wrap">
      <label class="form-label">Onde você trabalha?</label>
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
      <div id="profWorkplaceBadge" style="margin-top:0.35rem; display:none;"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Nova senha <span class="form-hint">(deixe em branco para manter)</span></label>
      <input type="password" id="profPassword" class="form-input" />
    </div>`;

  const prefsHTML = `
    <div class="form-group">
      <label class="form-label">Até 3 comidas favoritas</label>
      <div class="cuisine-grid">
        ${popularCuisines.map((c) => `
          <div
            class="cuisine-chip profile-cuisine-chip ${currentPrefs.includes(c.name) ? "selected" : ""}"
            data-value="${c.name}"
            onclick="toggleProfileCuisineSelection(this)"
          >
            ${c.icon ? c.icon + " " : ""}${c.name}
          </div>
        `).join("")}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Vales-refeição</label>
      <button type="button" class="btn btn-outline btn-sm" onclick="openEditVRModal()">💳 ${vrText} — alterar</button>
    </div>
    <div class="form-group">
      <label class="form-label">Sem o app, quantos minutos você esperava em pé?</label>
      <input type="number" id="profBaseline" class="form-input" min="0" max="120" value="${client.baseline_standing_wait_min ?? ""}" placeholder="Ex.: 35" />
    </div>`;

  return `
    <form onsubmit="submitProfileUpdate(event)">
      ${renderSection("cliDados", "Meus dados", client.email || "", dadosHTML)}
      ${renderSection("cliPrefs", "Preferências de almoço", currentPrefs.join(", "), prefsHTML)}
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:0.85rem;" onclick="openInvalidSections(this.form)">
        Salvar alterações
      </button>
    </form>

    <div class="account-actions">
      <button type="button" class="btn btn-outline btn-block" onclick="clientLogout()">Sair da conta</button>
      <button type="button" class="btn-link btn-link-danger" onclick="submitProfileDelete()">Apagar minha conta</button>
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

function switchRestaurantTab(tab) {
  appState.restaurantActiveTab = tab;
  renderApp();
}

function setRestaurantAuthTab(tab) {
  appState.restaurantAuth.authTab = tab;
  renderApp();
}

function quickLoginRestaurantAs(email, password = "123456") {
  submitRestaurantLogin(null, email, password);
}

async function submitRestaurantLogin(e, directEmail = null, directPw = null) {
  if (e) e.preventDefault();
  const email = directEmail || document.getElementById("restLoginEmail")?.value;
  const password = directPw || document.getElementById("restLoginPassword")?.value;

  if (!email || !password) {
    showToast("Informe e-mail e senha do restaurante", "var(--rose)");
    return;
  }

  const res = await apiPost("/api/restaurant/login", { email, password });
  if (res && res.ok) {
    appState.restaurantAuth.restaurant = res.restaurant;
    localStorage.setItem("cltempo_restaurant", JSON.stringify(res.restaurant));
    showToast(`Bem-vindo, <strong>${res.restaurant.name}</strong>!`, "var(--emerald)");
    appState.restaurantActiveTab = "fila";
    renderApp();
  }
}

function toggleRestaurantRegisterVR(vr) {
  const current = appState.restaurantAuth.registerVRs;
  if (current.includes(vr)) {
    appState.restaurantAuth.registerVRs = current.filter((x) => x !== vr);
  } else {
    appState.restaurantAuth.registerVRs = [...current, vr];
  }
  syncVRChips(".reg-rest-vr-chip", appState.restaurantAuth.registerVRs);
}

function toggleRestaurantProfileVR(vr) {
  const current = appState.restaurantAuth.profileVRs;
  if (current.includes(vr)) {
    appState.restaurantAuth.profileVRs = current.filter((x) => x !== vr);
  } else {
    appState.restaurantAuth.profileVRs = [...current, vr];
  }
  syncVRChips(".prof-rest-vr-chip", appState.restaurantAuth.profileVRs);
}

function syncVRChips(selector, selected) {
  document.querySelectorAll(selector).forEach((chip) => {
    chip.classList.toggle("selected", selected.includes(chip.dataset.value));
  });
}

function selectRestaurantRegisterCuisine(cuisineName) {
  appState.restaurantAuth.registerCuisine = cuisineName;
  const inputEl = document.getElementById("regRestCuisine");
  if (inputEl) inputEl.value = cuisineName;
  document.querySelectorAll(".reg-rest-cuisine-chip").forEach((chip) => {
    chip.classList.toggle("selected", chip.dataset.value === cuisineName);
  });
}

function selectRestaurantProfileCuisine(cuisineName) {
  const rest = appState.restaurantAuth.restaurant;
  if (rest) {
    rest.cuisine_type = cuisineName;
    rest.category = cuisineName;
  }
  const inputEl = document.getElementById("profRestCuisine");
  if (inputEl) inputEl.value = cuisineName;
  document.querySelectorAll(".prof-rest-cuisine-chip").forEach((chip) => {
    chip.classList.toggle("selected", chip.dataset.value === cuisineName);
  });
}

async function submitRestaurantRegister(e) {
  e.preventDefault();
  if (advanceIfNotLastStep(e)) return;
  const name = document.getElementById("regRestName")?.value;
  const email = document.getElementById("regRestEmail")?.value;
  const password = document.getElementById("regRestPassword")?.value;
  const phone = document.getElementById("regRestPhone")?.value;
  const cuisine = document.getElementById("regRestCuisine")?.value || appState.restaurantAuth.registerCuisine || "Executivo";
  const address = document.getElementById("regRestAddress")?.value;

  const turnover_1_2 = Number(document.getElementById("regRestTurnover12")?.value || 25);
  const turnover_3_4 = Number(document.getElementById("regRestTurnover34")?.value || 35);
  const turnover_5_plus = Number(document.getElementById("regRestTurnover5Plus")?.value || 45);

  const tables_1_2 = Number(document.getElementById("regRestTables12")?.value || 6);
  const tables_3_4 = Number(document.getElementById("regRestTables34")?.value || 6);
  const tables_5_plus = Number(document.getElementById("regRestTables5Plus")?.value || 4);

  const coords = restaurantGeocache.reg;

  const payload = {
    name,
    email,
    password,
    phone,
    cuisine_type: cuisine,
    category: cuisine,
    vr_accepted: appState.restaurantAuth.registerVRs,
    address,
    lat: coords ? coords.lat : undefined,
    lng: coords ? coords.lng : undefined,
    turnover_1_2,
    turnover_3_4,
    turnover_5_plus,
    tables_1_2,
    tables_3_4,
    tables_5_plus,
  };

  const res = await apiPost("/api/restaurant/register", payload);
  if (res && res.ok) {
    appState.restaurantAuth.restaurant = res.restaurant;
    localStorage.setItem("cltempo_restaurant", JSON.stringify(res.restaurant));
    showToast(`Restaurante <strong>${res.restaurant.name}</strong> cadastrado com sucesso!`, "var(--emerald)");
    appState.restaurantActiveTab = "fila";
    renderApp();
  }
}

function restaurantLogout() {
  localStorage.removeItem("cltempo_restaurant");
  appState.restaurantAuth.restaurant = null;
  appState.restaurantActiveTab = "fila";
  showToast("Você saiu da conta do restaurante.", "var(--blue)");
  renderApp();
}

async function submitRestaurantProfileUpdate(e) {
  e.preventDefault();
  const rest = appState.restaurantAuth.restaurant;
  if (!rest) return;

  const name = document.getElementById("profRestName")?.value;
  const phone = document.getElementById("profRestPhone")?.value;
  const cuisine = document.getElementById("profRestCuisine")?.value || rest.cuisine_type || rest.category || "Executivo";
  const address = document.getElementById("profRestAddress")?.value;
  const t1 = Number(document.getElementById("profRestTurnover12")?.value || 25);
  const t2 = Number(document.getElementById("profRestTurnover34")?.value || 35);
  const t3 = Number(document.getElementById("profRestTurnover5Plus")?.value || 45);

  const tb1 = Number(document.getElementById("profRestTables12")?.value || rest.tables_1_2 || 6);
  const tb2 = Number(document.getElementById("profRestTables34")?.value || rest.tables_3_4 || 6);
  const tb3 = Number(document.getElementById("profRestTables5Plus")?.value || rest.tables_5_plus || 4);

  const coords = restaurantGeocache.prof;

  const payload = {
    name,
    phone,
    cuisine_type: cuisine,
    category: cuisine,
    address,
    lat: coords ? coords.lat : rest.lat,
    lng: coords ? coords.lng : rest.lng,
    vr_accepted: appState.restaurantAuth.profileVRs,
    turnover_1_2: t1,
    turnover_3_4: t2,
    turnover_5_plus: t3,
    tables_1_2: tb1,
    tables_3_4: tb2,
    tables_5_plus: tb3,
  };

  const res = await apiPost("/api/restaurant/profile/update", { restaurant_id: rest.id, ...payload });
  if (res && res.ok) {
    appState.restaurantAuth.restaurant = res.restaurant;
    localStorage.setItem("cltempo_restaurant", JSON.stringify(res.restaurant));
    const stateRes = await apiFetch("/api/state");
    if (stateRes) {
      appState.data = stateRes;
    }
    showToast("Informações e mesas do restaurante atualizadas!", "var(--emerald)");
    renderApp();
  }
}

async function submitRestaurantProfileDelete() {
  const rest = appState.restaurantAuth.restaurant;
  if (!rest) return;

  if (confirm(`Tem certeza que deseja excluir o cadastro de "${rest.name}"? Esta ação cancelará filas ativas e removerá o restaurante do sistema.`)) {
    const res = await apiPost("/api/restaurant/profile/delete", { restaurant_id: rest.id });
    if (res && res.ok) {
      restaurantLogout();
    }
  }
}

async function toggleCurrentRestOpen() {
  const rest = appState.restaurantAuth.restaurant;
  if (!rest) return;

  const res = await apiPost("/api/restaurant/toggle", { restaurant_id: rest.id });
  if (res && res.ok) {
    rest.is_open = res.is_open;
    appState.restaurantAuth.restaurant = { ...rest };
    localStorage.setItem("cltempo_restaurant", JSON.stringify(appState.restaurantAuth.restaurant));
    showToast(res.is_open ? "Fila digital ABERTA para novos clientes!" : "Fila digital PAUSADA.", "var(--blue)");
    renderApp();
  }
}

// ==================== OPERAÇÕES DE FILA E SALÃO ====================

function openCallClientModal(entryId) {
  const activeQueue = appState.data?.active_queue || [];
  const entry = activeQueue.find((q) => q.id === entryId);
  if (!entry) return;

  const restId = appState.restaurantAuth.restaurant?.id || entry.restaurant_id;
  const allTables = appState.data?.restaurant_tables || [];
  const restTables = allTables.filter((t) => t.restaurant_id === restId);

  // Encontra a menor mesa livre correspondente ao porte
  const freeCatTables = restTables.filter(
    (t) => t.table_type === entry.table_category && t.status === "LIVRE"
  );
  freeCatTables.sort((a, b) => a.table_number - b.table_number);
  const suggestedTable = freeCatTables[0] ? freeCatTables[0].table_number : null;

  appState.restaurantCallingModal = {
    entry,
    suggestedTable,
    restTables,
  };
  renderApp();
}

function closeCallClientModal() {
  appState.restaurantCallingModal = null;
  renderApp();
}

async function confirmCallClient(entryId) {
  const select = document.getElementById("selectCallTable");
  if (!select) return;
  if (!select.value) {
    showToast("Nenhuma mesa livre. Libere uma mesa na aba Mesas.", "var(--amber)");
    return;
  }
  const tableNum = Number(select.value);

  const modalData = appState.restaurantCallingModal;
  const targetTable = modalData?.restTables?.find((t) => t.table_number === tableNum);

  if (targetTable && targetTable.status !== "LIVRE") {
    showToast(`A Mesa ${tableNum} já está ocupada ou indisponível! Selecione uma mesa livre.`, "var(--rose)");
    return;
  }

  const res = await apiPost("/api/restaurant/call", {
    entry_id: entryId,
    table_number: tableNum,
  });

  if (res && res.ok) {
    showToast(`🔔 Cliente chamado para a <strong>Mesa ${res.table_number}</strong>!`, "var(--emerald)");
    closeCallClientModal();
    await refreshClientState();
    renderApp();
  }
}

function openChangeTableModal(entryId, currentTable) {
  const activeQueue = appState.data?.active_queue || [];
  const entry = activeQueue.find((q) => q.id === entryId);
  if (!entry) return;

  const restId = appState.restaurantAuth.restaurant?.id || entry.restaurant_id;
  const allTables = appState.data?.restaurant_tables || [];
  const restTables = allTables.filter((t) => t.restaurant_id === restId);

  appState.restaurantChangeTableModal = {
    entry,
    currentTable,
    restTables,
  };
  renderApp();
}

function closeChangeTableModal() {
  appState.restaurantChangeTableModal = null;
  renderApp();
}

async function confirmChangeTable(entryId) {
  const select = document.getElementById("selectNewTable");
  if (!select) return;
  const newTableNum = Number(select.value);

  const modalData = appState.restaurantChangeTableModal;
  const targetTable = modalData?.restTables?.find((t) => t.table_number === newTableNum);

  if (targetTable && targetTable.status !== "LIVRE" && targetTable.table_number !== modalData.currentTable) {
    showToast(`A Mesa ${newTableNum} já está ocupada ou indisponível! Selecione uma mesa livre.`, "var(--rose)");
    return;
  }

  const res = await apiPost("/api/restaurant/change-table", {
    entry_id: entryId,
    new_table_number: newTableNum,
  });

  if (res && res.ok) {
    showToast(`Mesa alterada com sucesso para <strong>Mesa ${newTableNum}</strong>!`, "var(--emerald)");
    closeChangeTableModal();
    await refreshClientState();
    renderApp();
  }
}

async function confirmSeatClient(entryId) {
  const res = await apiPost("/api/restaurant/seat", { entry_id: entryId });
  if (res && res.ok) {
    showToast("Check-in confirmado! Cliente acomodado na mesa.", "var(--emerald)");
    await refreshClientState();
    renderApp();
  }
}

async function cancelClientReservation(entryId) {
  const reason = prompt("Motivo do cancelamento:", "Cancelado pelo restaurante / Balcão");
  if (reason === null) return;

  const res = await apiPost("/api/restaurant/cancel", {
    entry_id: entryId,
    cancel_reason: reason || "Cancelado pelo restaurante",
  });

  if (res && res.ok) {
    showToast("Reserva cancelada e mesa liberada.", "var(--amber)");
    await refreshClientState();
    renderApp();
  }
}

async function finishTableOrder(tableId, tableNumber, entryId) {
  if (confirm(`Deseja encerrar o atendimento e liberar a Mesa ${tableNumber}?`)) {
    const res = await apiPost("/api/restaurant/finish-table", {
      table_id: tableId,
      table_number: tableNumber,
      entry_id: entryId,
      restaurant_id: appState.restaurantAuth.restaurant?.id,
    });
    if (res && res.ok) {
      showToast(`Mesa ${tableNumber} desocupada e liberada para novos clientes!`, "var(--emerald)");
      await refreshClientState();
      renderApp();
    }
  }
}

async function setTableOperationalStatus(tableId, targetStatus) {
  const res = await apiPost("/api/restaurant/table/status", {
    table_id: tableId,
    status: targetStatus,
  });
  if (res && res.ok) {
    showToast(`Status da Mesa ${res.table_number} alterado para ${targetStatus}.`, "var(--blue)");
    await refreshClientState();
    renderApp();
  }
}

async function submitWalkinClient(e) {
  e.preventDefault();
  const rest = appState.restaurantAuth.restaurant;
  if (!rest) return;

  const nameInput = document.getElementById("restWalkinName");
  const partySelect = document.getElementById("restWalkinParty");
  if (!nameInput) return;

  const res = await apiPost("/api/restaurant/walkin", {
    restaurant_id: rest.id,
    customer_name: nameInput.value,
    party_size: Number(partySelect?.value || 2),
  });

  if (res && res.ok) {
    showToast(`Cliente presencial adicionado à fila!`, "var(--emerald)");
    nameInput.value = "";
    await refreshClientState();
    renderApp();
  }
}

// ==================== RENDERS DA INTERFACE RESTAURANTE ====================

function renderRestaurantView() {
  return renderRestaurantAppView();
}

function renderRestaurantAppView() {
  const rest = appState.restaurantAuth.restaurant;
  if (!rest) {
    return renderRestaurantAuthScreen();
  }
  return renderRestaurantMainScreen();
}

// Mesma lista no cadastro e no perfil do restaurante
const RESTAURANT_VR_OPTIONS = ["Alelo", "Sodexo", "Ticket Restaurante", "VR Refeição", "Flash", "iFood Benefícios", "Caju"];

function renderRestaurantAuthScreen() {
  const authTab = appState.restaurantAuth.authTab;
  const vrOptions = RESTAURANT_VR_OPTIONS;
  const selectedVRs = appState.restaurantAuth.registerVRs || [];
  const allCuisines = getAvailableCuisines();
  const selectedCuisine = appState.restaurantAuth.registerCuisine || "Executivo";

  return `
    <div class="auth-box card" style="max-width:440px;">
      <div style="text-align:center; margin-bottom:1.25rem;">
        <div class="brand-logo" style="margin:0 auto 0.75rem auto; width:52px; height:52px; font-size:1.45rem; background:linear-gradient(135deg, var(--primary) 0%, #d97706 100%); color:#fff; display:flex; align-items:center; justify-content:center; border-radius:14px; box-shadow:0 4px 12px rgba(234,88,12,0.3);">
          🧑‍🍳
        </div>
        <h2 style="font-size:1.25rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
          CLTempo Restaurante
        </h2>
        <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">
          Seu restaurante em primeiro lugar.
        </p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab ${authTab === "login" ? "active" : ""}" onclick="setRestaurantAuthTab('login')">
          Entrar
        </button>
        <button class="auth-tab ${authTab === "register" ? "active" : ""}" onclick="setRestaurantAuthTab('register')">
          Cadastrar-se
        </button>
      </div>

      ${authTab === "login" ? `
        <!-- Formulário de Login -->
        <form onsubmit="submitRestaurantLogin(event)">
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input type="email" id="restLoginEmail" class="form-input" placeholder="restaurante@gmail.com" required />
          </div>

          <div class="form-group">
            <label class="form-label">Senha</label>
            <input type="password" id="restLoginPassword" class="form-input" placeholder="••••••••" required />
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:0.85rem;">
            Entrar
          </button>
        </form>
      ` : `
        <!-- Formulário de Cadastro (2 etapas) -->
        <form onsubmit="submitRestaurantRegister(event)">
          ${renderStepDots(["Restaurante", "Operação"])}

          <div class="form-step active">
            <div class="form-group">
              <label class="form-label">Nome do restaurante</label>
              <input type="text" id="regRestName" class="form-input" placeholder="ex: Sabor do Centro" required />
            </div>
            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input type="email" id="regRestEmail" class="form-input" placeholder="restaurante@cltempo.com.br" required />
            </div>
            <div class="form-group">
              <label class="form-label">Senha</label>
              <input type="password" id="regRestPassword" class="form-input" placeholder="Mínimo 4 caracteres" minlength="4" required />
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp</label>
              <input type="text" id="regRestPhone" class="form-input" placeholder="21998876655" required />
            </div>
            <div class="form-group autocomplete-wrap">
              <label class="form-label">Endereço</label>
              <input 
                type="text" 
                id="regRestAddress" 
                class="form-input" 
                placeholder="Rua ou edifício do restaurante" 
                required 
                autocomplete="off"
                oninput="handleRestaurantAddressInput('reg')"
                onfocus="handleRestaurantAddressInput('reg')"
              />
              <div id="regRestPlacesDropdown" class="autocomplete-dropdown" style="display:none;"></div>
              <div id="regRestAddressBadge" style="margin-top:0.35rem; display:none;"></div>
            </div>
            <button type="button" class="btn btn-primary btn-block btn-lg" data-step-next onclick="goFormStep(this, 1)">
              Continuar
            </button>
          </div>

          <div class="form-step">
            <div class="form-group">
              <label class="form-label">Tipo de culinária</label>
              <input type="hidden" id="regRestCuisine" value="${selectedCuisine}" />
              <div class="cuisine-grid">
                ${allCuisines.map((c) => `
                  <div 
                    class="cuisine-chip reg-rest-cuisine-chip ${selectedCuisine === c.name ? "selected" : ""}" 
                    data-value="${c.name}"
                    onclick="selectRestaurantRegisterCuisine('${c.name}')"
                  >
                    ${c.icon ? c.icon + " " : ""}${c.name}
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Vales-refeição aceitos</label>
              <div class="vr-grid">
                ${vrOptions.map((vr) => `
                  <div class="vr-chip reg-rest-vr-chip ${selectedVRs.includes(vr) ? "selected" : ""}" data-value="${vr}" onclick="toggleRestaurantRegisterVR('${vr}')">
                    ${vr}
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Mesas</label>
              ${renderTablesConfigFields("regRest")}
            </div>

            <div style="display:flex; gap:0.5rem;">
              <button type="button" class="btn btn-outline btn-lg" onclick="goFormStep(this, -1)">Voltar</button>
              <button type="submit" class="btn btn-primary btn-block btn-lg">Cadastrar restaurante</button>
            </div>
          </div>
        </form>
      `}

      ${authTab === "login" ? `
        <!-- Atalhos de Demonstração Rápida -->
        <div class="demo-shortcuts">
          <div class="demo-shortcuts-title">Acesso rápido (demo)</div>
          <div class="demo-shortcuts-row">
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('bistro@cltempo.com.br')">🍲 Bistrô do Ouvidor</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('grao@cltempo.com.br')">🥩 Grão & Brasa</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('pasta@cltempo.com.br')">🍝 Pasta & Basta</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('sushi@cltempo.com.br')">🍣 Koji Sushi</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('verde@cltempo.com.br')">🥗 Verde & Fresco</button>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderRestaurantMainScreen() {
  const rest = appState.restaurantAuth.restaurant;
  const activeTab = appState.restaurantActiveTab;

  // Carrega mesas e filas deste restaurante do estado consolidado
  const allTables = appState.data?.restaurant_tables || [];
  const restTables = allTables.filter((t) => t.restaurant_id === rest.id);
  const alocadas = restTables.filter((t) => t.status === "ALOCADA");

  const allQueue = appState.data?.active_queue || [];
  const restWaiting = allQueue.filter(
    (q) => q.restaurant_id === rest.id && (q.status === "AGUARDANDO" || q.status === "WAITING")
  );

  let bodyHTML = "";
  if (activeTab === "fila") bodyHTML = renderRestaurantFilaTab(restTables);
  else if (activeTab === "mesas") bodyHTML = renderRestaurantMesasTab(restTables);
  else if (activeTab === "perfil") bodyHTML = renderRestaurantPerfilTab();

  return `
    <div class="restaurant-frame">
      <!-- Topo do Restaurante -->
      <div class="restaurant-header">
        <div>
          <div style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">
            ${rest.cuisine_type || rest.category || "Restaurante"}
          </div>
          <div style="font-weight:800; font-size:1.05rem; font-family:'Plus Jakarta Sans', sans-serif;">
            ${rest.name}
          </div>
        </div>

        <button 
          class="btn ${rest.is_open ? "btn-emerald" : "btn-rose"} btn-sm" 
          onclick="toggleCurrentRestOpen()"
          style="font-size:0.72rem; padding:0.35rem 0.65rem;"
        >
          ${rest.is_open ? "🟢 Fila Aberta" : "🔴 Fila Pausada"}
        </button>
      </div>

      <!-- Corpo da Aba Selecionada -->
      <div class="restaurant-body">
        ${bodyHTML}
      </div>

      <!-- Barra de Navegação Inferior (3 Abas: Fila | Mesas | Perfil) -->
      <div class="restaurant-bottom-nav">
        <button 
          class="restaurant-tab-btn ${activeTab === "fila" ? "active" : ""}" 
          onclick="switchRestaurantTab('fila')"
        >
          <span class="restaurant-tab-icon">⏳</span>
          <span>Fila</span>
          ${restWaiting.length > 0 ? `<span class="nav-counter">${restWaiting.length}</span>` : ""}
        </button>

        <button 
          class="restaurant-tab-btn ${activeTab === "mesas" ? "active" : ""}" 
          onclick="switchRestaurantTab('mesas')"
        >
          <span class="restaurant-tab-icon">🪑</span>
          <span>Mesas</span>
          <span class="nav-counter" style="background:${alocadas.length > 0 ? "#9333ea" : "var(--emerald)"};">${alocadas.length}/${restTables.length}</span>
        </button>

        <button 
          class="restaurant-tab-btn ${activeTab === "perfil" ? "active" : ""}" 
          onclick="switchRestaurantTab('perfil')"
        >
          <span class="restaurant-tab-icon">👤</span>
          <span>Perfil</span>
        </button>
      </div>

      <!-- Modais Operacionais -->
      ${renderRestaurantCallModal()}
      ${renderRestaurantChangeTableModal()}
    </div>
  `;
}

function renderRestaurantFilaTab(restTables) {
  const rest = appState.restaurantAuth.restaurant;
  const activeQueue = appState.data?.active_queue || [];
  const restQueue = activeQueue.filter((q) => q.restaurant_id === rest.id);

  // Fila de espera (AGUARDANDO): quem espera há mais tempo primeiro
  const waitingEntries = restQueue.filter(
    (q) => q.status === "AGUARDANDO" || q.status === "WAITING"
  );
  waitingEntries.sort((a, b) => {
    const waitA = a.elapsed_wait_min ?? calcElapsedMinutes(a.joined_at);
    const waitB = b.elapsed_wait_min ?? calcElapsedMinutes(b.joined_at);
    return waitB - waitA || a.id - b.id;
  });

  // Chamados (CHAMADO): chamado há mais tempo primeiro
  const calledEntries = restQueue.filter(
    (q) => q.status === "CHAMADO" || q.status === "CALLED"
  );
  calledEntries.sort((a, b) => {
    const callA = a.elapsed_called_min ?? calcElapsedMinutes(a.called_at);
    const callB = b.elapsed_called_min ?? calcElapsedMinutes(b.called_at);
    return callB - callA || (a.called_at || "").localeCompare(b.called_at || "");
  });

  const showWalkin = appState.ui.showWalkin;

  return `
    <!-- Chamados: precisam de ação (check-in), por isso ficam no topo quando existem -->
    ${calledEntries.length > 0 ? `
      <div style="margin-bottom:1.25rem;">
        <div class="section-label">Chamados (${calledEntries.length})</div>
        ${calledEntries.map((q) => {
          const callMin = q.elapsed_called_min ?? calcElapsedMinutes(q.called_at);
          return `
            <div class="queue-card queue-card-called">
              <div class="queue-card-row">
                <div>
                  <div class="queue-card-name">${q.customer_name}</div>
                  <div class="queue-card-sub">${q.party_size} pessoa(s) • chamado há ${callMin} min</div>
                </div>
                <span class="badge badge-purple" style="font-weight:800;">Mesa ${q.table_number || "?"}</span>
              </div>
              <div style="display:flex; gap:0.4rem; margin-top:0.65rem; align-items:center;">
                <button class="btn btn-emerald btn-sm" style="flex:1;" onclick="confirmSeatClient(${q.id})">
                  ✓ Sentou
                </button>
                <button class="btn btn-outline btn-sm" onclick="openChangeTableModal(${q.id}, ${q.table_number || 1})">
                  Trocar mesa
                </button>
                <button class="btn btn-outline btn-sm" title="Cancelar reserva" onclick="cancelClientReservation(${q.id})">
                  ✕
                </button>
              </div>
            </div>`;
        }).join("")}
      </div>
    ` : ""}

    <!-- Fila de espera -->
    <div style="margin-bottom:1.25rem;">
      <div class="section-label">Aguardando (${waitingEntries.length})</div>
      ${waitingEntries.length === 0 ? `
        <div class="empty-state">Ninguém na fila agora.</div>
      ` : waitingEntries.map((q, idx) => {
        const hasFreeTable = restTables.some(
          (t) => t.table_type === q.table_category && t.status === "LIVRE"
        );
        const waitMin = q.elapsed_wait_min ?? calcElapsedMinutes(q.joined_at);
        return `
          <div class="queue-card">
            <div class="queue-card-row">
              <div>
                <div class="queue-card-name">${idx + 1}º ${q.customer_name}</div>
                <div class="queue-card-sub">
                  ${q.party_size} pessoa(s) • há ${waitMin} min
                  ${hasFreeTable ? "" : ` • <span style="color:var(--rose);">sem mesa livre</span>`}
                </div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="openCallClientModal(${q.id})">
                Chamar
              </button>
            </div>
          </div>`;
      }).join("")}
    </div>

    <!-- Walk-in presencial: recolhido por padrão -->
    ${showWalkin ? `
      <div class="card" style="padding:0.85rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span style="font-weight:700; font-size:0.85rem;">Cliente sem o app</span>
          <button type="button" class="btn-link" onclick="toggleUIFlag('showWalkin')">Fechar</button>
        </div>
        <form onsubmit="submitWalkinClient(event)" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <input type="text" id="restWalkinName" class="form-input" placeholder="Nome" required style="flex:2; font-size:0.82rem;" />
          <select id="restWalkinParty" class="form-select" style="flex:1; font-size:0.82rem;">
            <option value="2">1-2 pessoas</option>
            <option value="4">3-4 pessoas</option>
            <option value="6">5+ pessoas</option>
          </select>
          <button type="submit" class="btn btn-primary btn-sm">Adicionar</button>
        </form>
      </div>
    ` : `
      <button type="button" class="btn btn-outline btn-block btn-sm" onclick="toggleUIFlag('showWalkin')">
        + Adicionar cliente sem o app
      </button>
    `}
  `;
}

function renderRestaurantMesasTab(restTables) {
  const groups = {
    ALOCADA: restTables.filter((t) => t.status === "ALOCADA"),
    LIVRE: restTables.filter((t) => t.status === "LIVRE"),
    "INDISPONÍVEL": restTables.filter((t) => t.status === "INDISPONÍVEL"),
  };
  const labels = { ALOCADA: "Ocupadas", LIVRE: "Livres", "INDISPONÍVEL": "Bloqueadas" };
  const emptyText = {
    ALOCADA: "Nenhuma mesa ocupada.",
    LIVRE: "Nenhuma mesa livre no momento.",
    "INDISPONÍVEL": "Nenhuma mesa bloqueada.",
  };
  const filter = groups[appState.ui.tableFilter] ? appState.ui.tableFilter : "ALOCADA";
  const list = groups[filter];

  const cardFor = (t) => {
    if (t.status === "ALOCADA") {
      return `
        <div class="table-card table-card-alocada">
          <div>
            <div class="table-num-pill">Mesa ${t.table_number} <span class="table-size">${t.table_type} lug.</span></div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
              ${t.customer_name || "Ocupada"}${t.checkin_at ? ` • desde ${t.checkin_at}` : ""}
            </div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="finishTableOrder(${t.id}, ${t.table_number}, ${t.entry_id || 0})">
            Liberar
          </button>
        </div>`;
    }
    if (t.status === "LIVRE") {
      return `
        <div class="table-card table-card-livre">
          <div class="table-num-pill">Mesa ${t.table_number} <span class="table-size">${t.table_type} lug.</span></div>
          <button class="btn btn-sm btn-outline" onclick="setTableOperationalStatus(${t.id}, 'INDISPONÍVEL')">
            Bloquear
          </button>
        </div>`;
    }
    return `
      <div class="table-card table-card-indisponivel">
        <div class="table-num-pill">Mesa ${t.table_number} <span class="table-size">${t.table_type} lug.</span></div>
        <button class="btn btn-sm btn-emerald" onclick="setTableOperationalStatus(${t.id}, 'LIVRE')">
          Desbloquear
        </button>
      </div>`;
  };

  return `
    <div class="auth-tabs auth-tabs-compact" style="margin-bottom:1rem;">
      ${Object.keys(groups).map((key) => `
        <button class="auth-tab ${filter === key ? "active" : ""}" onclick="setTableFilter('${key}')">
          ${labels[key]} (${groups[key].length})
        </button>
      `).join("")}
    </div>

    ${list.length === 0
      ? `<div class="empty-state">${emptyText[filter]}</div>`
      : list.map(cardFor).join("")}
  `;
}

function renderRestaurantPerfilTab() {
  const rest = appState.restaurantAuth.restaurant;
  if (!rest) return "";

  const vrOptions = RESTAURANT_VR_OPTIONS;
  const currentVRStr = rest.vr_accepted || "";
  if (!appState.restaurantAuth.profileVRs || appState.restaurantAuth.profileVRs.length === 0) {
    appState.restaurantAuth.profileVRs = currentVRStr.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const selectedVRs = appState.restaurantAuth.profileVRs;
  const allCuisines = getAvailableCuisines();
  const currentCuisine = rest.cuisine_type || rest.category || "Executivo";
  const totalTables = (rest.tables_1_2 || 6) + (rest.tables_3_4 || 6) + (rest.tables_5_plus || 4);

  const dadosHTML = `
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" id="profRestName" class="form-input" value="${rest.name}" required />
    </div>
    <div class="form-group">
      <label class="form-label">WhatsApp</label>
      <input type="text" id="profRestPhone" class="form-input" value="${rest.phone_whatsapp || ""}" required />
    </div>
    <div class="form-group autocomplete-wrap">
      <label class="form-label">Endereço</label>
      <input
        type="text"
        id="profRestAddress"
        class="form-input"
        value="${rest.address || ""}"
        required
        autocomplete="off"
        oninput="handleRestaurantAddressInput('prof')"
        onfocus="handleRestaurantAddressInput('prof')"
      />
      <div id="profRestPlacesDropdown" class="autocomplete-dropdown" style="display:none;"></div>
      <div id="profRestAddressBadge" style="margin-top:0.35rem; display:none;"></div>
    </div>`;

  const cardapioHTML = `
    <div class="form-group">
      <label class="form-label">Tipo de culinária</label>
      <input type="hidden" id="profRestCuisine" value="${currentCuisine}" />
      <div class="cuisine-grid">
        ${allCuisines.map((c) => `
          <div
            class="cuisine-chip prof-rest-cuisine-chip ${currentCuisine === c.name ? "selected" : ""}"
            data-value="${c.name}"
            onclick="selectRestaurantProfileCuisine('${c.name}')"
          >
            ${c.icon ? c.icon + " " : ""}${c.name}
          </div>
        `).join("")}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Vales-refeição aceitos</label>
      <div class="vr-grid">
        ${vrOptions.map((vr) => `
          <div class="vr-chip prof-rest-vr-chip ${selectedVRs.includes(vr) ? "selected" : ""}" data-value="${vr}" onclick="toggleRestaurantProfileVR('${vr}')">
            ${vr}
          </div>
        `).join("")}
      </div>
    </div>`;

  const mesasHTML = renderTablesConfigFields("profRest", rest);

  return `
    <form onsubmit="submitRestaurantProfileUpdate(event)">
      ${renderSection("restDados", "Dados do restaurante", rest.address || "", dadosHTML)}
      ${renderSection("restCardapio", "Culinária e vales-refeição", currentCuisine, cardapioHTML)}
      ${renderSection("restMesas", "Mesas e tempo de giro", `${totalTables} mesas`, mesasHTML)}
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:0.85rem;" onclick="openInvalidSections(this.form)">
        Salvar alterações
      </button>
    </form>

    <div class="account-actions">
      <button type="button" class="btn btn-outline btn-block" onclick="restaurantLogout()">Sair da conta</button>
      <button type="button" class="btn-link btn-link-danger" onclick="submitRestaurantProfileDelete()">Apagar restaurante</button>
    </div>
  `;
}

// Campos de mesas e giro, compartilhados entre cadastro (prefix "regRest") e perfil ("profRest")
function renderTablesConfigFields(prefix, rest = {}) {
  const rows = [
    { label: "1-2 lugares", tables: "Tables12", turnover: "Turnover12", t: rest.tables_1_2 || 6, g: rest.turnover_1_2 || 25 },
    { label: "3-4 lugares", tables: "Tables34", turnover: "Turnover34", t: rest.tables_3_4 || 6, g: rest.turnover_3_4 || 35 },
    { label: "5+ lugares", tables: "Tables5Plus", turnover: "Turnover5Plus", t: rest.tables_5_plus || 4, g: rest.turnover_5_plus || 45 },
  ];
  return `
    <table class="tables-config">
      <thead>
        <tr><th></th><th>Mesas</th><th>Giro (min)</th></tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r.label}</td>
            <td><input type="number" id="${prefix}${r.tables}" class="form-input" value="${r.t}" min="1" max="50" required /></td>
            <td><input type="number" id="${prefix}${r.turnover}" class="form-input" value="${r.g}" min="5" max="120" required /></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="form-hint" style="margin-top:0.35rem;">Giro = tempo médio que um grupo ocupa a mesa.</div>`;
}
// ==================== MODAIS DE CHAMADA E TROCA DE MESA ====================

function renderRestaurantCallModal() {
  const modal = appState.restaurantCallingModal;
  if (!modal) return "";

  const { entry, suggestedTable, restTables } = modal;

  return `
    <div class="modal-overlay" onclick="if(event.target === this) closeCallClientModal()">
      <div class="modal-card" style="max-width:400px; background:#ffffff !important; color:#0f172a !important; border-radius:18px; padding:1.4rem; box-shadow:0 25px 50px -12px rgba(0,0,0,0.35); border:1px solid #e2e8f0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif; color:#0f172a; margin:0;">
            Chamar cliente
          </h3>
          <button class="btn btn-outline btn-sm" onclick="closeCallClientModal()" style="border:1px solid #cbd5e1; color:#64748b; padding:0.25rem 0.55rem; font-size:1rem; border-radius:8px; background:#f8fafc;">✕</button>
        </div>

        <div style="background:#f8fafc; padding:0.95rem; border-radius:12px; margin-bottom:1.15rem; border:1px solid #e2e8f0;">
          <div style="font-weight:800; font-size:1.05rem; color:#0f172a;">${entry.customer_name}</div>
          <div style="font-size:0.78rem; color:#475569; margin-top:0.25rem;">
            ${entry.party_size} pessoa(s) • na fila desde ${entry.joined_at}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="color:#334155; font-weight:700;">Mesa:</label>
          <select id="selectCallTable" class="form-select" style="font-size:0.92rem; padding:0.65rem; background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; border-radius:10px;">
            ${restTables.filter((t) => t.status === "LIVRE").map((t) => {
              const isSuggested = t.table_number === suggestedTable;
              const isSameType = t.table_type === entry.table_category;
              return `
                <option value="${t.table_number}" ${isSuggested ? "selected" : ""}>
                  Mesa ${t.table_number} (${t.table_type} lug.)${isSuggested ? " ⭐ sugerida" : (!isSameType ? " — outro tamanho" : "")}
                </option>
              `;
            }).join("") || `<option value="" disabled selected>Nenhuma mesa livre</option>`}
          </select>
        </div>

        <div style="display:flex; gap:0.6rem; margin-top:1.35rem;">
          <button class="btn btn-outline btn-block btn-sm" onclick="closeCallClientModal()" style="border:1px solid #cbd5e1; color:#475569; background:#f8fafc; font-weight:600;">
            Cancelar
          </button>
          <button class="btn btn-emerald btn-block btn-sm" onclick="confirmCallClient(${entry.id})" style="font-weight:700;">
            🔔 Chamar
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderRestaurantChangeTableModal() {
  const modal = appState.restaurantChangeTableModal;
  if (!modal) return "";

  const { entry, currentTable, restTables } = modal;

  return `
    <div class="modal-overlay" onclick="if(event.target === this) closeChangeTableModal()">
      <div class="modal-card" style="max-width:400px; background:#ffffff !important; color:#0f172a !important; border-radius:18px; padding:1.4rem; box-shadow:0 25px 50px -12px rgba(0,0,0,0.35); border:1px solid #e2e8f0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif; color:#0f172a; margin:0;">
            Trocar mesa
          </h3>
          <button class="btn btn-outline btn-sm" onclick="closeChangeTableModal()" style="border:1px solid #cbd5e1; color:#64748b; padding:0.25rem 0.55rem; font-size:1rem; border-radius:8px; background:#f8fafc;">✕</button>
        </div>

        <div style="background:#f8fafc; padding:0.95rem; border-radius:12px; margin-bottom:1.15rem; border:1px solid #e2e8f0;">
          <div style="font-weight:800; font-size:1.05rem; color:#0f172a;">${entry.customer_name}</div>
          <div style="font-size:0.78rem; color:#475569; margin-top:0.25rem;">
            Mesa atual: <strong style="color:#0f172a;">Mesa ${currentTable}</strong> (${entry.table_category} lug.)
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="color:#334155; font-weight:700;">Nova mesa:</label>
          <select id="selectNewTable" class="form-select" style="font-size:0.92rem; padding:0.65rem; background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; border-radius:10px;">
            ${restTables.filter((t) => t.status === "LIVRE" || t.table_number === currentTable).map((t) => {
              const isCurrent = t.table_number === currentTable;
              return `
                <option value="${t.table_number}" ${isCurrent ? "selected" : ""}>
                  Mesa ${t.table_number} (${t.table_type} lug.)${isCurrent ? " — atual" : ""}
                </option>
              `;
            }).join("")}
          </select>
        </div>

        <div style="display:flex; gap:0.6rem; margin-top:1.35rem;">
          <button class="btn btn-outline btn-block btn-sm" onclick="closeChangeTableModal()" style="border:1px solid #cbd5e1; color:#475569; background:#f8fafc; font-weight:600;">
            Cancelar
          </button>
          <button class="btn btn-primary btn-block btn-sm" onclick="confirmChangeTable(${entry.id})" style="font-weight:700;">
            Confirmar Troca
          </button>
        </div>
      </div>
  `;
}

// ==================== INTERFACE ADMINISTRADOR ====================

function renderAdminView() {
  const metrics = appState.data?.metrics;
  if (!metrics) return `<div class="card">Carregando métricas de validação do Canvas...</div>`;

  const m1 = metrics.m1_restaurant_conversion;
  const m2 = metrics.m2_weekly_entries_per_user;
  const m3 = metrics.m3_dropout_rate;
  const m4 = metrics.m4_standing_wait_reduction;

  const metricCard = (label, value, color, goal, detail) => `
    <div class="card metric-card" title="${detail}">
      <div class="metric-label">${label}</div>
      <div class="metric-value" style="color:${color};">${value}</div>
      <div class="metric-goal">${goal}</div>
    </div>`;

  const m4HasData = m4.reduction_pct !== null && m4.reduction_pct !== undefined;
  const leads = m1.leads || [];

  return `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <h2 style="font-size:1.25rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
        Métricas do MVP
      </h2>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
        ${metricCard(
          "M1 · Restaurantes que aderiram",
          `${m1.conversion_pct}%`,
          "var(--primary)",
          `Meta: acima de ${m1.target_pct}%`,
          `${m1.onboarded} de ${m1.total_approached} restaurantes abordados aderiram`
        )}
        ${metricCard(
          "M2 · Usos por cliente/semana",
          `${m2.avg_entries_per_week}x`,
          "var(--emerald)",
          `Meta: acima de ${m2.target_entries}x`,
          `${m2.total_entries} entradas na fila no total`
        )}
        ${metricCard(
          "M3 · Desistência",
          `${m3.dropout_pct}%`,
          m3.dropout_pct <= m3.max_acceptable_pct ? "var(--emerald)" : "var(--rose)",
          `Meta: abaixo de ${m3.max_acceptable_pct}%`,
          `${m3.cancelled_count} reservas canceladas`
        )}
        ${metricCard(
          "M4 · Menos tempo em pé",
          m4HasData ? `${m4.reduction_pct}%` : "—",
          m4HasData ? "var(--blue)" : "var(--text-muted)",
          m4HasData ? `Meta: acima de ${m4.target_reduction_pct}%` : "Sem respostas ainda",
          m4HasData
            ? `De ${m4.avg_standing_without_app_min} para ~${m4.avg_standing_with_app_min} min (${m4.feedback_count} respostas)`
            : "Nenhum cliente respondeu quanto tempo ficou em pé"
        )}
      </div>

      <!-- Funil de Prospecção de Restaurantes -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.75rem;">
          <h3 style="font-size:1rem; font-weight:800;">Restaurantes abordados (${leads.length})</h3>
          <button type="button" class="btn btn-primary btn-sm" onclick="openLeadModal()">+ Adicionar</button>
        </div>
        ${leads.length === 0 ? `<div class="empty-state">Nenhum restaurante abordado ainda.</div>` : `
          <div style="overflow-x:auto;">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Restaurante</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${leads.map((l) => `
                  <tr>
                    <td title="${(l.notes || "").replace(/"/g, "&quot;")}">
                      <strong>${l.restaurant_name}</strong>
                      ${l.contact_person ? `<div style="font-size:0.72rem; color:var(--text-muted);">${l.contact_person}</div>` : ""}
                    </td>
                    <td>
                      <select class="form-input" style="padding:0.3rem 0.45rem; font-size:0.75rem; min-width:9.5rem;" onchange="updateLeadStatus(${l.id}, this.value)">
                        ${Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => `
                          <option value="${value}" ${l.status === value ? "selected" : ""}>${label}</option>
                        `).join("")}
                      </select>
                    </td>
                    <td style="text-align:right;">
                      <button type="button" class="btn btn-outline btn-sm" title="Remover" onclick="deleteLead(${l.id}, ${JSON.stringify(l.restaurant_name).replace(/"/g, "&quot;")})">🗑️</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

// ==================== FUNIL DE LEADS (MÉTRICA M1) ====================

const LEAD_STATUS_LABELS = {
  APPROACHED: "🟡 Abordado",
  IN_NEGOTIATION: "🔵 Em negociação",
  ONBOARDED: "🟢 Aderiu ao piloto",
  DECLINED: "🔴 Recusou",
};

function openLeadModal() {
  const modalContainer = document.getElementById("modalContainer");
  const overlay = document.getElementById("modalOverlay");
  if (!modalContainer || !overlay) return;
  appState.selectedModalRestaurant = null;

  modalContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
      <h3 style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
        🤝 Restaurante abordado
      </h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form onsubmit="submitLead(event)">
      <div class="form-group">
        <label class="form-label">Nome do restaurante</label>
        <input type="text" id="leadName" class="form-input" required />
      </div>
      <div class="form-group">
        <label class="form-label">Pessoa de contato</label>
        <input type="text" id="leadContact" class="form-input" placeholder="Ex.: Carlos (gerente)" />
      </div>
      <div class="form-group">
        <label class="form-label">Região</label>
        <input type="text" id="leadRegion" class="form-input" value="Polo Centro" />
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="leadStatus" class="form-input">
          ${Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Observações</label>
        <input type="text" id="leadNotes" class="form-input" placeholder="Como foi a abordagem?" />
      </div>
      <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `;
  overlay.style.display = "flex";
}

async function submitLead(e) {
  e.preventDefault();
  const res = await apiPost("/api/admin/leads/update", {
    restaurant_name: document.getElementById("leadName")?.value,
    contact_person: document.getElementById("leadContact")?.value,
    region: document.getElementById("leadRegion")?.value,
    status: document.getElementById("leadStatus")?.value,
    notes: document.getElementById("leadNotes")?.value,
  });
  if (res && res.ok) {
    closeModal();
    showToast(res.message, "var(--emerald)");
  }
}

async function updateLeadStatus(leadId, status) {
  const res = await apiPost("/api/admin/leads/update", { lead_id: leadId, status });
  if (res && res.ok) showToast("Status do lead atualizado.", "var(--emerald)");
}

async function deleteLead(leadId, name) {
  if (!confirm(`Remover "${name}" do funil?`)) return;
  const res = await apiPost("/api/admin/leads/delete", { lead_id: leadId });
  if (res && res.ok) showToast("Lead removido.", "var(--amber)");
}

// ==================== RENDER PRINCIPAL ====================

function renderSplitView() {
  return `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:1.5rem; max-width:1200px; margin:0 auto;">
      <div>
        <h3 style="margin-bottom:0.75rem; text-align:center; font-size:1rem; font-weight:700;">📱 Visão Cliente</h3>
        ${renderClientAppView()}
      </div>
      <div>
        <h3 style="margin-bottom:0.75rem; text-align:center; font-size:1rem; font-weight:700;">🧑‍🍳 Visão Restaurante</h3>
        ${renderRestaurantView()}
      </div>
    </div>
  `;
}

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
  if (e) e.preventDefault();
  const nameInput = document.getElementById("walkinName");
  const partyInput = document.getElementById("walkinParty");
  if (!nameInput) return;

  const res = await apiPost("/api/restaurant/walkin", {
    restaurant_id: restaurantId,
    customer_name: nameInput.value,
    party_size: Number(partyInput?.value || 2),
  });

  if (res && res.ok) {
    showToast(`Cliente presencial adicionado!`, "var(--emerald)");
    nameInput.value = "";
    refreshClientState();
    renderApp();
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
  // Restaurante
  switchRestaurantTab,
  setRestaurantAuthTab,
  quickLoginRestaurantAs,
  submitRestaurantLogin,
  submitRestaurantRegister,
  restaurantLogout,
  submitRestaurantProfileUpdate,
  submitRestaurantProfileDelete,
  toggleCurrentRestOpen,
  toggleRestaurantRegisterVR,
  toggleRestaurantProfileVR,
  getAvailableCuisines,
  selectRestaurantRegisterCuisine,
  selectRestaurantProfileCuisine,
  openCallClientModal,
  closeCallClientModal,
  confirmCallClient,
  openChangeTableModal,
  closeChangeTableModal,
  confirmChangeTable,
  confirmSeatClient,
  cancelClientReservation,
  finishTableOrder,
  setTableOperationalStatus,
  submitWalkinClient,
  handleRestaurantAddressInput,
  selectRestaurantAutocompletePlace,
  calcElapsedMinutes,
  renderRestaurantAppView,
  renderSplitView,
  renderApp,
  toggleUIFlag,
  setTableFilter,
  toggleSection,
  openInvalidSections,
  goFormStep,
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
