#!/usr/bin/env python3
"""
CLTempo — Módulo da Interface ADMINISTRADOR (admin_api.py)
Disciplina de Empreendedorismo - UFRJ (2026.2)

Gerencia as 4 métricas do MVP Canvas (M1 a M4), funil de prospecção de restaurantes,
acompanhamento de clientes/parceiros e reset de demonstração.
"""

from datetime import datetime
from http import HTTPStatus
from db import db_lock, get_db_connection, init_db


def calculate_canvas_metrics():
    """Calcula as 4 métricas de validação de hipóteses definidas no Canvas do MVP."""
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        # M1. Conversão de Restaurantes
        cur.execute("SELECT * FROM restaurant_leads ORDER BY id DESC")
        leads = [dict(r) for r in cur.fetchall()]
        total_leads = len(leads)
        onboarded_leads = sum(1 for l in leads if l["status"] == "ONBOARDED")
        negotiation_leads = sum(1 for l in leads if l["status"] == "IN_NEGOTIATION")
        m1_conversion_pct = round((onboarded_leads / total_leads) * 100, 1) if total_leads > 0 else 0.0

        # M2. Frequência Semanal por Usuário CLT
        cur.execute(
            """
            SELECT COUNT(*) as total_entries, COUNT(DISTINCT COALESCE(client_id, user_id)) as distinct_clients
            FROM queue_entries
            WHERE COALESCE(client_id, user_id) IS NOT NULL
            """
        )
        m2_row = cur.fetchone()
        total_client_entries = m2_row["total_entries"] or 0
        distinct_clients = max(1, m2_row["distinct_clients"] or 1)
        m2_entries_per_user_week = round(total_client_entries / distinct_clients, 2)

        cur.execute(
            """
            SELECT c.name, COALESCE(c.workplace, c.company) as workplace, COUNT(q.id) as entries_count
            FROM clients c
            LEFT JOIN queue_entries q ON (q.client_id = c.id OR q.user_id = c.id)
            GROUP BY c.id
            ORDER BY entries_count DESC
            """
        )
        client_frequency = [dict(r) for r in cur.fetchall()]

        # M3. Taxa de Desistência
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

        # M4. Redução de Espera em Pé
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
        avg_perceived = round(m4_row["avg_perceived"] or 2.8, 1)
        avg_baseline = round(m4_row["avg_baseline"] or 35.0, 1)
        feedback_count = m4_row["feedback_count"] or 0
        m4_reduction_pct = (
            round((1.0 - (avg_perceived / avg_baseline)) * 100, 1) if avg_baseline > 0 else 0.0
        )
        m4_minutes_saved = round(avg_baseline - avg_perceived, 1)

        conn.close()

    return {
        "m1_restaurant_conversion": {
            "conversion_pct": m1_conversion_pct,
            "onboarded": onboarded_leads,
            "in_negotiation": negotiation_leads,
            "total_approached": total_leads,
            "target_pct": 35.0,
            "leads": leads,
        },
        "m2_weekly_entries_per_user": {
            "avg_entries_per_week": m2_entries_per_user_week,
            "total_entries": total_client_entries,
            "active_clients": distinct_clients,
            "target_entries": 2.5,
            "user_breakdown": client_frequency,
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
    }


def handle_admin_leads_update(body):
    """Atualiza o status de um lead no funil de prospecção ou adiciona novo lead."""
    lead_id = body.get("lead_id")
    status = body.get("status", "ONBOARDED")
    restaurant_name = (body.get("restaurant_name") or "").strip()
    contact_person = (body.get("contact_person") or "Gerente").strip()
    notes = (body.get("notes") or "Contato realizado pelo time de validação").strip()
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

    return {"ok": True, "message": "Lead atualizado com sucesso."}, HTTPStatus.OK


def handle_admin_demo_reset():
    """Restaura o banco de dados para os dados padrão de apresentação."""
    init_db(force_reset=True)
    return {"ok": True, "message": "Dados de demonstração restaurados com sucesso."}, HTTPStatus.OK
