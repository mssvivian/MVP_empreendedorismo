// FilaZero CLT — Frontend SPA Reativo (Filas por Categoria de Mesa + Light/Dark)

const appState = {
  currentView: "split", // split | clt | restaurant | metrics | arch
  theme: localStorage.getItem("fz_theme") || "light",
  selectedUserId: 1, // Default: Vivian Souza
  selectedRestaurantId: 1, // Default: Bistrô do Ouvidor
  selectedPartySize: 2,
  selectedRestCategoryFilter: "ALL", // ALL | 1-2 | 3-4 | 5+
  lastSeatedEntryByUser: {},
  data: null,
};

function getTableCategory(partySize) {
  const p = Number(partySize);
  if (p <= 2) return "1-2";
  if (p <= 4) return "3-4";
  return "5+";
}

function applyTheme(theme) {
  appState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("fz_theme", theme);
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
  setTimeout(() => el.remove(), 3500);
}

async function apiPost(url, payload = {}) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Erro na operação", "var(--rose)");
      return null;
    }
    return data;
  } catch (err) {
    showToast("Falha de conexão com o servidor", "var(--rose)");
    return null;
  }
}

function initSSE() {
  const evtSource = new EventSource("/api/events");
  evtSource.onmessage = (e) => {
    try {
      const packet = JSON.parse(e.data);
      if (packet.state) {
        appState.data = packet.state;
        handleRealtimeNotification(packet.event, packet.meta || {});
        renderApp();
      }
    } catch (err) {
      console.error("Erro SSE:", err);
    }
  };
}

function handleRealtimeNotification(event, meta) {
  if (event === "queue_joined") {
    showToast(
      `<strong>${meta.customer_name}</strong> entrou na fila <strong>Mesa ${meta.table_category || ""}</strong> em ${meta.restaurant_name}`,
      "var(--primary)"
    );
  } else if (event === "queue_call") {
    showToast(
      `🔔 <strong>Mesa ${meta.table_category || ""} pronta!</strong> ${meta.restaurant_name} chamou <strong>${meta.customer_name}</strong>`,
      "var(--emerald)"
    );
  } else if (event === "queue_seat") {
    if (meta.user_id) {
      appState.lastSeatedEntryByUser[meta.user_id] = {
        entry_id: meta.entry_id,
        restaurant_name: meta.restaurant_name,
      };
    }
    showToast(`Check-in confirmado: <strong>${meta.customer_name}</strong>`, "var(--emerald)");
  } else if (event === "queue_cancel") {
    showToast(`<strong>${meta.customer_name}</strong> saiu da fila`, "var(--amber)");
  } else if (event === "feedback_recorded") {
    showToast(`Avaliação registrada (${meta.perceived_min} min em pé)`, "var(--blue)");
  } else if (event === "demo_reset") {
    appState.lastSeatedEntryByUser = {};
    showToast("Dados restaurados", "var(--blue)");
  }
}

// Actions
async function joinQueue(restaurantId) {
  const res = await apiPost("/api/queue/join", {
    restaurant_id: restaurantId,
    user_id: appState.selectedUserId,
    party_size: appState.selectedPartySize,
  });
  if (res) {
    appState.selectedRestaurantId = restaurantId;
  }
}

async function triggerQueueAction(entryId, action, extra = {}) {
  await apiPost("/api/queue/action", { entry_id: entryId, action, ...extra });
}

async function submitStandingWaitFeedback(userId, entryId, minutes) {
  const res = await apiPost("/api/queue/feedback", {
    entry_id: entryId,
    perceived_standing_wait_min: minutes,
  });
  if (res) {
    delete appState.lastSeatedEntryByUser[userId];
    renderApp();
  }
}

async function addWalkinCustomer(e) {
  e.preventDefault();
  const nameInput = document.getElementById("walkinName");
  const partyInput = document.getElementById("walkinParty");
  if (!nameInput || !nameInput.value.trim()) return;

  await apiPost("/api/queue/join", {
    restaurant_id: appState.selectedRestaurantId,
    user_id: null,
    customer_name: nameInput.value.trim(),
    company_tag: "Presencial",
    party_size: parseInt(partyInput.value || "2", 10),
  });
  nameInput.value = "";
}

