const appState = {
  mainView: 'client',
  clientTab: 'buscar',
  restaurantTab: 'fila',
  theme: localStorage.getItem('cltempo_theme') || 'light',
};

const demoData = {
  restaurants: [
    { name: 'Sushi Zen', cuisine: 'Japonês', wait: 18, score: '4.8', distance: '1.4 km', status: 'Aberto' },
    { name: 'Table 9', cuisine: 'Brasileira', wait: 12, score: '4.7', distance: '2.1 km', status: 'Aberto' },
    { name: 'Verde & Co.', cuisine: 'Saudável', wait: 9, score: '4.9', distance: '0.8 km', status: 'Atenção' },
    { name: 'Coco Grill', cuisine: 'Grelhados', wait: 22, score: '4.6', distance: '3.0 km', status: 'Aberto' },
  ],
  queue: [
    { customer: 'Ana', party: 2, table: '1-2', eta: '12 min', status: 'Aguardando' },
    { customer: 'Pedro', party: 4, table: '3-4', eta: '18 min', status: 'Aguardando' },
    { customer: 'Julia', party: 2, table: '1-2', eta: 'Chamada', status: 'Chamada' },
  ],
  tables: [
    { table: 'Mesa 1', status: 'Livre' },
    { table: 'Mesa 2', status: 'Livre' },
    { table: 'Mesa 3', status: 'Ocupada' },
    { table: 'Mesa 4', status: 'Em limpeza' },
  ],
  leads: [
    { name: 'Banca de Café', source: 'Instagram', value: 'R$ 3.2k', status: 'Qualificado' },
    { name: 'Arena Co.', source: 'Google', value: 'R$ 4.8k', status: 'Em contato' },
    { name: 'Ponto B', source: 'Indicação', value: 'R$ 2.1k', status: 'Novo' },
  ],
  metrics: [
    { label: 'Fechamento', value: 82, color: 'var(--emerald)' },
    { label: 'Leads', value: 68, color: 'var(--primary)' },
    { label: 'Tempo', value: 54, color: 'var(--blue)' },
    { label: 'Retenção', value: 76, color: 'var(--amber)' },
  ],
};

function applyTheme(theme) {
  appState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cltempo_theme', theme);
  const btn = document.getElementById('btnThemeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️ Claro' : '🌙 Escuro';
  }
}

function showToast(message, color = 'var(--primary)') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeftColor = color;
  el.innerHTML = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function switchMainView(view) {
  appState.mainView = view;
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  renderApp();
}

function renderClientHeaderCard() {
  return `
    <div class="card" style="margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
        <div>
          <small style="color: var(--text-muted);">Olá,</small>
          <h3 style="margin: 0.1rem 0 0;">Ana Silva</h3>
        </div>
        <span class="badge badge-emerald">Cliente</span>
      </div>
      <div style="display: grid; gap: 0.5rem;">
        <button class="btn btn-primary btn-block action-btn" data-action="buscar-restaurantes">Buscar restaurantes</button>
        <button class="btn btn-outline btn-block action-btn" data-action="ver-fila">Ver fila ativa</button>
      </div>
    </div>
  `;
}

function renderRestaurantCards() {
  return demoData.restaurants.map((restaurant) => `
    <div class="card" style="padding: 0.9rem; margin-bottom: 0.85rem;">
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 0.75rem; margin-bottom: 0.5rem;">
        <div>
          <strong>${restaurant.name}</strong><br>
          <small style="color: var(--text-muted);">${restaurant.cuisine}</small>
        </div>
        <span class="badge badge-score">${restaurant.score}</span>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
        <span class="badge badge-orange">${restaurant.wait} min</span>
        <span class="badge badge-emerald">${restaurant.status}</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.8rem;">
        <span>📍 ${restaurant.distance}</span>
        <span>🍽️ ${restaurant.cuisine}</span>
      </div>
      <div style="margin-top: 0.75rem;">
        <button class="btn btn-primary btn-sm action-btn" data-action="reservar-${restaurant.name.toLowerCase().replace(/\s+/g, '-')}">Reservar</button>
      </div>
    </div>
  `).join('');
}

