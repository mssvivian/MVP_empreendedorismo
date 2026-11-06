# Arquitetura do Sistema — MVP Gestão de Filas para Restaurantes (CLTempo)

**Disciplina:** Empreendedorismo (UFRJ — 2026.2)  
**Grupo:** Arthur Monteiro, Carolina Falcão, Fernando Bruzzi e Vivian Souza  

---

## 1. Alinhamento Estratégico com o MVP Canvas

A arquitetura foi desenhada seguindo estritamente o recorte de validação de hipóteses definido no [Canva.txt](Canva.txt) e no [canvas_mvp.jpeg](canvas_mvp.jpeg):

| Bloco do Canvas | Decisão Arquitetural no MVP |
| :--- | :--- |
| **Personas Segmentadas** | **1. CLTs sem tempo:** Interface mobile-first focada em entrada na fila em menos de 15 segundos (às ~11h30, ainda no escritório).<br>**2. Restaurantes parceiros:** Painel web simplificado (tablet/balcão) de 1 toque para chamar mesas sem fricção operacional. |
| **Jornada Melhorada** | Notificações em tempo real (Server-Sent Events + alerta sonoro, vibração e notificação do navegador) permitem que o usuário saia do escritório apenas quando sua posição estiver próxima, convertendo 30–40 min de fila em pé em tempo livre de descanso pós-almoço (12h40–13h30). |
| **Escopo Enxuto (Core MVP)** | Foco exclusivo em **Descoberta de Restaurantes do Polo**, **Entrada/Acompanhamento de Fila Digital** e **Painel do Restaurante**. Funcionalidades de *Mapa Virtual*, *Recomendação via IA* e *Fast-Pass Premium* foram isoladas para a Fase 2 (Pós-Validação). |
| **Validação de Hipóteses** | Coleta nativa de telemetria no banco de dados para medir as **4 métricas do Canvas**: conversão de restaurantes, entradas/usuário/semana, taxa de desistência e redução do tempo percebido de espera em pé. |
| **Custo & Cronograma** | Arquitetura monolítica modular com banco relacional leve e comunicação reativa via HTTP/SSE, permitindo entrega em **4 a 6 semanas** com custo de infraestrutura próximo de zero durante o piloto de **3 a 4 semanas**. |

---

## 2. Visão de Arquitetura (Modelo C4 — Contexto e Containers)

O diagrama abaixo representa os componentes do MVP, separando as três interfaces (App CLT, Painel do Restaurante e Dashboard de Métricas do Piloto) conectadas ao backend reativo.

```mermaid
flowchart TB
    subgraph Usuarios["Atores do Ecossistema"]
        CLT["👤 Usuário CLT\n(Smartphone / Web App)"]
        Hostess["🧑‍🍳 Recepção do Restaurante\n(Tablet / Desktop no Balcão)"]
        EquipeMVP["📊 Equipe Empreendedorismo\n(Acompanhamento do Piloto)"]
    end

    subgraph SistemaMVP["Sistema de Gestão de Filas (MVP)"]
        SPA["📱 Frontend Multi-Visão (SPA)\nHTML5 + CSS próprio + Vanilla JS\n(Visão Cliente | Visão Restaurante | Administrador)"]
        API["⚙️ Backend API & Motor de Filas\nPython (http.server) — app.py + client_api.py\nrestaurant_api.py + admin_api.py"]
        SSE["📡 Broker de Eventos em Tempo Real\nServer-Sent Events (SSE / EventSource)"]
        DB[("🗄️ Banco de Dados Relacional\nSQLite (db.py)")]
    end

    CLT -->|"1. Consulta filas e entra remotamente (REST)"| SPA
    Hostess -->|"2. Chama próximo / Confirma check-in (REST)"| SPA
    EquipeMVP -->|"3. Analisa métricas de validação do Canvas"| SPA

    SPA -->|"Requisições JSON (POST/PATCH/GET)"| API
    SSE -.->|"Push instantâneo de posição e chamada"| SPA
    API -->|"Persiste transações e telemetria"| DB
    API -->|"Dispara evento de mudança de fila"| SSE
```

---

## 3. Modelo Conceitual e Lógico de Dados (MER / DER)

O modelo de dados foi projetado para suportar tanto a operação de fila em tempo real quanto a extração direta das **4 métricas de validação do MVP Canvas**.

