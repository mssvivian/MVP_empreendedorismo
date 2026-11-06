// CLTempo — Frontend SPA Reativo (Arquitetura Modular, 3 Interfaces e Responsivo)
// Disciplina de Empreendedorismo - UFRJ 2026.2

const DEMO_MODE = true;

const demoClient = {
  id: 1,
  name: "Ana Silva",
  email: "ana.silva@email.com",
  phone: "21998876655",
  workplace: "Polo Centro",
  company: "Polo Centro",
  favorite_cuisines: ["Japonês & Poke", "Saladas & Saudável"],
  pref_food_1: "Japonês & Poke",
  pref_food_2: "Saladas & Saudável",
  pref_food_3: "Massas & Italiana",
};

const demoRestaurant = {
  id: 7,
  name: "Bistrô do Ouvidor",
  email: "bistro@cltempo.com.br",
  phone_whatsapp: "21999887766",
  cuisine_type: "Brasileira & Típica",
  category: "Brasileira & Típica",
  address: "Rua do Ouvidor, 120, Centro, Rio de Janeiro",
  is_open: true,
  lat: -22.9068,
  lng: -43.1764,
  vr_accepted: ["Alelo", "Sodexo", "Ticket Restaurante", "VR Refeição"],
  turnover_1_2: 25,
  turnover_3_4: 35,
  turnover_5_plus: 45,
  tables_1_2: 6,
  tables_3_4: 6,
  tables_5_plus: 4,
};

const demoRestaurants = [
  { id: 1, name: "Sushi Zen", cuisine_type: "Japonês & Poke", category: "Japonês & Poke", avg_wait_min: 18, rating: 4.8, distance_km: 1.4, distance_meters: 300, distance_walk_min: 5, is_open: true, table_categories: ["1-2", "3-4", "5+"], is_bookmarked: true, score: 92, waiting_in_category: 3, estimated_wait_min: 16 },
  { id: 2, name: "Table 9", cuisine_type: "Brasileira & Típica", category: "Brasileira & Típica", avg_wait_min: 12, rating: 4.7, distance_km: 2.1, distance_meters: 520, distance_walk_min: 7, is_open: true, table_categories: ["1-2", "3-4"], is_bookmarked: false, score: 88, waiting_in_category: 2, estimated_wait_min: 12 },
  { id: 3, name: "Verde & Co.", cuisine_type: "Saladas & Saudável", category: "Saladas & Saudável", avg_wait_min: 9, rating: 4.9, distance_km: 0.8, distance_meters: 220, distance_walk_min: 3, is_open: true, table_categories: ["1-2", "3-4"], is_bookmarked: true, score: 96, waiting_in_category: 1, estimated_wait_min: 8 },
  { id: 4, name: "Coco Grill", cuisine_type: "Grelhados & Carnes", category: "Grelhados & Carnes", avg_wait_min: 22, rating: 4.6, distance_km: 3.0, distance_meters: 760, distance_walk_min: 10, is_open: true, table_categories: ["3-4", "5+"], is_bookmarked: false, score: 83, waiting_in_category: 4, estimated_wait_min: 22 },
  { id: 5, name: "Pasta & Basta", cuisine_type: "Massas & Italiana", category: "Massas & Italiana", avg_wait_min: 16, rating: 4.8, distance_km: 1.7, distance_meters: 430, distance_walk_min: 6, is_open: true, table_categories: ["1-2", "3-4", "5+"], is_bookmarked: false, score: 90, waiting_in_category: 2, estimated_wait_min: 14 },
  { id: 6, name: "Koji Sushi", cuisine_type: "Japonês & Poke", category: "Japonês & Poke", avg_wait_min: 21, rating: 4.9, distance_km: 2.4, distance_meters: 610, distance_walk_min: 8, is_open: true, table_categories: ["2-4", "5+"], is_bookmarked: false, score: 89, waiting_in_category: 3, estimated_wait_min: 18 },
];

const demoQueue = [
  { id: 1, customer_name: "Ana", party_size: 2, table_category: "1-2", restaurant_id: 7, status: "AGUARDANDO", joined_at: "18:32", called_at: null, table_number: 2 },
  { id: 2, customer_name: "Pedro", party_size: 4, table_category: "3-4", restaurant_id: 7, status: "AGUARDANDO", joined_at: "18:10", called_at: null, table_number: 5 },
  { id: 3, customer_name: "Julia", party_size: 2, table_category: "1-2", restaurant_id: 7, status: "CHAMADO", joined_at: "17:55", called_at: "18:28", table_number: 4 },
  { id: 4, customer_name: "Bruno", party_size: 3, table_category: "3-4", restaurant_id: 7, status: "AGUARDANDO", joined_at: "18:20", called_at: null, table_number: 0 },
];

const demoTables = [
  { id: 1, restaurant_id: 7, table_number: 1, table_type: "1-2", status: "LIVRE", customer_name: null, entry_id: 0 },
  { id: 2, restaurant_id: 7, table_number: 2, table_type: "1-2", status: "ALOCADA", customer_name: "Ana", entry_id: 1 },
  { id: 3, restaurant_id: 7, table_number: 3, table_type: "3-4", status: "LIVRE", customer_name: null, entry_id: 0 },
  { id: 4, restaurant_id: 7, table_number: 4, table_type: "1-2", status: "ALOCADA", customer_name: "Julia", entry_id: 3 },
  { id: 5, restaurant_id: 7, table_number: 5, table_type: "3-4", status: "ALOCADA", customer_name: "Pedro", entry_id: 2 },
  { id: 6, restaurant_id: 7, table_number: 6, table_type: "5+", status: "INDISPONÍVEL", customer_name: null, entry_id: 0 },
];