function renderClientBuscar() {
  return `
    <div class="phone-frame">
      <div class="phone-header">
        <div>
          <strong style="font-size: 1rem;">CLTempo</strong><br>
          <small style="color: var(--text-muted);">Cliente</small>
        </div>
        <span class="badge badge-blue">Triagem</span>
      </div>
      <div class="phone-body">
        ${renderClientHeaderCard()}
        <div class="card" style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <strong>Busca rápida</strong>
            <span class="badge badge-blue">2.1 km</span>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge badge-orange">Todos</span>
            <span class="badge badge-emerald">Japonês</span>
            <span class="badge badge-amber">Saudável</span>
            <span class="badge badge-blue">3 pessoas</span>
          </div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 0.8rem;">
            <strong>Melhores opções</strong>
            <span style="color: var(--text-muted); font-size: 0.8rem;">Hoje</span>
          </div>
          ${renderRestaurantCards()}
        </div>
      </div>
      <div class="client-bottom-nav">
        <button class="client-tab-btn active" data-client-tab="buscar"><span class="client-tab-icon">🔎</span>Buscar</button>
        <button class="client-tab-btn" data-client-tab="fila"><span class="client-tab-icon">📋</span>Fila</button>
        <button class="client-tab-btn" data-client-tab="perfil"><span class="client-tab-icon">👤</span>Perfil</button>
      </div>
    </div>
  `;
}

function renderClientFila() {
  return `
    <div class="phone-frame">
      <div class="phone-header">
        <div>
          <strong style="font-size: 1rem;">CLTempo</strong><br>
          <small style="color: var(--text-muted);">Cliente</small>
        </div>
        <span class="badge badge-orange">Fila</span>
      </div>
      <div class="phone-body">
        <div class="card" style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.7rem;">
            <strong>Minha fila</strong>
            <span class="badge badge-emerald">Ativa</span>
          </div>
          <div class="card" style="padding: 0.8rem; margin-bottom: 0.7rem; background: var(--bg-surface);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <strong>Table 9</strong>
              <span class="badge badge-orange">Aguardando</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.8rem;">
              <span>2 pessoas</span>
              <span>18 min</span>
            </div>
          </div>
          <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <strong>Ponto de aviso</strong>
              <span class="badge badge-blue">Próximo</span>
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">
              Seu turno pode ser chamado em até 5 minutos.
            </div>
          </div>
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
            <strong>Histórico</strong>
            <span class="badge badge-emerald">3</span>
          </div>
          <div style="display: grid; gap: 0.7rem;">
            <div class="card" style="padding: 0.7rem; background: var(--bg-surface);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>Sushi Zen</strong>
                <span class="badge badge-emerald">Confirmado</span>
              </div>
            </div>
            <div class="card" style="padding: 0.7rem; background: var(--bg-surface);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>Verde & Co.</strong>
                <span class="badge badge-blue">Finalizado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="client-bottom-nav">
        <button class="client-tab-btn" data-client-tab="buscar"><span class="client-tab-icon">🔎</span>Buscar</button>
        <button class="client-tab-btn active" data-client-tab="fila"><span class="client-tab-icon">📋</span>Fila</button>
        <button class="client-tab-btn" data-client-tab="perfil"><span class="client-tab-icon">👤</span>Perfil</button>
      </div>
    </div>
  `;
}

