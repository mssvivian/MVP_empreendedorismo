#!/usr/bin/env python3
"""
CLTempo — Módulo da Interface RESTAURANTE (restaurant_api.py)
Disciplina de Empreendedorismo - UFRJ (2026.2)
Grupo: Arthur Monteiro, Carolina Falcão, Fernando Bruzzi e Vivian Souza

Gerencia a operação de salão do restaurante:
- Autenticação e Cadastro (com turnover por tipo de mesa e contagem de mesas 1-2, 3-4, 5+)
- Gestão de Mesas numeradas consecutivamente (status ALOCADA, LIVRE, INDISPONÍVEL)
- Fila de Espera (AGUARDANDO, CHAMADO, SENTADO, CANCELADO, ENCERRADO)
- Alocação e troca de mesas com prevenção de conflitos (HTTP 409)
- Check-in, cancelamento com liberação de mesa e encerramento de pedidos
- Perfil do restaurante e controle de abertura de fila
"""

import random
from datetime import datetime
from http import HTTPStatus
from db import (
    calc_category_wait_min,
    db_lock,
    generate_restaurant_tables,
    get_db_connection,
    get_table_category,
    hash_password,
)
from client_api import geocode_address


def handle_restaurant_register(body):
    """
    Cadastra novo restaurante parceiro no ecossistema CLTempo:
    - Dados básicos: nome, email, senha, telefone, culinária, VRs aceitos, endereço.
    - Operação de salão: tempo médio de giro por tipo de mesa (1-2, 3-4, 5+ lugares).
    - Capacidade: quantidade de mesas disponíveis por tipo de mesa (1-2, 3-4, 5+ lugares).
    - Gera automaticamente as mesas sequenciais na tabela restaurant_tables.
    """
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    phone = (body.get("phone") or body.get("phone_whatsapp") or "").strip()
    cuisine_type = (body.get("cuisine_type") or body.get("category") or "Contemporânea").strip()
    address = (body.get("address") or "Centro, Rio de Janeiro - RJ").strip()

    # VRs aceitos (string ou lista)
    raw_vr = body.get("vr_accepted")
    if isinstance(raw_vr, list):
        vr_accepted = ", ".join([v.strip() for v in raw_vr if v.strip()])
    elif isinstance(raw_vr, str) and raw_vr.strip():
        vr_accepted = raw_vr.strip()
    else:
        vr_accepted = "Alelo, Sodexo, Ticket Restaurante, VR Refeição"

    # Tempos médios de giro por tipo de mesa (minutos)
    turnover_1_2 = max(5, min(120, int(body.get("turnover_1_2") or 25)))
    turnover_3_4 = max(5, min(120, int(body.get("turnover_3_4") or 35)))
    turnover_5_plus = max(5, min(120, int(body.get("turnover_5_plus") or 45)))
    avg_turnover_min = round((turnover_1_2 + turnover_3_4 + turnover_5_plus) / 3)

    # Quantidade de mesas disponíveis por tipo
    tables_1_2 = max(1, min(50, int(body.get("tables_1_2") or 6)))
    tables_3_4 = max(1, min(50, int(body.get("tables_3_4") or 6)))
    tables_5_plus = max(1, min(50, int(body.get("tables_5_plus") or 4)))

    if not name or not email or not password:
        return {"error": "Nome, e-mail e senha são obrigatórios."}, HTTPStatus.BAD_REQUEST

    if len(password) < 4:
        return {"error": "A senha deve conter no mínimo 4 caracteres."}, HTTPStatus.BAD_REQUEST

    # Geocodificação do endereço do restaurante
    lat = body.get("lat")
    lng = body.get("lng")
    if lat is None or lng is None:
        lat, lng = geocode_address(address)

    pw_hash = hash_password(password)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        # Verifica unicidade do e-mail
        cur.execute("SELECT id FROM restaurants WHERE LOWER(email) = ?", (email,))
        if cur.fetchone():
            conn.close()
            return {"error": "Este e-mail já está cadastrado para outro restaurante."}, HTTPStatus.BAD_REQUEST

        cur.execute(
            """
            INSERT INTO restaurants (
                name, email, password_hash, phone_whatsapp, category, cuisine_type,
                vr_accepted, address, lat, lng,
                turnover_1_2, turnover_3_4, turnover_5_plus, avg_turnover_min,
                tables_1_2, tables_3_4, tables_5_plus, is_open, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                name, email, pw_hash, phone, cuisine_type, cuisine_type,
                vr_accepted, address, lat, lng,
                turnover_1_2, turnover_3_4, turnover_5_plus, avg_turnover_min,
                tables_1_2, tables_3_4, tables_5_plus, now_str,
            ),
        )
        rest_id = cur.lastrowid

        # Gera mesas numeradas consecutivas
        generate_restaurant_tables(cur, rest_id, tables_1_2, tables_3_4, tables_5_plus)

        conn.commit()
        cur.execute("SELECT * FROM restaurants WHERE id = ?", (rest_id,))
        new_rest = dict(cur.fetchone())
        new_rest.pop("password_hash", None)
        conn.close()

    return {
        "ok": True,
        "restaurant": new_rest,
        "message": f"Restaurante '{name}' cadastrado com sucesso!",
    }, HTTPStatus.CREATED


def handle_restaurant_login(body):
    """Realiza autenticação de restaurante utilizando e-mail e senha."""
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return {"error": "E-mail e senha são obrigatórios."}, HTTPStatus.BAD_REQUEST

    pw_hash = hash_password(password)

    # Tabela de aliases para os restaurantes demo do piloto
    username_part = email.split("@")[0].lower()
    alias_map = {
        "trattoria": "pasta",
        "brasa": "grao",
        "bistro": "bistro",
        "ouvidor": "bistro",
        "pasta": "pasta",
        "sushi": "sushi",
        "koji": "sushi",
        "verde": "verde",
    }
    target_user = alias_map.get(username_part, username_part)

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT * FROM restaurants
            WHERE LOWER(email) = ?
               OR LOWER(email) = ?
               OR LOWER(email) LIKE ?
               OR LOWER(name) LIKE ?
            LIMIT 1
            """,
            (email, f"{target_user}@cltempo.com.br", f"{target_user}%", f"%{target_user}%"),
        )
        row = cur.fetchone()
        conn.close()

        if not row or row["password_hash"] != pw_hash:
            return {"error": "E-mail ou senha inválidos."}, HTTPStatus.UNAUTHORIZED

        rest_data = dict(row)
        rest_data.pop("password_hash", None)

    return {"ok": True, "restaurant": rest_data}, HTTPStatus.OK


