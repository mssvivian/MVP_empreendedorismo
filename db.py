#!/usr/bin/env python3
"""
CLTempo — Módulo de Banco de Dados e Persistência
Disciplina de Empreendedorismo - UFRJ (2026.2)
"""

import hashlib
import json
import math
import os
import sqlite3
import threading
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "mvp_filas.db"))
if os.path.dirname(DB_PATH):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
STATIC_DIR = os.path.join(BASE_DIR, "static")

db_lock = threading.Lock()


def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    """Gera hash SHA-256 seguro para a senha."""
    salt = "cltempo_salt_2026"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def get_table_category(party_size: int) -> str:
    p = int(party_size)
    if p <= 2:
        return "1-2"
    if p <= 4:
        return "3-4"
    return "5+"


def calc_category_wait_min(position: int, base_turnover_min: int, cat: str, tables_count: int) -> int:
    """
    Calcula o tempo estimado considerando:
    - posição na fila específica da categoria (1-2, 3-4 ou 5+)
    - quantidade de mesas daquela categoria no restaurante (vazão paralela)
    - fator de ocupação por tamanho do grupo
    """
    if position <= 0:
        return 0
    if cat == "1-2":
        cat_turnover = base_turnover_min * 0.85
    elif cat == "3-4":
        cat_turnover = base_turnover_min * 1.1
    else:
        cat_turnover = base_turnover_min * 1.6

    tables = max(1, int(tables_count or 1))
    return max(2, int(math.ceil((position * cat_turnover) / tables)))


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Fórmula de Haversine para calcular distância real em km."""
    R = 6371.0  # Raio da Terra em km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def generate_restaurant_tables(cur, restaurant_id: int, t_1_2: int, t_3_4: int, t_5_plus: int):
    """Gera mesas numeradas automaticamente de 1 em diante de acordo com a quantidade por tipo."""
    # Preserva status de mesas existentes (ALOCADA ou INDISPONÍVEL)
    cur.execute(
        "SELECT table_number, status FROM restaurant_tables WHERE restaurant_id = ?",
        (restaurant_id,),
    )
    preserved_statuses = {r["table_number"]: r["status"] for r in cur.fetchall()}

    # Garante que qualquer mesa com cliente chamado ou sentado permaneça ALOCADA
    cur.execute(
        """
        SELECT table_number FROM queue_entries 
        WHERE restaurant_id = ? AND status IN ('CHAMADO', 'SENTADO', 'CALLED', 'SEATED') AND table_number IS NOT NULL
        """,
        (restaurant_id,),
    )
    for r in cur.fetchall():
        preserved_statuses[r[0]] = "ALOCADA"

    cur.execute("DELETE FROM restaurant_tables WHERE restaurant_id = ?", (restaurant_id,))
    cur_num = 1
    # 1. Mesas até 2 lugares
    for _ in range(max(0, int(t_1_2 or 0))):
        st = preserved_statuses.get(cur_num, "LIVRE")
        cur.execute(
            "INSERT INTO restaurant_tables (restaurant_id, table_number, table_type, status) VALUES (?, ?, '1-2', ?)",
            (restaurant_id, cur_num, st),
        )
        cur_num += 1
    # 2. Mesas até 4 lugares
    for _ in range(max(0, int(t_3_4 or 0))):
        st = preserved_statuses.get(cur_num, "LIVRE")
        cur.execute(
            "INSERT INTO restaurant_tables (restaurant_id, table_number, table_type, status) VALUES (?, ?, '3-4', ?)",
            (restaurant_id, cur_num, st),
        )
        cur_num += 1
    # 3. Mesas mais de 5 lugares
    for _ in range(max(0, int(t_5_plus or 0))):
        st = preserved_statuses.get(cur_num, "LIVRE")
        cur.execute(
            "INSERT INTO restaurant_tables (restaurant_id, table_number, table_type, status) VALUES (?, ?, '5+', ?)",
            (restaurant_id, cur_num, st),
        )
        cur_num += 1


STANDARD_CUISINES = [
    ("Executivo", "💼", "Almoço Executivo"),
    ("Buffet a Quilo", "⚖️", "Buffet / Self-Service"),
    ("Massas & Italiana", "🍝", "Italiana & Pizzas"),
    ("Japonês & Poke", "🍣", "Asiática & Poke"),
    ("Saladas & Saudável", "🥗", "Saudável & Bowls"),
    ("Grelhados & Carnes", "🥩", "Carnes & Churrasco"),
    ("Hambúrguer & Artesanal", "🍔", "Burgers & Sanduíches"),
    ("Árabe & Contemporânea", "🥙", "Árabe & Fusion"),
    ("Brasileira & Típica", "🍲", "Brasileira & Regional"),
    ("Frutos do Mar", "🍤", "Peixes & Frutos do Mar"),
    ("Vegano & Vegetariano", "🌱", "Plant-based & Veggie"),
    ("Cafeteria & Doces", "☕", "Cafés & Sobremesas"),
]


def seed_cuisines(cur):
    """Popula a tabela de tipos de culinária padrão do ecossistema CLTempo."""
    for item in STANDARD_CUISINES:
        cur.execute(
            """INSERT OR IGNORE INTO cuisines (name, icon, category_group)
            VALUES (?, ?, ?)""",
            item,
        )


def init_db(force_reset=False):
    """Inicializa as tabelas do banco de dados e executa migrações necessárias."""
    with db_lock:
        if force_reset and os.path.exists(DB_PATH):
            os.remove(DB_PATH)

        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Migração: se a tabela antiga 'users' existir e 'clients' não, renomeia
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        has_users_table = cur.fetchone() is not None
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'")
        has_clients_table = cur.fetchone() is not None

        if has_users_table and not has_clients_table:
            cur.execute("ALTER TABLE users RENAME TO clients")

        # 2. Cria tabela clients se não existir
        cur.executescript(
            """
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
                meal_vouchers TEXT DEFAULT 'Alelo, Ticket',
                lat REAL DEFAULT -22.9035,
                lng REAL DEFAULT -43.1780,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS restaurants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT,
                category TEXT NOT NULL,
                cuisine_type TEXT DEFAULT 'Executivo',
                address TEXT NOT NULL,
                phone_whatsapp TEXT DEFAULT '5521999998888',
                distance_walk_min INTEGER NOT NULL DEFAULT 3,
                avg_turnover_min INTEGER NOT NULL DEFAULT 8,
                turnover_1_2 INTEGER NOT NULL DEFAULT 8,
                turnover_3_4 INTEGER NOT NULL DEFAULT 12,
                turnover_5_plus INTEGER NOT NULL DEFAULT 20,
                tables_1_2 INTEGER NOT NULL DEFAULT 10,
                tables_3_4 INTEGER NOT NULL DEFAULT 8,
                tables_5_plus INTEGER NOT NULL DEFAULT 3,
                is_open INTEGER NOT NULL DEFAULT 1,
                vr_accepted TEXT NOT NULL DEFAULT 'Alelo, Ticket, Sodexo / Pluxee, Flash',
                lat REAL DEFAULT -22.9030,
                lng REAL DEFAULT -43.1770,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS restaurant_tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                table_number INTEGER NOT NULL,
                table_type TEXT NOT NULL, -- '1-2', '3-4', '5+'
                status TEXT NOT NULL DEFAULT 'LIVRE', -- 'ALOCADA', 'LIVRE', 'INDISPONÍVEL'
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
            );

            CREATE TABLE IF NOT EXISTS queue_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                client_id INTEGER,
                user_id INTEGER, -- Mantido para compatibilidade
                customer_name TEXT NOT NULL,
                company_tag TEXT DEFAULT 'CLT Polo',
                party_size INTEGER NOT NULL DEFAULT 2,
                table_category TEXT NOT NULL DEFAULT '1-2',
                status TEXT NOT NULL, -- AGUARDANDO, CHAMADO, SENTADO, CANCELADO, ENCERRADO
                table_number INTEGER,
                checkin_code TEXT NOT NULL,
                cancel_reason TEXT,
                perceived_standing_wait_min INTEGER,
                joined_at TEXT NOT NULL,
                called_at TEXT,
                checkin_at TEXT,
                completed_at TEXT,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            );

            CREATE TABLE IF NOT EXISTS restaurant_leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_name TEXT NOT NULL,
                contact_person TEXT NOT NULL,
                region TEXT NOT NULL,
                status TEXT NOT NULL, -- ONBOARDED, IN_NEGOTIATION, APPROACHED, DECLINED
                notes TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cuisines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                icon TEXT,
                category_group TEXT
            );
            """
        )

        # 3. Adicionar colunas faltantes em clients se tabela já existia da versão anterior
        cur.execute("PRAGMA table_info(clients)")
        client_cols = [r["name"] for r in cur.fetchall()]
        cols_to_add = [
            ("email", "TEXT"),
            ("password_hash", "TEXT"),
            ("phone", "TEXT"),
            ("workplace", "TEXT"),
            ("pref_food_1", "TEXT"),
            ("pref_food_2", "TEXT"),
            ("pref_food_3", "TEXT"),
            ("meal_vouchers", "TEXT DEFAULT 'Alelo, Ticket'"),
            ("lat", "REAL DEFAULT -22.9035"),
            ("lng", "REAL DEFAULT -43.1780"),
        ]
        for col_name, col_type in cols_to_add:
            if col_name not in client_cols:
                try:
                    cur.execute(f"ALTER TABLE clients ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass

        # Garante que meal_vouchers esteja preenchido nos registros existentes
        try:
            cur.execute("""
                UPDATE clients 
                SET meal_vouchers = COALESCE(NULLIF(meal_vouchers, ''), NULLIF(vr_card, ''), 'Alelo, Ticket')
                WHERE meal_vouchers IS NULL OR meal_vouchers = ''
            """)
        except Exception:
            pass

        # 4. Remover baseline_wait_min e adicionar colunas faltantes em restaurants se necessário
        cur.execute("PRAGMA table_info(restaurants)")
        rest_cols = [r["name"] for r in cur.fetchall()]
        if "baseline_wait_min" in rest_cols:
            try:
                cur.execute("ALTER TABLE restaurants DROP COLUMN baseline_wait_min")
            except Exception:
                pass

        rest_cols_to_add = [
            ("email", "TEXT"),
            ("password_hash", "TEXT"),
            ("cuisine_type", "TEXT DEFAULT 'Executivo'"),
            ("phone_whatsapp", "TEXT DEFAULT '5521999998888'"),
            ("turnover_1_2", "INTEGER DEFAULT 8"),
            ("turnover_3_4", "INTEGER DEFAULT 12"),
            ("turnover_5_plus", "INTEGER DEFAULT 20"),
            ("lat", "REAL DEFAULT -22.9030"),
            ("lng", "REAL DEFAULT -43.1770"),
            ("created_at", "TEXT"),
        ]
        for col_name, col_type in rest_cols_to_add:
            if col_name not in rest_cols:
                try:
                    cur.execute(f"ALTER TABLE restaurants ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass

        # Garante credenciais e giros padrão para os restaurantes existentes
        default_rest_pw = hash_password("123456")
        try:
            cur.execute("""
                UPDATE restaurants SET
                    email = COALESCE(email, LOWER(REPLACE(REPLACE(SUBSTR(name, 1, 6), ' ', ''), '&', '')) || '@cltempo.com.br'),
                    password_hash = COALESCE(password_hash, ?),
                    turnover_1_2 = COALESCE(turnover_1_2, avg_turnover_min, 8),
                    turnover_3_4 = COALESCE(turnover_3_4, avg_turnover_min + 3, 12),
                    turnover_5_plus = COALESCE(turnover_5_plus, avg_turnover_min + 10, 20)
                WHERE email IS NULL OR password_hash IS NULL OR turnover_1_2 IS NULL
            """, (default_rest_pw,))
        except Exception:
            pass

        # 5. Adicionar colunas faltantes em queue_entries e migrar status para português
        cur.execute("PRAGMA table_info(queue_entries)")
        q_cols = [r["name"] for r in cur.fetchall()]
        if "client_id" not in q_cols:
            try:
                cur.execute("ALTER TABLE queue_entries ADD COLUMN client_id INTEGER")
                cur.execute("UPDATE queue_entries SET client_id = user_id WHERE client_id IS NULL AND user_id IS NOT NULL")
            except Exception:
                pass
        if "table_number" not in q_cols:
            try:
                cur.execute("ALTER TABLE queue_entries ADD COLUMN table_number INTEGER")
            except Exception:
                pass
        if "checkin_at" not in q_cols:
            try:
                cur.execute("ALTER TABLE queue_entries ADD COLUMN checkin_at TEXT")
            except Exception:
                pass

        # Migração idempotente de status para português
        try:
            cur.execute("UPDATE queue_entries SET status = 'AGUARDANDO' WHERE status = 'WAITING'")
            cur.execute("UPDATE queue_entries SET status = 'CHAMADO' WHERE status = 'CALLED'")
            cur.execute("UPDATE queue_entries SET status = 'SENTADO' WHERE status = 'SEATED'")
            cur.execute("UPDATE queue_entries SET status = 'CANCELADO' WHERE status IN ('CANCELLED', 'NO_SHOW')")
            cur.execute("UPDATE queue_entries SET status = 'ENCERRADO' WHERE status = 'FINISHED'")
        except Exception:
            pass

        # 6. Se tabela de restaurantes vazia, insere seed
        cur.execute("SELECT COUNT(*) as cnt FROM restaurants")
        if cur.fetchone()["cnt"] == 0:
            seed_data(cur)
        else:
            # Garante que as mesas existam para todos os restaurantes cadastrados
            cur.execute("SELECT id, tables_1_2, tables_3_4, tables_5_plus FROM restaurants")
            for r in cur.fetchall():
                cur.execute("SELECT COUNT(*) as t_cnt FROM restaurant_tables WHERE restaurant_id = ?", (r["id"],))
                if cur.fetchone()["t_cnt"] == 0:
                    generate_restaurant_tables(cur, r["id"], r["tables_1_2"] or 6, r["tables_3_4"] or 4, r["tables_5_plus"] or 2)

            # Marca mesas alocadas conforme filas ativas
            try:
                cur.execute("""
                    UPDATE restaurant_tables SET status = 'ALOCADA'
                    WHERE (restaurant_id, table_number) IN (
                        SELECT restaurant_id, table_number FROM queue_entries
                        WHERE table_number IS NOT NULL AND status IN ('CHAMADO', 'SENTADO')
                    )
                """)
            except Exception:
                pass

            # Garante que o restaurante 5 exista se a base era antiga
            cur.execute("SELECT id FROM restaurants WHERE id = 5")
            if not cur.fetchone():
                cur.execute(
                    """INSERT INTO restaurants
                    (id, name, email, password_hash, category, cuisine_type, address, phone_whatsapp, distance_walk_min, avg_turnover_min,
                     turnover_1_2, turnover_3_4, turnover_5_plus, tables_1_2, tables_3_4, tables_5_plus, is_open, vr_accepted, lat, lng)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (5, "Verde & Fresco Saladas", "verde@cltempo.com.br", default_rest_pw, "Saladas & Saudável", "Saladas & Saudável", "Rua da Quitanda, 75 - Centro",
                     "5521995556677", 3, 7, 7, 10, 18, 7, 2, 1, 1, "Alelo, Sodexo / Pluxee, Flash", -22.9031, -43.1772)
                )
                generate_restaurant_tables(cur, 5, 7, 2, 1)

            # Garante que os clientes tenham email e password_hash
            default_pw = hash_password("123456")
            cur.execute(
                """
                UPDATE clients SET 
                    email = COALESCE(email, LOWER(REPLACE(name, ' ', '.')) || '@cltempo.com.br'),
                    password_hash = COALESCE(password_hash, ?),
                    phone = COALESCE(phone, '(21) 98765-4321'),
                    workplace = COALESCE(workplace, company),
                    pref_food_1 = COALESCE(pref_food_1, 'Executivo'),
                    pref_food_2 = COALESCE(pref_food_2, 'Buffet a Quilo'),
                    pref_food_3 = COALESCE(pref_food_3, 'Massas & Italiana')
                WHERE email IS NULL OR password_hash IS NULL
                """,
                (default_pw,),
            )

        # Garante que a tabela cuisines esteja populada
        cur.execute("SELECT COUNT(*) as c FROM cuisines")
        if cur.fetchone()["c"] == 0:
            seed_cuisines(cur)

        conn.commit()
        conn.close()


