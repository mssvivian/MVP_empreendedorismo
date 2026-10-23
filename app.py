#!/usr/bin/env python3
"""
MVP Gestão de Filas para Restaurantes Corporativos (FilaZero CLT)
Disciplina de Empreendedorismo - UFRJ (2026.2)
Grupo: Arthur Monteiro, Carolina Falcão, Fernando Bruzzi e Vivian Souza

Servidor HTTP/REST + Server-Sent Events (SSE) + SQLite (Zero dependências externas)
Com Filas Segmentadas por Capacidade de Mesa (1-2 lugares | 3-4 lugares | 5+ lugares)
"""

import json
import math
import os
import queue
import random
import sqlite3
import threading
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "mvp_filas.db")
STATIC_DIR = os.path.join(BASE_DIR, "static")

db_lock = threading.Lock()
sse_clients = []
sse_lock = threading.Lock()


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
    - posição na fila específica daquela categoria de mesa (1-2, 3-4 ou 5+)
    - quantidade de mesas daquela categoria no restaurante (quanto mais mesas, maior a vazão paralela)
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

    # Vazão paralela baseada no inventário de mesas da categoria (ex: cada 5 mesas no salão libera ~1 por ciclo curto)
    parallel_flow = max(1.0, tables_count / 5.0)
    return max(2, int(math.ceil((position * cat_turnover) / parallel_flow)))