function renderClientPerfil() {
  return `
    <div class="phone-frame">
      <div class="phone-header">
        <div>
          <strong style="font-size: 1rem;">CLTempo</strong><br>
          <small style="color: var(--text-muted);">Cliente</small>
        </div>
        <span class="badge badge-blue">Perfil</span>
      </div>
      <div class="phone-body">
        <div class="card" style="margin-bottom: 1rem;">
          <div style="display: flex; gap: 0.85rem; align-items: center; margin-bottom: 0.8rem;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--blue)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800;">AS</div>
            <div>
              <strong>Ana Silva</strong><br>
              <small style="color: var(--text-muted);">ana.silva@email.com</small>
            </div>
          </div>
          <div style="display: grid; gap: 0.5rem;">
            <button class="btn btn-outline btn-block action-btn" data-action="editar-perfil">Editar perfil</button>
            <button class="btn btn-outline btn-block action-btn" data-action="preferencias">Preferências</button>
            <button class="btn btn-rose btn-block action-btn" data-action="sair">Sair</button>
          </div>
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
            <strong>Preferências</strong>
            <span class="badge badge-orange">3</span>
          </div>
          <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
            <span class="badge badge-emerald">Japonês</span>
            <span class="badge badge-amber">Saudável</span>
            <span class="badge badge-blue">Vegetariano</span>
          </div>
        </div>
      </div>
      <div class="client-bottom-nav">
        <button class="client-tab-btn" data-client-tab="buscar"><span class="client-tab-icon">🔎</span>Buscar</button>
        <button class="client-tab-btn" data-client-tab="fila"><span class="client-tab-icon">📋</span>Fila</button>
        <button class="client-tab-btn active" data-client-tab="perfil"><span class="client-tab-icon">👤</span>Perfil</button>
      </div>
    </div>
  `;
}

function renderClientView() {
  const view = appState.clientTab === 'fila' ? renderClientFila() : appState.clientTab === 'perfil' ? renderClientPerfil() : renderClientBuscar();
  return view;
}