async function toggleRestaurantOpen(restaurantId) {
  await apiPost("/api/restaurants/toggle", { restaurant_id: restaurantId });
}

async function updateLeadStatus(leadId, status) {
  await apiPost("/api/leads/update", { lead_id: leadId, status });
}

async function addNewLead(e) {
  e.preventDefault();
  const restName = document.getElementById("newLeadName").value.trim();
  const contact = document.getElementById("newLeadContact").value.trim();
  const status = document.getElementById("newLeadStatus").value;
  if (!restName) return;
  await apiPost("/api/leads/update", {
    restaurant_name: restName,
    contact_person: contact || "Gerente",
    status,
  });
}

// 1. Clean CLT Mobile View (with Table Size Segmentation)
function renderCLTPanel() {
  const { users, restaurants, active_queue } = appState.data;
  const currentUser = users.find((u) => u.id === Number(appState.selectedUserId)) || users[0];
  const activeTicket = active_queue.find((q) => q.user_id === currentUser.id);
  const pendingFeedback = appState.lastSeatedEntryByUser[currentUser.id];
  const targetCat = getTableCategory(appState.selectedPartySize);

  const userOptions = users
    .map((u) => {
      const hasTicket = active_queue.find((q) => q.user_id === u.id);
      const statusText = hasTicket
        ? hasTicket.status === "CALLED"
          ? " • Chamado!"
          : ` • ${hasTicket.position}º (Mesa ${hasTicket.table_category})`
        : "";
      return `<option value="${u.id}" ${u.id === currentUser.id ? "selected" : ""}>
        ${u.name}${statusText}
      </option>`;
    })
    .join("");

  let ticketHTML = "";
  if (activeTicket) {
    const isCalled = activeTicket.status === "CALLED";
    ticketHTML = `
      <div class="ticket-card ${isCalled ? "called" : ""}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="badge ${isCalled ? "badge-emerald" : "badge-orange"}">
            ${isCalled ? "🔔 Mesa pronta" : `Fila Mesa ${activeTicket.table_category} lug.`}
          </span>
          <span style="font-family:monospace; font-weight:700; font-size:0.82rem; color:var(--text-muted);">
            #${activeTicket.checkin_code}
          </span>
        </div>

        <div style="margin-top:0.55rem;">
          <div style="font-weight:700; font-size:1.05rem;">${activeTicket.restaurant_name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            Grupo de ${activeTicket.party_size} pessoa(s) • ${activeTicket.tables_in_category} mesas desse porte no salão
          </div>
        </div>

        <div class="ticket-metrics">
          <div class="ticket-metric-box">
            <div class="ticket-metric-val">${isCalled ? "Agora" : `${activeTicket.position}º`}</div>
            <div class="ticket-metric-lbl">Posição (${activeTicket.table_category})</div>
          </div>
          <div class="ticket-metric-box">
            <div class="ticket-metric-val">${isCalled ? "0 min" : `~${activeTicket.estimated_wait_min}m`}</div>
            <div class="ticket-metric-lbl">Espera</div>
          </div>
          <div class="ticket-metric-box">
            <div class="ticket-metric-val">${activeTicket.party_size}p</div>
            <div class="ticket-metric-lbl">Pessoas</div>
          </div>
        </div>

        ${
          isCalled
            ? `<div style="display:flex; gap:0.45rem;">
                <button class="btn btn-emerald btn-block" onclick="triggerQueueAction(${activeTicket.id}, 'seat')">
                  Confirmar Check-in
                </button>
                <button class="btn btn-rose btn-sm" onclick="promptCancelTicket(${activeTicket.id})">
                  Sair
                </button>
              </div>`
            : `<button class="btn btn-outline btn-block btn-sm" onclick="promptCancelTicket(${activeTicket.id})">
                Sair da fila
              </button>`
        }
      </div>
    `;
  } else if (pendingFeedback) {
    ticketHTML = `
      <div class="card" style="padding:1rem; margin-bottom:1rem; border-color:var(--blue);">
        <div style="font-weight:700; font-size:0.88rem; margin-bottom:0.25rem;">
          Como foi a chegada no ${pendingFeedback.restaurant_name}?
        </div>
        <div style="font-size:0.76rem; color:var(--text-muted); margin-bottom:0.65rem;">
          Quantos minutos você esperou em pé na fila?
        </div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.35rem;">
          <button class="btn btn-emerald btn-sm" onclick="submitStandingWaitFeedback(${currentUser.id}, ${pendingFeedback.entry_id}, 0)">0 min</button>
          <button class="btn btn-outline btn-sm" onclick="submitStandingWaitFeedback(${currentUser.id}, ${pendingFeedback.entry_id}, 2)">2 min</button>
          <button class="btn btn-outline btn-sm" onclick="submitStandingWaitFeedback(${currentUser.id}, ${pendingFeedback.entry_id}, 5)">5 min</button>
          <button class="btn btn-outline btn-sm" onclick="submitStandingWaitFeedback(${currentUser.id}, ${pendingFeedback.entry_id}, 10)">10+ m</button>
        </div>
      </div>
    `;
  }

  const restaurantsHTML = restaurants
    .map((r) => {
      const isUserHere = activeTicket && activeTicket.restaurant_id === r.id;
      const catStats = r.queues_by_category
        ? r.queues_by_category[targetCat]
        : { waiting: r.waiting_count, est_wait_min: r.estimated_wait_for_new_min, tables: 8 };

      return `
        <div class="rest-item">
          <div style="min-width:0;">
            <div class="rest-name">${r.name}</div>
            <div class="rest-meta">
              ${r.category} • ${r.distance_walk_min} min a pé • <strong>${catStats.tables} mesas (${targetCat} lug.)</strong>
            </div>
            <div style="display:flex; gap:0.4rem; margin-top:0.45rem; align-items:center; flex-wrap:wrap;">
              <span class="badge ${catStats.waiting > 0 ? "badge-orange" : "badge-emerald"}">
                ${catStats.waiting === 0 ? "Fila livre" : `${catStats.waiting} na fila`} (Mesa ${targetCat})
              </span>
              <span style="font-size:0.73rem; color:var(--text-muted);">
                ~${catStats.est_wait_min} min
              </span>
            </div>
          </div>

          <div>
            ${
              !r.is_open
                ? `<span class="badge badge-rose">Fechado</span>`
                : `<button
                    class="btn ${isUserHere ? "btn-outline" : "btn-primary"} btn-sm"
                    ${activeTicket ? "disabled" : ""}
                    onclick="joinQueue(${r.id})"
                  >
                    ${isUserHere ? "Na fila" : "Entrar"}
                  </button>`
            }
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="phone-frame">
      <div class="phone-header">
        <div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Perfil CLT</div>
          <div style="font-weight:700; font-size:0.9rem;">${currentUser.name}</div>
        </div>
        <span class="badge badge-blue">${currentUser.vr_card}</span>
      </div>

      <!-- User Selector -->
      <div style="margin-bottom:0.65rem;">
        <select id="userSelect" onchange="onUserSelectChange(this.value)">
          ${userOptions}
        </select>
      </div>

      <!-- Party Size Selector showing Table Category -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface); padding:0.45rem 0.65rem; border-radius:10px; margin-bottom:1rem; border:1px solid var(--border);">
        <span style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">
          Pessoas (<strong style="color:var(--text);">Mesa ${targetCat}</strong>):
        </span>
        <div style="display:flex; gap:0.2rem;">
          ${[
            { n: 2, lbl: "2p" },
            { n: 4, lbl: "4p" },
            { n: 6, lbl: "6p" },
            { n: 8, lbl: "8p" },
          ]
            .map(
              (item) => `
            <button
              class="btn btn-sm"
              style="padding:0.22rem 0.5rem; background:${appState.selectedPartySize === item.n ? "var(--primary)" : "transparent"}; color:${appState.selectedPartySize === item.n ? "#fff" : "var(--text-muted)"};"
              onclick="setPartySize(${item.n})"
            >${item.lbl}</button>
          `
            )
            .join("")}
        </div>
      </div>

      ${ticketHTML}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.55rem;">
        <span style="font-size:0.74rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">
          Filas para Mesa ${targetCat} lugares
        </span>
      </div>

      ${restaurantsHTML}
    </div>
  `;
}

// 2. Clean Restaurant Operational Dashboard (with Table Category Filters & Inventory)
function renderRestaurantPanel() {
  const { restaurants, active_queue, recent_history } = appState.data;
  const currentRest =
    restaurants.find((r) => r.id === Number(appState.selectedRestaurantId)) || restaurants[0];

  const allRestQueue = active_queue.filter((q) => q.restaurant_id === currentRest.id);
  const filteredQueue =
    appState.selectedRestCategoryFilter === "ALL"
      ? allRestQueue
      : allRestQueue.filter((q) => q.table_category === appState.selectedRestCategoryFilter);

  const restHistory = recent_history.filter((q) => q.restaurant_id === currentRest.id).slice(0, 5);
  const qByCat = currentRest.queues_by_category || {
    "1-2": { waiting: 0, tables: 12 },
    "3-4": { waiting: 0, tables: 8 },
    "5+": { waiting: 0, tables: 2 },
  };

  const restTabs = restaurants
    .map(
      (r) => `
      <button
        class="btn btn-sm ${r.id === currentRest.id ? "btn-primary" : "btn-outline"}"
        onclick="selectRestaurant(${r.id})"
      >
        ${r.name}
        <span style="opacity:0.8;">(${r.waiting_count + r.called_count})</span>
      </button>
    `
    )
    .join("");

  const queueRowsHTML =
    filteredQueue.length === 0
      ? `<div style="text-align:center; padding:1.75rem 1rem; color:var(--text-muted); font-size:0.84rem; background:var(--bg-surface); border-radius:12px;">
          Nenhum grupo aguardando nesta categoria de mesa.
        </div>`
      : filteredQueue
          .map((q) => {
            const isCalled = q.status === "CALLED";
            return `
            <div class="queue-row ${isCalled ? "called" : ""}">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <div class="queue-pos" title="Posição na fila de Mesa ${q.table_category}">
                  ${isCalled ? "🔔" : `${q.position}º`}
                </div>
                <div>
                  <div style="font-weight:700; font-size:0.9rem; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                    <span>${q.customer_name}</span>
                    <span class="badge badge-orange">Mesa ${q.table_category} (${q.party_size}p)</span>
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.1rem;">
                    #${q.checkin_code} • Entrou às ${q.joined_at}
                    ${
                      isCalled
                        ? ` • <strong style="color:var(--emerald-text);">Chamado no balcão</strong>`
                        : ` • ${q.position}º da fila (${q.table_category} lug.) • ~${q.estimated_wait_min} min`
                    }
                  </div>
                </div>
              </div>

              <div style="display:flex; gap:0.4rem;">
                ${
                  !isCalled
                    ? `<button class="btn btn-primary btn-sm" onclick="triggerQueueAction(${q.id}, 'call')">
                        Chamar
                      </button>`
                    : `<button class="btn btn-emerald btn-sm" onclick="triggerQueueAction(${q.id}, 'seat')">
                        Check-in
                      </button>`
                }
                <button class="btn btn-outline btn-sm" onclick="triggerQueueAction(${q.id}, 'noshow')" title="Não compareceu">
                  Ausente
                </button>
              </div>
            </div>
          `;
          })
          .join("");

  const historyRowsHTML = restHistory
    .map((h) => {
      let badge = `<span class="badge badge-emerald">Atendido (${h.perceived_standing_wait_min ?? 2}m em pé)</span>`;
      if (h.status === "CANCELLED") badge = `<span class="badge badge-amber">Cancelou</span>`;
      if (h.status === "NO_SHOW") badge = `<span class="badge badge-rose">Ausente</span>`;

      return `
        <tr>
          <td><strong>${h.customer_name}</strong></td>
          <td><span class="badge badge-blue">Mesa ${h.table_category || getTableCategory(h.party_size)} (${h.party_size}p)</span></td>
          <td><code>${h.checkin_code}</code></td>
          <td>${badge}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div>
      <!-- Top Selector & Table Inventory by Size -->
      <div class="card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:1.1rem;">
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${restTabs}
          </div>
          <button
            class="btn btn-sm ${currentRest.is_open ? "btn-outline" : "btn-emerald"}"
            onclick="toggleRestaurantOpen(${currentRest.id})"
          >
            ${currentRest.is_open ? "⏸ Pausar Fila" : "▶ Abrir Fila"}
          </button>
        </div>

        <!-- 3 Independent Table Queues Summary -->
        <div class="kpi-strip">
          <div class="kpi-mini" style="cursor:pointer; border:1px solid ${appState.selectedRestCategoryFilter === "1-2" ? "var(--primary)" : "transparent"};" onclick="setRestCategoryFilter('1-2')">
            <div class="kpi-mini-label">Mesas 1–2 lug. (${qByCat["1-2"].tables} mesas)</div>
            <div class="kpi-mini-val" style="color:var(--primary-text);">${qByCat["1-2"].waiting} <span style="font-size:0.75rem; font-weight:500; color:var(--text-muted);">na fila</span></div>
          </div>
          <div class="kpi-mini" style="cursor:pointer; border:1px solid ${appState.selectedRestCategoryFilter === "3-4" ? "var(--primary)" : "transparent"};" onclick="setRestCategoryFilter('3-4')">
            <div class="kpi-mini-label">Mesas 3–4 lug. (${qByCat["3-4"].tables} mesas)</div>
            <div class="kpi-mini-val" style="color:var(--blue-text);">${qByCat["3-4"].waiting} <span style="font-size:0.75rem; font-weight:500; color:var(--text-muted);">na fila</span></div>
          </div>
          <div class="kpi-mini" style="cursor:pointer; border:1px solid ${appState.selectedRestCategoryFilter === "5+" ? "var(--primary)" : "transparent"};" onclick="setRestCategoryFilter('5+')">
            <div class="kpi-mini-label">Mesas 5+ lug. (${qByCat["5+"].tables} mesas)</div>
            <div class="kpi-mini-val" style="color:var(--amber-text);">${qByCat["5+"].waiting} <span style="font-size:0.75rem; font-weight:500; color:var(--text-muted);">na fila</span></div>
          </div>
          <div class="kpi-mini" style="cursor:pointer;" onclick="setRestCategoryFilter('ALL')">
            <div class="kpi-mini-label">Atendidos hoje</div>
            <div class="kpi-mini-val" style="color:var(--emerald-text);">${currentRest.seated_today}</div>
          </div>
        </div>

        <!-- Filter & Quick Call by Table Size -->
        <div class="card-header" style="margin-top:0.5rem; flex-wrap:wrap;">
          <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;">
            <button class="btn btn-sm ${appState.selectedRestCategoryFilter === "ALL" ? "btn-primary" : "btn-outline"}" onclick="setRestCategoryFilter('ALL')">
              Todas (${allRestQueue.length})
            </button>
            <button class="btn btn-sm ${appState.selectedRestCategoryFilter === "1-2" ? "btn-primary" : "btn-outline"}" onclick="setRestCategoryFilter('1-2')">
              Mesa 1–2
            </button>
            <button class="btn btn-sm ${appState.selectedRestCategoryFilter === "3-4" ? "btn-primary" : "btn-outline"}" onclick="setRestCategoryFilter('3-4')">
              Mesa 3–4
            </button>
            <button class="btn btn-sm ${appState.selectedRestCategoryFilter === "5+" ? "btn-primary" : "btn-outline"}" onclick="setRestCategoryFilter('5+')">
              Mesa 5+
            </button>
          </div>

          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            ${["1-2", "3-4", "5+"]
              .map((cat) => {
                const hasWait = allRestQueue.some((q) => q.status === "WAITING" && q.table_category === cat);
                return hasWait
                  ? `<button class="btn btn-emerald btn-sm" onclick="callNextByCategory(${currentRest.id}, '${cat}')">
                      🔔 Liberou Mesa ${cat}
                    </button>`
                  : "";
              })
              .join("")}
          </div>
        </div>

        ${queueRowsHTML}

        <!-- Minimal Walk-in Input -->
        <form onsubmit="addWalkinCustomer(event)" style="margin-top:0.9rem; display:flex; gap:0.5rem;">
          <input type="text" id="walkinName" placeholder="Adicionar cliente presencial..." style="flex:1;" required />
          <select id="walkinParty" style="width:110px;">
            <option value="2" selected>2p (1–2)</option>
            <option value="4">4p (3–4)</option>
            <option value="6">6p (5+)</option>
            <option value="8">8p (5+)</option>
          </select>
          <button type="submit" class="btn btn-outline btn-sm">+ Incluir</button>
        </form>
      </div>

      <!-- Compact History -->
      <div class="card">
        <div class="card-title" style="margin-bottom:0.75rem;">Últimos Atendimentos</div>
        <table class="table-clean">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Categoria de Mesa</th>
              <th>Código</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${historyRowsHTML}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 3. Clean Canvas Validation Metrics View
function renderMetricsView() {
  const { metrics, leads } = appState.data;
  const m1 = metrics.m1_restaurant_conversion;
  const m2 = metrics.m2_weekly_entries_per_user;
  const m3 = metrics.m3_dropout_rate;
  const m4 = metrics.m4_standing_wait_reduction;

  const userBreakdownRows = m2.user_breakdown
    .map(
      (u) => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.company}</td>
        <td><span class="badge badge-orange">${u.entries_count} entradas</span></td>
      </tr>
    `
    )
    .join("");

  const leadsRows = leads
    .map((l) => {
      let badgeClass = "badge-blue";
      let statusLabel = "Abordado";
      if (l.status === "ONBOARDED") {
        badgeClass = "badge-emerald";
        statusLabel = "Piloto Ativo";
      } else if (l.status === "IN_NEGOTIATION") {
        badgeClass = "badge-amber";
        statusLabel = "Negociação";
      } else if (l.status === "DECLINED") {
        badgeClass = "badge-rose";
        statusLabel = "Recusou";
      }

      return `
        <tr>
          <td><strong>${l.restaurant_name}</strong></td>
          <td>${l.contact_person}</td>
          <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
          <td>
            ${
              l.status !== "ONBOARDED"
                ? `<button class="btn btn-outline btn-sm" onclick="updateLeadStatus(${l.id}, 'ONBOARDED')">
                    Ativar Piloto
                  </button>`
                : `<span style="font-size:0.75rem; color:var(--emerald-text);">✓ Parceiro</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div>
      <div class="section-label">
        <span>Validação de Hipóteses do MVP Canvas</span>
        <span>Atualizado em tempo real</span>
      </div>

      <div class="metrics-grid">
        <div class="metric-kpi-card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">1. Conversão de Restaurantes</div>
          <div class="kpi-number" style="color:var(--emerald-text);">${m1.conversion_pct}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(100, m1.conversion_pct)}%; background:var(--emerald);"></div>
          </div>
          <div style="font-size:0.76rem; color:var(--text-muted);">
            ${m1.onboarded} de ${m1.total_approached} abordados no piloto
          </div>
        </div>

        <div class="metric-kpi-card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">2. Entradas / Usuário / Semana</div>
          <div class="kpi-number" style="color:var(--primary-text);">${m2.avg_entries_per_week}x</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(100, (m2.avg_entries_per_week / 5) * 100)}%; background:var(--primary);"></div>
          </div>
          <div style="font-size:0.76rem; color:var(--text-muted);">
            ${m2.total_entries} entradas (${m2.active_users} usuários ativos)
          </div>
        </div>

        <div class="metric-kpi-card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">3. Taxa de Desistência da Fila</div>
          <div class="kpi-number" style="color:var(--amber-text);">${m3.dropout_pct}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(100, m3.dropout_pct)}%; background:var(--amber);"></div>
          </div>
          <div style="font-size:0.76rem; color:var(--text-muted);">
            ${m3.cancelled_count} cancelamentos e ${m3.noshow_count} ausências
          </div>
        </div>

        <div class="metric-kpi-card">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">4. Redução de Espera em Pé</div>
          <div class="kpi-number" style="color:var(--blue-text);">-${m4.reduction_pct}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(100, m4.reduction_pct)}%; background:var(--blue);"></div>
          </div>
          <div style="font-size:0.76rem; color:var(--text-muted);">
            De ${m4.avg_standing_without_app_min} min para ${m4.avg_standing_with_app_min} min em pé
          </div>
        </div>
      </div>

      <div class="split-grid" style="grid-template-columns: 1fr 1.3fr;">
        <div class="card">
          <div class="card-title" style="margin-bottom:0.75rem;">Recorrência Semanal (CLTs)</div>
          <table class="table-clean">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Polo</th>
                <th>Uso</th>
              </tr>
            </thead>
            <tbody>
              ${userBreakdownRows}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:0.75rem;">Funil de Restaurantes Abordados</div>
          <table class="table-clean">
            <thead>
              <tr>
                <th>Restaurante</th>
                <th>Contato</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              ${leadsRows}
            </tbody>
          </table>

          <form onsubmit="addNewLead(event)" style="margin-top:0.85rem; display:flex; gap:0.45rem;">
            <input type="text" id="newLeadName" placeholder="Novo restaurante..." style="flex:1;" required />
            <input type="text" id="newLeadContact" placeholder="Contato" style="width:130px;" />
            <select id="newLeadStatus" style="width:140px;">
              <option value="APPROACHED">Abordado</option>
              <option value="IN_NEGOTIATION">Negociação</option>
              <option value="ONBOARDED">Piloto Ativo</option>
            </select>
            <button type="submit" class="btn btn-primary btn-sm">+ Adicionar</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

// 4. Clean Architecture Summary View
function renderArchitectureView() {
  return `
    <div>
      <div class="metrics-grid">
        <div class="metric-kpi-card">
          <span class="badge badge-orange">Filas por Capacidade</span>
          <div style="font-weight:700; margin:0.5rem 0 0.3rem;">Particionamento por Mesa</div>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Filas independentes para <strong>1–2 lugares</strong>, <strong>3–4 lugares</strong> e <strong>5+ lugares</strong>, ponderadas pelo inventário de mesas de cada porte no restaurante.
          </p>
        </div>

        <div class="metric-kpi-card">
          <span class="badge badge-emerald">Comunicação em Tempo Real</span>
          <div style="font-weight:700; margin:0.5rem 0 0.3rem;">Server-Sent Events (SSE)</div>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Conexão persistente (<code>/api/events</code>) que atualiza a posição na fila e envia o alerta de mesa pronta instantaneamente.
          </p>
        </div>

        <div class="metric-kpi-card">
          <span class="badge badge-blue">Camada de Apresentação</span>
          <div style="font-weight:700; margin:0.5rem 0 0.3rem;">SPA Web Responsiva</div>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Interface única para o App do CLT e o Balcão do Restaurante, sem exigir download na loja durante o piloto de 3–4 semanas.
          </p>
        </div>

        <div class="metric-kpi-card">
          <span class="badge badge-amber">Persistência &amp; Métricas</span>
          <div style="font-weight:700; margin:0.5rem 0 0.3rem;">SQLite / PostgreSQL</div>
          <p style="font-size:0.8rem; color:var(--text-muted);">
            Registra eventos de entrada, chamada, check-in, desistência e tempo percebido em pé para validar o Canvas.
          </p>
        </div>
      </div>

      <div class="split-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="card">
          <div class="card-title" style="margin-bottom:0.75rem;">Modelo de Dados (Tabelas)</div>
          <table class="table-clean">
            <thead>
              <tr>
                <th>Tabela</th>
                <th>Descrição</th>
                <th>Métrica</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>users</code></td>
                <td>Perfil CLT, empresa e vale-refeição</td>
                <td>M2</td>
              </tr>
              <tr>
                <td><code>restaurants</code></td>
                <td>Inventário de mesas (<code>1-2</code>, <code>3-4</code>, <code>5+</code>) e giro médio</td>
                <td>M4</td>
              </tr>
              <tr>
                <td><code>queue_entries</code></td>
                <td>Tickets segmentados por <code>table_category</code></td>
                <td>M2, M3, M4</td>
              </tr>
              <tr>
                <td><code>restaurant_leads</code></td>
                <td>Funil de restaurantes abordados no polo</td>
                <td>M1</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:0.75rem;">Escopo do MVP vs. Evolução Futura</div>
          <table class="table-clean">
            <thead>
              <tr>
                <th>Fase</th>
                <th>Funcionalidades</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="badge badge-emerald">MVP Atual</span></td>
                <td>Listagem do polo, fila segmentada por capacidade de mesa, alerta em tempo real e métricas do Canvas.</td>
              </tr>
              <tr>
                <td><span class="badge badge-blue">Fase 2</span></td>
                <td>Mapa virtual integrado (Google Maps), recomendação personalizada e opção Premium / Fast-Pass.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// Helpers
window.onUserSelectChange = function (val) {
  appState.selectedUserId = parseInt(val, 10);
  renderApp();
};

window.setPartySize = function (size) {
  appState.selectedPartySize = size;
  renderApp();
};

window.selectRestaurant = function (id) {
  appState.selectedRestaurantId = id;
  renderApp();
};

window.setRestCategoryFilter = function (cat) {
  appState.selectedRestCategoryFilter = cat;
  renderApp();
};

window.callNextByCategory = function (restaurantId, category) {
  const nextWaiting = appState.data.active_queue.find(
    (q) => q.restaurant_id === restaurantId && q.status === "WAITING" && q.table_category === category
  );
  if (nextWaiting) {
    triggerQueueAction(nextWaiting.id, "call");
  }
};

window.promptCancelTicket = function (entryId) {
  const reason = window.prompt(
    "Motivo do cancelamento (registra na Métrica 3 do Canvas):",
    "Reunião de última hora"
  );
  if (reason !== null) {
    triggerQueueAction(entryId, "cancel", {
      cancel_reason: reason.trim() || "Cancelado pelo usuário",
    });
  }
};

window.joinQueue = joinQueue;
window.triggerQueueAction = triggerQueueAction;
window.submitStandingWaitFeedback = submitStandingWaitFeedback;
window.addWalkinCustomer = addWalkinCustomer;
window.toggleRestaurantOpen = toggleRestaurantOpen;
window.updateLeadStatus = updateLeadStatus;
window.addNewLead = addNewLead;

function renderApp() {
  const root = document.getElementById("appRoot");
  if (!root || !appState.data) return;

  if (appState.currentView === "split") {
    root.innerHTML = `
      <div class="split-grid">
        <div>
          <div class="section-label">
            <span>📱 App do Usuário CLT</span>
            <span>11h30 • No Escritório</span>
          </div>
          ${renderCLTPanel()}
        </div>
        <div>
          <div class="section-label">
            <span>🧑‍🍳 Painel do Restaurante</span>
            <span>Filas por Capacidade de Mesa</span>
          </div>
          ${renderRestaurantPanel()}
        </div>
      </div>
    `;
  } else if (appState.currentView === "clt") {
    root.innerHTML = `<div class="single-phone-wrapper">${renderCLTPanel()}</div>`;
  } else if (appState.currentView === "restaurant") {
    root.innerHTML = renderRestaurantPanel();
  } else if (appState.currentView === "metrics") {
    root.innerHTML = renderMetricsView();
  } else if (appState.currentView === "arch") {
    root.innerHTML = renderArchitectureView();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(appState.theme);

  const themeBtn = document.getElementById("btnThemeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      applyTheme(appState.theme === "dark" ? "light" : "dark");
    });
  }

  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      appState.currentView = btn.dataset.view;
      renderApp();
    });
  });

  const resetBtn = document.getElementById("btnResetDemo");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      await apiPost("/api/demo/reset");
    });
  }

  const res = await fetch("/api/state");
  if (res.ok) {
    appState.data = await res.json();
    renderApp();
  }
  initSSE();
});
