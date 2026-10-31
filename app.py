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

        # 2. Restaurantes
        cur.execute("SELECT * FROM restaurants ORDER BY id ASC")
        rest_rows = [dict(r) for r in cur.fetchall()]

        # 3. Filas ativas com cálculo de posição por porte de mesa
        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name, r.avg_turnover_min,
                   r.tables_1_2, r.tables_3_4, r.tables_5_plus, r.baseline_wait_min, r.phone_whatsapp
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE q.status IN ('WAITING', 'CALLED')
            ORDER BY
                CASE q.status WHEN 'CALLED' THEN 0 ELSE 1 END,
                q.id ASC
            """
        )
        active_rows = [dict(r) for r in cur.fetchall()]

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
                "SELECT COUNT(*) as c FROM queue_entries WHERE restaurant_id = ? AND status = 'SEATED'",
                (rid,),
            )
            rd["seated_today"] = cur.fetchone()["c"]
            restaurants.append(rd)

        # 4. Histórico recente
        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name, r.baseline_wait_min
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE q.status IN ('SEATED', 'CANCELLED', 'NO_SHOW')
            ORDER BY q.id DESC
            LIMIT 20
            """
        )
        recent_history = [dict(r) for r in cur.fetchall()]

        # 5. Leads de prospecção
        cur.execute("SELECT * FROM restaurant_leads ORDER BY id DESC")
        leads = [dict(r) for r in cur.fetchall()]

        conn.close()

    metrics = calculate_canvas_metrics()

    return {
        "app_name": "CLTempo",
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "clients": clients,
        "users": clients, # retrocompatibilidade
        "restaurants": restaurants,
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

        if parsed.path == "/api/client/places/autocomplete":
            query = flat_params.get("query", "")
            data, status = handle_client_places_autocomplete(query)
            self._send_json(data, status=status)
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