def handle_restaurant_get_profile(restaurant_id):
    """Retorna dados cadastrais e métricas básicas de mesas do restaurante."""
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return {"error": "Restaurante não encontrado."}, HTTPStatus.NOT_FOUND

        profile = dict(row)
        profile.pop("password_hash", None)

        # Mesas totais
        cur.execute(
            """
            SELECT status, COUNT(*) as cnt
            FROM restaurant_tables
            WHERE restaurant_id = ?
            GROUP BY status
            """,
            (restaurant_id,),
        )
        status_counts = {r["status"]: r["cnt"] for r in cur.fetchall()}
        profile["table_counts"] = {
            "alocada": status_counts.get("ALOCADA", 0),
            "livre": status_counts.get("LIVRE", 0),
            "indisponivel": status_counts.get("INDISPONÍVEL", 0),
            "total": sum(status_counts.values()),
        }
        conn.close()

    return {"ok": True, "restaurant": profile}, HTTPStatus.OK


def handle_restaurant_profile_update(restaurant_id, body):
    """Atualiza informações cadastrais do restaurante."""
    name = (body.get("name") or "").strip()
    phone = (body.get("phone") or body.get("phone_whatsapp") or "").strip()
    cuisine_type = (body.get("cuisine_type") or body.get("category") or "").strip()
    address = (body.get("address") or "").strip()
    is_open = body.get("is_open")

    turnover_1_2 = body.get("turnover_1_2")
    turnover_3_4 = body.get("turnover_3_4")
    turnover_5_plus = body.get("turnover_5_plus")

    tables_1_2 = body.get("tables_1_2")
    tables_3_4 = body.get("tables_3_4")
    tables_5_plus = body.get("tables_5_plus")

    raw_vr = body.get("vr_accepted")
    vr_str = None
    if isinstance(raw_vr, list):
        vr_str = ", ".join([v.strip() for v in raw_vr if v.strip()])
    elif isinstance(raw_vr, str) and raw_vr.strip():
        vr_str = raw_vr.strip()

    lat = body.get("lat")
    lng = body.get("lng")
    if (lat is None or lng is None) and address:
        lat, lng = geocode_address(address)

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,))
        rest_curr = cur.fetchone()
        if not rest_curr:
            conn.close()
            return {"error": "Restaurante não encontrado."}, HTTPStatus.NOT_FOUND

        t1 = int(turnover_1_2) if turnover_1_2 is not None else rest_curr["turnover_1_2"]
        t2 = int(turnover_3_4) if turnover_3_4 is not None else rest_curr["turnover_3_4"]
        t3 = int(turnover_5_plus) if turnover_5_plus is not None else rest_curr["turnover_5_plus"]
        avg_turnover = round((t1 + t2 + t3) / 3)

        tb1 = int(tables_1_2) if tables_1_2 is not None else (rest_curr["tables_1_2"] or 6)
        tb2 = int(tables_3_4) if tables_3_4 is not None else (rest_curr["tables_3_4"] or 6)
        tb3 = int(tables_5_plus) if tables_5_plus is not None else (rest_curr["tables_5_plus"] or 4)
        tb1 = max(1, min(50, tb1))
        tb2 = max(1, min(50, tb2))
        tb3 = max(1, min(50, tb3))

        # Validação: impede reduzir mesas abaixo da quantidade atualmente ocupada
        cur.execute(
            """
            SELECT table_type, COUNT(*) as cnt 
            FROM restaurant_tables 
            WHERE restaurant_id = ? AND status = 'ALOCADA' 
            GROUP BY table_type
            """,
            (restaurant_id,),
        )
        allocated_by_type = {r["table_type"]: r["cnt"] for r in cur.fetchall()}
        if tb1 < allocated_by_type.get("1-2", 0):
            conn.close()
            return {
                "error": f"Não é possível definir menos de {allocated_by_type['1-2']} mesa(s) de 1-2 lugares pois estão atualmente alocadas a clientes."
            }, HTTPStatus.BAD_REQUEST
        if tb2 < allocated_by_type.get("3-4", 0):
            conn.close()
            return {
                "error": f"Não é possível definir menos de {allocated_by_type['3-4']} mesa(s) de 3-4 lugares pois estão atualmente alocadas a clientes."
            }, HTTPStatus.BAD_REQUEST
        if tb3 < allocated_by_type.get("5+", 0):
            conn.close()
            return {
                "error": f"Não é possível definir menos de {allocated_by_type['5+']} mesa(s) de 5+ lugares pois estão atualmente alocadas a clientes."
            }, HTTPStatus.BAD_REQUEST

        new_password = body.get("password")
        if new_password and len(new_password) >= 4:
            pw_hash = hash_password(new_password)
            cur.execute(
                """
                UPDATE restaurants SET
                    name = COALESCE(NULLIF(?, ''), name),
                    phone_whatsapp = COALESCE(NULLIF(?, ''), phone_whatsapp),
                    cuisine_type = COALESCE(NULLIF(?, ''), cuisine_type),
                    category = COALESCE(NULLIF(?, ''), category),
                    vr_accepted = COALESCE(?, vr_accepted),
                    address = COALESCE(NULLIF(?, ''), address),
                    lat = COALESCE(?, lat),
                    lng = COALESCE(?, lng),
                    turnover_1_2 = ?,
                    turnover_3_4 = ?,
                    turnover_5_plus = ?,
                    avg_turnover_min = ?,
                    tables_1_2 = ?,
                    tables_3_4 = ?,
                    tables_5_plus = ?,
                    is_open = COALESCE(?, is_open),
                    password_hash = ?
                WHERE id = ?
                """,
                (
                    name, phone, cuisine_type, cuisine_type, vr_str, address,
                    lat, lng, t1, t2, t3, avg_turnover,
                    tb1, tb2, tb3,
                    is_open if is_open is not None else None,
                    pw_hash, restaurant_id,
                ),
            )
        else:
            cur.execute(
                """
                UPDATE restaurants SET
                    name = COALESCE(NULLIF(?, ''), name),
                    phone_whatsapp = COALESCE(NULLIF(?, ''), phone_whatsapp),
                    cuisine_type = COALESCE(NULLIF(?, ''), cuisine_type),
                    category = COALESCE(NULLIF(?, ''), category),
                    vr_accepted = COALESCE(?, vr_accepted),
                    address = COALESCE(NULLIF(?, ''), address),
                    lat = COALESCE(?, lat),
                    lng = COALESCE(?, lng),
                    turnover_1_2 = ?,
                    turnover_3_4 = ?,
                    turnover_5_plus = ?,
                    avg_turnover_min = ?,
                    tables_1_2 = ?,
                    tables_3_4 = ?,
                    tables_5_plus = ?,
                    is_open = COALESCE(?, is_open)
                WHERE id = ?
                """,
                (
                    name, phone, cuisine_type, cuisine_type, vr_str, address,
                    lat, lng, t1, t2, t3, avg_turnover,
                    tb1, tb2, tb3,
                    is_open if is_open is not None else None,
                    restaurant_id,
                ),
            )

        # Se o quantitativo de mesas foi alterado, sincroniza as mesas operacionais
        if (
            tb1 != rest_curr["tables_1_2"]
            or tb2 != rest_curr["tables_3_4"]
            or tb3 != rest_curr["tables_5_plus"]
        ):
            generate_restaurant_tables(cur, restaurant_id, tb1, tb2, tb3)

        conn.commit()
        cur.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,))
        updated = dict(cur.fetchone())
        updated.pop("password_hash", None)
        conn.close()

    return {"ok": True, "restaurant": updated, "message": "Perfil atualizado com sucesso!"}, HTTPStatus.OK


