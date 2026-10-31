#!/usr/bin/env python3
"""
CLTempo — Módulo da Interface RESTAURANTE (restaurant_api.py)
Disciplina de Empreendedorismo - UFRJ (2026.2)

Gerencia a operação de salão do restaurante, filas segmentadas por porte de mesa
(1-2, 3-4, 5+ lugares), chamada no balcão, check-in de clientes e walk-in presencial.
"""

import random
from datetime import datetime
from http import HTTPStatus
from db import (
    calc_category_wait_min,
    db_lock,
    get_db_connection,
    get_table_category,
)


def handle_restaurant_action(body):
    """
    Executa ações operacionais de fila:
    - 'call': Chama próximo cliente para o balcão.
    - 'seat': Confirma check-in e ocupação da mesa.
    - 'cancel': Cancela reserva.
    - 'noshow': Marca ausência após tolerância de chamada.
    """
    entry_id = int(body.get("entry_id", 0))
    action = body.get("action", "").lower()
    cancel_reason = (body.get("cancel_reason") or "Imprevisto operacional").strip()
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
            return {"error": "Registro de fila não encontrado."}, HTTPStatus.NOT_FOUND

        entry_dict = dict(entry)

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
                SET status = 'NO_SHOW', completed_at = ?, cancel_reason = 'Não compareceu após chamada no balcão'
                WHERE id = ?
                """,
                (now_str, entry_id),
            )
        else:
            conn.close()
            return {"error": f"Ação '{action}' inválida."}, HTTPStatus.BAD_REQUEST

        conn.commit()
        conn.close()

    broadcast_meta = {
        "entry_id": entry_id,
        "client_id": entry_dict.get("client_id") or entry_dict.get("user_id"),
        "customer_name": entry_dict["customer_name"],
        "restaurant_name": entry_dict["restaurant_name"],
        "table_category": entry_dict["table_category"],
        "code": entry_dict["checkin_code"],
        "action": action,
    }

    return {"ok": True, "action": action, "broadcast_meta": broadcast_meta}, HTTPStatus.OK


def handle_restaurant_walkin(body):
    """Adiciona cliente presencial (walk-in sem smartphone) na fila do restaurante."""
    restaurant_id = int(body.get("restaurant_id", 1))
    customer_name = (body.get("customer_name") or "Cliente Presencial").strip()
    party_size = max(1, min(16, int(body.get("party_size", 2))))
    table_cat = get_table_category(party_size)
    now_str = datetime.now().strftime("%H:%M")

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,))
        rest = cur.fetchone()
        if not rest:
            conn.close()
            return {"error": "Restaurante não encontrado."}, HTTPStatus.NOT_FOUND

        code = f"CLT-{random.randint(200, 999)}"
        cur.execute(
            """
            INSERT INTO queue_entries 
            (restaurant_id, client_id, user_id, customer_name, company_tag, party_size, table_category, status, checkin_code, joined_at)
            VALUES (?, NULL, NULL, ?, 'Presencial / Balcão', ?, ?, 'WAITING', ?, ?)
            """,
            (restaurant_id, customer_name, party_size, table_cat, code, now_str),
        )
        entry_id = cur.lastrowid
        conn.commit()
        conn.close()

    broadcast_meta = {
        "entry_id": entry_id,
        "client_id": None,
        "customer_name": customer_name,
        "restaurant_name": rest["name"],
        "table_category": table_cat,
        "code": code,
        "is_walkin": True,
    }

    return {
        "ok": True,
        "entry_id": entry_id,
        "checkin_code": code,
        "table_category": table_cat,
        "broadcast_meta": broadcast_meta,
    }, HTTPStatus.CREATED


def handle_restaurant_toggle(body):
    """Pausa ou reativa a fila digital do restaurante ou atualiza tempo de giro."""
    restaurant_id = int(body.get("restaurant_id", 1))
    avg_turnover = body.get("avg_turnover_min")

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        if avg_turnover is not None:
            cur.execute(
                "UPDATE restaurants SET avg_turnover_min = ? WHERE id = ?",
                (max(1, min(60, int(avg_turnover))), restaurant_id),
            )
        else:
            cur.execute(
                "UPDATE restaurants SET is_open = CASE WHEN is_open = 1 THEN 0 ELSE 1 END WHERE id = ?",
                (restaurant_id,),
            )

        conn.commit()
        cur.execute("SELECT is_open, avg_turnover_min FROM restaurants WHERE id = ?", (restaurant_id,))
        row = cur.fetchone()
        conn.close()

    return {
        "ok": True,
        "restaurant_id": restaurant_id,
        "is_open": bool(row["is_open"]),
        "avg_turnover_min": row["avg_turnover_min"],
    }, HTTPStatus.OK
