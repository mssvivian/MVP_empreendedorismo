"""
Ponte da demo estática (GitHub Pages): roda o backend real do CLTempo dentro do
navegador via Pyodide. O mock-backend.js chama `handle_request` em vez de fazer
uma requisição HTTP, e o roteamento é o mesmo do CLTempoRequestHandler do app.py.
O banco SQLite fica em memória no navegador e volta ao estado inicial ao recarregar.
"""

import json
import os
from http import HTTPStatus

os.environ.setdefault("DB_PATH", "/tmp/cltempo/mvp_filas.db")
os.environ.setdefault("CLTEMPO_DISABLE_OSM", "1")

import app  # noqa: E402
from db import init_db  # noqa: E402

init_db(force_reset=True)

_pending_events = []


def _capture_broadcast(event_type="state_updated", meta=None):
    _pending_events.append({"event": event_type, "meta": meta or {}})


# Substitui o SSE do servidor: os eventos voltam para o JS junto com a resposta.
app.broadcast_state = _capture_broadcast


class _DemoHandler(app.CLTempoRequestHandler):
    def __init__(self, path, body):
        # Não chama o __init__ do SimpleHTTPRequestHandler (não há socket).
        self.path = path
        self._body = body
        self._response = None

    def _read_json_body(self):
        return self._body

    def _send_json(self, data, status=HTTPStatus.OK):
        self._response = (int(status), data)

    def send_head(self):
        # Fallback de arquivos estáticos do do_GET: na demo, rota desconhecida = 404.
        self._send_json({"error": "Endpoint não encontrado"}, status=HTTPStatus.NOT_FOUND)
        return None


def build_state_json():
    return json.dumps(app.build_state(), ensure_ascii=False)


def handle_request(method, path, body_json):
    try:
        body = json.loads(body_json) if body_json else {}
    except Exception:
        body = {}

    handler = _DemoHandler(path, body)
    _pending_events.clear()
    try:
        if method.upper() == "POST":
            handler.do_POST()
        else:
            handler.do_GET()
    except Exception as exc:  # erro no backend vira 500 em vez de travar a demo
        handler._response = (500, {"error": f"Erro na demo: {exc}"})

    status, data = handler._response or (404, {"error": "Endpoint não encontrado"})
    events = list(_pending_events)
    _pending_events.clear()

    # Assim como o broadcast_state real, cada evento leva o estado atualizado.
    state = app.build_state() if events else None
    packets = [{**ev, "state": state} for ev in events]

    return json.dumps({"status": status, "data": data, "events": packets}, ensure_ascii=False)
