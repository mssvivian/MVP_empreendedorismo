# IMPLEMENTAÇÃO DO RESTAURANTE & GESTÃO DE SALÃO — CLTempo

Documento consolidado de especificação técnica e registro de todas as implementações, reestruturações, migrações de banco de dados e refinamentos realizados no ecossistema do **CLTempo**, com foco integral na **Interface do Restaurante**, na **criação e numeração consecutiva de mesas operacionais**, no **ciclo de vida de atendimento e prevenção de conflitos de alocação** e na **sincronização em tempo real com a Interface do Cliente**.

---

## 📑 Sumário

1. [Visão Geral & Requisitos da Interface do Restaurante](#1-visão-geral--requisitos-da-interface-do-restaurante)
2. [Estrutura do Banco de Dados & Novas Tabelas](#2-estrutura-do-banco-de-dados--novas-tabelas)
   - [2.1 Remoção da coluna `baseline_wait_min`](#21-remoção-da-coluna-baseline_wait_min)
   - [2.2 Expansão da tabela `restaurants`](#22-expansão-da-tabela-restaurants)
   - [2.3 Criação da tabela `restaurant_tables` (Mesas)](#23-criação-da-tabela-restaurant_tables-mesas)
   - [2.4 Atualização da tabela `queue_entries`](#24-atualização-da-tabela-queue_entries)
   - [2.5 Criação da tabela `cuisines` & Seleção Padronizada por Chips](#25-criação-da-tabela-cuisines--seleção-padronizada-por-chips)
3. [Lógica de Numeração Consecutiva de Mesas](#3-lógica-de-numeração-consecutiva-de-mesas)
4. [Módulo Backend: `restaurant_api.py`](#4-módulo-backend-restaurant_apipy)
5. [Endpoints REST no `app.py`](#5-endpoints-rest-no-apppy)
6. [Frontend da Interface Restaurante (`static/app.js` e `styles.css`)](#6-frontend-da-interface-restaurante-staticappjs-e-stylescss)
   - [6.1 Tela Inicial de Autenticação (Login & Cadastro)](#61-tela-inicial-de-autenticação-login--cadastro)
   - [6.2 Aba Fila (Espera com Sugestão de Mesa & Chamados)](#62-aba-fila-espera-com-sugestão-de-mesa--chamados)
   - [6.3 Aba Mesas (Alocadas, Livres e Indisponíveis)](#63-aba-mesas-alocadas-livres-e-indisponíveis)
   - [6.4 Aba Perfil (Edição, Status da Fila, Exclusão e Logout)](#64-aba-perfil-edição-status-da-fila-exclusão-e-logout)
7. [Ajustes Sincronizados na Aba Fila do Cliente](#7-ajustes-sincronizados-na-aba-fila-do-cliente)
8. [Sincronização de Cancelamento, Tempo Decorrido e Autocomplete Google Maps](#8-sincronização-de-cancelamento-tempo-decorrido-e-autocomplete-google-maps)
9. [Verificação & Testes Automatizados](#9-verificação--testes-automatizados)

---

## 1. Visão Geral & Requisitos da Interface do Restaurante

A interface do restaurante foi concebida para fornecer aos estabelecimentos parceiros do polo corporativo do Centro do Rio de Janeiro uma ferramenta leve, reativa e intuitiva para o gerenciamento ágil de mesas e filas presenciais e remotas durante o pico de almoço.

### Principais Pilares Atendidos:
- **Design Responsivo Duplo:** Interface consistente para computadores (desktop) e dispositivos móveis (smartphones/tablets no balcão), mantendo a identidade visual corporativa do CLTempo.
- **Autenticação Segura:** Fluxo completo com cadastro (incluindo capacidade e turnover por porte de mesa), login com senha criptografada via SHA-256 e atalhos rápidos de demonstração para os restaurantes do piloto.
- **Prevenção Estrita de Conflito de Mesas:** Não é permitido alocar mesas já ocupadas (`ALOCADA`) ou bloqueadas (`INDISPONÍVEL`), retornando erro `HTTP 409 Conflict` e alertas claros ao operador.
- **Gestão em 3 Abas:** **Fila**, **Mesas** e **Perfil**, com contadores dinâmicos de clientes aguardando e ocupação de salão.
- **Ciclo de Vida em Português:** Transição transparente entre os estados `AGUARDANDO`, `CHAMADO`, `SENTADO`, `CANCELADO` e `ENCERRADO`.

---

## 2. Estrutura do Banco de Dados & Novas Tabelas

### 2.1 Remoção da coluna `baseline_wait_min`
A coluna `baseline_wait_min` foi formalmente removida da tabela `restaurants` via migração DDL (`ALTER TABLE restaurants DROP COLUMN baseline_wait_min`). O cálculo de redução de tempo em pé da Métrica M4 do Canvas agora utiliza a média do benchmark do polo corporativo (35 minutos), garantindo autonomia e precisão estatística.

### 2.2 Expansão da tabela `restaurants`
Foram adicionadas novas colunas para acomodar os parâmetros operacionais de cada restaurante cadastrado:
```sql
ALTER TABLE restaurants ADD COLUMN email TEXT;
ALTER TABLE restaurants ADD COLUMN password_hash TEXT;
ALTER TABLE restaurants ADD COLUMN turnover_1_2 INTEGER DEFAULT 25;
ALTER TABLE restaurants ADD COLUMN turnover_3_4 INTEGER DEFAULT 35;
ALTER TABLE restaurants ADD COLUMN turnover_5_plus INTEGER DEFAULT 45;
ALTER TABLE restaurants ADD COLUMN created_at TEXT;
```

### 2.3 Criação da tabela `restaurant_tables` (Mesas)
Devido ao fato de `TABLE` ser uma palavra reservada em dialetos SQL padrão (como SQLite e PostgreSQL), a tabela foi nomeada como `restaurant_tables`, representando fisicamente cada mesa do salão:
```sql
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_number INTEGER NOT NULL,
    table_type TEXT NOT NULL, -- '1-2', '3-4', '5+'
    status TEXT NOT NULL DEFAULT 'LIVRE', -- 'ALOCADA', 'LIVRE', 'INDISPONÍVEL'
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);
```

### 2.4 Atualização da tabela `queue_entries`
A tabela de reservas em fila foi expandida com:
- `table_number INTEGER`: Número da mesa física atribuída ao cliente.
- `checkin_at TEXT`: Horário em que o cliente ocupou a mesa presencialmente.
- Migração de status para o vocabulário em português:
  - `AGUARDANDO` (legado: `WAITING`)
  - `CHAMADO` (legado: `CALLED`)
  - `SENTADO` (legado: `SEATED`)
  - `CANCELADO` (legado: `CANCELLED`, `NO_SHOW`)
  - `ENCERRADO` (atendimento finalizado e mesa desocupada)

### 2.5 Criação da tabela `cuisines` & Seleção Padronizada por Chips
Para atender ao requisito de que o tipo de culinária seja escolhido pelo restaurante de forma análoga à do cliente (através de chips visuais interativos e opções consolidadas em banco de dados), foi criada a tabela `cuisines`:
```sql
CREATE TABLE IF NOT EXISTS cuisines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    icon TEXT,
    category_group TEXT
);
```

**12 Culinárias Padronizadas Populadas:**
- 💼 `Executivo` (Almoço Executivo)
- ⚖️ `Buffet a Quilo` (Buffet / Self-Service)
- 🍝 `Massas & Italiana` (Italiana & Pizzas)
- 🍣 `Japonês & Poke` (Asiática & Poke)
- 🥗 `Saladas & Saudável` (Saudável & Bowls)
- 🥩 `Grelhados & Carnes` (Carnes & Churrasco)
- 🍔 `Hambúrguer & Artesanal` (Burgers & Sanduíches)
- 🥙 `Árabe & Contemporânea` (Árabe & Fusion)
- 🍲 `Brasileira & Típica` (Brasileira & Regional)
- 🍤 `Frutos do Mar` (Peixes & Frutos do Mar)
- 🌱 `Vegano & Vegetariano` (Plant-based & Veggie)
- ☕ `Cafeteria & Doces` (Cafés & Sobremesas)

Tanto na tela de **Cadastro** quanto na **Aba Perfil** do Restaurante, o campo de texto livre foi substituído por seletores visuais em formato de chips (`.cuisine-grid` / `.cuisine-chip`), com realce ativo e gravação no banco de dados.

---

## 3. Lógica de Numeração Consecutiva de Mesas

A geração de mesas foi automatizada por meio da função `generate_restaurant_tables(cur, restaurant_id, t_1_2, t_3_4, t_5_plus)` em `db.py`:

1. **Mesas de 1 a 2 lugares:** Numeradas de `1` até $N_{1-2}$.
2. **Mesas de 3 a 4 lugares:** Numeradas de $N_{1-2} + 1$ até $N_{1-2} + N_{3-4}$.
3. **Mesas de 5+ lugares:** Numeradas de $N_{1-2} + N_{3-4} + 1$ até o total geral de mesas.

> **Exemplo Prático (Bistrô Carioca com 8 mesas 1-2, 6 mesas 3-4 e 2 mesas 5+):**
> - Mesas 1 a 8: Porte `1-2`
> - Mesas 9 a 14: Porte `3-4`
> - Mesas 15 a 16: Porte `5+`
> 
> Todas as mesas são inicializadas com status `LIVRE`.

---

## 4. Módulo Backend: `restaurant_api.py`

O arquivo [restaurant_api.py](restaurant_api.py) encapsula integralmente as regras de negócio de atendimento e gestão física:

| Função | Comportamento Técnico |
| :--- | :--- |
| `handle_restaurant_register(body)` | Cadastra o restaurante, calcula hash da senha, geocodifica o endereço, insere na tabela `restaurants` e invoca `generate_restaurant_tables` gerando as mesas numeradas. Retorna HTTP 201 Created. |
| `handle_restaurant_login(body)` | Autentica via email e senha com verificação SHA-256 e suporte a atalhos de seed. Retorna HTTP 200 OK ou 401 Unauthorized. |
| `handle_restaurant_get_profile(id)` | Retorna os dados do restaurante com quantitativo consolidado de mesas por status. |
| `handle_restaurant_profile_update(id, body)` | Atualiza dados cadastrais, culinária, VRs aceitos e tempos de giro por porte de mesa. |
| `handle_restaurant_profile_delete(id)` | Cancela filas ativas pendentes, remove mesas e apaga o registro do restaurante. |
| `handle_restaurant_get_tables(id)` | Retorna lista de mesas ordenadas por `table_number`, com junção à fila ativa para identificar clientes que ocupam mesas `ALOCADA`. |
| `handle_restaurant_call_client(body)` | Valida disponibilidade da mesa solicitada (ou seleciona a menor mesa livre do porte). Impede alocação se já estiver ocupada (HTTP 409). Altera status da mesa para `ALOCADA` e da reserva para `CHAMADO`. |
| `handle_restaurant_change_table(body)` | Altera a mesa alocada para um cliente chamado. Valida se a nova mesa está `LIVRE` (HTTP 409 se ocupada), libera a mesa anterior para `LIVRE` e aloca a nova. |
| `handle_restaurant_seat_client(body)` | Confirma a presença do cliente à mesa, definindo o status para `SENTADO` com timestamp em `checkin_at`. |
| `handle_restaurant_cancel_client(body)` | Cancela a reserva (`CANCELADO`), registra motivo e libera imediatamente a mesa alocada para `LIVRE`. |
| `handle_restaurant_finish_table(body)` | Conclui a refeição, definindo a mesa como `LIVRE` e a reserva como `ENCERRADO` (`completed_at`). |
| `handle_restaurant_set_table_status(body)` | Alterna a disponibilidade operacional da mesa entre `LIVRE` e `INDISPONÍVEL` (impede alteração se a mesa estiver `ALOCADA`). |
| `handle_restaurant_walkin(body)` | Registra cliente presencial de balcão diretamente na fila com status `AGUARDANDO`. |
| `handle_restaurant_toggle(body)` | Alterna status `is_open` (aberto para novas entradas na fila ou pausado). |

---

## 5. Endpoints REST no `app.py`

O servidor HTTP em [app.py](app.py) foi atualizado para rotear os novos endpoints REST e transmiti-los via Server-Sent Events (SSE):

- `POST /api/restaurant/register`
- `POST /api/restaurant/login`
- `GET /api/restaurant/profile?restaurant_id=X`
- `POST /api/restaurant/profile/update`
- `POST /api/restaurant/profile/delete`
- `GET /api/restaurant/tables?restaurant_id=X`
- `POST /api/restaurant/call`
- `POST /api/restaurant/change-table`
- `POST /api/restaurant/seat`
- `POST /api/restaurant/cancel`
- `POST /api/restaurant/finish-table`
- `POST /api/restaurant/table/status`
- `POST /api/restaurant/walkin`
- `POST /api/restaurant/toggle`

---

## 6. Frontend da Interface Restaurante (`static/app.js` e `styles.css`)

### 6.1 Tela Inicial de Autenticação (Login & Cadastro)
- **Harmonização com a Interface Cliente:** Utiliza container de cartão limpo (`.auth-box.card` com `max-width: 440px`), cabeçalho centralizado com ícone `🧑‍🍳`, título *CLTempo Restaurante* e subtítulo *Seu restaurante em primeiro lugar.*
- **Abas de Navegação:** Alternância intuitiva entre *Entrar* e *Cadastrar-se* via `.auth-tabs`.
- **Acesso Rápido para a Banca Examinadora (Demo):** Seção posicionada na base com divisor pontilhado e botões compactos em linha para os 5 restaurantes parceiros oficiais cadastrados no MVP:
  - 🍲 **Bistrô do Ouvidor** (`bistro@cltempo.com.br`)
  - 🥩 **Grão & Brasa Corporativo** (`grao@cltempo.com.br`)
  - 🍝 **Pasta & Basta Express** (`pasta@cltempo.com.br`)
  - 🍣 **Koji Sushi Executivo** (`sushi@cltempo.com.br`)
  - 🥗 **Verde & Fresco Saladas** (`verde@cltempo.com.br`)
- **Formulário de Cadastro Completo:**
  - Nome, e-mail comercial, senha e telefone/WhatsApp.
  - Culinária (seleção por chips) e endereço com autocomplete Google Maps e coordenadas em tempo real.
  - Multi-seleção de Vales-Refeição aceitos (chips interativos: *Alelo, Ticket, Sodexo / Pluxee, VR Refeição, Flash, Caju, Swile, iFood Benefícios*).
  - Tempos médios de giro por tipo de mesa (1-2, 3-4, 5+ lugares).
  - Quantidade de mesas disponíveis por tipo de mesa (1-2, 3-4, 5+ lugares).
  - Botão principal `Concluir Cadastro` (`btn btn-primary btn-block btn-lg`).

### 6.2 Aba Fila (Espera com Sugestão de Mesa & Chamados)
- **Parte Superior (Fila de Espera - `AGUARDANDO`):**
  - Ordenada da chegada mais antiga para a mais recente (`joined_at`).
  - **Sinalização Dinâmica:** Identifica em tempo real a menor mesa livre compatível com o porte da reserva (ex: `🟢 MESA 2`). Se não houver mesas livres para aquele porte no momento, sinaliza claramente `🔴 MESA INDISPONÍVEL`.
  - **Modal de Chamada:** Ao clicar em *Chamar Cliente*, exibe modal com o cliente, porte e seletor de mesa. Pré-seleciona a sugestão da menor mesa livre. Se o operador selecionar uma mesa alocada ou indisponível, o sistema impede a ação e emite aviso toast de conflito.
- **Parte Inferior (Chamados no Balcão - `CHAMADO`):**
  - Ordenado pela chamada mais antiga (`called_at`).
  - Exibe o número da mesa atribuída e o horário de chamada.
  - Ações diretas:
    1. **Alterar Mesa:** Abre modal para trocar para outra mesa `LIVRE` (com validação estrita).
    2. **Check-in (Sentado):** Confirma a presença física do cliente à mesa (`SENTADO`).
    3. **Cancelar Reserva:** Cancela a reserva e libera imediatamente a mesa para `LIVRE`.
- **Walk-in Presencial:** Formulário rápido de balcão integrado para clientes sem celular.

### 6.3 Aba Mesas (Alocadas, Livres e Indisponíveis)
- **Parte Superior (Mesas Alocadas):** Cartões com destaque roxo indicando número da mesa, porte, nome do cliente que a ocupa e horário de acomodação. Botão direto para **Encerrar Pedido**, liberando a mesa de volta para `LIVRE` e marcando a reserva como `ENCERRADO`.
- **Parte do Meio (Mesas Livres):** Cartões verdes indicando disponibilidade. Botão para marcar a mesa como `INDISPONÍVEL` (em caso de manutenção ou reserva prévia).
- **Parte Inferior (Mesas Indisponíveis):** Cartões cinzas com botão para restaurar o status para `LIVRE`.

### 6.4 Aba Perfil (Edição, Status da Fila, Exclusão e Logout)
- Edição de dados cadastrais, culinária, telefone e tempos médios de giro.
- **Edição da Quantidade de Mesas Disponíveis por Porte (1-2, 3-4, 5+ lugares)** com sincronização imediata do salão e da numeração consecutiva.
- Botão/toggle para abrir ou pausar a fila digital (`is_open`).
- Botão seguro de exclusão de cadastro com modal de confirmação.
- Botão de logout da conta do restaurante.

---

## 7. Ajustes Sincronizados na Aba Fila do Cliente

Para atender às solicitações de simplificação e clareza da experiência do cliente:
1. **Remoção do código do ticket `#CLT-XXX`:** O identificador numérico foi retirado do cartão de reserva ativa.
2. **Exibição do Status Atual em Português:** No lugar do antigo texto *"Fila Mesa X-X lugares"*, o cliente agora visualiza seu status operacional explícito em badges coloridos:
   - `⏳ AGUARDANDO` (laranja)
   - `🔔 CHAMADO` (verde)
   - `🪑 SENTADO` (azul)
   - `⚠️ CANCELADO` (âmbar)
   - `✅ ENCERRADO` (cinza)
3. **Mesa Atribuída:** Quando o status muda para `CHAMADO` ou `SENTADO`, o cliente visualiza com destaque a mesa designada: `🪑 Mesa X` com a instrução clara *"Dirija-se à Mesa X"*.
4. **Histórico de Reservas:** As reservas passadas são exibidas categorizadas unicamente como `Atendido` ou `Cancelado`.

---

---

## 8. Sincronização de Cancelamento, Tempo Decorrido e Autocomplete Google Maps

### 8.1 Sincronização Imediata de Cancelamento & Bloqueio de Check-in Indevido
- **Causa Raiz Corrigida:** Anteriormente, o endpoint `/api/client/active-ticket` retornava `{"active_ticket": None}` sem o atributo `"ok": True` quando o ticket era cancelado. O frontend cliente avaliava a resposta como inválida e mantinha em cache o ticket anterior no status `CHAMADO`, permitindo que o cliente clicasse em confirmar check-in. Além disso, o broadcast disparava o evento `"queue_cancelled"`, enquanto o frontend aguardava `"queue_cancel"`.
- **Solução Implementada:**
  1. `client_api.py` atualizado para retornar explicitamente `{"ok": True, "active_ticket": None}` quando não há ticket ativo.
  2. `restaurant_api.py` no handler `handle_restaurant_seat_client` agora valida estritamente o status da reserva: se a reserva estiver em `CANCELADO` (`CANCELLED` ou `NO_SHOW`), rejeita com `HTTP 400 Bad Request` e a mensagem: *"Esta chamada foi cancelada pelo restaurante e não pode ser confirmada."*
  3. `static/app.js` escuta tanto `"queue_cancel"` quanto `"queue_cancelled"`, limpando imediatamente `appState.clientActiveTicket = null`, exibindo toast informativo e re-renderizando a interface de forma reativa.

### 8.2 Lógica de Tempo de Espera Real Decorrido do Cliente
- **Regra de Negócio:** Para a operação do restaurante, a informação crucial não é o tempo médio projetado de espera futuro, mas sim **há quanto tempo aquele cliente específico está esperando na fila** desde seu registro (`joined_at`), e para chamados, há quantos minutos foi efetuada a chamada (`called_at`).
- **Implementação Técnica:**
  - Na função `build_state()` em `app.py`, foi implementado o cálculo de minutos decorridos:
    $$\text{elapsed\_wait\_min} = \max(1, \text{hora\_atual} - \text{joined\_at})$$
    $$\text{elapsed\_called\_min} = \max(1, \text{hora\_atual} - \text{called\_at})$$
  - Na Interface do Restaurante (`renderRestaurantFilaTab`), a lista de clientes aguardando é **ordenada decrescentemente pelo tempo de espera** (`b.elapsed_wait_min - a.elapsed_wait_min`), garantindo que o cliente que aguarda há mais tempo fique sempre no topo:
    $$\text{⏱️ Esperando na fila há } X\text{ min • Chegou às } HH:MM$$
  - Para clientes chamados no balcão:
    $$\text{🔔 Chamado há } Y\text{ min (Mesa } Z\text{)}$$
  - No banco de dados (`db.py`), as sementes da demonstração foram atualizadas com `timedelta` relativo ao horário atual para garantir tempos sempre realistas (ex: 14 min, 10 min, 7 min, etc.).

### 8.3 Autocomplete de Endereço com Google Maps no Restaurante
- **Experiência Idêntica à do Cliente:**
  - Tanto no **Cadastro do Restaurante** (`regRestAddress`) quanto na **Aba Perfil** (`profRestAddress`), os campos de endereço foram equipados com autocomplete dinâmico baseado na API do Google Maps Places.
  - Ao digitar, um dropdown suspenso (`.autocomplete-dropdown`) sugere endereços corporativos e comerciais do Centro do Rio de Janeiro com latitude e longitude pré-geocodificadas (ex: Rua do Ouvidor, Rua da Quitanda, Rua Sete de Setembro, Av. Rio Branco).
  - Ao selecionar um local, o sistema exibe o badge visual de confirmação:
    `📍 Google Maps: -22.9030, -43.1770 (localizado)`
  - Os valores exatos de `lat` e `lng` são enviados na carga útil (`POST /api/restaurant/register` e `POST /api/restaurant/profile/update`), garantindo posicionamento geográfico de alta precisão no cálculo de raio e proximidade para os clientes.

### 8.4 Correção da Visibilidade do Restaurante na Busca com Clientes na Fila
- **Causa Raiz Identificada:** A fórmula de estimativa de espera `calc_category_wait_min` dividia a vazão paralela de mesas por `tables_count / 5.0`. Em restaurantes com 6 mesas e giro de 35 min, a entrada de apenas 1 cliente na fila fazia a estimativa para o próximo saltar de imediato para 50 minutos. Como o filtro padrão da tela de busca (`max_wait_min`) estava definido em 45 minutos, o restaurante era sumariamente excluído da lista de busca dos demais clientes (`est_wait_min > max_wait`).
- **Solução Implementada:**
  1. Em `db.py` (`calc_category_wait_min`), a fórmula de vazão paralela foi corrigida para escalonar diretamente pela quantidade real de mesas da categoria ($\text{tables} = \max(1, \text{tables\_count})$):
     $$\text{est\_wait\_min} = \max\left(2, \left\lceil \frac{\text{position} \times \text{cat\_turnover}}{\text{tables}} \right\rceil\right)$$
     Para 1 cliente na fila em restaurante com 6 mesas, a espera agora é estimada com precisão em ~10 a 12 min (em vez de 50 min).
  2. Em `client_api.py`, o filtro de tempo de espera foi ajustado para só restringir restaurantes caso o usuário tenha ajustado ativamente o slider para um tempo menor que 60 minutos (`if max_wait is not None and max_wait < 60 and est_wait_min > max_wait: continue`).
  3. No frontend (`static/app.js`), o filtro padrão foi definido em 60 min (*"Até 60 min (Sem limite)"*), garantindo que todos os restaurantes permaneçam visíveis para novos clientes mesmo com filas ativas.

### 8.5 Fundo Branco e Alto Contraste no Modal "Chamar Cliente para a Mesa"
- **Melhoria Visual & Acessibilidade:**
  - O modal de chamada (`renderRestaurantCallModal`) e de troca de mesa (`renderRestaurantChangeTableModal`) receberam fundo branco puro (`background: #ffffff !important;`) com tipografia escura de alto contraste (`color: #0f172a !important;`), eliminando a sobreposição escura anterior que dificultava a leitura.
  - O cartão de informações do cliente agora utiliza fundo claro (`#f8fafc`) com borda suave (`#e2e8f0`), realçando o nome do cliente, porte de mesa e tempo aguardado.
  - O seletor de mesa física (`#selectCallTable`) possui destaque de mesa sugerida, indicação de status e bloqueio visual de mesas ocupadas.
  - Regra CSS `.modal-card` adicionada formalmente ao `styles.css`.

### 8.6 Edição do Quantitativo de Mesas Disponíveis na Aba Perfil
- **Requisito Atendido:** Permitir que o restaurante altere livremente o número de mesas disponíveis por porte (`tables_1_2`, `tables_3_4`, `tables_5_plus`) diretamente pela aba **Perfil**.
- **Regras Operacionais e de Integridade Implementadas:**
  1. **Interface do Restaurante:** Grade de inputs numéricos adicionada ao formulário de perfil logo abaixo do tempo de giro, populada com os valores atuais do restaurante (`profRestTables12`, `profRestTables34`, `profRestTables5Plus`).
  2. **Validação Estrita de Salão:** Caso o operador tente reduzir a quantidade de mesas para um número inferior ao de mesas daquele porte que estejam atualmente ocupadas (`ALOCADA`) por clientes chamados ou sentados, o backend rejeita a solicitação com `HTTP 400 Bad Request` e mensagem explicativa (ex: *"Não é possível definir menos de 2 mesa(s) de 1-2 lugares pois estão atualmente alocadas a clientes"*).
  3. **Preservação de Status:** A função `generate_restaurant_tables` em `db.py` foi aprimorada para preservar automaticamente o status `ALOCADA` das mesas ocupadas e garantir que clientes ativos não tenham seu atendimento corrompido durante o redimensionamento do salão.
  4. **Renumeração Consecutiva Automática:** As mesas físicas em `restaurant_tables` são imediatamente sincronizadas e renumeradas em ordem consecutiva a partir de 1:
     - 1 até $N_{1-2}$ para mesas de 1 a 2 lugares;
     - $N_{1-2} + 1$ até $N_{1-2} + N_{3-4}$ para mesas de 3 a 4 lugares;
     - $N_{1-2} + N_{3-4} + 1$ até o total geral para mesas de 5+ lugares.
  5. **Atualização Reativa:** A Aba Mesas e a Aba Fila refletem a nova capacidade do salão imediatamente após salvar.

### 8.7 Harmonização do Layout de Login/Cadastro e Correção dos Restaurantes Demo
- **Causa Raiz das Falhas de Login Demo:**
  1. O primeiro botão (*Bistrô Carioca*) continha o atributo `onclick=""` vazio, de modo que o clique não disparava nenhuma ação.
  2. O segundo botão (*Trattoria da Glória*) submetia `trattoria@cltempo.com.br`, enquanto o restaurante semeado na base de dados é *Pasta & Basta Express* (`pasta@cltempo.com.br`).
  3. O terceiro botão (*Brasa & Sabor*) submetia `brasa@cltempo.com.br`, enquanto o restaurante semeado na base de dados é *Grão & Brasa Corporativo* (`grao@cltempo.com.br`).
- **Solução no Backend (`restaurant_api.py`):**
  - Implementação de um dicionário de mapeamento de apelidos/aliases demo:
    - `"trattoria"` $\rightarrow$ `"pasta"`
    - `"brasa"` $\rightarrow$ `"grao"`
    - `"bistro"` / `"ouvidor"` $\rightarrow$ `"bistro"`
    - `"koji"` / `"sushi"` $\rightarrow$ `"sushi"`
    - `"verde"` $\rightarrow$ `"verde"`
  - A query de autenticação em `handle_restaurant_login` busca tanto pelo e-mail exato digitado quanto pelo alias resolvido, garantindo 100% de compatibilidade retroativa e facilidade de login.
- **Harmonização de Layout no Frontend (`static/app.js` e `static/styles.css`):**
  - O container da tela de autenticação deslogada foi convertido de `.restaurant-frame` para `.auth-box.card` (com `max-width: 440px`), garantindo que tanto o cliente quanto o restaurante compartilhem a mesma elegância visual, sem molduras falsas de celular antes do login.
  - Cabeçalho padronizado com logotipo 52x52 estilizado (`🧑‍🍳`), título *CLTempo Restaurante* e subtítulo institucional.
  - Na aba **Entrar**, os campos de e-mail e senha vêm primeiro com o botão `Acessar o CLTempo Restaurante`, seguidos pela seção inferior de *Acesso Rápido para a Banca (Demo)* separada por linha pontilhada (`border-top: 1px dashed var(--border)`).
  - Os botões demo agora utilizam os nomes e e-mails oficiais dos 5 restaurantes semeados.
  - Na aba **Cadastrar-se**, os chips de VR foram atualizados para utilizar a mesma lista padronizada da interface do cliente (`💳 ${vr}`) com texto de auxílio, e o botão de envio foi formatado como `btn btn-primary btn-block btn-lg` (*Concluir Cadastro*).

---

## 9. Verificação & Testes Automatizados

O sistema foi rigorosamente validado através de sete baterias de testes automatizados:

1. **Teste de Login Oficial e Resolução de Aliases dos Restaurantes Demo:**
   - Login com credenciais oficiais dos 5 restaurantes (*Bistrô do Ouvidor*, *Grão & Brasa*, *Pasta & Basta*, *Koji Sushi*, *Verde & Fresco*) via API retornando HTTP 200 OK e dados sem vazamento de senha.
   - Login via aliases (`trattoria@cltempo.com.br`, `brasa@cltempo.com.br`, `ouvidor@cltempo.com.br`, `koji@cltempo.com.br`) resolvendo para os restaurantes corretos.
   - Bloqueio estrito de senhas incorretas (HTTP 401) e campos vazios (HTTP 400).
   - **Resultado:** 100% de sucesso.

2. **Teste de Alteração do Quantitativo de Mesas no Perfil:**
   - Atualização de mesas do Bistrô do Ouvidor para 12 (1-2), 9 (3-4) e 5 (5+), totalizando 26 mesas.
   - Verificação da renumeração consecutiva de 1 a 26 no banco de dados.
   - Validação da preservação do status `ALOCADA` da mesa ocupada.
   - Bloqueio estrito de redução indevida de mesas abaixo da ocupação atual com erro 400.
   - **Resultado:** 100% de sucesso.

2. **Teste de Visibilidade com Fila Ativa & Estilização:**
   - Validação de que restaurantes novos e do piloto (ex: *KiSabor*, *Bistrô do Ouvidor*) permanecem 100% visíveis nos resultados de busca para todos os clientes enquanto há clientes aguardando na fila.
   - Cálculo de espera realista (~10-12 min) com múltiplos clientes na fila.
   - Verificação do fundo branco `#ffffff` e tipografia de alto contraste dos modais operacionais.
   - **Resultado:** 100% de sucesso.

1. **Teste de Fluxo de Salão e Conflitos:**
   - Cadastro de restaurante e geração de mesas 1 a 7 consecutivas.
   - Autenticação e entrada de cliente na fila (`AGUARDANDO`).
   - Chamada com alocação da Mesa 1 e verificação de conflito 409 ao tentar alocar a Mesa 1 para outro cliente.
   - Troca de mesa com prevenção de conflito e liberação da mesa anterior.
   - Check-in presencial (`SENTADO`) e sincronização no ticket do cliente.
   - Encerramento do atendimento (`finish-table`) com liberação da mesa para `LIVRE` e marcação de status `ENCERRADO`.
   - Alternância operacional `LIVRE` $\leftrightarrow$ `INDISPONÍVEL`.
   - Cancelamento com liberação imediata de mesa.
   - Compilação e execução de `build_state()`.
   - **Resultado:** 100% de sucesso.

2. **Teste de Cancelamento, Tempo Decorrido e Autocomplete:**
   - Chamada de cliente pelo restaurante e validação do ticket ativo como `CHAMADO`.
   - Cancelamento da chamada pelo restaurante e verificação de que `handle_client_active_ticket` retorna `{"ok": True, "active_ticket": None}`.
   - Bloqueio estrito de check-in em ticket cancelado com `HTTP 400 Bad Request`.
   - Verificação dos campos `elapsed_wait_min` e `elapsed_called_min` em `build_state()`.
   - Autocomplete de endereço do restaurante retornando coordenadas geográficas.
   - **Resultado:** 100% de sucesso.

3. **Teste dos Handlers HTTP:**
   - Validação de rotas GET e POST (`/api/state`, `/api/restaurant/login`, `/api/restaurant/tables`, `/api/restaurant/toggle`, `/api/restaurant/places/autocomplete`).
   - **Resultado:** 100% de sucesso.

4. **Teste de Renderização da SPA:**
   - Validação via Node.js da renderização de todas as telas e abas da Interface do Cliente e Interface do Restaurante (Login, Cadastro com autocomplete, Fila com tempo decorrido, Mesas com 3 seções, Perfil com coordenadas geocodificadas e Modais de chamada/troca).
   - **Resultado:** 100% de sucesso.