```mermaid
erDiagram
    CLIENTS ||--o{ QUEUE_ENTRIES : "entra na fila"
    RESTAURANTS ||--o{ QUEUE_ENTRIES : "gerencia"
    RESTAURANTS ||--o{ RESTAURANT_TABLES : "possui"
    RESTAURANT_LEADS ||--o| RESTAURANTS : "converte em parceiro"

    CLIENTS {
        int id PK
        string name "Nome do colaborador CLT"
        string email "E-mail (login)"
        string password_hash
        string phone "WhatsApp"
        string workplace "Local de trabalho no polo"
        string pref_food_1_2_3 "3 culinárias preferidas"
        string meal_vouchers "VRs que possui"
        int baseline_standing_wait_min "Minutos em pé SEM o app (linha de base M4)"
        float lat_lng "Coordenadas do local de trabalho"
        datetime created_at
    }

    RESTAURANTS {
        int id PK
        string name "Nome do restaurante"
        string email "Login do restaurante"
        string cuisine_type "Culinária"
        string address "Localização no polo"
        int turnover_1_2_3_4_5_plus "Tempo de giro por porte de mesa (min)"
        int tables_1_2_3_4_5_plus "Qtd de mesas por porte"
        boolean is_open "Fila digital aberta/pausada"
        string vr_accepted "VRs aceitos"
        float lat_lng
    }

    RESTAURANT_TABLES {
        int id PK
        int restaurant_id FK
        int table_number "Numeração consecutiva"
        string table_type "'1-2' | '3-4' | '5+'"
        string status "LIVRE | ALOCADA | INDISPONÍVEL"
    }

    QUEUE_ENTRIES {
        int id PK
        int restaurant_id FK
        int client_id FK "Nulo para walk-in"
        string customer_name "Nome para chamada"
        int party_size "Qtd de pessoas"
        string table_category "'1-2' | '3-4' | '5+'"
        string status "AGUARDANDO | CHAMADO | SENTADO | ENCERRADO | CANCELADO"
        int table_number "Mesa alocada na chamada"
        string checkin_code "Código curto (ex: CLT-482)"
        string cancel_reason "Motivo da desistência (M3)"
        int perceived_standing_wait_min "Minutos em pé relatados após o atendimento (M4)"
        datetime joined_at
        datetime called_at
        datetime checkin_at
        datetime completed_at
    }

    RESTAURANT_LEADS {
        int id PK
        string restaurant_name "Restaurante abordado"
        string contact_person "Gerente / Proprietário"
        string region
        string status "APPROACHED | IN_NEGOTIATION | ONBOARDED | DECLINED"
        string notes
        datetime updated_at
    }
```

### Segmentação de Filas por Tamanho de Mesa e Cálculo de Espera ($T_{\text{espera}}$)

Em um restaurante real, uma dupla (**1–2 lugares**) não compete na mesma fila de uma equipe grande (**5+ lugares**). Por isso, o motor de filas particiona a fila de cada restaurante em **3 categorias independentes** ($c \in \{\text{'1-2'}, \text{'3-4'}, \text{'5+'}\}$):

$$T_{\text{espera}}(p_c, c) = \left\lceil \frac{p_c \times T_{\text{giro}}(c)}{\text{FatorMesas}(c)} \right\rceil$$

Onde:
- $p_c$: posição do grupo **apenas dentro da fila da sua categoria de mesa $c$** (ex: 1º da fila de mesas para 2 pessoas, mesmo que haja 4 grupos esperando mesa de 4 lugares).
- $T_{\text{giro}}(c)$: tempo médio de giro ajustado pelo porte da mesa (mesas de 1–2 lugares giram mais rápido; mesas de 5+ lugares exigem junção de mesas e têm giro ~1.4x maior).
- $\text{FatorMesas}(c)$: vazão paralela proporcional à quantidade de mesas daquela categoria no salão (`tables_1_2`, `tables_3_4`, `tables_5_plus`).

---

## 4. Fluxos em Tempo Real (Diagramas de Sequência)

### 4.1. Jornada Principal: Entrada Remota às 11h30 e Chamada de Mesa

