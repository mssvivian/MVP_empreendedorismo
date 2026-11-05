#!/usr/bin/env python3
"""
CLTempo — Servidor Principal e Ponto de Entrada (app.py)
Disciplina de Empreendedorismo - UFRJ (2026.2)
Grupo: Arthur Monteiro, Carolina Falcão, Fernando Bruzzi e Vivian Souza

Servidor HTTP/REST com Server-Sent Events (SSE) integrado, arquitetura modular:
- client_api.py: interface do Cliente (Auth, Busca com Score, Fila em Tempo Real, Perfil)
- restaurant_api.py: interface do Restaurante (Gestão de Salão, Mesas 1-2/3-4/5+, Chamada e Walk-in)
- admin_api.py: interface do Administrador (Métricas Canvas M1-M4, Leads, Gestão e Reset)
- db.py: base SQLite, migração de users -> clients e persistência thread-safe
"""

import json
import os
import queue
import sqlite3
import sys
import threading
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from admin_api import (
    calculate_canvas_metrics,
    handle_admin_demo_reset,
    handle_admin_leads_update,
)
from client_api import (
    geocode_address,
    handle_client_active_ticket,
    handle_client_delete_profile,
    handle_client_get_profile,
    handle_client_history,
    handle_client_join_queue,
    handle_client_login,
    handle_client_places_autocomplete,
    handle_client_register,
    handle_client_search_restaurants,
    handle_client_update_profile,
    handle_client_update_vr,
)
from db import (
    DB_PATH,
    STATIC_DIR,
    calc_category_wait_min,
    db_lock,
    get_db_connection,
    get_table_category,
    init_db,
)
from restaurant_api import (
    handle_restaurant_action,
    handle_restaurant_call_client,
    handle_restaurant_cancel_client,
    handle_restaurant_change_table,
    handle_restaurant_finish_table,
    handle_restaurant_get_profile,
    handle_restaurant_get_tables,
    handle_restaurant_login,
    handle_restaurant_profile_delete,
    handle_restaurant_profile_update,
    handle_restaurant_register,
    handle_restaurant_seat_client,
    handle_restaurant_set_table_status,
    handle_restaurant_toggle,
    handle_restaurant_walkin,
)

sse_clients = []
sse_lock = threading.Lock()