def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(force_reset=False):
    with db_lock:
        if force_reset and os.path.exists(DB_PATH):
            os.remove(DB_PATH)

        conn = get_db_connection()
        cur = conn.cursor()

        # Check if schema needs migration (tables_1_2 column)
        cur.execute("PRAGMA table_info(restaurants)")
        cols = [r["name"] for r in cur.fetchall()]
        if cols and "tables_1_2" not in cols:
            conn.close()
            os.remove(DB_PATH)
            conn = get_db_connection()
            cur = conn.cursor()

        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                company TEXT NOT NULL,
                vr_card TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS restaurants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                address TEXT NOT NULL,
                distance_walk_min INTEGER NOT NULL,
                avg_turnover_min INTEGER NOT NULL,
                tables_1_2 INTEGER NOT NULL DEFAULT 10,
                tables_3_4 INTEGER NOT NULL DEFAULT 8,
                tables_5_plus INTEGER NOT NULL DEFAULT 3,
                is_open INTEGER NOT NULL DEFAULT 1,
                baseline_wait_min INTEGER NOT NULL,
                vr_accepted TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS queue_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                user_id INTEGER,
                customer_name TEXT NOT NULL,
                company_tag TEXT DEFAULT 'CLT Polo',
                party_size INTEGER NOT NULL DEFAULT 2,
                table_category TEXT NOT NULL DEFAULT '1-2', -- '1-2', '3-4', '5+'
                status TEXT NOT NULL, -- WAITING, CALLED, SEATED, CANCELLED, NO_SHOW
                checkin_code TEXT NOT NULL,
                cancel_reason TEXT,
                perceived_standing_wait_min INTEGER,
                joined_at TEXT NOT NULL,
                called_at TEXT,
                completed_at TEXT,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
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
            """
        )

        cur.execute("SELECT COUNT(*) as cnt FROM restaurants")
        if cur.fetchone()["cnt"] == 0:
            seed_data(cur)

        conn.commit()
        conn.close()


def seed_data(cur):
    now_str = datetime.now().strftime("%H:%M")

    # 1. Personas CLT (Grupo + Perfis do Canvas)
    users = [
        (1, "Vivian Souza", "Analista Jr", "Polo Corporativo Centro", "Alelo / Flash"),
        (2, "Arthur Monteiro", "Desenvolvedor Jr", "TechTower 14º Andar", "Caju / VR"),
        (3, "Carolina Falcão", "Consultora de Negócios", "Edifício RB1", "Sodexo / Pluxee"),
        (4, "Fernando Bruzzi", "Analista de Produto", "Hub Financeiro", "Ticket Restaurante"),
        (5, "Mariana Costa", "Analista Pleno", "Edifício RB1", "Flash"),
        (6, "Rafael Gomes", "Auditor Jr", "Polo Corporativo Centro", "Alelo"),
    ]
    for u in users:
        cur.execute(
            "INSERT INTO users (id, name, role, company, vr_card, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (*u, "2026-10-01 09:00:00"),
        )

    # 2. Restaurantes Parceiros com inventário de mesas por capacidade (1-2, 3-4, 5+)
    restaurants = [
        (
            1,
            "Bistrô do Ouvidor",
            "Executivo & Grelhados",
            "Rua do Ouvidor, 112",
            3,
            8,   # giro base
            12,  # 12 mesas de 1-2 lugares (alta rotatividade)
            8,   # 8 mesas de 3-4 lugares
            2,   # 2 mesas grandes de 5+ lugares (baixa disponibilidade)
            1,
            35,
            "Alelo, Flash, Caju, Ticket, Pluxee",
        ),
        (
            2,
            "Grão & Brasa Corporativo",
            "Buffet a Quilo Premium",
            "Av. Rio Branco, 85",
            4,
            6,
            15,  # 15 mesas de 1-2 lugares
            12,  # 12 mesas de 3-4 lugares
            4,   # 4 mesas de 5+ lugares
            1,
            28,
            "Flash, Caju, Alelo, Ticket",
        ),
        (
            3,
            "Pasta & Basta Express",
            "Massas & Risotos Rápidos",
            "Rua Sete de Setembro, 48",
            2,
            9,
            10,  # 10 mesas de 1-2 lugares
            6,   # 6 mesas de 3-4 lugares
            2,   # 2 mesas de 5+ lugares
            1,
            40,
            "Caju, Pluxee, Alelo, Flash",
        ),
        (
            4,
            "Koji Sushi Executivo",
            "Japonês & Poke Bowls",
            "Travessa do Comércio, 19",
            5,
            10,
            14,  # 14 lugares balcão/mesas de 1-2
            5,   # 5 mesas de 3-4 lugares
            1,   # Apenas 1 tatame/mesa para 5+ lugares
            1,
            45,
            "Alelo, Caju, Flash",
        ),
    ]
    for r in restaurants:
        cur.execute(
            """INSERT INTO restaurants
            (id, name, category, address, distance_walk_min, avg_turnover_min,
             tables_1_2, tables_3_4, tables_5_plus, is_open, baseline_wait_min, vr_accepted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            r,
        )

    # 3. Funil de Prospecção de Restaurantes (Métrica M1 do Canvas)
    leads = [
        ("Bistrô do Ouvidor", "Carlos (Sócio-Gerente)", "Polo Centro", "ONBOARDED", "Piloto ativo — reduziu aglomeração na calçada", "2026-10-18"),
        ("Grão & Brasa Corporativo", "Fernanda (Gerente)", "Polo Centro", "ONBOARDED", "Piloto ativo — incentivo de isenção nos 30 dias", "2026-10-19"),
        ("Pasta & Basta Express", "Roberto (Proprietário)", "Polo Centro", "ONBOARDED", "Piloto ativo — alta adesão de CLTs às 11h35", "2026-10-20"),
        ("Koji Sushi Executivo", "Kenji (Gerente)", "Polo Centro", "ONBOARDED", "Piloto ativo — melhorou previsibilidade de mesas", "2026-10-21"),
        ("Cantina Donatello", "Sr. Giuseppe", "Polo Centro", "IN_NEGOTIATION", "Aguardando aprovação do sócio para iniciar segunda-feira", "2026-10-22"),
        ("Verde Vida Saladas", "Patrícia", "Polo Centro", "IN_NEGOTIATION", "Gostou da proposta de desconto inicial", "2026-10-22"),
        ("Churrascaria Pampa Grill", "Marcos", "Polo Centro", "APPROACHED", "Visita presencial realizada antes do horário de pico", "2026-10-23"),
        ("Boteco do Carmo", "André", "Polo Centro", "DECLINED", "Prefere não trabalhar com fila controlada no momento", "2026-10-19"),
        ("Delírio Tropical", "Luciana", "Polo Centro", "IN_NEGOTIATION", "Avaliando uso em tablet na recepção", "2026-10-23"),
        ("Sabor Real Executivo", "Paulo", "Polo Centro", "DECLINED", "Operação 100% balcão sem mesas numeradas", "2026-10-20"),
    ]
    for lead in leads:
        cur.execute(
            """INSERT INTO restaurant_leads
            (restaurant_name, contact_person, region, status, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)""",
            lead,
        )

    # 4. Histórico da Semana de Piloto + Filas Ativas separadas por categoria de mesa
    historical_entries = [
        # Concluídos com sucesso (SEATED)
        (1, 1, "Vivian Souza", "Polo Corporativo Centro", 2, "SEATED", "FZ-101", None, 2, "11:32", "11:54", "11:57"),
        (2, 1, "Vivian Souza", "Polo Corporativo Centro", 1, "SEATED", "FZ-108", None, 3, "11:35", "11:50", "11:53"),
        (3, 1, "Vivian Souza", "Polo Corporativo Centro", 2, "SEATED", "FZ-115", None, 1, "11:28", "11:48", "11:50"),
        (1, 2, "Arthur Monteiro", "TechTower 14º Andar", 4, "SEATED", "FZ-102", None, 4, "11:34", "11:56", "12:00"),
        (2, 2, "Arthur Monteiro", "TechTower 14º Andar", 2, "SEATED", "FZ-109", None, 2, "11:40", "11:55", "11:58"),
        (4, 2, "Arthur Monteiro", "TechTower 14º Andar", 2, "SEATED", "FZ-120", None, 5, "11:30", "11:58", "12:03"),
        (1, 3, "Carolina Falcão", "Edifício RB1", 2, "SEATED", "FZ-103", None, 3, "11:31", "11:50", "11:53"),
        (3, 3, "Carolina Falcão", "Edifício RB1", 4, "SEATED", "FZ-112", None, 4, "11:33", "11:55", "11:59"),
        (2, 3, "Carolina Falcão", "Edifício RB1", 2, "SEATED", "FZ-125", None, 2, "11:36", "11:51", "11:53"),
        (1, 4, "Fernando Bruzzi", "Hub Financeiro", 2, "SEATED", "FZ-104", None, 3, "11:38", "11:59", "12:02"),
        (4, 4, "Fernando Bruzzi", "Hub Financeiro", 1, "SEATED", "FZ-118", None, 2, "11:35", "11:55", "11:57"),
        (1, 5, "Mariana Costa", "Edifício RB1", 2, "SEATED", "FZ-130", None, 3, "11:42", "12:01", "12:04"),
        (2, 6, "Rafael Gomes", "Polo Corporativo Centro", 4, "SEATED", "FZ-131", None, 4, "11:45", "12:02", "12:06"),
        # Desistências / Cancelamentos antes de ser chamado (M3)
        (1, 4, "Fernando Bruzzi", "Hub Financeiro", 2, "CANCELLED", "FZ-140", "Reunião de emergência às 12h", None, "11:35", None, "11:48"),
        (3, 5, "Mariana Costa", "Edifício RB1", 2, "CANCELLED", "FZ-141", "Mudou de restaurante com a equipe", None, "11:39", None, "11:46"),
        # Filas ATIVAS no Bistrô do Ouvidor (mostrando claramente filas independentes por tamanho de mesa!)
        (1, 3, "Carolina Falcão", "Edifício RB1", 2, "CALLED", "FZ-801", None, None, "11:30", now_str, None),
        (1, 4, "Fernando Bruzzi", "Hub Financeiro", 2, "WAITING", "FZ-803", None, None, "11:34", None, None),
        (1, 2, "Arthur Monteiro", "TechTower 14º Andar", 4, "WAITING", "FZ-802", None, None, "11:33", None, None),
        (1, None, "Equipe Auditoria (8p)", "Consultoria PwC", 8, "WAITING", "FZ-809", None, None, "11:29", None, None),
        # Filas ATIVAS nos demais restaurantes
        (2, 5, "Mariana Costa", "Edifício RB1", 2, "WAITING", "FZ-804", None, None, "11:34", None, None),
        (2, 6, "Rafael Gomes", "Polo Corporativo Centro", 4, "WAITING", "FZ-805", None, None, "11:37", None, None),
        (3, None, "Lucas Andrade", "Banco Alfa", 2, "WAITING", "FZ-806", None, None, "11:35", None, None),
        (4, None, "Beatriz Rocha", "Consultoria EY", 6, "WAITING", "FZ-807", None, None, "11:38", None, None),
    ]

    for entry in historical_entries:
        cat = get_table_category(entry[4])
        cur.execute(
            """INSERT INTO queue_entries
            (restaurant_id, user_id, customer_name, company_tag, party_size, table_category, status, checkin_code,
             cancel_reason, perceived_standing_wait_min, joined_at, called_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                entry[0],
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
            ),
        )


def build_state():
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM users ORDER BY id ASC")
        users = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM restaurants ORDER BY id ASC")
        rest_rows = [dict(r) for r in cur.fetchall()]
        rest_map = {r["id"]: r for r in rest_rows}

        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name, r.avg_turnover_min,
                   r.tables_1_2, r.tables_3_4, r.tables_5_plus, r.baseline_wait_min
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE q.status IN ('WAITING', 'CALLED')
            ORDER BY
                CASE q.status WHEN 'CALLED' THEN 0 ELSE 1 END,
                q.id ASC
            """
        )
        active_rows = [dict(r) for r in cur.fetchall()]

        # Compute position INDEPENDENTLY per (restaurant_id, table_category)
        pos_by_rest_cat = {}
        for item in active_rows:
            rid = item["restaurant_id"]
            cat = item.get("table_category") or get_table_category(item["party_size"])
            item["table_category"] = cat
            tables_for_cat = (
                item["tables_1_2"]
                if cat == "1-2"
                else (item["tables_3_4"] if cat == "3-4" else item["tables_5_plus"])
            )
            item["tables_in_category"] = tables_for_cat

            if item["status"] == "CALLED":
                item["position"] = 0
                item["estimated_wait_min"] = 0
            else:
                key = (rid, cat)
                pos_by_rest_cat[key] = pos_by_rest_cat.get(key, 0) + 1
                pos = pos_by_rest_cat[key]
                item["position"] = pos
                item["estimated_wait_min"] = calc_category_wait_min(
                    pos, item["avg_turnover_min"], cat, tables_for_cat
                )

        # Build restaurant stats including breakdown per table category
        restaurants = []
        for rd in rest_rows:
            rid = rd["id"]
            waiting_all = [x for x in active_rows if x["restaurant_id"] == rid and x["status"] == "WAITING"]
            called_all = [x for x in active_rows if x["restaurant_id"] == rid and x["status"] == "CALLED"]
            rd["waiting_count"] = len(waiting_all)
            rd["called_count"] = len(called_all)

            queues_by_cat = {}
            for cat, col_name in [("1-2", "tables_1_2"), ("3-4", "tables_3_4"), ("5+", "tables_5_plus")]:
                w_cat = [x for x in waiting_all if x["table_category"] == cat]
                c_cat = [x for x in called_all if x["table_category"] == cat]
                t_count = rd[col_name]
                next_pos = len(w_cat) + 1
                est_new = (
                    calc_category_wait_min(next_pos, rd["avg_turnover_min"], cat, t_count)
                    if len(w_cat) > 0
                    else calc_category_wait_min(1, rd["avg_turnover_min"], cat, t_count)
                )
                queues_by_cat[cat] = {
                    "waiting": len(w_cat),
                    "called": len(c_cat),
                    "tables": t_count,
                    "est_wait_min": est_new,
                }

            rd["queues_by_category"] = queues_by_cat
            rd["estimated_wait_for_new_min"] = queues_by_cat["1-2"]["est_wait_min"]

            cur.execute(
                "SELECT COUNT(*) as c FROM queue_entries WHERE restaurant_id = ? AND status = 'SEATED'",
                (rid,),
            )
            rd["seated_today"] = cur.fetchone()["c"]
            restaurants.append(rd)

        # Recent completed/cancelled entries
        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name, r.baseline_wait_min
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE q.status IN ('SEATED', 'CANCELLED', 'NO_SHOW')
            ORDER BY q.id DESC
            LIMIT 15
            """
        )
        recent_history = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM restaurant_leads ORDER BY id DESC")
        leads = [dict(r) for r in cur.fetchall()]

        # 4 Canvas Metrics
        total_leads = len(leads)
        onboarded_leads = sum(1 for l in leads if l["status"] == "ONBOARDED")
        negotiation_leads = sum(1 for l in leads if l["status"] == "IN_NEGOTIATION")
        m1_conversion_pct = round((onboarded_leads / total_leads) * 100, 1) if total_leads > 0 else 0.0

        cur.execute(
            """
            SELECT COUNT(*) as total_entries, COUNT(DISTINCT user_id) as distinct_users
            FROM queue_entries
            WHERE user_id IS NOT NULL
            """
        )
        m2_row = cur.fetchone()
        total_user_entries = m2_row["total_entries"] or 0
        distinct_users = max(1, m2_row["distinct_users"] or 1)
        m2_entries_per_user_week = round(total_user_entries / distinct_users, 2)

        cur.execute(
            """
            SELECT u.name, u.company, COUNT(q.id) as entries_count
            FROM users u
            LEFT JOIN queue_entries q ON q.user_id = u.id
            GROUP BY u.id
            ORDER BY entries_count DESC
            """
        )
        user_frequency = [dict(r) for r in cur.fetchall()]

        cur.execute(
            """
            SELECT
                COUNT(*) as total_all,
                SUM(CASE WHEN status IN ('CANCELLED', 'NO_SHOW') THEN 1 ELSE 0 END) as dropped_count,
                SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
                SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) as noshow_count,
                SUM(CASE WHEN status = 'SEATED' THEN 1 ELSE 0 END) as seated_count
            FROM queue_entries
            """
        )
        m3_row = cur.fetchone()
        total_all = m3_row["total_all"] or 1
        dropped_count = m3_row["dropped_count"] or 0
        m3_dropout_pct = round((dropped_count / total_all) * 100, 1)

        cur.execute(
            """
            SELECT
                AVG(q.perceived_standing_wait_min) as avg_perceived,
                AVG(r.baseline_wait_min) as avg_baseline,
                COUNT(q.perceived_standing_wait_min) as feedback_count
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE q.perceived_standing_wait_min IS NOT NULL
            """
        )
        m4_row = cur.fetchone()
        avg_perceived = round(m4_row["avg_perceived"] or 3.0, 1)
        avg_baseline = round(m4_row["avg_baseline"] or 35.0, 1)
        feedback_count = m4_row["feedback_count"] or 0
        m4_reduction_pct = (
            round((1.0 - (avg_perceived / avg_baseline)) * 100, 1) if avg_baseline > 0 else 0.0
        )
        m4_minutes_saved = round(avg_baseline - avg_perceived, 1)

        conn.close()

        return {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "users": users,
            "restaurants": restaurants,
            "active_queue": active_rows,
            "recent_history": recent_history,
            "leads": leads,
            "metrics": {
                "m1_restaurant_conversion": {
                    "conversion_pct": m1_conversion_pct,
                    "onboarded": onboarded_leads,
                    "in_negotiation": negotiation_leads,
                    "total_approached": total_leads,
                    "target_pct": 35.0,
                },
                "m2_weekly_entries_per_user": {
                    "avg_entries_per_week": m2_entries_per_user_week,
                    "total_entries": total_user_entries,
                    "active_users": distinct_users,
                    "target_entries": 2.5,
                    "user_breakdown": user_frequency,
                },
                "m3_dropout_rate": {
                    "dropout_pct": m3_dropout_pct,
                    "cancelled_count": m3_row["cancelled_count"] or 0,
                    "noshow_count": m3_row["noshow_count"] or 0,
                    "seated_count": m3_row["seated_count"] or 0,
                    "total_entries": total_all,
                    "max_acceptable_pct": 20.0,
                },
                "m4_standing_wait_reduction": {
                    "reduction_pct": m4_reduction_pct,
                    "avg_standing_with_app_min": avg_perceived,
                    "avg_standing_without_app_min": avg_baseline,
                    "minutes_saved_per_lunch": m4_minutes_saved,
                    "feedback_count": feedback_count,
                },
            },
        }


def broadcast_state(event_type="state_updated", meta=None):
    payload = {
        "event": event_type,
        "meta": meta or {},
        "state": build_state(),
    }
    data_str = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    with sse_lock:
        dead_clients = []
        for client_q in sse_clients:
            try:
                client_q.put_nowait(data_str)
            except Exception:
                dead_clients.append(client_q)
        for dc in dead_clients:
            if dc in sse_clients:
                sse_clients.remove(dc)


class MVPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def _send_json(self, data, status=HTTPStatus.OK):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            self._send_json(build_state())
            return

        if parsed.path == "/api/events":
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            client_q = queue.Queue(maxsize=30)
            with sse_lock:
                sse_clients.append(client_q)

            init_payload = {
                "event": "connected",
                "meta": {},
                "state": build_state(),
            }
            try:
                self.wfile.write(f"data: {json.dumps(init_payload, ensure_ascii=False)}\n\n".encode("utf-8"))
                self.wfile.flush()

                while True:
                    try:
                        msg = client_q.get(timeout=15)
                        self.wfile.write(msg.encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": keep-alive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                with sse_lock:
                    if client_q in sse_clients:
                        sse_clients.remove(client_q)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        body = self._read_json_body()

        if parsed.path == "/api/queue/join":
            restaurant_id = int(body.get("restaurant_id", 1))
            user_id = body.get("user_id")
            user_id = int(user_id) if user_id is not None and str(user_id).strip() != "" else None
            party_size = max(1, min(16, int(body.get("party_size", 2))))
            table_cat = get_table_category(party_size)
            custom_name = (body.get("customer_name") or "").strip()
            company_tag = (body.get("company_tag") or "CLT Polo").strip()

            now_str = datetime.now().strftime("%H:%M")

            with db_lock:
                conn = get_db_connection()
                cur = conn.cursor()

                cur.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,))
                rest = cur.fetchone()
                if not rest or not rest["is_open"]:
                    conn.close()
                    self._send_json(
                        {"error": "A fila digital deste restaurante está temporariamente pausada."},
                        status=HTTPStatus.BAD_REQUEST,
                    )
                    return

                if user_id:
                    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
                    urow = cur.fetchone()
                    if urow:
                        custom_name = urow["name"]
                        company_tag = urow["company"]

                        cur.execute(
                            "SELECT id FROM queue_entries WHERE user_id = ? AND status IN ('WAITING', 'CALLED')",
                            (user_id,),
                        )
                        existing = cur.fetchone()
                        if existing:
                            conn.close()
                            self._send_json(
                                {"error": "Você já está em uma fila ativa!"},
                                status=HTTPStatus.BAD_REQUEST,
                            )
                            return

                if not custom_name:
                    custom_name = "Cliente CLT"

                code = f"FZ-{random.randint(200, 999)}"
                cur.execute(
                    """
                    INSERT INTO queue_entries
                    (restaurant_id, user_id, customer_name, company_tag, party_size, table_category, status, checkin_code, joined_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)
                    """,
                    (restaurant_id, user_id, custom_name, company_tag, party_size, table_cat, code, now_str),
                )
                entry_id = cur.lastrowid
                conn.commit()
                conn.close()

            broadcast_state(
                "queue_joined",
                {
                    "entry_id": entry_id,
                    "customer_name": custom_name,
                    "restaurant_name": rest["name"],
                    "table_category": table_cat,
                    "code": code,
                },
            )
            self._send_json({"ok": True, "entry_id": entry_id, "checkin_code": code, "table_category": table_cat})
            return

        if parsed.path == "/api/queue/action":
            entry_id = int(body.get("entry_id", 0))
            action = body.get("action", "")
            cancel_reason = (body.get("cancel_reason") or "Imprevisto no trabalho").strip()
            perceived_wait = body.get("perceived_standing_wait_min")

            now_str = datetime.now().strftime("%H:%M")

            with db_lock:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT q.*, r.name as restaurant_name
                    FROM queue_entries q
                    JOIN restaurants r ON r.id = q.restaurant_id
                    WHERE q.id = ?
                    """,
                    (entry_id,),
                )
                entry = cur.fetchone()
                if not entry:
                    conn.close()
                    self._send_json({"error": "Registro de fila não encontrado."}, status=HTTPStatus.NOT_FOUND)
                    return

                if action == "call":
                    cur.execute(
                        "UPDATE queue_entries SET status = 'CALLED', called_at = ? WHERE id = ?",
                        (now_str, entry_id),
                    )
                elif action == "seat":
                    wait_val = int(perceived_wait) if perceived_wait is not None else 2
                    cur.execute(
                        """
                        UPDATE queue_entries
                        SET status = 'SEATED', completed_at = ?, perceived_standing_wait_min = COALESCE(perceived_standing_wait_min, ?)
                        WHERE id = ?
                        """,
                        (now_str, wait_val, entry_id),
                    )
                elif action == "cancel":
                    cur.execute(
                        """
                        UPDATE queue_entries
                        SET status = 'CANCELLED', completed_at = ?, cancel_reason = ?
                        WHERE id = ?
                        """,
                        (now_str, cancel_reason, entry_id),
                    )
                elif action == "noshow":
                    cur.execute(
                        """
                        UPDATE queue_entries
                        SET status = 'NO_SHOW', completed_at = ?, cancel_reason = 'Não compareceu após chamada'
                        WHERE id = ?
                        """,
                        (now_str, entry_id),
                    )
                else:
                    conn.close()
                    self._send_json({"error": "Ação inválida."}, status=HTTPStatus.BAD_REQUEST)
                    return

                conn.commit()
                conn.close()

            broadcast_state(
                f"queue_{action}",
                {
                    "entry_id": entry_id,
                    "user_id": entry["user_id"],
                    "customer_name": entry["customer_name"],
                    "restaurant_name": entry["restaurant_name"],
                    "table_category": entry["table_category"],
                    "code": entry["checkin_code"],
                    "action": action,
                },
            )
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/queue/feedback":
            entry_id = int(body.get("entry_id", 0))
            perceived_min = max(0, min(60, int(body.get("perceived_standing_wait_min", 2))))

            with db_lock:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute(
                    "UPDATE queue_entries SET perceived_standing_wait_min = ? WHERE id = ?",
                    (perceived_min, entry_id),
                )
                conn.commit()
                conn.close()

            broadcast_state("feedback_recorded", {"entry_id": entry_id, "perceived_min": perceived_min})
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/restaurants/toggle":
            restaurant_id = int(body.get("restaurant_id", 1))
            avg_turnover = body.get("avg_turnover_min")

            with db_lock:
                conn = get_db_connection()
                cur = conn.cursor()
                if avg_turnover is not None:
                    cur.execute(
                        "UPDATE restaurants SET avg_turnover_min = ? WHERE id = ?",
                        (max(1, min(30, int(avg_turnover))), restaurant_id),
                    )
                else:
                    cur.execute(
                        "UPDATE restaurants SET is_open = CASE WHEN is_open = 1 THEN 0 ELSE 1 END WHERE id = ?",
                        (restaurant_id,),
                    )
                conn.commit()
                conn.close()

            broadcast_state("restaurant_updated", {"restaurant_id": restaurant_id})
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/leads/update":
            lead_id = body.get("lead_id")
            status = body.get("status", "ONBOARDED")
            restaurant_name = (body.get("restaurant_name") or "").strip()
            contact_person = (body.get("contact_person") or "Gerente").strip()
            notes = (body.get("notes") or "Abordado na rodada de validação do piloto").strip()
            today_str = datetime.now().strftime("%Y-%m-%d")

            with db_lock:
                conn = get_db_connection()
                cur = conn.cursor()
                if lead_id:
                    cur.execute(
                        "UPDATE restaurant_leads SET status = ?, updated_at = ? WHERE id = ?",
                        (status, today_str, int(lead_id)),
                    )
                elif restaurant_name:
                    cur.execute(
                        """
                        INSERT INTO restaurant_leads (restaurant_name, contact_person, region, status, notes, updated_at)
                        VALUES (?, ?, 'Polo Centro', ?, ?, ?)
                        """,
                        (restaurant_name, contact_person, status, notes, today_str),
                    )
                conn.commit()
                conn.close()

            broadcast_state("leads_updated", {})
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/demo/reset":
            init_db(force_reset=True)
            broadcast_state("demo_reset", {})
            self._send_json({"ok": True})
            return

        self._send_json({"error": "Endpoint não encontrado"}, status=HTTPStatus.NOT_FOUND)


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def run_server(port=8765):
    os.makedirs(STATIC_DIR, exist_ok=True)
    init_db(force_reset=False)
    server = ReusableThreadingHTTPServer(("0.0.0.0", port), MVPRequestHandler)
    print(f"🚀 Servidor MVP FilaZero CLT rodando em http://localhost:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
        server.server_close()


if __name__ == "__main__":
    import sys

    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8765))
    run_server(port)
