# IMPLEMENTAÇÃO DO CLIENTE & ARQUITETURA MODULAR — CLTempo

Documento consolidado de especificação técnica e registro de todas as implementações, reestruturações, migrações de banco de dados e refinamentos realizados no ecossistema do **CLTempo** (anteriormente *FilaZero CLT*), com foco aprofundado na **Interface do Cliente**, na **arquitetura de microsserviços modular em Python**, na **universalização com Docker** e nas **correções solicitadas para o MVP da disciplina de Empreendedorismo (UFRJ 2026.2)**.

---

## 📑 Sumário

1. [Visão Geral & Rebranding](#1-visão-geral--rebranding)
2. [Arquitetura Modular do Backend](#2-arquitetura-modular-do-backend)
3. [Universalização e Implantação com Docker](#3-universalização-e-implantação-com-docker)
4. [Banco de Dados & Migração da Tabela `clients`](#4-banco-de-dados--migração-da-tabela-clients)
5. [Interface do Cliente (Mobile & Desktop)](#5-interface-do-cliente-mobile--desktop)
   - [5.1 Autenticação, Cadastro e Multi-seleção de VR](#51-autenticação-cadastro-e-multi-seleção-de-vr)
   - [5.2 Aba Buscar: Filtros, Geocoding e Algoritmo de Score](#52-aba-buscar-filtros-geocoding-e-algoritmo-de-score)
   - [5.3 Aba Fila: Acompanhamento em Tempo Real & Histórico](#53-aba-fila-acompanhamento-em-tempo-real--histórico)
   - [5.4 Aba Perfil: Gestão de Dados e Edição de VR](#54-aba-perfil-gestão-de-dados-e-edição-de-vr)
6. [Hotfixes & Ajustes Realizados](#6-hotfixes--ajustes-realizados)
7. [Como Executar e Testar](#7-como-executar-e-testar)

---

## 1. Visão Geral & Rebranding

O projeto foi totalmente reformulado a partir da proposta original:
- **Nova Identidade Visual e Nomenclatura:** O produto passou a se chamar oficialmente **CLTempo** (eliminando a nomenclatura *FilaZero CLT*).
- **Proposta de Valor Central:** Reduzir o tempo de espera em pé na hora do almoço dos trabalhadores em regime CLT no polo corporativo do Centro do Rio de Janeiro de **~35-40 minutos** para **menos de 3 minutos**, permitindo reservas remotas, acompanhamento da fila em tempo real, roteamento geográfico e contato direto via WhatsApp Comercial.
- **Design Responsivo Duplo:** Interface ajustada tanto para telas de computadores (desktop) quanto para navegadores móveis (smartphones), simulando a experiência de um aplicativo nativo (Phone Frame responsivo).

---

## 2. Arquitetura Modular do Backend

O antigo monólito [app.py](app.py) foi desmembrado em **três submódulos especializados por interface**, mantendo o ponto de entrada principal (`main`) e a infraestrutura de rede e eventos em `app.py`:

```
MVP_empreendedorismo/
├── app.py                  # Ponto de entrada (Main), Servidor HTTP multithread, SSE e Roteador Central
├── client_api.py           # Interface CLIENTE (Auth, Busca com Score, Filas, Histórico, VR e Perfil)
├── restaurant_api.py       # Interface RESTAURANTE (Painel do Salão, Mesas 1-2/3-4/5+, Check-in, Walk-in)
├── admin_api.py            # Interface ADMINISTRADOR (Dashboard M1–M4 Canvas, Funil de Leads e Reset)
├── db.py                   # Camada de Persistência SQLite, Migrações, Haversine e Seed de Dados
├── Dockerfile              # Imagem conteinerizada leve em Python 3.11-slim
├── docker-compose.yml      # Orquestração com volume persistente para mvp_filas.db
├── .dockerignore           # Exclusão de arquivos temporários e caches
├── static/
│   ├── index.html          # Shell HTML semântico com modais e notificações toast
│   ├── styles.css          # Design System moderno, responsivo, temas Claro/Escuro
│   └── app.js              # SPA reativa com SSE, controle de abas, geocoding e autocomplete
└── mvp_filas.db            # Banco de dados SQLite persistente
```

### Detalhamento das Responsabilidades:

| Módulo | Responsabilidade Técnica |
| :--- | :--- |
| **`app.py`** | Servidor multithread baseado em `http.server` (`ReusableThreadingHTTPServer`), corretor de **Server-Sent Events (SSE)** em tempo real (`/api/events`), função agregadora de estado consolidado (`build_state`), despachante de rotas GET/POST e serviço de arquivos estáticos. |
| **`client_api.py`** | Toda a lógica de negócio do cliente corporativo: cadastro, criptografia SHA-256 de senhas, login, autocomplete do Google Places, geolocalização de endereços, algoritmo de ordenação de busca por relevância com teto de 100 pontos, entrada e cancelamento de fila, histórico de refeições, atualização cadastral e gestão de Vales-Refeição. |
| **`restaurant_api.py`** | Operação do salão físico: controle das filas por porte de mesa (`1-2`, `3-4`, `5+`), avanço de fila (`call`), confirmação de presença (`seat`), ausência (`noshow`), desistência (`cancel`), entrada presencial manual (`walkin`) e abertura/fechamento do restaurante. |
| **`admin_api.py`** | Consolidação das 4 métricas do Canvas de Empreendedorismo (M1 Conversão, M2 Frequência semanal, M3 Taxa de Desistência, M4 Redução de tempo em pé), funil de prospecção comercial de restaurantes e reset da demonstração. |
| **`db.py`** | Gerenciador de conexão thread-safe com locks (`db_lock`), schema DDL, migrações idempotentes, cálculo de distância real via fórmula de Haversine, cálculo determinístico de espera com base no turnover e populamento inicial de clientes e restaurantes parceiros. |

---

## 3. Universalização e Implantação com Docker

Para garantir que a aplicação funcione em qualquer sistema operacional (macOS, Linux, Windows) sem conflitos de dependências ou versões do interpretador, foi criada a conteinerização completa:

- **[Dockerfile](Dockerfile):** Utiliza imagem base `python:3.11-slim`, define diretório de trabalho `/app`, expõe a porta `8765` e inicia o servidor via `python -u app.py`.
- **[docker-compose.yml](docker-compose.yml):**
  - Mapeia a porta `8765:8765`.
  - Mapeia o volume local `./mvp_filas.db:/app/mvp_filas.db` para que os dados cadastrados pelos usuários permaneçam salvos mesmo se o contêiner for reiniciado.
  - Define política de reinicialização `unless-stopped`.
- **[.dockerignore](.dockerignore):** Garante builds rápidos ignorando arquivos `__pycache__`, `.git`, `.DS_Store` e arquivos de log.

---

## 4. Banco de Dados & Migração da Tabela `clients`

### 4.1 Renomeação de `users` para `clients`
A tabela de usuários foi renomeada para `clients` para refletir estritamente o público-alvo CLT corporativo, mantendo retrocompatibilidade com chaves estrangeiras de reservas anteriores (`queue_entries`).

### 4.2 Estrutura da Tabela `clients`
```sql
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    phone TEXT,
    workplace TEXT,
    pref_food_1 TEXT,
    pref_food_2 TEXT,
    pref_food_3 TEXT,
    role TEXT DEFAULT 'CLT Polo',
    company TEXT DEFAULT 'Empresa Polo Centro',
    vr_card TEXT DEFAULT 'Alelo / Flash',
    meal_vouchers TEXT DEFAULT 'Alelo, Ticket', -- Nova coluna adicionada
    lat REAL DEFAULT -22.9035,
    lng REAL DEFAULT -43.1780,
    created_at TEXT NOT NULL
);
```

### 4.3 Rotina de Migração e Backfill
O método `init_db()` em [db.py](db.py) verifica dinamicamente via `PRAGMA table_info(clients)` as colunas existentes e executa automaticamente comandos `ALTER TABLE clients ADD COLUMN ...` para quaisquer colunas que não existam em instalações prévias, além de preencher a nova coluna `meal_vouchers` com base nas informações existentes de cartões.

---

## 5. Interface do Cliente (Mobile & Desktop)

A interface do cliente foi projetada com layout responsivo simulando um smartphone corporativo moderno, incluindo topo informativo com status online e navegação inferior em 3 abas principais (**Buscar**, **Fila** e **Perfil**).

```
 ┌───────────────────────────────────────┐
 │ 📍 Edifício RB1 • Vivian Souza [Online]│
 ├───────────────────────────────────────┤
 │                                       │
 │         CONTEÚDO DA ABA ATIVA         │
 │     [ Buscar | Fila | Perfil ]        │
 │                                       │
 ├───────────────────────────────────────┤
 │   [🔍 Buscar]   [⏳ Fila]   [👤 Perfil] │
 └───────────────────────────────────────┘
```

---

### 5.1 Autenticação, Cadastro e Multi-seleção de VR

#### A. Início Direto na Aba "Buscar" ao Efetuar Login
- **Correção de Usabilidade:** Ao fazer login tradicional (e-mail e senha), ao usar os botões de demonstração rápida (Vivian, Arthur, Carolina, Fernando) ou ao concluir um novo cadastro, o sistema **redireciona imediatamente para a aba Buscar** (`appState.clientActiveTab = "buscar"`), permitindo que o cliente veja instantaneamente as opções de restaurantes e tempos de espera.

#### B. Multi-seleção de Vales-Refeição (VR) no Cadastro
- Durante o cadastro do cliente, além dos dados básicos (Nome, E-mail, Senha, WhatsApp, Local de Trabalho e 3 preferências culinárias), foi adicionada a seção interativa:
  - **Quais Vales-Refeição (VR) você possui? (Pode marcar mais de um)**
  - Bandeiras disponíveis: `Alelo`, `Ticket`, `Sodexo / Pluxee`, `VR Refeição`, `Flash`, `Caju`, `Swile`, `iFood Benefícios`.
  - O usuário pode selecionar livremente 1, 2, 3 ou mais opções de cartões.

#### C. Localização Automática do Local de Trabalho (Google Maps)
- Conforme o cliente digita o nome do prédio ou endereço no campo de trabalho, o sistema ativa um **dropdown de autocomplete** em tempo real com sugestões do Google Maps (ex: *Edifício RB1, Ventura Towers, Petrobras, Hub Financeiro, etc.*).
- Ao clicar em uma sugestão, a latitude e longitude exatas são capturadas e gravadas no perfil do cliente para cálculo de distância por raio geográfico.

---

### 5.2 Aba Buscar: Filtros, Geocoding e Algoritmo de Score

A aba Buscar oferece uma experiência de descoberta personalizada para a hora do almoço corporativo:

#### A. Teaser de Recomendações
Exibe um banner destacado no topo personalizado com as 3 culinárias preferidas cadastradas pelo usuário (ex: *Executivo*, *Buffet a Quilo*, *Massas*).

#### B. Filtros Combinados de Busca
- **Busca Textual:** Campo de pesquisa livre que busca simultaneamente pelo nome do restaurante ou pela culinária servida.
- **Chips Rápidos de Culinária:** Todos, Executivo, Buffet a Quilo, Massas, Japonês, Saladas & Saudável.
- **Slider de Tempo Máximo de Espera:** De 10 a 60 minutos (com indicador em tempo real).
- **Slider de Raio Geográfico:** De 0.5 km a 5.0 km em relação às coordenadas exatas do local de trabalho do cliente.
- **Porte de Mesa:** Mesas para 1 a 2 pessoas, 3 a 4 pessoas ou grupos de 5 ou mais pessoas.

#### C. Algoritmo de Score Balanceado (Teto Rigoroso de 100 Pontos)
Cada restaurante recebe uma pontuação calculada dinamicamente:
$$\text{Score} = \text{Espera} (35\text{ pts}) + \text{Proximidade} (25\text{ pts}) + \text{Preferências Gastronômicas} (30\text{ pts}) + \text{Status Aberto} (10\text{ pts})$$

- **Critérios detalhados:**
  1. **Tempo de espera na fila atual:** Até 35 pontos (quanto menor a fila atual do restaurante, maior a pontuação).
  2. **Proximidade geográfica (Haversine):** Até 25 pontos com base na distância entre o local de trabalho do cliente e o restaurante.
  3. **Compatibilidade culinária:** Até 30 pontos (10 pontos para cada uma das 3 preferências gastronômicas que casem com o cardápio do restaurante).
  4. **Restaurante em operação:** 10 pontos adicionais se o salão estiver aberto e recebendo clientes.
- **Teto Garantido:** A pontuação é limitada a no máximo 100 pontos (`min(100.0, total)`), sendo exibida no card como `★ Score X/100`.
- **Ordenação:** Os restaurantes retornam sempre em ordem decrescente de Score.

#### D. Modal de Detalhes do Restaurante
Ao clicar em qualquer restaurante:
- **Iframe Responsivo do Google Maps:** Mostra a localização exata do restaurante no mapa da cidade.
- **Tempo e Distância:** Distância em metros e tempo estimado de caminhada a pé.
- **WhatsApp Comercial Direto:** Botão verde oficial com link `https://wa.me/...` com mensagem pré-formatada para tirar dúvidas diretamente com o estabelecimento.
- **Botão "Confirmar Reserva":** Coloca o cliente na fila digital e **transiciona automaticamente para a aba Fila**.

---

### 5.3 Aba Fila: Acompanhamento em Tempo Real & Histórico

A aba Fila divide-se em duas seções essenciais:

#### A. Parte Superior: Reserva Atual Ativa
- Exibe o código único de check-in (`#CLT-XXX`).
- Mostra a posição em tempo real do grupo na fila para o porte de mesa selecionado.
- Cronômetro decorrido e tempo estimado restante em minutos (atualizados dinamicamente via Server-Sent Events).
- Botão direto para contato via **WhatsApp Comercial** com a recepção do restaurante.
- Botão para **Confirmar Check-in** (quando chamado para sentar à mesa).
- Opção para **Sair da Fila** (cancelamento com motivo registrado para alimentar a métrica M3 do Canvas).

#### B. Parte Inferior: Histórico de Reservas
- Tabela histórica consolidando todas as experiências passadas do cliente no polo.
- Informa data/hora, restaurante, porte da mesa e status final (`SEATED`, `CANCELLED`, `NO_SHOW`).

---

### 5.4 Aba Perfil: Gestão de Dados e Edição de VR

A aba Perfil permite controle completo da conta corporativa do cliente:
- Alteração de nome completo, WhatsApp, local de trabalho (com busca no Google Maps) e nova senha.
- Edição das 3 culinárias preferidas.

#### A. Visualização e Alteração Interativa de Vales-Refeição (VR):
- **Badge Clicável no Cabeçalho:** O topo do perfil exibe os cartões do cliente em um botão azul destacado:
  `💳 [Alelo, Ticket, Flash...] ✏️ Alterar`
  Ao clicar, abre-se uma janela modal para marcar/desmarcar cartões instantaneamente via endpoint `/api/client/profile/vr`.
- **Chips no Formulário de Perfil:** A grade de chips de VR também está embutida no próprio formulário, salvando todas as informações integradas no botão *"Salvar Alterações"*.

#### B. Zona de Perigo da Conta:
- Botão **Deslogar da Conta** (`🚪 Deslogar`).
- Botão **Apagar Perfil Cadastrado** (`🗑️ Apagar Perfil Cadastrado`), que remove o registro e cancela quaisquer reservas ativas do cliente para manter a consistência da fila.

---

## 6. Hotfixes & Ajustes Realizados

Durante a homologação técnica, foram aplicadas as seguintes melhorias específicas:

1. **Correção do Ponto de Partida pós-login:**
   - Garantido que `appState.clientActiveTab` seja sempre inicializado em `"buscar"`, tanto no login normal, no cadastro e nos atalhos rápidos quanto ao recarregar a página.

2. **Criação da Coluna `meal_vouchers` na Tabela `clients`:**
   - Adicionada ao schema do banco em [db.py](db.py), com migração automática via `init_db()` e suporte a multi-seleção de bandeiras.

3. **Autocomplete Google Places no Local de Trabalho:**
   - Implementado endpoint `/api/client/places/autocomplete` com suporte híbrido: consulta à API oficial do Google Maps quando `GOOGLE_MAPS_API_KEY` estiver definida no ambiente, ou catálogo corporativo do Centro do Rio de Janeiro como fallback de alta precisão.

4. **Teto Rigoroso de 100 Pontos no Score:**
   - O cálculo do algoritmo foi rebalanceado e encapsulado com `min(100.0, total)`, formatado visualmente como `★ Score X/100`.

5. **Exportação Global das Funções no DOM:**
   - Todas as funções de manipulação de VR e autocomplete (`toggleVRSelection`, `toggleProfileVRSelection`, `openEditVRModal`, `saveModalVRs`, `selectAutocompletePlace`) foram devidamente vinculadas ao escopo global do objeto `window`, prevenindo quaisquer erros de execução no navegador.

---

## 7. Como Executar e Testar

### Opção 1: Execução Direta via Python Nativo
```bash
python3 app.py
```
Acesse no navegador: **[http://localhost:8765](http://localhost:8765)**

---

### Opção 2: Execução Universal via Docker Compose
```bash
docker compose up --build
```
Acesse no navegador: **[http://localhost:8765](http://localhost:8765)**

---

### Roteiro de Teste Recomendado:
1. Abra [http://localhost:8765](http://localhost:8765).
2. Clique no atalho de demonstração **Vivian**.
3. Verifique que a tela abre imediatamente na aba **Buscar** com os restaurantes ordenados pelo Score.
4. Teste os sliders de **Tempo Máximo** e **Raio Geográfico**.
5. Clique em um restaurante para ver o **Google Maps**, porte de mesa e botão de **WhatsApp Comercial**.
6. Confirme a reserva e veja a transição automática para a aba **Fila**.
7. Vá para a aba **Perfil**, clique no badge de **VR** no cabeçalho e altere os cartões aceitos.
8. Deslogue e teste a tela de **Cadastro**, preenchendo o local de trabalho com sugestões automáticas e selecionando múltiplos vales-refeição.