def handle_restaurant_profile_delete(restaurant_id):
    """Exclui cadastro do restaurante, liberando ou cancelando filas ativas."""
    now_str = datetime.now().strftime("%H:%M")
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        # Cancela reservas ativas
        cur.execute(
            """
            UPDATE queue_entries
            SET status = 'CANCELADO', completed_at = ?, cancel_reason = 'Restaurante encerrou cadastro'
            WHERE restaurant_id = ? AND status IN ('AGUARDANDO', 'CHAMADO', 'WAITING', 'CALLED')
            """,
            (now_str, restaurant_id),
        )

        cur.execute("DELETE FROM restaurant_tables WHERE restaurant_id = ?", (restaurant_id,))
        cur.execute("DELETE FROM restaurants WHERE id = ?", (restaurant_id,))
        conn.commit()
        conn.close()

    return {"ok": True, "message": "Cadastro do restaurante excluído com sucesso."}, HTTPStatus.OK


def handle_restaurant_get_tables(restaurant_id):
    """
    Retorna a lista de todas as mesas cadastradas do restaurante com status:
    - ALOCADA: inclui dados do cliente ocupante (nome, código, horario)
    - LIVRE
    - INDISPONÍVEL
    """
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT t.id, t.restaurant_id, t.table_number, t.table_type, t.status,
                   q.id as entry_id, q.customer_name, q.party_size, q.status as queue_status,
                   q.joined_at, q.called_at, q.checkin_at, q.checkin_code
            FROM restaurant_tables t
            LEFT JOIN queue_entries q ON (
                q.restaurant_id = t.restaurant_id
                AND q.table_number = t.table_number
                AND q.status IN ('CHAMADO', 'SENTADO', 'CALLED', 'SEATED')
            )
            WHERE t.restaurant_id = ?
            ORDER BY t.table_number ASC
            """,
            (restaurant_id,),
        )
        tables = [dict(r) for r in cur.fetchall()]
        conn.close()

    # Agrupa por categoria de status para facilitar renderização
    alocadas = [t for t in tables if t["status"] == "ALOCADA"]
    livres = [t for t in tables if t["status"] == "LIVRE"]
    indisponiveis = [t for t in tables if t["status"] == "INDISPONÍVEL"]

    return {
        "ok": True,
        "tables": tables,
        "alocadas": alocadas,
        "livres": livres,
        "indisponiveis": indisponiveis,
        "total": len(tables),
    }, HTTPStatus.OK


def handle_restaurant_call_client(body):
    """
    Chama cliente da fila de espera para o balcão/mesa:
    - Valida se a mesa indicada está com status 'LIVRE'.
    - Se a mesa já estiver ALOCADA ou INDISPONÍVEL, retorna erro HTTP 409 Conflict.
    - Se não for indicada mesa, seleciona a mesa LIVRE com menor número correspondente ao porte.
    - Altera o status da mesa para ALOCADA.
    - Altera a reserva para CHAMADO, salva table_number e timestamp called_at.
    """
    entry_id = int(body.get("entry_id", 0))
    requested_table_number = body.get("table_number")
    if requested_table_number is not None:
        try:
            requested_table_number = int(requested_table_number)
        except (ValueError, TypeError):
            requested_table_number = None

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
        rid = entry_dict["restaurant_id"]
        table_cat = entry_dict["table_category"]

        # Busca mesa livre
        allocated_table_number = None
        if requested_table_number is not None:
            cur.execute(
                "SELECT * FROM restaurant_tables WHERE restaurant_id = ? AND table_number = ?",
                (rid, requested_table_number),
            )
            t_row = cur.fetchone()
            if not t_row:
                conn.close()
                return {"error": f"Mesa {requested_table_number} não encontrada neste restaurante."}, HTTPStatus.NOT_FOUND

            if t_row["status"] == "ALOCADA":
                conn.close()
                return {
                    "error": f"Mesa {requested_table_number} já está ocupada ou alocada para outro cliente! Escolha uma mesa livre."
                }, HTTPStatus.CONFLICT
            if t_row["status"] == "INDISPONÍVEL":
                conn.close()
                return {
                    "error": f"Mesa {requested_table_number} está marcada como indisponível no momento."
                }, HTTPStatus.CONFLICT

            allocated_table_number = requested_table_number
        else:
            # Seleciona menor mesa livre da categoria
            cur.execute(
                """
                SELECT table_number FROM restaurant_tables
                WHERE restaurant_id = ? AND table_type = ? AND status = 'LIVRE'
                ORDER BY table_number ASC LIMIT 1
                """,
                (rid, table_cat),
            )
            free_t = cur.fetchone()
            if not free_t:
                # Tenta qualquer mesa livre no restaurante
                cur.execute(
                    """
                    SELECT table_number FROM restaurant_tables
                    WHERE restaurant_id = ? AND status = 'LIVRE'
                    ORDER BY table_number ASC LIMIT 1
                    """,
                    (rid,),
                )
                free_t = cur.fetchone()

            if not free_t:
                conn.close()
                return {
                    "error": "Não há mesas livres disponíveis no momento para realizar a chamada."
                }, HTTPStatus.CONFLICT

            allocated_table_number = free_t["table_number"]

        # 1. Aloca a mesa selecionada
        cur.execute(
            """
            UPDATE restaurant_tables
            SET status = 'ALOCADA'
            WHERE restaurant_id = ? AND table_number = ?
            """,
            (rid, allocated_table_number),
        )

        # 2. Atualiza a entrada da fila
        cur.execute(
            """
            UPDATE queue_entries
            SET status = 'CHAMADO', called_at = ?, table_number = ?
            WHERE id = ?
            """,
            (now_str, allocated_table_number, entry_id),
        )

        conn.commit()
        conn.close()

    broadcast_meta = {
        "entry_id": entry_id,
        "client_id": entry_dict.get("client_id") or entry_dict.get("user_id"),
        "customer_name": entry_dict["customer_name"],
        "restaurant_name": entry_dict["restaurant_name"],
        "table_category": entry_dict["table_category"],
        "table_number": allocated_table_number,
        "code": entry_dict["checkin_code"],
        "action": "call",
    }

    return {
        "ok": True,
        "action": "call",
        "entry_id": entry_id,
        "table_number": allocated_table_number,
        "broadcast_meta": broadcast_meta,
    }, HTTPStatus.OK


def handle_restaurant_change_table(body):
    """
    Altera a mesa alocada para um cliente já chamado:
    - Valida se a nova mesa está 'LIVRE'.
    - Se a nova mesa já estiver 'ALOCADA' ou 'INDISPONÍVEL', retorna erro HTTP 409 Conflict.
    - Libera a mesa anterior para 'LIVRE' e aloca a nova mesa como 'ALOCADA'.
    - Atualiza a reserva com o novo número da mesa.
    """
    entry_id = int(body.get("entry_id", 0))
    new_table_number = int(body.get("new_table_number", 0))

    if not entry_id or not new_table_number:
        return {"error": "entry_id e new_table_number são obrigatórios."}, HTTPStatus.BAD_REQUEST

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM queue_entries WHERE id = ?", (entry_id,))
        entry_row = cur.fetchone()
        if not entry_row:
            conn.close()
            return {"error": "Registro de fila não encontrado."}, HTTPStatus.NOT_FOUND

        entry = dict(entry_row)
        rid = entry["restaurant_id"]
        old_table_number = entry["table_number"]

        # Valida nova mesa
        cur.execute(
            "SELECT * FROM restaurant_tables WHERE restaurant_id = ? AND table_number = ?",
            (rid, new_table_number),
        )
        new_t = cur.fetchone()
        if not new_t:
            conn.close()
            return {"error": f"Mesa {new_table_number} não existe neste restaurante."}, HTTPStatus.NOT_FOUND

        if new_t["status"] == "ALOCADA" and new_table_number != old_table_number:
            conn.close()
            return {
                "error": f"Mesa {new_table_number} já está alocada para outro cliente! Escolha uma mesa livre."
            }, HTTPStatus.CONFLICT
        if new_t["status"] == "INDISPONÍVEL":
            conn.close()
            return {
                "error": f"Mesa {new_table_number} está marcada como indisponível."
            }, HTTPStatus.CONFLICT

        # Libera mesa antiga
        if old_table_number and old_table_number != new_table_number:
            cur.execute(
                "UPDATE restaurant_tables SET status = 'LIVRE' WHERE restaurant_id = ? AND table_number = ?",
                (rid, old_table_number),
            )

        # Aloca nova mesa
        cur.execute(
            "UPDATE restaurant_tables SET status = 'ALOCADA' WHERE restaurant_id = ? AND table_number = ?",
            (rid, new_table_number),
        )

        # Atualiza reserva
        cur.execute(
            "UPDATE queue_entries SET table_number = ? WHERE id = ?",
            (new_table_number, entry_id),
        )

        conn.commit()
        conn.close()

    broadcast_meta = {
        "entry_id": entry_id,
        "client_id": entry.get("client_id") or entry.get("user_id"),
        "table_number": new_table_number,
        "old_table_number": old_table_number,
        "action": "change_table",
    }

    return {
        "ok": True,
        "action": "change_table",
        "entry_id": entry_id,
        "table_number": new_table_number,
        "broadcast_meta": broadcast_meta,
    }, HTTPStatus.OK


def handle_restaurant_seat_client(body):
    """
    Confirma check-in e ocupação presencial da mesa pelo cliente:
    - Altera status da reserva para SENTADO com timestamp checkin_at.
    - Garante que a mesa continue com status ALOCADA.
    """
    entry_id = int(body.get("entry_id", 0))
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
        cur_status = entry_dict["status"]

        # Validação estrita: apenas clientes com status CHAMADO podem fazer check-in (SENTADO)
        if cur_status not in ("CHAMADO", "CALLED"):
            conn.close()
            if cur_status in ("CANCELADO", "CANCELLED", "NO_SHOW"):
                return {
                    "error": "Esta chamada foi cancelada pelo restaurante e não pode ser confirmada."
                }, HTTPStatus.BAD_REQUEST
            elif cur_status in ("ENCERRADO", "COMPLETED"):
                return {
                    "error": "Este atendimento já foi encerrado."
                }, HTTPStatus.BAD_REQUEST
            elif cur_status in ("AGUARDANDO", "WAITING"):
                return {
                    "error": "O cliente ainda está aguardando na fila e precisa ser chamado antes do check-in."
                }, HTTPStatus.BAD_REQUEST
            elif cur_status in ("SENTADO", "SEATED"):
                return {
                    "error": "O cliente já efetuou o check-in e está sentado."
                }, HTTPStatus.BAD_REQUEST
            return {
                "error": f"Não é possível confirmar check-in no status atual ({cur_status})."
            }, HTTPStatus.BAD_REQUEST

        table_num = entry_dict.get("table_number")
        rid = entry_dict["restaurant_id"]

        cur.execute(
            """
            UPDATE queue_entries
            SET status = 'SENTADO', checkin_at = ?
            WHERE id = ?
            """,
            (now_str, entry_id),
        )

        if table_num:
            cur.execute(
                "UPDATE restaurant_tables SET status = 'ALOCADA' WHERE restaurant_id = ? AND table_number = ?",
                (rid, table_num),
            )

        conn.commit()
        conn.close()

    broadcast_meta = {
        "entry_id": entry_id,
        "client_id": entry_dict.get("client_id") or entry_dict.get("user_id"),
        "customer_name": entry_dict["customer_name"],
        "restaurant_name": entry_dict["restaurant_name"],
        "table_number": table_num,
        "action": "seat",
    }

    return {"ok": True, "action": "seat", "entry_id": entry_id, "broadcast_meta": broadcast_meta}, HTTPStatus.OK


def handle_restaurant_cancel_client(body):
    """
    Cancela a reserva do cliente:
    - Libera a mesa eventualmente alocada de volta para status LIVRE.
    - Altera status da reserva para CANCELADO com motivo e completed_at.
    """
    entry_id = int(body.get("entry_id", 0))
    cancel_reason = (body.get("cancel_reason") or "Cancelado pelo restaurante").strip()
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
        rid = entry_dict["restaurant_id"]
        table_num = entry_dict.get("table_number")

        # Libera mesa se estava alocada
        if table_num:
            cur.execute(
                "UPDATE restaurant_tables SET status = 'LIVRE' WHERE restaurant_id = ? AND table_number = ?",
                (rid, table_num),
            )

        cur.execute(
            """
            UPDATE queue_entries
            SET status = 'CANCELADO', completed_at = ?, cancel_reason = ?
            WHERE id = ?
            """,
            (now_str, cancel_reason, entry_id),
        )

        conn.commit()
        conn.close()

    broadcast_meta = {
        "entry_id": entry_id,
        "client_id": entry_dict.get("client_id") or entry_dict.get("user_id"),
        "customer_name": entry_dict["customer_name"],
        "restaurant_name": entry_dict.get("restaurant_name", ""),
        "table_number": table_num,
        "cancel_reason": cancel_reason,
        "action": "cancel",
    }

    return {"ok": True, "action": "cancel", "entry_id": entry_id, "broadcast_meta": broadcast_meta}, HTTPStatus.OK


def handle_restaurant_finish_table(body):
    """
    Encerra o atendimento da mesa (refeição concluída):
    - Altera o status da mesa para LIVRE.
    - Atualiza a reserva correspondente para ENCERRADO com completed_at.
    """
    restaurant_id = int(body.get("restaurant_id", 0))
    table_number = body.get("table_number")
    table_id = body.get("table_id")
    entry_id = body.get("entry_id")
    now_str = datetime.now().strftime("%H:%M")

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        # Localiza a mesa
        if table_id:
            cur.execute("SELECT * FROM restaurant_tables WHERE id = ?", (table_id,))
        elif restaurant_id and table_number:
            cur.execute(
                "SELECT * FROM restaurant_tables WHERE restaurant_id = ? AND table_number = ?",
                (restaurant_id, int(table_number)),
            )
        elif entry_id:
            cur.execute("SELECT * FROM queue_entries WHERE id = ?", (int(entry_id),))
            q_row = cur.fetchone()
            if q_row and q_row["table_number"]:
                cur.execute(
                    "SELECT * FROM restaurant_tables WHERE restaurant_id = ? AND table_number = ?",
                    (q_row["restaurant_id"], q_row["table_number"]),
                )
            else:
                cur.execute("SELECT * FROM restaurant_tables WHERE 1=0")
        else:
            conn.close()
            return {"error": "table_id, table_number ou entry_id são obrigatórios."}, HTTPStatus.BAD_REQUEST

        t_row = cur.fetchone()
        if not t_row:
            conn.close()
            return {"error": "Mesa não encontrada."}, HTTPStatus.NOT_FOUND

        rid = t_row["restaurant_id"]
        t_num = t_row["table_number"]

        # 1. Define mesa como LIVRE
        cur.execute(
            "UPDATE restaurant_tables SET status = 'LIVRE' WHERE id = ?",
            (t_row["id"],),
        )

        # 2. Conclui reserva associada
        cur.execute(
            """
            UPDATE queue_entries
            SET status = 'ENCERRADO', completed_at = ?
            WHERE restaurant_id = ? AND table_number = ? AND status IN ('SENTADO', 'CHAMADO', 'SEATED', 'CALLED')
            """,
            (now_str, rid, t_num),
        )

        conn.commit()
        conn.close()

    broadcast_meta = {
        "restaurant_id": rid,
        "table_number": t_num,
        "action": "finish_table",
    }

    return {
        "ok": True,
        "action": "finish_table",
        "table_number": t_num,
        "status": "LIVRE",
        "broadcast_meta": broadcast_meta,
    }, HTTPStatus.OK


def handle_restaurant_set_table_status(body):
    """
    Alterna o status operacional da mesa entre LIVRE e INDISPONÍVEL:
    - Se a mesa estiver ALOCADA, não pode ser alterada diretamente (requer encerramento prévio).
    """
    table_id = body.get("table_id")
    restaurant_id = body.get("restaurant_id")
    table_number = body.get("table_number")
    target_status = (body.get("status") or "").strip().upper()

    if target_status not in ("LIVRE", "INDISPONÍVEL", "INDISPONIVEL"):
        return {"error": "Status inválido. Permitido: LIVRE ou INDISPONÍVEL."}, HTTPStatus.BAD_REQUEST

    if target_status == "INDISPONIVEL":
        target_status = "INDISPONÍVEL"

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        if table_id:
            cur.execute("SELECT * FROM restaurant_tables WHERE id = ?", (table_id,))
        elif restaurant_id and table_number:
            cur.execute(
                "SELECT * FROM restaurant_tables WHERE restaurant_id = ? AND table_number = ?",
                (int(restaurant_id), int(table_number)),
            )
        else:
            conn.close()
            return {"error": "table_id ou (restaurant_id e table_number) são obrigatórios."}, HTTPStatus.BAD_REQUEST

        t_row = cur.fetchone()
        if not t_row:
            conn.close()
            return {"error": "Mesa não encontrada."}, HTTPStatus.NOT_FOUND

        if t_row["status"] == "ALOCADA":
            conn.close()
            return {
                "error": f"A Mesa {t_row['table_number']} está atualmente ALOCADA. Encerre o atendimento antes de alterar sua disponibilidade."
            }, HTTPStatus.CONFLICT

        cur.execute(
            "UPDATE restaurant_tables SET status = ? WHERE id = ?",
            (target_status, t_row["id"]),
        )
        conn.commit()
        conn.close()

    broadcast_meta = {
        "restaurant_id": t_row["restaurant_id"],
        "table_number": t_row["table_number"],
        "status": target_status,
        "action": "table_status_changed",
    }

    return {
        "ok": True,
        "table_id": t_row["id"],
        "table_number": t_row["table_number"],
        "status": target_status,
        "broadcast_meta": broadcast_meta,
    }, HTTPStatus.OK


def handle_restaurant_action(body):
    """
    Roteador consolidado para ações de salão vindas do painel operacional:
    - 'call': Chama cliente com alocação de mesa livre
    - 'change_table': Altera mesa de cliente já chamado
    - 'seat': Confirma check-in
    - 'cancel': Cancela reserva e libera mesa
    - 'noshow': Marca não comparecimento e libera mesa
    - 'finish': Conclui pedido e libera mesa
    """
    action = body.get("action", "").lower()
    if action == "call":
        return handle_restaurant_call_client(body)
    elif action == "change_table":
        return handle_restaurant_change_table(body)
    elif action == "seat":
        return handle_restaurant_seat_client(body)
    elif action in ("cancel", "noshow"):
        if action == "noshow":
            body["cancel_reason"] = "Não compareceu após chamada no balcão"
        return handle_restaurant_cancel_client(body)
    elif action in ("finish", "finish_table", "complete"):
        return handle_restaurant_finish_table(body)

    return {"error": f"Ação '{action}' inválida."}, HTTPStatus.BAD_REQUEST


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
            VALUES (?, NULL, NULL, ?, 'Presencial / Balcão', ?, ?, 'AGUARDANDO', ?, ?)
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
        "action": "walkin",
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
                (max(1, min(120, int(avg_turnover))), restaurant_id),
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