```mermaid
sequenceDiagram
    autonumber
    actor CLT as 👤 Usuário CLT (No Escritório)
    participant App as 📱 App CLT
    participant API as ⚙️ Backend API + SSE
    participant DB as 🗄️ Banco de Dados
    participant Painel as 🧑‍🍳 Painel Restaurante

    Note over CLT,App: 11:30 — Pausa rápida antes do almoço
    CLT->>App: Abre lista de restaurantes do polo
    App->>API: GET /api/client/restaurants
    API->>DB: Conta filas ativas e calcula tempo estimado
    API-->>App: Lista com fila atual e espera estimada (ex: 18 min)

    CLT->>App: Clica em "Entrar na Fila" (2 pessoas)
    App->>API: POST /api/client/queue/join {restaurant_id, client_id, party_size}
    API->>DB: INSERT INTO queue_entries (status='AGUARDANDO', code='CLT-901')
    API-->>Painel: 📡 Evento SSE: queue_updated (Novo cliente na fila)
    API-->>App: Retorna Ticket Digital (Código CLT-901)

    Note over CLT,Painel: 11:55 — CLT caminha até o restaurante enquanto a fila anda
    Painel->>API: POST /api/restaurant/call {entry_id, table_number}
    API->>DB: UPDATE status='CHAMADO', table_number, called_at=NOW()
    API-->>App: 📡 Evento SSE: queue_called
    App-->>CLT: 🔔 Som + vibração + notificação do navegador: "Sua mesa está pronta! Mesa 4"

    Note over CLT,Painel: 12:00 — Chegada sem espera em pé
    CLT->>Painel: Chega e se apresenta na recepção
    Painel->>API: POST /api/restaurant/seat {entry_id}
    API->>DB: UPDATE status='SENTADO', checkin_at=NOW()
    CLT->>App: Responde "quanto tempo ficou em pé?" (ex: 2 min)
    App->>API: POST /api/client/feedback {entry_id, perceived_standing_wait_min: 2}
    API->>DB: Salva percepção (M4) — e, na 1ª vez, o tempo em pé sem o app
```

---

## 5. Rastreabilidade das Métricas do MVP Canvas

Cada métrica listada no bloco **"Métricas para validar as hipóteses do negócio"** do Canvas é calculada em `admin_api.calculate_canvas_metrics()` e enviada em `GET /api/state` (campo `metrics`), exibida na aba **Administrador**:

1. **Taxa de conversão de restaurantes abordados (`M1`):**
   $$\text{Conversão} = \frac{\text{COUNT}(\text{RESTAURANT\_LEADS onde status = 'ONBOARDED'})}{\text{COUNT}(\text{RESTAURANT\_LEADS totais})} \times 100$$
2. **Número de entradas registradas na fila digital por usuário/semana (`M2`):**
   $$\text{Recorrência Semanal} = \frac{\text{Total de entradas na semana}}{\text{Usuários CLT ativos na semana}}$$
3. **Taxa de desistência ou cancelamento da fila antes de ser chamado (`M3`):**
   $$\text{Taxa de Abandono} = \frac{\text{COUNT}(\text{status} = \text{'CANCELADO'})}{\text{COUNT}(\text{entradas})} \times 100$$
4. **Redução no tempo percebido de espera em pé (`M4`):**
   $$\text{Redução (\%)} = \left(1 - \frac{\text{AVG}(\text{queue\_entries.perceived\_standing\_wait\_min})}{\text{AVG}(\text{clients.baseline\_standing\_wait\_min})}\right) \times 100$$

   - O tempo **com o app** vem da pergunta feita ao cliente depois do check-in (aba Fila → "Quanto tempo você ficou em pé?").
   - O tempo **sem o app** é informado pelo próprio cliente no cadastro, no perfil ou no primeiro feedback. Só enquanto nenhum cliente informou é que o painel usa o benchmark de 35 min do Canvas (e avisa isso).
   - Sem nenhuma resposta, o painel mostra "—" em vez de um número estimado.

O funil da **M1** é alimentado pela equipe na aba **Administrador** (registrar restaurante abordado, mudar status, remover).

---

## 6. Especificação dos Endpoints da API (MVP)