const demoMetrics = {
  m1_restaurant_conversion: { conversion_pct: 82, target_pct: 70, onboarded: 41, total_approached: 50, leads: [{ restaurant_name: "Banca de Café", contact_person: "Lia Costa", status: "ONBOARDED", notes: "Primeira semana acima da meta" }, { restaurant_name: "Arena Co.", contact_person: "Mauro Silva", status: "IN_NEGOTIATION", notes: "Aguardando resposta do dono" }, { restaurant_name: "Ponto B", contact_person: "Tayná Lima", status: "NEW", notes: "Contato recente" }] },
  m2_weekly_entries_per_user: { avg_entries_per_week: 3.6, target_entries: 2.5, total_entries: 184 },
  m3_dropout_rate: { dropout_pct: 14, max_acceptable_pct: 20, cancelled_count: 27 },
  m4_standing_wait_reduction: { reduction_pct: 48, avg_standing_without_app_min: 28, avg_standing_with_app_min: 15, minutes_saved_per_lunch: 13 },
};

const demoState = {
  cuisines: [
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
  ],
  restaurants: demoRestaurants,
  active_queue: demoQueue,
  restaurant_tables: demoTables,
  metrics: demoMetrics,
};

const appState = {
  mainView: "client", // client | restaurant | admin | split
  theme: localStorage.getItem("cltempo_theme") || "light",
  
  // Autenticação do Cliente
  clientAuth: {
    client: JSON.parse(localStorage.getItem("cltempo_client") || "null") || demoClient,
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
  
  searchResults: demoRestaurants,
  selectedModalRestaurant: null,
  clientActiveTicket: demoQueue[0],
  clientHistory: [
    { restaurant_name: "Sushi Zen", status: "Confirmado", date: "Hoje" },
    { restaurant_name: "Verde & Co.", status: "Finalizado", date: "Ontem" },
    { restaurant_name: "Table 9", status: "Confirmado", date: "Semana passada" },
  ],

  // Interface do Restaurante (Gestão de Salão, Fila e Mesas)
  restaurantAuth: {
    restaurant: JSON.parse(localStorage.getItem("cltempo_restaurant") || "null") || demoRestaurant,
    authTab: "login", // login | register
    registerVRs: ["Alelo", "Sodexo", "Ticket Restaurante", "VR Refeição"],
    profileVRs: ["Alelo", "Sodexo", "Ticket Restaurante", "VR Refeição"],
    registerCuisine: "Executivo",
  },
  restaurantActiveTab: "fila", // fila | mesas | perfil
  restaurantCallingModal: null, // { entryId, customerName, partySize, tableCategory, suggestedTable }
  restaurantChangeTableModal: null, // { entryId, currentTableNumber, customerName }
  selectedRestaurantId: 1,
  selectedRestCategoryFilter: "ALL", // ALL | 1-2 | 3-4 | 5+

  // Dados consolidados do backend
  data: demoState,
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

function buildDemoResponse(url, payload = {}) {
  const normalized = String(url).split("?")[0];

  if (normalized.endsWith("/api/client/restaurants")) {
    return { ok: true, restaurants: demoRestaurants };
  }

  if (normalized.endsWith("/api/client/ticket")) {
    return { ok: true, active_ticket: demoQueue[0] };
  }

  if (normalized.endsWith("/api/client/history")) {
    return { ok: true, history: appState.clientHistory };
  }

  if (normalized.endsWith("/api/client/login")) {
    return { ok: true, client: demoClient };
  }

  if (normalized.endsWith("/api/client/register")) {
    return { ok: true, client: { ...demoClient, ...payload, id: Date.now() % 1000 } };
  }

  if (normalized.endsWith("/api/state")) {
    return { ok: true, ...demoState, cuisines: demoState.cuisines };
  }

  if (normalized.endsWith("/api/restaurant/login")) {
    return { ok: true, restaurant: demoRestaurant };
  }

  if (normalized.endsWith("/api/restaurant/register")) {
    return { ok: true, restaurant: { ...demoRestaurant, ...payload, id: Date.now() % 1000 } };
  }

  if (normalized.endsWith("/api/restaurant/profile/update")) {
    return { ok: true, restaurant: { ...demoRestaurant, ...payload, id: demoRestaurant.id } };
  }

  if (normalized.endsWith("/api/restaurant/toggle")) {
    const rest = appState.restaurantAuth.restaurant || demoRestaurant;
    rest.is_open = !rest.is_open;
    return { ok: true, is_open: rest.is_open, restaurant: rest };
  }

  if (normalized.endsWith("/api/restaurant/call")) {
    return { ok: true, table_number: payload.table_number || 4 };
  }

  if (normalized.endsWith("/api/restaurant/change-table")) {
    return { ok: true, new_table_number: payload.new_table_number || 3 };
  }

  if (normalized.endsWith("/api/restaurant/seat")) {
    return { ok: true };
  }

  if (normalized.endsWith("/api/restaurant/cancel")) {
    return { ok: true };
  }

  if (normalized.endsWith("/api/restaurant/finish-table")) {
    return { ok: true };
  }

  if (normalized.endsWith("/api/restaurant/table/status")) {
    return { ok: true, table_number: payload.table_id || 1, status: payload.status || "LIVRE" };
  }

  if (normalized.endsWith("/api/restaurant/walkin")) {
    return { ok: true };
  }

  if (normalized.endsWith("/api/admin/demo/reset")) {
    appState.data = demoState;
    appState.searchResults = demoRestaurants;
    appState.clientActiveTicket = demoQueue[0];
    appState.clientHistory = [
      { restaurant_name: "Sushi Zen", status: "Confirmado", date: "Hoje" },
      { restaurant_name: "Verde & Co.", status: "Finalizado", date: "Ontem" },
      { restaurant_name: "Table 9", status: "Confirmado", date: "Semana passada" },
    ];
    appState.restaurantAuth.restaurant = demoRestaurant;
    appState.clientAuth.client = demoClient;
    return { ok: true };
  }

  return { ok: true, message: "Demo mode" };
}

async function apiFetch(url, options = {}) {
  if (DEMO_MODE) {
    const fallback = buildDemoResponse(url, {});
    if (fallback) {
      return fallback;
    }
  }

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Erro na operação", "var(--rose)");
      return null;
    }
    return data;
  } catch (err) {
    if (DEMO_MODE) {
      return buildDemoResponse(url, {});
    }
    showToast("Falha de comunicação com o servidor", "var(--rose)");
    return null;
  }
}

