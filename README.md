# CLTempo — Fila digital para o almoço do CLT

MVP da disciplina de **Empreendedorismo (UFRJ — 2026.2)**.
Grupo: Arthur Monteiro, Carolina Falcão, Fernando Bruzzi e Vivian Souza.

Trabalhadores CLT do polo corporativo do Centro do Rio perdem de 30 a 40 minutos do almoço em pé na fila dos restaurantes. Com o CLTempo, o cliente entra na fila pelo celular ainda no escritório, acompanha a posição em tempo real e é avisado quando a mesa fica pronta. O restaurante gerencia fila e mesas num painel simples, e a equipe acompanha no painel administrativo as 4 métricas que validam as hipóteses do [MVP Canvas](docs/Canva.txt).

## Como rodar

### Opção 1: Python (sem instalar nada)

Precisa de **Python 3.9 ou mais novo**. O projeto não tem dependências externas.

```bash
python3 app.py          # porta padrão 8765
python3 app.py 9000     # ou outra porta
```

Abra **http://localhost:8765**.

Na primeira execução, o banco `mvp_filas.db` é criado e populado sozinho com os dados de demonstração. Esse arquivo fica fora do git.

### Opção 2: Docker

```bash
docker compose up --build
```

Abra **http://localhost:8765**. O banco fica salvo em `./data/mvp_filas.db` e não se perde quando o contêiner reinicia.

### Variáveis de ambiente (todas opcionais)

| Variável | Para que serve |
| :--- | :--- |
| `PORT` | Porta do servidor (padrão `8765`). |
| `DB_PATH` | Caminho do arquivo SQLite (padrão `./mvp_filas.db`). |
| `GOOGLE_MAPS_API_KEY` | Usa Google Geocoding/Places no autocomplete de endereços. Sem a chave, o app usa o catálogo do polo e o OpenStreetMap (gratuito). |
| `CLTEMPO_DISABLE_OSM=1` | Desliga a busca no OpenStreetMap (útil sem internet e nos testes). |

## Contas de demonstração

Todas as contas usam a senha **`123456`**. Também há botões de acesso rápido nas telas de login.

| Tipo | E-mails |
| :--- | :--- |
| Cliente | `vivian@cltempo.com.br`, `arthur@cltempo.com.br`, `carolina@cltempo.com.br`, `fernando@cltempo.com.br` |
| Restaurante | `bistro@`, `grao@`, `pasta@`, `sushi@`, `verde@` (todos `@cltempo.com.br`) |

O botão **↺ Resetar**, no topo, restaura os dados originais.

## Roteiro de demonstração

1. Abra duas janelas lado a lado: uma na aba **📱 App Cliente** (login como Vivian) e outra em **🧑‍🍳 Restaurante** (login como Verde & Fresco).
2. No cliente, escolha o restaurante, confirme a reserva e permita as notificações do navegador quando ele pedir.
3. No restaurante, clique em **Chamar Cliente** e escolha a mesa. O cliente recebe na hora som, vibração (no celular), notificação do navegador e um aviso na tela.
4. O cliente confirma a chegada (ou o restaurante faz o check-in) e responde **"Quanto tempo você ficou em pé?"**. Essa resposta alimenta a métrica M4.
5. Na aba **📊 Administrador**, veja as métricas atualizadas e registre um restaurante abordado no funil (M1).

## Métricas do MVP Canvas

| Métrica | Origem dos dados |
| :--- | :--- |
| **M1:** conversão de restaurantes abordados | Funil preenchido pela equipe na aba Administrador. |
| **M2:** entradas na fila por usuário/semana | Entradas registradas em `queue_entries`. |
| **M3:** taxa de desistência | Reservas canceladas ÷ total de reservas. |
| **M4:** redução do tempo em pé | Tempo em pé relatado após o atendimento, comparado com o tempo em pé **sem o app** que cada cliente informa no cadastro, no perfil ou no primeiro feedback. |

Detalhes das fórmulas estão em [docs/ARQUITETURA_MVP.md](docs/ARQUITETURA_MVP.md#5-rastreabilidade-das-métricas-do-mvp-canvas).

## Estrutura do projeto

```
├── app.py               # Servidor HTTP, SSE (/api/events), roteamento e arquivos estáticos
├── client_api.py        # Cliente: cadastro, busca com score, fila, histórico, feedback, geolocalização
├── restaurant_api.py    # Restaurante: fila por porte de mesa, mesas, chamada, check-in, walk-in
├── admin_api.py         # Administrador: métricas M1–M4, funil de leads, reset da demo
├── db.py                # SQLite: schema, migrações automáticas e dados de demonstração
├── static/              # Frontend (HTML + CSS + JavaScript puro)
├── tests/               # Testes automatizados (unittest)
├── docs/                # Arquitetura, documentação das interfaces e MVP Canvas
├── Dockerfile
└── docker-compose.yml
```

## Testes

```bash
python3 -m unittest discover -s tests -v
```

Os testes usam um banco temporário e não precisam de internet.

## Documentação

- [Arquitetura do sistema](docs/ARQUITETURA_MVP.md): visão C4, modelo de dados, fluxos, endpoints e métricas
- [Interface do cliente](docs/IMPLEMENTACAO_CLIENTE.md)
- [Interface do restaurante](docs/IMPLEMENTACAO_RESTAURANTE.md)
- [MVP Canvas](docs/canvas_mvp.jpeg) e [notas do Canvas](docs/Canva.txt)

## Limitações conhecidas

- **Sem autenticação no servidor:** o login fica só no navegador e as rotas confiam nos IDs enviados. Isso basta para a demonstração, mas precisa ser resolvido antes de um piloto com usuários reais.
- **Alertas dependem da aba aberta:** o som, a vibração e a notificação funcionam com o app aberto, mesmo em segundo plano. Para avisar com o navegador fechado seria preciso um Service Worker com Web Push.