Todas as rotas `POST` recebem e devolvem JSON. Toda alteração dispara um evento SSE em `/api/events` com o estado consolidado.

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/state` | Estado consolidado (restaurantes, filas, clientes, culinárias e métricas M1–M4). |
| `GET` | `/api/events` | Stream **Server-Sent Events (SSE)** para atualização instantânea das telas. |
| `GET` | `/api/cuisines` | Lista de culinárias padronizadas. |
| `GET` | `/api/places/autocomplete?query=` | Sugestões de endereço (Google, se houver chave; senão catálogo do polo + OpenStreetMap). |
| **Cliente** | | |
| `POST` | `/api/client/register` · `/api/client/login` | Cadastro e login. |
| `GET` | `/api/client/profile?client_id=` | Perfil do cliente. |
| `POST` | `/api/client/profile/update` · `/profile/vr` · `/profile/delete` | Edição do perfil, dos VRs e exclusão da conta. |
| `GET` | `/api/client/restaurants?...` | Busca com filtros (nome, culinária, espera máxima, raio, porte) e score. |
| `POST` | `/api/client/queue/join` | Entra na fila e gera o código de check-in. |
| `GET` | `/api/client/ticket?client_id=` · `/api/client/history?client_id=` | Reserva ativa e histórico. |
| `POST` | `/api/client/feedback` | Tempo em pé na visita (M4) e, opcionalmente, o tempo em pé sem o app. |
| **Restaurante** | | |
| `POST` | `/api/restaurant/register` · `/api/restaurant/login` | Cadastro (gera as mesas) e login. |
| `GET` | `/api/restaurant/profile?restaurant_id=` · `/api/restaurant/tables?restaurant_id=` | Perfil e mesas. |
| `POST` | `/api/restaurant/profile/update` · `/profile/delete` | Edição (inclusive quantidade de mesas) e exclusão. |
| `POST` | `/api/restaurant/call` · `/change-table` · `/seat` · `/cancel` | Chamar cliente para uma mesa, trocar mesa, check-in e cancelamento. |
| `POST` | `/api/restaurant/finish-table` · `/table/status` | Encerrar atendimento e marcar mesa como livre/indisponível. |
| `POST` | `/api/restaurant/walkin` · `/api/restaurant/toggle` | Cliente presencial e abrir/pausar a fila. |
| `POST` | `/api/restaurant/action` | Rota genérica (`call`, `seat`, `cancel`, `noshow`) usada pelo app do cliente. |
| **Administrador** | | |
| `POST` | `/api/admin/leads/update` | Adiciona restaurante abordado ou muda o status de um lead (M1). |
| `POST` | `/api/admin/leads/delete` | Remove um lead. |
| `POST` | `/api/admin/demo/reset` | Restaura os dados de demonstração. |

--- | :--- | :--- |
| `GET` | `/api/state` | Retorna estado consolidado (restaurantes, filas ativas, usuários CLT e métricas do Canvas). |
| `GET` | `/api/events` | Stream **Server-Sent Events (SSE)** para atualização instantânea de todas as telas abertas. |
| `POST` | `/api/queue/join` | Registra entrada de um usuário CLT na fila de um restaurante e gera código de check-in. |
| `POST` | `/api/queue/action` | Executa transições de estado (`call`, `seat`, `cancel`, `noshow`) e dispara broadcast SSE. |
| `POST` | `/api/queue/feedback` | Registra o tempo percebido de espera em pé informado pelo usuário após sentar. |
| `POST` | `/api/restaurants/toggle` | Abre/pausa a fila digital ou ajusta o tempo médio de giro do restaurante. |
| `POST` | `/api/leads/add` | Registra ou atualiza restaurante abordado no funil comercial do piloto (Métrica M1). |
| `POST` | `/api/demo/reset` | Restaura os dados iniciais de demonstração para apresentações da disciplina. |

---

## 7. Roadmap de Evolução Arquitetural (Pós-MVP)

Conforme recomendado em [Canva.txt](Canva.txt), os blocos mais complexos do BMC foram isolados para a Fase 2 após validação das 4 semanas de piloto:

```mermaid
flowchart LR
    subgraph Fase1["Fase 1: Piloto MVP (Semanas 1 a 10)"]
        F1A["Listagem do Polo Corporativo"]
        F1B["Fila Digital Remota em Tempo Real"]
        F1C["Painel Operacional Simplificado"]
        F1D["Telemetria das 4 Métricas do Canvas"]
    end

    subgraph Fase2["Fase 2: Escala & Monetização (Pós-Validação)"]
        F2A["🗺️ Mapa Virtual Interativo\n(Google Maps / Mapbox SDK)"]
        F2B["⚡ Fast-Pass / Opção Premium\n(Gateway PIX / Stripe + Fila Prioritária)"]
        F2C["🤖 Recomendação Personalizada\n(Filtro colaborativo por histórico de VR e tempo livre)"]
    end

    Fase1 -->|"Validação de Retenção CLT e Adesão de Restaurantes"| Fase2
```

---

## 8. Como Executar o Protótipo Funcional

O protótipo usa **Python 3 puro (sem dependências externas)**, **SQLite** e **Server-Sent Events (SSE)**. As instruções completas (Docker, variáveis de ambiente e testes) estão no [README](../README.md).

```bash
python3 app.py
```

Acesse no navegador: **`http://localhost:8765`**

- Use as abas **App Cliente** e **Restaurante** (de preferência em duas janelas lado a lado) para demonstrar ao vivo a entrada na fila pelo CLT e a chamada da mesa pelo restaurante.
- Acesse a aba **Administrador** para ver as 4 métricas do Canvas recalculadas em tempo real e gerenciar o funil de restaurantes abordados.