def build_state():
    """Compila o estado consolidado do ecossistema CLTempo para o SSE e dashboards."""
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Clientes
        cur.execute("SELECT id, name, email, phone, workplace, company, pref_food_1, pref_food_2, pref_food_3, vr_card, meal_vouchers, lat, lng FROM clients ORDER BY id ASC")
        clients = [dict(r) for r in cur.fetchall()]

        # 2. Mesas operacionais
        cur.execute(
            """
            SELECT t.id, t.restaurant_id, t.table_number, t.table_type, t.status,
                   q.id as entry_id, q.customer_name, q.party_size, q.status as queue_status,
                   q.joined_at, q.called_at, q.checkin_at
            FROM restaurant_tables t
            LEFT JOIN queue_entries q ON (
                q.restaurant_id = t.restaurant_id
                AND q.table_number = t.table_number
                AND q.status IN ('CHAMADO', 'SENTADO', 'CALLED', 'SEATED')
            )
            ORDER BY t.restaurant_id ASC, t.table_number ASC
            """
        )
        all_tables = [dict(r) for r in cur.fetchall()]

        # 3. Restaurantes
        cur.execute("SELECT * FROM restaurants ORDER BY id ASC")
        rest_rows = [dict(r) for r in cur.fetchall()]

        # 4. Filas ativas com cálculo de posição por porte de mesa
        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name, r.avg_turnover_min,
                   r.tables_1_2, r.tables_3_4, r.tables_5_plus, r.phone_whatsapp
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE q.status IN ('AGUARDANDO', 'CHAMADO', 'WAITING', 'CALLED')
            ORDER BY
                CASE WHEN q.status IN ('CHAMADO', 'CALLED') THEN 0 ELSE 1 END,
                q.id ASC
            """
        )
        active_rows = [dict(r) for r in cur.fetchall()]

        now_dt = datetime.now()
        cur_minute_of_day = now_dt.hour * 60 + now_dt.minute

        def parse_to_minutes(time_str):
            if not time_str:
                return None
            try:
                time_part = str(time_str).split(" ")[-1]
                parts = time_part.split(":")
                return int(parts[0]) * 60 + int(parts[1])
            except Exception:
                return None

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

            # Calcula tempo decorrido desde a entrada na fila (joined_at)
            joined_min = parse_to_minutes(item.get("joined_at"))
            if joined_min is not None:
                diff = cur_minute_of_day - joined_min
                if diff < 0:
                    diff += 1440
                item["elapsed_wait_min"] = max(1, diff)
            else:
                item["elapsed_wait_min"] = 1

            # Calcula tempo decorrido desde o chamamento (called_at)
            called_min = parse_to_minutes(item.get("called_at"))
            if called_min is not None:
                diff = cur_minute_of_day - called_min
                if diff < 0:
                    diff += 1440
                item["elapsed_called_min"] = max(1, diff)
            else:
                item["elapsed_called_min"] = item["elapsed_wait_min"]

            if item["status"] in ("CHAMADO", "CALLED"):
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

        restaurants = []
        for rd in rest_rows:
            rid = rd["id"]
            waiting_all = [x for x in active_rows if x["restaurant_id"] == rid and x["status"] in ("AGUARDANDO", "WAITING")]
            called_all = [x for x in active_rows if x["restaurant_id"] == rid and x["status"] in ("CHAMADO", "CALLED")]
            rd["waiting_count"] = len(waiting_all)
            rd["called_count"] = len(called_all)

            r_tables = [t for t in all_tables if t["restaurant_id"] == rid]
            rd["tables"] = r_tables
            rd["tables_alocadas"] = len([t for t in r_tables if t["status"] == "ALOCADA"])
            rd["tables_livres"] = len([t for t in r_tables if t["status"] == "LIVRE"])
            rd["tables_indisponiveis"] = len([t for t in r_tables if t["status"] == "INDISPONÍVEL"])

            queues_by_cat = {}
            for cat, col_name in [("1-2", "tables_1_2"), ("3-4", "tables_3_4"), ("5+", "tables_5_plus")]:
                w_cat = [x for x in waiting_all if x["table_category"] == cat]
                c_cat = [x for x in called_all if x["table_category"] == cat]
                t_count = rd.get(col_name) or 4
                next_pos = len(w_cat) + 1
                est_new = calc_category_wait_min(next_pos, rd["avg_turnover_min"], cat, t_count)
                queues_by_cat[cat] = {
                    "waiting": len(w_cat),
                    "called": len(c_cat),
                    "tables": t_count,
                    "est_wait_min": est_new,
                }

            rd["queues_by_category"] = queues_by_cat
            rd["estimated_wait_for_new_min"] = queues_by_cat["1-2"]["est_wait_min"]

            cur.execute(
                "SELECT COUNT(*) as c FROM queue_entries WHERE restaurant_id = ? AND status IN ('SENTADO', 'SEATED', 'ENCERRADO')",
                (rid,),
            )
            rd["seated_today"] = cur.fetchone()["c"]
            restaurants.append(rd)

        # 5. Histórico recente
        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE q.status IN ('SENTADO', 'SEATED', 'CANCELADO', 'CANCELLED', 'NO_SHOW', 'ENCERRADO')
            ORDER BY q.id DESC
            LIMIT 20
            """
        )
        recent_history = [dict(r) for r in cur.fetchall()]

        # 6. Leads de prospecção
        cur.execute("SELECT * FROM restaurant_leads ORDER BY id DESC")
        leads = [dict(r) for r in cur.fetchall()]

        # 7. Tipos de culinária padronizados
        cur.execute("SELECT id, name, icon, category_group FROM cuisines ORDER BY id ASC")
        cuisines = [dict(r) for r in cur.fetchall()]

        conn.close()

    metrics = calculate_canvas_metrics()

    return {
        "app_name": "CLTempo",
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "cuisines": cuisines,
        "clients": clients,
        "users": clients,  # retrocompatibilidade
        "restaurants": restaurants,
        "restaurant_tables": all_tables,
        "active_queue": active_rows,
        "recent_history": recent_history,
        "leads": leads,
        "metrics": metrics,
    }