function renderRestaurantPanel() {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <small style="color: var(--text-muted);">Restaurante</small>
          <h3 style="margin: 0.2rem 0 0;">Bistro Central</h3>
        </div>
        <span class="badge badge-emerald">Aberto</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
        <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
          <small style="color: var(--text-muted);">Fila</small>
          <div style="font-size: 1.5rem; font-weight: 800; margin-top: 0.25rem;">12</div>
        </div>
        <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
          <small style="color: var(--text-muted);">Mesas</small>
          <div style="font-size: 1.5rem; font-weight: 800; margin-top: 0.25rem;">8</div>
        </div>
        <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
          <small style="color: var(--text-muted);">Tempo</small>
          <div style="font-size: 1.5rem; font-weight: 800; margin-top: 0.25rem;">18m</div>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <button class="btn btn-sm ${appState.restaurantTab === 'fila' ? 'btn-primary' : 'btn-outline'} action-btn" data-action="restaurant-fila">Fila</button>
        <button class="btn btn-sm ${appState.restaurantTab === 'mesas' ? 'btn-primary' : 'btn-outline'} action-btn" data-action="restaurant-mesas">Mesas</button>
        <button class="btn btn-sm ${appState.restaurantTab === 'perfil' ? 'btn-primary' : 'btn-outline'} action-btn" data-action="restaurant-perfil">Perfil</button>
      </div>
      ${appState.restaurantTab === 'mesas' ? `
        <div>
          <h4 style="margin-bottom: 0.75rem;">Mesas</h4>
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem;">
            ${demoData.tables.map((table) => `
              <div class="card" style="padding: 0.75rem; background: var(--bg-surface);">
                <div style="font-weight: 700; margin-bottom: 0.3rem;">${table.table}</div>
                <span class="badge ${table.status === 'Livre' ? 'badge-emerald' : table.status === 'Ocupada' ? 'badge-rose' : 'badge-amber'}">${table.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : appState.restaurantTab === 'perfil' ? `
        <div>
          <h4 style="margin-bottom: 0.75rem;">Perfil do restaurante</h4>
          <div class="card" style="padding: 0.85rem; background: var(--bg-surface); margin-bottom: 0.8rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <strong>Horário</strong>
              <span class="badge badge-blue">18:00–23:00</span>
            </div>
          </div>
          <div class="card" style="padding: 0.85rem; background: var(--bg-surface); margin-bottom: 0.8rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <strong>Capacidade</strong>
              <span class="badge badge-orange">42 pax</span>
            </div>
          </div>
          <div class="card" style="padding: 0.85rem; background: var(--bg-surface);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <strong>Atendimento</strong>
              <span class="badge badge-emerald">Alta</span>
            </div>
          </div>
        </div>
      ` : `
        <div>
          <h4 style="margin-bottom: 0.75rem;">Fila ativa</h4>
          ${demoData.queue.map((item) => `
            <div class="card" style="padding: 0.8rem; margin-bottom: 0.7rem; background: var(--bg-surface);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>${item.customer}</strong>
                <span class="badge ${item.status === 'Chamada' ? 'badge-emerald' : 'badge-orange'}">${item.status}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.8rem; margin-top: 0.4rem;">
                <span>${item.party} pessoas</span>
                <span>${item.table}</span>
                <span>${item.eta}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function renderRestaurantView() {
  return renderRestaurantPanel();
}

function renderAdminView() {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <small style="color: var(--text-muted);">Administrador</small>
          <h3 style="margin: 0.2rem 0 0;">Dashboard</h3>
        </div>
        <span class="badge badge-blue">Operação</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
        <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
          <small style="color: var(--text-muted);">Leads</small>
          <div style="font-size: 1.6rem; font-weight: 800; margin-top: 0.25rem;">284</div>
        </div>
        <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
          <small style="color: var(--text-muted);">Conversão</small>
          <div style="font-size: 1.6rem; font-weight: 800; margin-top: 0.25rem;">34%</div>
        </div>
        <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
          <small style="color: var(--text-muted);">Pessoas na fila</small>
          <div style="font-size: 1.6rem; font-weight: 800; margin-top: 0.25rem;">15</div>
        </div>
        <div class="card" style="padding: 0.8rem; background: var(--bg-surface);">
          <small style="color: var(--text-muted);">Faturamento</small>
          <div style="font-size: 1.6rem; font-weight: 800; margin-top: 0.25rem;">R$ 42k</div>
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <h4 style="margin-bottom: 0.7rem;">Métricas</h4>
        <div style="display: flex; align-items: end; gap: 0.6rem; height: 140px;">
          ${demoData.metrics.map((metric) => `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.45rem;">
              <div style="width: 100%; height: ${metric.value}%; background: ${metric.color}; border-radius: 10px 10px 0 0; box-shadow: inset 0 -10px 20px rgba(255,255,255,0.15);"></div>
              <small style="color: var(--text-muted); text-align: center;">${metric.label}</small>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <h4 style="margin-bottom: 0.7rem;">Leads recentes</h4>
        ${demoData.leads.map((lead) => `
          <div class="card" style="padding: 0.8rem; margin-bottom: 0.7rem; background: var(--bg-surface);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.7rem;">
              <div>
                <strong>${lead.name}</strong><br>
                <small style="color: var(--text-muted);">${lead.source}</small>
              </div>
              <div style="text-align: right;">
                <strong>${lead.value}</strong><br>
                <span class="badge badge-emerald">${lead.status}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function bindActionButtons() {
  document.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action || '';
      const label = btn.textContent.trim() || action;
      showToast(`${label} selecionado`, 'var(--emerald)');
    });
  });

  document.querySelectorAll('.client-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.clientTab;
      appState.clientTab = tab;
      renderApp();
      showToast(`Cliente: ${tab}`, 'var(--primary)');
    });
  });
}

function renderApp() {
  const appRoot = document.getElementById('appRoot');
  if (!appRoot) return;

  const content = appState.mainView === 'client'
    ? renderClientView()
    : appState.mainView === 'restaurant'
      ? renderRestaurantView()
      : renderAdminView();

  appRoot.innerHTML = content;
  bindActionButtons();

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === appState.mainView);
  });

  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) {
    btnTheme.onclick = () => applyTheme(appState.theme === 'dark' ? 'light' : 'dark');
  }

  const btnReset = document.getElementById('btnResetDemo');
  if (btnReset) {
    btnReset.onclick = () => {
      appState.mainView = 'client';
      appState.clientTab = 'buscar';
      appState.restaurantTab = 'fila';
      renderApp();
      showToast('Interface restaurada', 'var(--emerald)');
    };
  }
}

function initApp() {
  applyTheme(appState.theme);
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchMainView(btn.dataset.view));
  });
  renderApp();
}

initApp();