def seed_data(cur):
    now_dt = datetime.now()
    now_str = now_dt.strftime("%H:%M")
    default_pw = hash_password("123456")

    # Tempos relativos para simulação em tempo real consistente
    t_called = (now_dt - timedelta(minutes=2)).strftime("%H:%M")
    t_wait_14 = (now_dt - timedelta(minutes=14)).strftime("%H:%M")
    t_wait_10 = (now_dt - timedelta(minutes=10)).strftime("%H:%M")
    t_wait_7 = (now_dt - timedelta(minutes=7)).strftime("%H:%M")
    t_wait_5 = (now_dt - timedelta(minutes=5)).strftime("%H:%M")
    t_wait_3 = (now_dt - timedelta(minutes=3)).strftime("%H:%M")

    # 0. Culinárias padronizadas do ecossistema CLTempo
    seed_cuisines(cur)

    # 1. Clientes CLT (Grupo + Personas do Canvas) com e-mail, senha, telefone, workplace, 3 comidas preferidas e VRs
    clients = [
        (
            1,
            "Vivian Souza",
            "vivian@cltempo.com.br",
            default_pw,
            "(21) 99123-4567",
            "Polo Corporativo Centro",
            "Executivo",
            "Buffet a Quilo",
            "Massas & Italiana",
            "Analista Jr",
            "Polo Corporativo Centro",
            "Alelo / Flash",
            "Alelo, Ticket",
            -22.9035,
            -43.1780,
            "2026-10-01 09:00:00",
        ),
        (
            2,
            "Arthur Monteiro",
            "arthur@cltempo.com.br",
            default_pw,
            "(21) 99234-5678",
            "TechTower 14º Andar",
            "Grelhados & Carnes",
            "Hambúrguer & Artesanal",
            "Japonês & Poke",
            "Desenvolvedor Jr",
            "TechTower 14º Andar",
            "Caju / VR",
            "Flash, Caju",
            -22.9040,
            -43.1790,
            "2026-10-01 09:00:00",
        ),
        (
            3,
            "Carolina Falcão",
            "carolina@cltempo.com.br",
            default_pw,
            "(21) 99345-6789",
            "Edifício RB1",
            "Massas & Italiana",
            "Saladas & Saudável",
            "Executivo",
            "Consultora de Negócios",
            "Edifício RB1",
            "Sodexo / Pluxee",
            "Sodexo / Pluxee, VR Refeição",
            -22.9020,
            -43.1765,
            "2026-10-01 09:00:00",
        ),
        (
            4,
            "Fernando Bruzzi",
            "fernando@cltempo.com.br",
            default_pw,
            "(21) 99456-7890",
            "Hub Financeiro",
            "Buffet a Quilo",
            "Grelhados & Carnes",
            "Brasileira & Típica",
            "Analista de Produto",
            "Hub Financeiro",
            "Ticket Restaurante",
            "Ticket, Alelo, iFood",
            -22.9050,
            -43.1775,
            "2026-10-01 09:00:00",
        ),
        (
            5,
            "Mariana Costa",
            "mariana@cltempo.com.br",
            default_pw,
            "(21) 99567-8901",
            "Edifício RB1",
            "Japonês",
            "Poke",
            "Saladas & Saudável",
            "Analista Pleno",
            "Edifício RB1",
            "Flash",
            "Flash, Swile",
            -22.9022,
            -43.1768,
            "2026-10-01 09:00:00",
        ),
        (
            6,
            "Rafael Gomes",
            "rafael@cltempo.com.br",
            default_pw,
            "(21) 99678-9012",
            "Polo Corporativo Centro",
            "Árabe",
            "Executivo",
            "Buffet a Quilo",
            "Auditor Jr",
            "Polo Corporativo Centro",
            "Alelo",
            "Alelo, Sodexo / Pluxee",
            -22.9038,
            -43.1782,
            "2026-10-01 09:00:00",
        ),
    ]
    for c in clients:
        cur.execute(
            """INSERT INTO clients 
            (id, name, email, password_hash, phone, workplace, pref_food_1, pref_food_2, pref_food_3,
             role, company, vr_card, meal_vouchers, lat, lng, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            c,
        )

    # 2. Restaurantes Parceiros no Polo Centro com credenciais, giros e mesas
    restaurants = [
        (
            1,
            "Bistrô do Ouvidor",
            "bistro@cltempo.com.br",
            default_pw,
            "Executivo & Grelhados",
            "Executivo",
            "Rua do Ouvidor, 112 - Centro",
            "5521991112233",
            3,
            8,
            8,
            12,
            20,
            10,
            8,
            3,
            1,
            "Alelo, Flash, Caju, Ticket, Pluxee",
            -22.9036,
            -43.1769,
            "2026-10-01 09:00:00",
        ),
        (
            2,
            "Grão & Brasa Corporativo",
            "grao@cltempo.com.br",
            default_pw,
            "Buffet a Quilo Premium",
            "Buffet a Quilo",
            "Av. Rio Branco, 85 - Centro",
            "5521992223344",
            4,
            6,
            6,
            10,
            18,
            12,
            8,
            4,
            1,
            "Flash, Caju, Alelo, Ticket",
            -22.9028,
            -43.1785,
            "2026-10-01 09:00:00",
        ),
        (
            3,
            "Pasta & Basta Express",
            "pasta@cltempo.com.br",
            default_pw,
            "Massas & Italiana",
            "Massas & Italiana",
            "Rua Sete de Setembro, 48 - Centro",
            "5521993334455",
            2,
            9,
            9,
            12,
            22,
            8,
            6,
            2,
            1,
            "Caju, Pluxee, Alelo, Flash",
            -22.9045,
            -43.1778,
            "2026-10-01 09:00:00",
        ),
        (
            4,
            "Koji Sushi Executivo",
            "sushi@cltempo.com.br",
            default_pw,
            "Japonês & Poke",
            "Japonês & Poke",
            "Travessa do Comércio, 19 - Centro",
            "5521994445566",
            5,
            10,
            10,
            14,
            20,
            6,
            4,
            2,
            1,
            "Alelo, Caju, Flash",
            -22.9039,
            -43.1758,
            "2026-10-01 09:00:00",
        ),
        (
            5,
            "Verde & Fresco Saladas",
            "verde@cltempo.com.br",
            default_pw,
            "Saladas & Saudável",
            "Saladas & Saudável",
            "Rua da Quitanda, 75 - Centro",
            "5521995556677",
            3,
            7,
            7,
            10,
            18,
            7,
            3,
            1,
            1,
            "Alelo, Sodexo, Flash",
            -22.9031,
            -43.1772,
            "2026-10-01 09:00:00",
        ),
    ]
    for r in restaurants:
        cur.execute(
            """INSERT INTO restaurants
            (id, name, email, password_hash, category, cuisine_type, address, phone_whatsapp, distance_walk_min, avg_turnover_min,
             turnover_1_2, turnover_3_4, turnover_5_plus, tables_1_2, tables_3_4, tables_5_plus, is_open, vr_accepted, lat, lng, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            r,
        )
        # Gera mesas numeradas automaticamente a partir de 1
        generate_restaurant_tables(cur, r[0], r[13], r[14], r[15])

    # 3. Funil de Prospecção de Restaurantes (M1)
    leads = [
        ("Bistrô do Ouvidor", "Carlos (Sócio-Gerente)", "Polo Centro", "ONBOARDED", "Piloto ativo no CLTempo — reduziu filas na calçada", "2026-10-18"),
        ("Grão & Brasa Corporativo", "Fernanda (Gerente)", "Polo Centro", "ONBOARDED", "Piloto ativo — alta rotatividade no buffet", "2026-10-19"),
        ("Pasta & Basta Express", "Roberto (Proprietário)", "Polo Centro", "ONBOARDED", "Piloto ativo — alta adesão de CLTs às 11h35", "2026-10-20"),
        ("Koji Sushi Executivo", "Kenji (Gerente)", "Polo Centro", "ONBOARDED", "Piloto ativo — melhorou previsibilidade de mesas", "2026-10-21"),
        ("Verde & Fresco Saladas", "Patrícia", "Polo Centro", "ONBOARDED", "Iniciou operações de fila expressa", "2026-10-22"),
        ("Cantina Donatello", "Sr. Giuseppe", "Polo Centro", "IN_NEGOTIATION", "Aguardando aprovação de equipamentos", "2026-10-22"),
        ("Churrascaria Pampa Grill", "Marcos", "Polo Centro", "APPROACHED", "Visita presencial realizada antes do pico", "2026-10-23"),
        ("Boteco do Carmo", "André", "Polo Centro", "DECLINED", "Prefere não operar com fila digital", "2026-10-19"),
        ("Delírio Tropical", "Luciana", "Polo Centro", "IN_NEGOTIATION", "Avaliando integração com tablet", "2026-10-23"),
        ("Sabor Real Executivo", "Paulo", "Polo Centro", "DECLINED", "Operação 100% balcão rápido", "2026-10-20"),
    ]
    for lead in leads:
        cur.execute(
            """INSERT INTO restaurant_leads
            (restaurant_name, contact_person, region, status, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)""",
            lead,
        )

    # 4. Histórico da Semana de Piloto + Filas Ativas (Status em português: AGUARDANDO, CHAMADO, SENTADO, CANCELADO, ENCERRADO)
    historical_entries = [
        # Concluídos com sucesso na semana de piloto (ENCERRADO)
        (1, 1, "Vivian Souza", "Polo Corporativo Centro", 2, "ENCERRADO", "CLT-101", None, 2, "11:32", "11:54", "12:35", None),
        (2, 1, "Vivian Souza", "Polo Corporativo Centro", 1, "ENCERRADO", "CLT-108", None, 3, "11:35", "11:50", "12:25", None),
        (3, 1, "Vivian Souza", "Polo Corporativo Centro", 2, "ENCERRADO", "CLT-115", None, 1, "11:28", "11:48", "12:30", None),
        (1, 2, "Arthur Monteiro", "TechTower 14º Andar", 4, "ENCERRADO", "CLT-102", None, 4, "11:34", "11:56", "12:45", None),
        (2, 2, "Arthur Monteiro", "TechTower 14º Andar", 2, "ENCERRADO", "CLT-109", None, 2, "11:40", "11:55", "12:35", None),
        (4, 2, "Arthur Monteiro", "TechTower 14º Andar", 2, "ENCERRADO", "CLT-120", None, 5, "11:30", "11:58", "12:40", None),
        (1, 3, "Carolina Falcão", "Edifício RB1", 2, "ENCERRADO", "CLT-103", None, 3, "11:31", "11:50", "12:30", None),
        (3, 3, "Carolina Falcão", "Edifício RB1", 4, "ENCERRADO", "CLT-112", None, 4, "11:33", "11:55", "12:42", None),
        (2, 3, "Carolina Falcão", "Edifício RB1", 2, "ENCERRADO", "CLT-125", None, 2, "11:36", "11:51", "12:32", None),
        (1, 4, "Fernando Bruzzi", "Hub Financeiro", 2, "ENCERRADO", "CLT-104", None, 3, "11:38", "11:59", "12:40", None),
        (4, 4, "Fernando Bruzzi", "Hub Financeiro", 1, "ENCERRADO", "CLT-118", None, 2, "11:35", "11:55", "12:30", None),
        (1, 5, "Mariana Costa", "Edifício RB1", 2, "ENCERRADO", "CLT-130", None, 3, "11:42", "12:01", "12:45", None),
        (2, 6, "Rafael Gomes", "Polo Corporativo Centro", 4, "ENCERRADO", "CLT-131", None, 4, "11:45", "12:02", "12:50", None),
        # Desistências / Cancelamentos
        (1, 4, "Fernando Bruzzi", "Hub Financeiro", 2, "CANCELADO", "CLT-140", "Reunião de emergência às 12h", None, "11:35", None, "11:48", None),
        (3, 5, "Mariana Costa", "Edifício RB1", 2, "CANCELADO", "CLT-141", "Mudou de restaurante com a equipe", None, "11:39", None, "11:46", None),
        # Filas ATIVAS: Carolina chamada na Mesa 1, demais aguardando com tempos relativos
        (1, 3, "Carolina Falcão", "Edifício RB1", 2, "CHAMADO", "CLT-801", None, None, t_wait_14, t_called, None, 1),
        (1, 4, "Fernando Bruzzi", "Hub Financeiro", 2, "AGUARDANDO", "CLT-803", None, None, t_wait_7, None, None, None),
        (1, 2, "Arthur Monteiro", "TechTower 14º Andar", 4, "AGUARDANDO", "CLT-802", None, None, t_wait_10, None, None, None),
        (1, None, "Equipe Auditoria (8p)", "Consultoria PwC", 8, "AGUARDANDO", "CLT-809", None, None, t_wait_14, None, None, None),
        (2, 5, "Mariana Costa", "Edifício RB1", 2, "AGUARDANDO", "CLT-804", None, None, t_wait_7, None, None, None),
        (2, 6, "Rafael Gomes", "Polo Corporativo Centro", 4, "AGUARDANDO", "CLT-805", None, None, t_wait_5, None, None, None),
        (3, None, "Lucas Andrade", "Banco Alfa", 2, "AGUARDANDO", "CLT-806", None, None, t_wait_5, None, None, None),
        (4, None, "Beatriz Rocha", "Consultoria EY", 6, "AGUARDANDO", "CLT-807", None, None, t_wait_3, None, None, None),
    ]

    for entry in historical_entries:
        cat = get_table_category(entry[4])
        cur.execute(
            """INSERT INTO queue_entries
            (restaurant_id, client_id, user_id, customer_name, company_tag, party_size, table_category, status, checkin_code,
             cancel_reason, perceived_standing_wait_min, joined_at, called_at, completed_at, table_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                entry[0],
                entry[1],
                entry[1],
                entry[2],
                entry[3],
                entry[4],
                cat,
                entry[5],
                entry[6],
                entry[7],
                entry[8],
                entry[9],
                entry[10],
                entry[11],
                entry[12],
            ),
        )

    # Marca mesa 1 do restaurante 1 como ALOCADA para a Carolina Falcão
    cur.execute("UPDATE restaurant_tables SET status = 'ALOCADA' WHERE restaurant_id = 1 AND table_number = 1")