async function apiPost(url, payload = {}) {
  if (DEMO_MODE) {
    const fallback = buildDemoResponse(url, payload);
    if (fallback) {
      return fallback;
    }
  }

  return apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ==================== SSE EM TEMPO REAL ====================

function initSSE() {
  if (DEMO_MODE) return;

  const evtSource = new EventSource("/api/events");
  evtSource.onmessage = async (e) => {
    try {
      const packet = JSON.parse(e.data);
      if (packet.state) {
        appState.data = packet.state;
        handleRealtimeEvent(packet.event, packet.meta || {});
        await refreshClientState();
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
    appState.clientActiveTicket = ticketRes.active_ticket || null;
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
        ✓ Localizado no Google Maps: <strong>${addressText}</strong> (${lat.toFixed(4)}, ${lng.toFixed(4)})
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
            Acessar o CLTempo
          </button>
        </form>
      ` : `
        <form onsubmit="submitRegister(event)">
          <div class="form-group">
            <label class="form-label">Nome Completo</label>
            <input type="text" id="regName" class="form-input" placeholder="Seu Nome" required />
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
            <label class="form-label">Telefone (WhatsApp)</label>
            <input type="tel" id="regPhone" class="form-input" placeholder="21987654321" required />
          </div>
          <div class="form-group autocomplete-wrap">
            <label class="form-label">Local de Trabalho</label>
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
                  data-value="${c.name}"
                  onclick="toggleCuisineSelection(this)"
                >
                  ${c.icon ? c.icon + " " : ""}${c.name}
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
    "TODOS",
    ...getAvailableCuisines().map((c) => c.name),
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
        <span>Tempo Máximo: <strong>${f.max_wait_min >= 60 ? "Até 60 min" : `Até ${f.max_wait_min} min`}</strong></span>
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
        <div class="active-ticket ${ticket.status === "CALLED" || ticket.status === "CHAMADO" ? "called" : ""}">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
            ${(() => {
              const st = (ticket.status || "").toUpperCase();
              if (st === "CHAMADO" || st === "CALLED") {
                return `<span class="badge badge-emerald" style="font-weight:800; font-size:0.8rem;">🔔 CHAMADO</span>`;
              } else if (st === "SENTADO" || st === "SEATED") {
                return `<span class="badge badge-blue" style="font-weight:800; font-size:0.8rem;">🪑 SENTADO</span>`;
              } else if (st === "CANCELADO" || st === "CANCELLED") {
                return `<span class="badge badge-amber" style="font-weight:800; font-size:0.8rem;">⚠️ CANCELADO</span>`;
              } else if (st === "ENCERRADO") {
                return `<span class="badge badge-gray" style="font-weight:800; font-size:0.8rem;">✅ ENCERRADO</span>`;
              } else {
                return `<span class="badge badge-orange" style="font-weight:800; font-size:0.8rem;">⏳ AGUARDANDO</span>`;
              }
            })()}

            ${(ticket.table_number && (ticket.status === "CHAMADO" || ticket.status === "CALLED" || ticket.status === "SENTADO" || ticket.status === "SEATED")) ? `
              <span class="badge badge-purple" style="font-weight:800; font-size:0.82rem;">
                🪑 Mesa ${ticket.table_number}
              </span>
            ` : ""}
          </div>

          <div style="margin:0.75rem 0 0.35rem 0;">
            <div style="font-size:1.15rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif;">
              ${ticket.restaurant_name}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              Mesa para ${ticket.party_size} pessoa(s) • Entrou às ${ticket.joined_at}
              ${(ticket.table_number && (ticket.status === "CHAMADO" || ticket.status === "CALLED" || ticket.status === "SENTADO" || ticket.status === "SEATED")) ? ` • <strong style="color:var(--text);">Dirija-se à Mesa ${ticket.table_number}</strong>` : ""}
            </div>
          </div>

          <div class="ticket-metrics-grid">
            <div class="ticket-metric-box">
              <div class="ticket-metric-val">${(ticket.status === "CALLED" || ticket.status === "CHAMADO" || ticket.status === "SENTADO" || ticket.status === "SEATED") ? "Agora" : `${ticket.position}º`}</div>
              <div class="ticket-metric-lbl">Posição</div>
            </div>
            <div class="ticket-metric-box">
              <div class="ticket-metric-val">${(ticket.status === "CALLED" || ticket.status === "CHAMADO" || ticket.status === "SENTADO" || ticket.status === "SEATED") ? "0m" : `~${ticket.estimated_wait_min}m`}</div>
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

            ${(ticket.status === "CALLED" || ticket.status === "CHAMADO") ? `
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-emerald btn-block" onclick="confirmCheckin(${ticket.id})">
                  Confirmar Chegada
                </button>
                <button class="btn btn-rose btn-sm" onclick="cancelTicket(${ticket.id})">
                  Cancelar
                </button>
              </div>
            ` : (ticket.status === "SENTADO" || ticket.status === "SEATED") ? `
              <div style="text-align:center; padding:0.6rem; background:rgba(16, 185, 129, 0.08); border-radius:10px; font-size:0.8rem; color:var(--emerald-text); font-weight:700;">
                🍽️ Bom apetite! Atendimento presencial na Mesa ${ticket.table_number || ""}.
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
                const st = (h.status || "").toUpperCase();
                let badge = `<span class="badge badge-emerald">Atendido</span>`;
                if (st === "CANCELADO" || st === "CANCELLED" || st === "NO_SHOW") {
                  badge = `<span class="badge badge-amber">Cancelado</span>`;
                } else if (st === "SENTADO" || st === "SEATED" || st === "ENCERRADO") {
                  badge = `<span class="badge badge-emerald">Atendido</span>`;
                }
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

  const popularCuisines = getAvailableCuisines();

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
          <label class="form-label">Nome Completo</label>
          <input type="text" id="profName" class="form-input" value="${client.name}" required />
        </div>

        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" class="form-input" value="${client.email || ""}" disabled style="opacity:0.7;" />
        </div>

        <div class="form-group">
          <label class="form-label">Telefone (WhatsApp)</label>
          <input type="tel" id="profPhone" class="form-input" value="${client.phone || ""}" required />
        </div>

        <div class="form-group autocomplete-wrap">
          <label class="form-label">Local de Trabalho</label>
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
          <label class="form-label">3 comidas que você mais gosta</label>
          <div class="cuisine-grid">
            ${popularCuisines.map((c) => {
              const isSelected = currentPrefs.includes(c.name);
              return `
                <div 
                  class="cuisine-chip profile-cuisine-chip ${isSelected ? "selected" : ""}" 
                  data-value="${c.name}"
                  onclick="toggleProfileCuisineSelection(this)"
                >
                  ${c.icon ? c.icon + " " : ""}${c.name}
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nova Senha</label>
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
          🚪 Sair da Conta
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
  renderApp();
}

function toggleRestaurantProfileVR(vr) {
  const current = appState.restaurantAuth.profileVRs;
  if (current.includes(vr)) {
    appState.restaurantAuth.profileVRs = current.filter((x) => x !== vr);
  } else {
    appState.restaurantAuth.profileVRs = [...current, vr];
  }
  renderApp();
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

function renderRestaurantAuthScreen() {
  const authTab = appState.restaurantAuth.authTab;
  const vrOptions = [
    "Alelo", "Ticket", "Sodexo / Pluxee", "VR Refeição",
    "Flash", "Caju", "Swile", "iFood Benefícios"
  ];
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
            Acessar o CLTempo Restaurante
          </button>
        </form>
      ` : `
        <!-- Formulário de Cadastro -->
        <form onsubmit="submitRestaurantRegister(event)">
          <div class="form-group">
            <label class="form-label">Nome do Restaurante</label>
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
            <label class="form-label">Telefone (WhatsApp)</label>
            <input type="text" id="regRestPhone" class="form-input" placeholder="21998876655" required />
          </div>

          <!-- Tipo de Culinária (Chips) -->
          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>Tipo de Culinária</span>
            </label>
            <input type="hidden" id="regRestCuisine" value="${selectedCuisine}" />
            <div class="cuisine-grid">
              ${allCuisines.map((c) => {
                const sel = selectedCuisine === c.name;
                return `
                  <div 
                    class="cuisine-chip reg-rest-cuisine-chip ${sel ? "selected" : ""}" 
                    data-value="${c.name}"
                    onclick="selectRestaurantRegisterCuisine('${c.name}')"
                  >
                    ${c.icon ? c.icon + " " : ""}${c.name}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div class="form-group autocomplete-wrap">
            <label class="form-label">Endereço</label>
            <input 
              type="text" 
              id="regRestAddress" 
              class="form-input" 
              placeholder="Digite o logradouro ou edifício do restaurante..." 
              required 
              autocomplete="off"
              oninput="handleRestaurantAddressInput('reg')"
              onfocus="handleRestaurantAddressInput('reg')"
            />
            <div id="regRestPlacesDropdown" class="autocomplete-dropdown" style="display:none;"></div>
            <div id="regRestAddressBadge" style="margin-top:0.35rem; display:none;"></div>
          </div>

          <!-- Vales-Refeição Aceitos -->
          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>Quais VRs o restaurante aceita?</span>
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">Pode marcar mais de um ;)</span>
            </label>
            <div class="vr-grid">
              ${vrOptions.map((vr) => {
                const sel = selectedVRs.includes(vr);
                return `
                  <div class="vr-chip ${sel ? "selected" : ""}" onclick="toggleRestaurantRegisterVR('${vr}')">
                    💳 ${vr}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <!-- Tempos Médios de Giro por Tipo de Mesa -->
          <div style="margin:1rem 0 0.5rem 0; font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
            ⏱️ Tempo Médio de Giro (minutos)
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.4rem; margin-bottom:1rem;">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Até 2 lug.</label>
              <input type="number" id="regRestTurnover12" class="form-input" value="25" min="5" max="120" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Até 4 lug.</label>
              <input type="number" id="regRestTurnover34" class="form-input" value="35" min="5" max="120" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mais de 5 lug.</label>
              <input type="number" id="regRestTurnover5Plus" class="form-input" value="45" min="5" max="120" required />
            </div>
          </div>

          <!-- Quantidade de Mesas Disponíveis por Tipo -->
          <div style="margin:0.5rem 0 0.5rem 0; font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
            🪑 Quantidade de Mesas
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.4rem; margin-bottom:1.25rem;">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mesas 1-2</label>
              <input type="number" id="regRestTables12" class="form-input" value="6" min="1" max="50" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mesas 3-4</label>
              <input type="number" id="regRestTables34" class="form-input" value="6" min="1" max="50" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mesas 5+</label>
              <input type="number" id="regRestTables5Plus" class="form-input" value="4" min="1" max="50" required />
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
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('bistro@cltempo.com.br')">🍲 Bistrô do Ouvidor</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('grao@cltempo.com.br')">🥩 Grão & Brasa</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('pasta@cltempo.com.br')">🍝 Pasta & Basta</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('sushi@cltempo.com.br')">🍣 Koji Sushi</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="quickLoginRestaurantAs('verde@cltempo.com.br')">🥗 Verde & Fresco</button>
        </div>
      </div>
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

  // Parte Superior: Fila de Espera (AGUARDANDO) ordenada pelo cliente que está esperando há MAIS tempo
  const waitingEntries = restQueue.filter(
    (q) => q.status === "AGUARDANDO" || q.status === "WAITING"
  );
  waitingEntries.sort((a, b) => {
    const waitA = a.elapsed_wait_min ?? calcElapsedMinutes(a.joined_at);
    const waitB = b.elapsed_wait_min ?? calcElapsedMinutes(b.joined_at);
    return waitB - waitA || a.id - b.id;
  });

  // Parte Inferior: Chamados (CHAMADO) ordenados pelo chamado há mais tempo
  const calledEntries = restQueue.filter(
    (q) => q.status === "CHAMADO" || q.status === "CALLED"
  );
  calledEntries.sort((a, b) => {
    const callA = a.elapsed_called_min ?? calcElapsedMinutes(a.called_at);
    const callB = b.elapsed_called_min ?? calcElapsedMinutes(b.called_at);
    return callB - callA || (a.called_at || "").localeCompare(b.called_at || "");
  });

  return `
    <!-- PARTE SUPERIOR: Fila de Espera (AGUARDANDO) -->
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
          Fila de Espera (${waitingEntries.length})
        </div>
      </div>

      ${waitingEntries.length === 0 ? `
        <div style="text-align:center; padding:1.75rem 1rem; background:var(--bg-surface); border-radius:12px; color:var(--text-muted); font-size:0.82rem; border:1px dashed var(--border);">
          Nenhum cliente aguardando na fila.
        </div>
      ` : waitingEntries.map((q, idx) => {
        // Encontra a menor mesa livre correspondente ao porte
        const freeCatTables = restTables.filter(
          (t) => t.table_type === q.table_category && t.status === "LIVRE"
        );
        freeCatTables.sort((a, b) => a.table_number - b.table_number);
        const minFreeTable = freeCatTables[0] ? freeCatTables[0].table_number : null;
        const waitMin = q.elapsed_wait_min ?? calcElapsedMinutes(q.joined_at);

        return `
          <div style="background:var(--bg-surface); border:1px solid var(--border); border-left:4px solid var(--primary); border-radius:12px; padding:0.85rem; margin-bottom:0.6rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.35rem;">
              <div>
                <div style="font-weight:800; font-size:0.95rem;">
                  ${idx + 1}º ${q.customer_name}
                </div>
                <div style="font-size:0.73rem; color:var(--text-muted);">
                  Mesa ${q.table_category} (${q.party_size}p) • Chegou às ${q.joined_at}
                </div>
              </div>

              ${minFreeTable !== null ? `
                <span class="badge badge-emerald" style="font-weight:700; font-size:0.75rem;">
                  MESA ${minFreeTable}
                </span>
              ` : `
                <span class="badge badge-rose" style="font-weight:700; font-size:0.75rem;">
                  MESA INDISPONÍVEL
                </span>
              `}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem;">
              <span style="font-size:0.75rem; color:var(--amber); font-weight:700;">
                ⏱️ Esperando na fila há <strong>${waitMin} min</strong>
              </span>

              <button 
                class="btn btn-primary btn-sm" 
                onclick="openCallClientModal(${q.id})"
                style="padding:0.35rem 0.8rem; font-size:0.78rem;"
              >
                Chamar Cliente
              </button>
            </div>
          </div>
        `;
      }).join("")}
    </div>

    <!-- PARTE INFERIOR: Chamados no Balcão (CHAMADO) -->
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
          Clientes chamados (${calledEntries.length})
        </div>
      </div>

      ${calledEntries.length === 0 ? `
        <div style="text-align:center; padding:1.25rem 1rem; background:var(--bg-surface); border-radius:12px; color:var(--text-muted); font-size:0.82rem; border:1px dashed var(--border);">
          Nenhum cliente chamado no balcão no momento.
        </div>
      ` : calledEntries.map((q) => {
        const callMin = q.elapsed_called_min ?? calcElapsedMinutes(q.called_at);

        return `
          <div style="background:var(--bg-surface); border:1px solid var(--border); border-left:4px solid var(--emerald); border-radius:12px; padding:0.85rem; margin-bottom:0.6rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:800; font-size:0.95rem;">
                  🔔 ${q.customer_name}
                </div>
                <div style="font-size:0.73rem; color:var(--text-muted);">
                  Mesa ${q.table_category} (${q.party_size}p) • Chamado há <strong>${callMin} min</strong> (às ${q.called_at || q.joined_at})
                </div>
              </div>

              <span class="badge badge-purple" style="font-weight:800; font-size:0.82rem;">
                Mesa ${q.table_number || "?"}
              </span>
            </div>

            <div style="display:flex; gap:0.4rem; margin-top:0.75rem;">
              <button 
                class="btn btn-outline btn-sm" 
                onclick="openChangeTableModal(${q.id}, ${q.table_number || 1})"
                style="flex:1; font-size:0.74rem; padding:0.35rem 0.2rem;"
              >
                🔄 Alterar Mesa
              </button>

              <button 
                class="btn btn-emerald btn-sm" 
                onclick="confirmSeatClient(${q.id})"
                style="flex:1.2; font-size:0.74rem; padding:0.35rem 0.2rem;"
              >
                ✓ Check-in (Sentado)
              </button>

              <button 
                class="btn btn-rose btn-sm" 
                onclick="cancelClientReservation(${q.id})"
                style="font-size:0.74rem; padding:0.35rem 0.5rem;"
                title="Cancelar reserva"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        `;
      }).join("")}
    </div>

    <!-- Walk-in Presencial (Balcão) -->
    <div style="padding:0.9rem; background:var(--bg-surface); border-radius:12px; border:1px solid var(--border);">
      <div style="font-weight:700; font-size:0.82rem; margin-bottom:0.45rem;">
        ➕ Adicionar Walk-in Presencial (Sem Celular):
      </div>
      <form onsubmit="submitWalkinClient(event)" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <input type="text" id="restWalkinName" class="form-input" placeholder="Nome do cliente" required style="flex:2; font-size:0.82rem;" />
        <select id="restWalkinParty" class="form-select" style="flex:1; font-size:0.82rem;">
          <option value="2">2p (1-2)</option>
          <option value="4">4p (3-4)</option>
          <option value="6">6p (5+)</option>
        </select>
        <button type="submit" class="btn btn-primary btn-sm" style="font-size:0.8rem;">Adicionar</button>
      </form>
    </div>
  `;
}

function renderRestaurantMesasTab(restTables) {
  // Três seções: ALOCADA, LIVRE, INDISPONÍVEL
  const alocadas = restTables.filter((t) => t.status === "ALOCADA");
  const livres = restTables.filter((t) => t.status === "LIVRE");
  const indisponiveis = restTables.filter((t) => t.status === "INDISPONÍVEL");

  return `
    <!-- PARTE SUPERIOR: Mesas Alocadas -->
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <div style="font-size:0.75rem; font-weight:700; color:#9333ea; text-transform:uppercase;">
          Mesas Alocadas (${alocadas.length})
        </div>
      </div>

      ${alocadas.length === 0 ? `
        <div style="text-align:center; padding:1.25rem; background:var(--bg-surface); border-radius:12px; color:var(--text-muted); font-size:0.82rem; border:1px dashed var(--border);">
          Nenhuma mesa alocada no momento.
        </div>
      ` : alocadas.map((t) => `
        <div class="table-card table-card-alocada">
          <div>
            <div class="table-num-pill">
              <span>Mesa ${t.table_number}</span>
              <span class="badge badge-purple" style="font-size:0.7rem;">${t.table_type} lug.</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
              👤 <strong>${t.customer_name || "Cliente Ocupante"}</strong>
              ${t.checkin_at ? ` • Sentou às ${t.checkin_at}` : (t.called_at ? ` • Chamado às ${t.called_at}` : "")}
            </div>
          </div>

          <button 
            class="btn btn-sm btn-outline" 
            onclick="finishTableOrder(${t.id}, ${t.table_number}, ${t.entry_id || 0})"
            style="font-size:0.74rem; padding:0.35rem 0.65rem;"
          >
            Encerrar Pedido
          </button>
        </div>
      `).join("")}
    </div>

    <!-- PARTE DO MEIO: Mesas Livres -->
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--emerald-text); text-transform:uppercase;">
          Mesas Livres (${livres.length})
        </div>
      </div>

      ${livres.length === 0 ? `
        <div style="text-align:center; padding:1.25rem; background:var(--bg-surface); border-radius:12px; color:var(--text-muted); font-size:0.82rem; border:1px dashed var(--border);">
          Todas as mesas estão ocupadas ou indisponíveis!
        </div>
      ` : livres.map((t) => `
        <div class="table-card table-card-livre">
          <div>
            <div class="table-num-pill">
              <span>Mesa ${t.table_number}</span>
              <span class="badge badge-emerald" style="font-size:0.7rem;">${t.table_type} lug.</span>
            </div>
            <div style="font-size:0.74rem; color:var(--emerald-text); margin-top:0.15rem;">
              Disponível para alocação
            </div>
          </div>

          <button 
            class="btn btn-sm btn-outline" 
            onclick="setTableOperationalStatus(${t.id}, 'INDISPONÍVEL')"
            style="font-size:0.74rem; padding:0.35rem 0.65rem;"
          >
            Indisponível
          </button>
        </div>
      `).join("")}
    </div>

    <!-- PARTE INFERIOR: Mesas Indisponíveis -->
    <div style="margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
          Mesas Indisponíveis (${indisponiveis.length})
        </div>
      </div>

      ${indisponiveis.length === 0 ? `
        <div style="text-align:center; padding:1rem; background:var(--bg-surface); border-radius:12px; color:var(--text-muted); font-size:0.82rem; border:1px dashed var(--border);">
          Nenhuma mesa marcada como indisponível.
        </div>
      ` : indisponiveis.map((t) => `
        <div class="table-card table-card-indisponivel">
          <div>
            <div class="table-num-pill">
              <span>Mesa ${t.table_number}</span>
              <span class="badge badge-gray" style="font-size:0.7rem;">${t.table_type} lug.</span>
            </div>
            <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.15rem;">
              Bloqueada para uso
            </div>
          </div>

          <button 
            class="btn btn-sm btn-emerald" 
            onclick="setTableOperationalStatus(${t.id}, 'LIVRE')"
            style="font-size:0.74rem; padding:0.35rem 0.65rem;"
          >
            Liberar Mesa
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRestaurantPerfilTab() {
  const rest = appState.restaurantAuth.restaurant;
  if (!rest) return "";

  const vrOptions = ["Alelo", "Sodexo", "Ticket Restaurante", "VR Refeição", "Flash", "iFood Benefícios", "Caju"];
  const currentVRStr = rest.vr_accepted || "";
  if (!appState.restaurantAuth.profileVRs || appState.restaurantAuth.profileVRs.length === 0) {
    appState.restaurantAuth.profileVRs = currentVRStr.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const selectedVRs = appState.restaurantAuth.profileVRs;
  const allCuisines = getAvailableCuisines();
  const currentCuisine = rest.cuisine_type || rest.category || "Executivo";

  return `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div class="card" style="border-color:var(--border);">
      <div style="font-size:0.75rem; color:var(--text-muted);">Meu Perfil CLTempo</div>
        <h3 style="font-size:1.05rem; font-weight:800; font-family:'Plus Jakarta Sans', sans-serif; margin-bottom:0.75rem;">
          ${rest.name}
        </h3>

        <form onsubmit="submitRestaurantProfileUpdate(event)">
          <div class="form-group">
            <label class="form-label">Nome</label>
            <input type="text" id="profRestName" class="form-input" value="${rest.name}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Telefone (WhatsApp)</label>
            <input type="text" id="profRestPhone" class="form-input" value="${rest.phone_whatsapp || ""}" required />
          </div>

          <!-- Tipo de Culinária (Chips) -->
          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>Tipo de Culinária</span>
            </label>
            <input type="hidden" id="profRestCuisine" value="${currentCuisine}" />
            <div class="cuisine-grid">
              ${allCuisines.map((c) => {
                const sel = currentCuisine === c.name;
                return `
                  <div 
                    class="cuisine-chip prof-rest-cuisine-chip ${sel ? "selected" : ""}" 
                    data-value="${c.name}"
                    onclick="selectRestaurantProfileCuisine('${c.name}')"
                  >
                    ${c.icon ? c.icon + " " : ""}${c.name}
                  </div>
                `;
              }).join("")}
            </div>
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
            <div id="profRestAddressBadge" style="font-size:0.73rem; margin-top:0.35rem; color:var(--text-muted);">
              📍 Google Maps: <strong>${rest.lat ? Number(rest.lat).toFixed(4) : "-22.9030"}, ${rest.lng ? Number(rest.lng).toFixed(4) : "-43.1770"}</strong> (localizado)
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">VRs Aceitos</label>
            <div class="vr-grid">
              ${vrOptions.map((vr) => {
                const sel = selectedVRs.includes(vr);
                return `
                  <div class="vr-chip ${sel ? "selected" : ""}" onclick="toggleRestaurantProfileVR('${vr}')">
                    <span>${sel ? "✓" : "+"}</span>
                    <span>${vr}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div style="margin:1rem 0 0.5rem 0; font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
            ⏱️ Tempo Médio de Giro (minutos)
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.4rem; margin-bottom:1rem;">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Até 2 lug.</label>
              <input type="number" id="profRestTurnover12" class="form-input" value="${rest.turnover_1_2 || 25}" min="5" max="120" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Até 4 lug.</label>
              <input type="number" id="profRestTurnover34" class="form-input" value="${rest.turnover_3_4 || 35}" min="5" max="120" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mais de 5 lug.</label>
              <input type="number" id="profRestTurnover5Plus" class="form-input" value="${rest.turnover_5_plus || 45}" min="5" max="120" required />
            </div>
          </div>

          <div style="margin:1rem 0 0.5rem 0; font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
            🪑 Quantidade de Mesas
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.4rem; margin-bottom:1.25rem;">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mesas 1-2</label>
              <input type="number" id="profRestTables12" class="form-input" value="${rest.tables_1_2 || 6}" min="1" max="50" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mesas 3-4</label>
              <input type="number" id="profRestTables34" class="form-input" value="${rest.tables_3_4 || 6}" min="1" max="50" required />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Mesas 5+</label>
              <input type="number" id="profRestTables5Plus" class="form-input" value="${rest.tables_5_plus || 4}" min="1" max="50" required />
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block">
            Salvar Alterações
          </button>
        </form>
      </div>

      <!-- Ações de Conta -->
      <div class="card" style="border-color:var(--border);">
        <div style="display:flex; flex-direction:column; gap:0.65rem;">
          <button type="button" class="btn btn-outline btn-block" onclick="restaurantLogout()">
            🚪 Sair da Conta
          </button>
          <button type="button" class="btn btn-rose btn-block" onclick="submitRestaurantProfileDelete()">
            🗑️ Apagar Perfil Cadastrado
          </button>
        </div>
      </div>
    </div>
  `;
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
            Chamar Cliente para a Mesa
          </h3>
          <button class="btn btn-outline btn-sm" onclick="closeCallClientModal()" style="border:1px solid #cbd5e1; color:#64748b; padding:0.25rem 0.55rem; font-size:1rem; border-radius:8px; background:#f8fafc;">✕</button>
        </div>

        <div style="background:#f8fafc; padding:0.95rem; border-radius:12px; margin-bottom:1.15rem; border:1px solid #e2e8f0;">
          <div style="font-weight:800; font-size:1.05rem; color:#0f172a;">${entry.customer_name}</div>
          <div style="font-size:0.78rem; color:#475569; margin-top:0.25rem;">
            Porte: <strong style="color:#0f172a;">Mesa ${entry.table_category} (${entry.party_size} pessoa(s))</strong>
          </div>
          <div style="font-size:0.78rem; color:#475569; margin-top:0.15rem;">
            ⏱️ Aguardando desde <strong>${entry.joined_at}</strong>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="color:#334155; font-weight:700;">Selecione a Mesa para Alocação:</label>
          <select id="selectCallTable" class="form-select" style="font-size:0.92rem; padding:0.65rem; background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; border-radius:10px;">
            ${restTables.map((t) => {
              const isFree = t.status === "LIVRE";
              const isSuggested = t.table_number === suggestedTable;
              const isSameType = t.table_type === entry.table_category;
              return `
                <option 
                  value="${t.table_number}" 
                  ${isSuggested ? "selected" : ""}
                  ${!isFree ? "disabled" : ""}
                  style="color:${!isFree ? "#94a3b8" : "#0f172a"};"
                >
                  Mesa ${t.table_number} (${t.table_type} lug.) — ${t.status}${isSuggested ? " ⭐ (Sugestão)" : (!isSameType ? " [Outro porte]" : "")}
                </option>
              `;
            }).join("")}
          </select>
          <div style="font-size:0.74rem; color:#64748b; margin-top:0.45rem;">
            * Apenas mesas com status <strong>LIVRE</strong> podem ser alocadas. Mesas ocupadas não podem ser selecionadas.
          </div>
        </div>

        <div style="display:flex; gap:0.6rem; margin-top:1.35rem;">
          <button class="btn btn-outline btn-block btn-sm" onclick="closeCallClientModal()" style="border:1px solid #cbd5e1; color:#475569; background:#f8fafc; font-weight:600;">
            Cancelar
          </button>
          <button class="btn btn-emerald btn-block btn-sm" onclick="confirmCallClient(${entry.id})" style="font-weight:700;">
            🔔 Confirmar Chamada
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
            Alterar Mesa Alocada
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
          <label class="form-label" style="color:#334155; font-weight:700;">Selecione a Nova Mesa Livre:</label>
          <select id="selectNewTable" class="form-select" style="font-size:0.92rem; padding:0.65rem; background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; border-radius:10px;">
            ${restTables.map((t) => {
              const isFree = t.status === "LIVRE";
              const isCurrent = t.table_number === currentTable;
              return `
                <option 
                  value="${t.table_number}" 
                  ${isCurrent ? "selected" : ""}
                  ${!isFree && !isCurrent ? "disabled" : ""}
                  style="color:${!isFree && !isCurrent ? "#94a3b8" : "#0f172a"};"
                >
                  Mesa ${t.table_number} (${t.table_type} lug.) — ${t.status}${isCurrent ? " (Atual)" : ""}
                </option>
              `;
            }).join("")}
          </select>
          <div style="font-size:0.74rem; color:#64748b; margin-top:0.45rem;">
            * A mesa atual será liberada e a nova mesa será marcada como ALOCADA.
          </div>
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
});

// ==================== INICIALIZAÇÃO ====================

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(appState.theme);

  if (DEMO_MODE) {
    appState.data = demoState;
    appState.clientAuth.client = demoClient;
    appState.clientActiveTicket = demoQueue[0];
    appState.clientHistory = [
      { restaurant_name: "Sushi Zen", status: "Confirmado", date: "Hoje" },
      { restaurant_name: "Verde & Co.", status: "Finalizado", date: "Ontem" },
      { restaurant_name: "Table 9", status: "Confirmado", date: "Semana passada" },
    ];
    appState.restaurantAuth.restaurant = demoRestaurant;
    appState.searchResults = demoRestaurants;
    appState.clientActiveTab = "buscar";
  }

  // Garante que o app sempre inicie na aba Buscar ao carregar
  appState.clientActiveTab = "buscar";

  // Botões do Topbar
  document.getElementById("btnThemeToggle")?.addEventListener("click", () => {
    applyTheme(appState.theme === "dark" ? "light" : "dark");
  });

  document.getElementById("btnResetDemo")?.addEventListener("click", async () => {
    if (confirm("Deseja restaurar os dados originais do piloto do CLTempo?")) {
      await apiPost("/api/admin/demo/reset");
      renderApp();
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