def broadcast_state(event_type="state_updated", meta=None):
    """Transmite estado em tempo real para os clientes conectados via SSE."""
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


class CLTempoRequestHandler(SimpleHTTPRequestHandler):
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
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        flat_params = {k: v[0] for k, v in params.items()}

        # 1. Estado completo
        if parsed.path in ("/api/state", "/api/state/"):
            self._send_json(build_state())
            return

        # 2. SSE em tempo real
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

        # 3. Endpoints da Interface CLIENTE (Busca, Fila Ativa, Histórico, Perfil)
        if parsed.path == "/api/client/restaurants":
            client_id = flat_params.get("client_id")
            data, status = handle_client_search_restaurants(client_id, flat_params)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/ticket":
            client_id = flat_params.get("client_id")
            data, status = handle_client_active_ticket(client_id)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/history":
            client_id = flat_params.get("client_id")
            data, status = handle_client_history(client_id)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/profile":
            client_id = flat_params.get("client_id")
            data, status = handle_client_get_profile(client_id)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/geocode":
            address = flat_params.get("address", "")
            lat, lng = geocode_address(address)
            self._send_json({"ok": True, "address": address, "lat": lat, "lng": lng})
            return

        if parsed.path in (
            "/api/client/places/autocomplete",
            "/api/restaurant/places/autocomplete",
            "/api/places/autocomplete",
        ):
            query = flat_params.get("query", "")
            data, status = handle_client_places_autocomplete(query)
            self._send_json(data, status=status)
            return

        # Endpoints da Interface RESTAURANTE (Perfil, Mesas)
        if parsed.path == "/api/restaurant/profile":
            restaurant_id = flat_params.get("restaurant_id")
            data, status = handle_restaurant_get_profile(restaurant_id)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/tables":
            restaurant_id = flat_params.get("restaurant_id")
            data, status = handle_restaurant_get_tables(restaurant_id)
            self._send_json(data, status=status)
            return

        # Culinárias padronizadas
        if parsed.path in ("/api/cuisines", "/api/cuisines/"):
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT id, name, icon, category_group FROM cuisines ORDER BY id ASC")
            cuisines_list = [dict(r) for r in cur.fetchall()]
            conn.close()
            self._send_json({"ok": True, "cuisines": cuisines_list}, status=HTTPStatus.OK)
            return

        # 4. Arquivos estáticos (HTML/CSS/JS)
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        body = self._read_json_body()

        # ==================== INTERFACE CLIENTE ====================
        if parsed.path == "/api/client/register":
            data, status = handle_client_register(body)
            if status == HTTPStatus.CREATED:
                broadcast_state("client_registered", {"client_name": data["client"]["name"]})
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/login":
            data, status = handle_client_login(body)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/profile/update":
            client_id = body.get("client_id")
            data, status = handle_client_update_profile(client_id, body)
            if status == HTTPStatus.OK:
                broadcast_state("client_updated", {"client_id": client_id})
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/profile/vr":
            client_id = body.get("client_id")
            data, status = handle_client_update_vr(client_id, body)
            if status == HTTPStatus.OK:
                broadcast_state("client_updated", {"client_id": client_id})
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/client/profile/delete":
            client_id = body.get("client_id")
            data, status = handle_client_delete_profile(client_id)
            if status == HTTPStatus.OK:
                broadcast_state("client_deleted", {"client_id": client_id})
            self._send_json(data, status=status)
            return

        if parsed.path in ("/api/client/queue/join", "/api/queue/join"):
            data, status = handle_client_join_queue(body)
            if status == HTTPStatus.CREATED:
                meta = data.get("broadcast_meta", {})
                broadcast_state("queue_joined", meta)
            self._send_json(data, status=status)
            return

        # ==================== INTERFACE RESTAURANTE ====================
        if parsed.path == "/api/restaurant/register":
            data, status = handle_restaurant_register(body)
            if status == HTTPStatus.CREATED:
                broadcast_state("restaurant_registered", {"restaurant_name": data["restaurant"]["name"]})
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/login":
            data, status = handle_restaurant_login(body)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/profile/update":
            restaurant_id = body.get("restaurant_id")
            data, status = handle_restaurant_profile_update(restaurant_id, body)
            if status == HTTPStatus.OK:
                broadcast_state("restaurant_updated", {"restaurant_id": restaurant_id})
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/profile/delete":
            restaurant_id = body.get("restaurant_id")
            data, status = handle_restaurant_profile_delete(restaurant_id)
            if status == HTTPStatus.OK:
                broadcast_state("restaurant_deleted", {"restaurant_id": restaurant_id})
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/call":
            data, status = handle_restaurant_call_client(body)
            if status == HTTPStatus.OK:
                meta = data.get("broadcast_meta", {})
                broadcast_state("queue_called", meta)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/change-table":
            data, status = handle_restaurant_change_table(body)
            if status == HTTPStatus.OK:
                meta = data.get("broadcast_meta", {})
                broadcast_state("queue_change_table", meta)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/seat":
            data, status = handle_restaurant_seat_client(body)
            if status == HTTPStatus.OK:
                meta = data.get("broadcast_meta", {})
                broadcast_state("queue_seated", meta)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/cancel":
            data, status = handle_restaurant_cancel_client(body)
            if status == HTTPStatus.OK:
                meta = data.get("broadcast_meta", {})
                broadcast_state("queue_cancelled", meta)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/finish-table":
            data, status = handle_restaurant_finish_table(body)
            if status == HTTPStatus.OK:
                meta = data.get("broadcast_meta", {})
                broadcast_state("table_finished", meta)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/table/status":
            data, status = handle_restaurant_set_table_status(body)
            if status == HTTPStatus.OK:
                meta = data.get("broadcast_meta", {})
                broadcast_state("table_status_changed", meta)
            self._send_json(data, status=status)
            return

        if parsed.path in ("/api/restaurant/action", "/api/queue/action"):
            data, status = handle_restaurant_action(body)
            if status == HTTPStatus.OK:
                meta = data.get("broadcast_meta", {})
                broadcast_state(f"queue_{meta.get('action', 'action')}", meta)
            self._send_json(data, status=status)
            return

        if parsed.path == "/api/restaurant/walkin":
            data, status = handle_restaurant_walkin(body)
            if status == HTTPStatus.CREATED:
                meta = data.get("broadcast_meta", {})
                broadcast_state("queue_joined", meta)
            self._send_json(data, status=status)
            return

        if parsed.path in ("/api/restaurant/toggle", "/api/restaurants/toggle"):
            data, status = handle_restaurant_toggle(body)
            if status == HTTPStatus.OK:
                broadcast_state("restaurant_updated", data)
            self._send_json(data, status=status)
            return

        # ==================== INTERFACE ADMINISTRADOR ====================
        if parsed.path in ("/api/admin/leads/update", "/api/leads/update"):
            data, status = handle_admin_leads_update(body)
            if status == HTTPStatus.OK:
                broadcast_state("leads_updated", {})
            self._send_json(data, status=status)
            return

        if parsed.path in ("/api/admin/demo/reset", "/api/demo/reset"):
            data, status = handle_admin_demo_reset()
            if status == HTTPStatus.OK:
                broadcast_state("demo_reset", {})
            self._send_json(data, status=status)
            return

        # Feedback de tempo em pé
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

        self._send_json({"error": "Endpoint não encontrado"}, status=HTTPStatus.NOT_FOUND)


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def run_server(port=8765):
    os.makedirs(STATIC_DIR, exist_ok=True)
    init_db(force_reset=False)
    server = ReusableThreadingHTTPServer(("0.0.0.0", port), CLTempoRequestHandler)
    print(f"🚀 Servidor CLTempo rodando em http://localhost:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor CLTempo...")
        server.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8765))
    run_server(port)
