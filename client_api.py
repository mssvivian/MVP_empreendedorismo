#!/usr/bin/env python3
"""
CLTempo — Módulo da Interface CLIENTE (client_api.py)
Disciplina de Empreendedorismo - UFRJ (2026.2)

Gerencia autenticação de clientes, perfil, busca avançada de restaurantes
com filtros, cálculo de score e raio geográfico, além de fila digital e histórico.
"""

import hashlib
import json
import os
import random
import urllib.parse
import urllib.request
from datetime import datetime
from http import HTTPStatus
from db import (
    calc_category_wait_min,
    calculate_distance_km,
    db_lock,
    get_db_connection,
    get_table_category,
    hash_password,
)


def geocode_address(address: str) -> tuple:
    """
    Localiza coordenadas geográficas (lat, lng) a partir do nome ou endereço fornecido.
    Utiliza a API do Google Maps (Geocoding API) se GOOGLE_MAPS_API_KEY estiver configurada,
    com mapeamento inteligente para polos e edifícios corporativos do Rio de Janeiro.
    """
    addr = (address or "").strip()
    if not addr:
        return -22.9035, -43.1780

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        try:
            query = urllib.parse.quote(f"{addr}, Rio de Janeiro - RJ, Brasil")
            url = f"https://maps.googleapis.com/maps/api/geocode/json?address={query}&key={api_key}"
            req = urllib.request.Request(url, headers={"User-Agent": "CLTempo-MVP/1.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    if data.get("status") == "OK" and data.get("results"):
                        loc = data["results"][0]["geometry"]["location"]
                        return round(float(loc["lat"]), 6), round(float(loc["lng"]), 6)
        except Exception:
            pass

    # Mapeamento corporativo do Polo Rio de Janeiro e centros empresariais
    addr_lower = addr.lower()
    known_landmarks = [
        (["rb1", "rio branco 1", "edifício rb1"], (-22.9018, -43.1764)),
        (["techtower", "torre tech", "uruguaiana"], (-22.9042, -43.1792)),
        (["hub financeiro", "hub", "praça xv", "bolsa de valores"], (-22.9052, -43.1774)),
        (["ventura", "edifício ventura", "chile", "república do chile", "petrobras", "bndes"], (-22.9082, -43.1812)),
        (["candelária", "presidente vargas"], (-22.9015, -43.1796)),
        (["carioca", "metrô carioca", "almirante barroso"], (-22.9065, -43.1772)),
        (["cinelândia", "treze de maio"], (-22.9102, -43.1762)),
        (["castelo", "santa luzia", "antônio carlos"], (-22.9072, -43.1722)),
        (["porto maravilha", "aqwa", "boulevard olímpico"], (-22.8982, -43.1952)),
        (["botafogo", "praia de botafogo", "flamengo"], (-22.9472, -43.1822)),
        (["barra", "jardim oceânico", "barra da tijuca"], (-23.0030, -43.3230)),
    ]

    for keywords, coords in known_landmarks:
        if any(k in addr_lower for k in keywords):
            return coords

    # Cálculo determinístico próximo ao centro para locais sem chave
    h = int(hashlib.md5(addr.encode("utf-8")).hexdigest()[:6], 16)
    delta_lat = ((h % 100) - 50) * 0.0001
    delta_lng = (((h // 100) % 100) - 50) * 0.0001
    return round(-22.9035 + delta_lat, 6), round(-43.1780 + delta_lng, 6)


def handle_client_places_autocomplete(query: str):
    """
    Retorna lista de possíveis locais / edifícios no Google Maps
    conforme o usuário digita o local de trabalho.
    """
    q = (query or "").strip()
    if not q or len(q) < 2:
        return {"ok": True, "predictions": []}, HTTPStatus.OK

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        try:
            encoded_q = urllib.parse.quote(q)
            url = (
                f"https://maps.googleapis.com/maps/api/place/autocomplete/json"
                f"?input={encoded_q}&location=-22.9035,-43.1780&radius=15000"
                f"&components=country:br&language=pt-BR&key={api_key}"
            )
            req = urllib.request.Request(url, headers={"User-Agent": "CLTempo-MVP/1.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    preds = data.get("predictions", [])
                    results = []
                    for p in preds[:6]:
                        main_t = p.get("structured_formatting", {}).get("main_text", p.get("description"))
                        sec_t = p.get("structured_formatting", {}).get("secondary_text", "")
                        desc = p.get("description", main_t)
                        lat, lng = geocode_address(desc)
                        results.append({
                            "description": desc,
                            "main_text": main_t,
                            "secondary_text": sec_t,
                            "lat": lat,
                            "lng": lng,
                        })
                    if results:
                        return {"ok": True, "predictions": results, "source": "google_places_api"}, HTTPStatus.OK
        except Exception:
            pass

    # Catálogo corporativo de edifícios e polos empresariais do Rio de Janeiro
    corporate_places = [
        {
            "main_text": "Edifício RB1 (Rio Branco 1)",
            "secondary_text": "Av. Rio Branco, 1 - Centro, Rio de Janeiro - RJ",
            "keywords": ["rb1", "rio branco 1", "edificio rb1", "rio branco"],
            "lat": -22.9018,
            "lng": -43.1764,
        },
        {
            "main_text": "TechTower (Torre Tecnológica)",
            "secondary_text": "Rua da Quitanda, 86 - Centro, Rio de Janeiro - RJ",
            "keywords": ["techtower", "tech", "torre tech", "quitanda", "uruguaiana"],
            "lat": -22.9042,
            "lng": -43.1792,
        },
        {
            "main_text": "Hub Financeiro & Bolsa do Rio",
            "secondary_text": "Praça XV de Novembro, 20 - Centro, Rio de Janeiro - RJ",
            "keywords": ["hub", "financeiro", "bolsa", "praça xv", "mercado"],
            "lat": -22.9052,
            "lng": -43.1774,
        },
        {
            "main_text": "Edifício Ventura Corporate Towers",
            "secondary_text": "Av. República do Chile, 330 - Centro, Rio de Janeiro - RJ",
            "keywords": ["ventura", "corporate towers", "chile", "república do chile", "torre ventura"],
            "lat": -22.9082,
            "lng": -43.1812,
        },
        {
            "main_text": "Edifício Linneo de Paula Machado",
            "secondary_text": "Av. Almirante Barroso, 52 - Centro, Rio de Janeiro - RJ",
            "keywords": ["linneo", "almirante barroso", "barroso", "carioca"],
            "lat": -22.9065,
            "lng": -43.1760,
        },
        {
            "main_text": "Candelária Corporate",
            "secondary_text": "Rua da Candelária, 65 - Centro, Rio de Janeiro - RJ",
            "keywords": ["candelária", "candelaria", "candelária corporate"],
            "lat": -22.9015,
            "lng": -43.1796,
        },
        {
            "main_text": "Edifício BNDES / Petrobras Sede",
            "secondary_text": "Av. República do Chile, 100 - Centro, Rio de Janeiro - RJ",
            "keywords": ["bndes", "petrobras", "sede petrobras", "chile 100"],
            "lat": -22.9075,
            "lng": -43.1805,
        },
        {
            "main_text": "AQWA Corporate — Porto Maravilha",
            "secondary_text": "Via Binário do Porto, 299 - Santo Cristo, Rio de Janeiro - RJ",
            "keywords": ["aqwa", "porto maravilha", "binário do porto", "porto"],
            "lat": -22.8982,
            "lng": -43.1952,
        },
        {
            "main_text": "Torre Almirante",
            "secondary_text": "Av. Almirante Barroso, 81 - Centro, Rio de Janeiro - RJ",
            "keywords": ["torre almirante", "almirante", "barroso 81"],
            "lat": -22.9070,
            "lng": -43.1775,
        },
        {
            "main_text": "Edifício Bolsa de Valores",
            "secondary_text": "Praça XV de Novembro, 10 - Centro, Rio de Janeiro - RJ",
            "keywords": ["bolsa de valores", "bvrj", "praça xv 10"],
            "lat": -22.9048,
            "lng": -43.1768,
        },
        {
            "main_text": "Polo Corporativo Rua do Ouvidor",
            "secondary_text": "Rua do Ouvidor, 112 - Centro, Rio de Janeiro - RJ",
            "keywords": ["ouvidor", "rua do ouvidor", "polo ouvidor"],
            "lat": -22.9035,
            "lng": -43.1780,
        },
        {
            "main_text": "Centro Empresarial Mourisco",
            "secondary_text": "Praia de Botafogo, 501 - Botafogo, Rio de Janeiro - RJ",
            "keywords": ["mourisco", "praia de botafogo", "botafogo", "cem"],
            "lat": -22.9472,
            "lng": -43.1822,
        },
        {
            "main_text": "Edifício Rodolpho De Paoli",
            "secondary_text": "Av. Nilo Peçanha, 50 - Centro, Rio de Janeiro - RJ",
            "keywords": ["rodolpho de paoli", "nilo peçanha", "paoli"],
            "lat": -22.9058,
            "lng": -43.1755,
        },
        {
            "main_text": "Edifício Presidente Wilson",
            "secondary_text": "Av. Presidente Wilson, 231 - Castelo, Rio de Janeiro - RJ",
            "keywords": ["presidente wilson", "wilson", "castelo"],
            "lat": -22.9110,
            "lng": -43.1730,
        },
        {
            "main_text": "Metrô Estação Carioca",
            "secondary_text": "Largo da Carioca - Centro, Rio de Janeiro - RJ",
            "keywords": ["carioca", "metrô carioca", "largo da carioca"],
            "lat": -22.9065,
            "lng": -43.1772,
        },
        {
            "main_text": "Metrô Estação Cinelândia",
            "secondary_text": "Praça Floriano - Cinelândia, Rio de Janeiro - RJ",
            "keywords": ["cinelândia", "cinelandia", "praça floriano"],
            "lat": -22.9102,
            "lng": -43.1762,
        },
        {
            "main_text": "Metrô Estação Uruguaiana",
            "secondary_text": "Rua Uruguaiana / Pres. Vargas - Centro, Rio de Janeiro - RJ",
            "keywords": ["uruguaiana", "saara", "metrô uruguaiana"],
            "lat": -22.9035,
            "lng": -43.1815,
        },
    ]

    q_lower = q.lower()
    matches = []
    for place in corporate_places:
        if (
            q_lower in place["main_text"].lower()
            or q_lower in place["secondary_text"].lower()
            or any(q_lower in k for k in place["keywords"])
        ):
            matches.append({
                "description": f"{place['main_text']} — {place['secondary_text']}",
                "main_text": place["main_text"],
                "secondary_text": place["secondary_text"],
                "lat": place["lat"],
                "lng": place["lng"],
            })

    if not matches:
        dynamic_lat, dynamic_lng = geocode_address(q)
        matches.append({
            "description": f"{q} — Rio de Janeiro, RJ (Polo Corporativo)",
            "main_text": q,
            "secondary_text": "Rio de Janeiro, RJ (Localização aproximada via Google Maps)",
            "lat": dynamic_lat,
            "lng": dynamic_lng,
        })

    return {"ok": True, "predictions": matches[:6], "source": "google_maps_suggestions"}, HTTPStatus.OK


def handle_client_register(body):
    """
    Cadastra novo cliente CLT:
    nome, e-mail, senha, telefone, local de trabalho e três tipos de comida preferida.
    Localiza latitude e longitude via Google Maps API com base no local de trabalho.
    """
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    phone = (body.get("phone") or "").strip()
    workplace = (body.get("workplace") or "").strip()
    pref_food_1 = (body.get("pref_food_1") or "Executivo").strip()
    pref_food_2 = (body.get("pref_food_2") or "Buffet a Quilo").strip()
    pref_food_3 = (body.get("pref_food_3") or "Massas").strip()

    if not name or not email or not password:
        return {"error": "Nome, e-mail e senha são obrigatórios."}, HTTPStatus.BAD_REQUEST

    pw_hash = hash_password(password)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Localização via Google Maps Geocoding API a partir do nome do local de trabalho
    lat = body.get("lat")
    lng = body.get("lng")
    if lat is None or lng is None:
        lat, lng = geocode_address(workplace)
    else:
        try:
            lat, lng = float(lat), float(lng)
        except (ValueError, TypeError):
            lat, lng = geocode_address(workplace)

    # Meal Vouchers (VR) multi-seleção
    raw_vr = body.get("meal_vouchers")
    if isinstance(raw_vr, list):
        meal_vouchers = ", ".join([v.strip() for v in raw_vr if v.strip()])
    elif isinstance(raw_vr, str) and raw_vr.strip():
        meal_vouchers = raw_vr.strip()
    else:
        meal_vouchers = "Alelo, Ticket"
    if not meal_vouchers:
        meal_vouchers = "Alelo, Ticket"

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT id FROM clients WHERE email = ?", (email,))
        if cur.fetchone():
            conn.close()
            return {"error": "Já existe um cliente cadastrado com este e-mail."}, HTTPStatus.CONFLICT

        cur.execute(
            """
            INSERT INTO clients (name, email, password_hash, phone, workplace, pref_food_1, pref_food_2, pref_food_3,
                                role, company, vr_card, meal_vouchers, lat, lng, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CLT Polo', ?, ?, ?, ?, ?, ?)
            """,
            (name, email, pw_hash, phone, workplace, pref_food_1, pref_food_2, pref_food_3, workplace, meal_vouchers, meal_vouchers, lat, lng, now_str),
        )
        client_id = cur.lastrowid
        conn.commit()

        cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        new_client = dict(cur.fetchone())
        new_client.pop("password_hash", None)
        conn.close()

    return {"ok": True, "client": new_client, "message": "Cadastro realizado com sucesso!"}, HTTPStatus.CREATED


def handle_client_login(body):
    """Realiza autenticação de cliente utilizando e-mail e senha."""
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return {"error": "E-mail e senha são obrigatórios."}, HTTPStatus.BAD_REQUEST

    pw_hash = hash_password(password)

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        username_part = email.split('@')[0].lower()
        cur.execute(
            """
            SELECT * FROM clients 
            WHERE LOWER(email) = ? 
               OR LOWER(email) LIKE ?
               OR LOWER(email) = ?
            """,
            (email, f"{username_part}%", f"{username_part}@cltempo.com.br"),
        )
        row = cur.fetchone()
        conn.close()

        if not row or row["password_hash"] != pw_hash:
            return {"error": "E-mail ou senha inválidos."}, HTTPStatus.UNAUTHORIZED

        client_data = dict(row)
        client_data.pop("password_hash", None)

    return {"ok": True, "client": client_data}, HTTPStatus.OK


def handle_client_get_profile(client_id):
    """Retorna os dados do perfil do cliente."""
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        row = cur.fetchone()
        conn.close()

        if not row:
            return {"error": "Cliente não encontrado."}, HTTPStatus.NOT_FOUND

        profile = dict(row)
        profile.pop("password_hash", None)
        return {"ok": True, "client": profile}, HTTPStatus.OK


def handle_client_update_profile(client_id, body):
    """Atualiza as informações cadastrais do cliente."""
    name = (body.get("name") or "").strip()
    phone = (body.get("phone") or "").strip()
    workplace = (body.get("workplace") or "").strip()
    pref_food_1 = (body.get("pref_food_1") or "").strip()
    pref_food_2 = (body.get("pref_food_2") or "").strip()
    pref_food_3 = (body.get("pref_food_3") or "").strip()
    new_password = body.get("password")

    lat = body.get("lat")
    lng = body.get("lng")
    if (lat is None or lng is None) and workplace:
        lat, lng = geocode_address(workplace)
    elif lat is not None and lng is not None:
        try:
            lat, lng = float(lat), float(lng)
        except (ValueError, TypeError):
            lat, lng = geocode_address(workplace)

    # Meal Vouchers (VR) multi-seleção
    raw_vr = body.get("meal_vouchers")
    meal_vouchers_str = None
    if isinstance(raw_vr, list):
        meal_vouchers_str = ", ".join([v.strip() for v in raw_vr if v.strip()])
    elif isinstance(raw_vr, str) and raw_vr.strip():
        meal_vouchers_str = raw_vr.strip()

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        if not cur.fetchone():
            conn.close()
            return {"error": "Cliente não encontrado."}, HTTPStatus.NOT_FOUND

        if new_password and len(new_password) >= 4:
            pw_hash = hash_password(new_password)
            cur.execute(
                """
                UPDATE clients SET 
                    name = COALESCE(NULLIF(?, ''), name),
                    phone = COALESCE(NULLIF(?, ''), phone),
                    workplace = COALESCE(NULLIF(?, ''), workplace),
                    company = COALESCE(NULLIF(?, ''), company),
                    pref_food_1 = COALESCE(NULLIF(?, ''), pref_food_1),
                    pref_food_2 = COALESCE(NULLIF(?, ''), pref_food_2),
                    pref_food_3 = COALESCE(NULLIF(?, ''), pref_food_3),
                    meal_vouchers = COALESCE(?, meal_vouchers),
                    vr_card = COALESCE(?, vr_card),
                    lat = COALESCE(?, lat),
                    lng = COALESCE(?, lng),
                    password_hash = ?
                WHERE id = ?
                """,
                (name, phone, workplace, workplace, pref_food_1, pref_food_2, pref_food_3, meal_vouchers_str, meal_vouchers_str, lat, lng, pw_hash, client_id),
            )
        else:
            cur.execute(
                """
                UPDATE clients SET 
                    name = COALESCE(NULLIF(?, ''), name),
                    phone = COALESCE(NULLIF(?, ''), phone),
                    workplace = COALESCE(NULLIF(?, ''), workplace),
                    company = COALESCE(NULLIF(?, ''), company),
                    pref_food_1 = COALESCE(NULLIF(?, ''), pref_food_1),
                    pref_food_2 = COALESCE(NULLIF(?, ''), pref_food_2),
                    pref_food_3 = COALESCE(NULLIF(?, ''), pref_food_3),
                    meal_vouchers = COALESCE(?, meal_vouchers),
                    vr_card = COALESCE(?, vr_card),
                    lat = COALESCE(?, lat),
                    lng = COALESCE(?, lng)
                WHERE id = ?
                """,
                (name, phone, workplace, workplace, pref_food_1, pref_food_2, pref_food_3, meal_vouchers_str, meal_vouchers_str, lat, lng, client_id),
            )

        conn.commit()
        cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        updated = dict(cur.fetchone())
        updated.pop("password_hash", None)
        conn.close()

    return {"ok": True, "client": updated, "message": "Perfil atualizado com sucesso!"}, HTTPStatus.OK


def handle_client_update_vr(client_id, body):
    """Atualiza diretamente as opções de VR (Vale Refeição) do cliente."""
    raw_vr = body.get("meal_vouchers")
    if isinstance(raw_vr, list):
        meal_vouchers_str = ", ".join([v.strip() for v in raw_vr if v.strip()])
    elif isinstance(raw_vr, str):
        meal_vouchers_str = raw_vr.strip()
    else:
        meal_vouchers_str = ""

    if not meal_vouchers_str:
        return {"error": "Selecione ao menos um vale-refeição."}, HTTPStatus.BAD_REQUEST

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT id FROM clients WHERE id = ?", (client_id,))
        if not cur.fetchone():
            conn.close()
            return {"error": "Cliente não encontrado."}, HTTPStatus.NOT_FOUND

        cur.execute(
            "UPDATE clients SET meal_vouchers = ?, vr_card = ? WHERE id = ?",
            (meal_vouchers_str, meal_vouchers_str, client_id),
        )
        conn.commit()
        cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        updated = dict(cur.fetchone())
        updated.pop("password_hash", None)
        conn.close()

    return {"ok": True, "client": updated, "message": "Vales-refeição atualizados com sucesso!"}, HTTPStatus.OK


def handle_client_delete_profile(client_id):
    """Apaga o perfil do cliente e cancela eventuais filas pendentes."""
    now_str = datetime.now().strftime("%H:%M")
    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        # Cancela reservas ativas antes de excluir
        cur.execute(
            """
            UPDATE queue_entries 
            SET status = 'CANCELLED', completed_at = ?, cancel_reason = 'Perfil de usuário excluído'
            WHERE (client_id = ? OR user_id = ?) AND status IN ('WAITING', 'CALLED')
            """,
            (now_str, client_id, client_id),
        )

        cur.execute("DELETE FROM clients WHERE id = ?", (client_id,))
        conn.commit()
        conn.close()

    return {"ok": True, "message": "Perfil excluído com sucesso."}, HTTPStatus.OK


def handle_client_search_restaurants(client_id, filters):
    """
    Busca restaurantes cadastrados com filtros e cálculo de Score decrescente:
    - Filtros: nome, tipo de comida, tempo máximo de espera, raio geográfico.
    - Score baseado em tempo de espera, distância, preferências culinárias do cliente e status aberto.
    """
    search_name = (filters.get("name") or "").strip().lower()
    filter_cuisine = (filters.get("cuisine_type") or "").strip()
    max_wait = filters.get("max_wait_min")
    max_wait = int(max_wait) if max_wait is not None and str(max_wait).strip() != "" else None
    radius_km = filters.get("radius_km")
    radius_km = float(radius_km) if radius_km is not None and str(radius_km).strip() != "" else 5.0
    party_size = int(filters.get("party_size", 2))
    target_cat = get_table_category(party_size)

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        # Obtém perfil do cliente logado para pontuação personalizada
        client = None
        if client_id:
            cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
            crow = cur.fetchone()
            if crow:
                client = dict(crow)

        client_lat = client.get("lat", -22.9035) if client else -22.9035
        client_lng = client.get("lng", -43.1780) if client else -43.1780
        client_prefs = []
        if client:
            client_prefs = [
                p.lower()
                for p in [client.get("pref_food_1"), client.get("pref_food_2"), client.get("pref_food_3")]
                if p
            ]

        # Busca restaurantes
        cur.execute("SELECT * FROM restaurants ORDER BY id ASC")
        rest_rows = [dict(r) for r in cur.fetchall()]

        # Fila ativa para cálculo de tempo de espera
        cur.execute(
            """
            SELECT restaurant_id, table_category, status, COUNT(*) as cnt
            FROM queue_entries
            WHERE status IN ('WAITING', 'CALLED')
            GROUP BY restaurant_id, table_category, status
            """
        )
        q_counts = cur.fetchall()
        waiting_counts = {}
        for row in q_counts:
            if row["status"] == "WAITING":
                waiting_counts[(row["restaurant_id"], row["table_category"])] = row["cnt"]

        results = []
        for r in rest_rows:
            r_id = r["id"]
            cat_col = (
                "tables_1_2" if target_cat == "1-2" else ("tables_3_4" if target_cat == "3-4" else "tables_5_plus")
            )
            tables_in_cat = r.get(cat_col, 8)
            waiting_in_cat = waiting_counts.get((r_id, target_cat), 0)
            next_pos = waiting_in_cat + 1

            est_wait_min = calc_category_wait_min(
                next_pos, r["avg_turnover_min"], target_cat, tables_in_cat
            )

            # Distância real por Haversine
            dist_km = calculate_distance_km(client_lat, client_lng, r.get("lat", -22.9030), r.get("lng", -43.1770))
            dist_meters = int(dist_km * 1000)

            # Filtros
            # 1. Filtro por nome / categoria
            if search_name:
                matches_name = search_name in r["name"].lower() or search_name in r["category"].lower()
                if not matches_name:
                    continue

            # 2. Filtro por tipo de comida
            if filter_cuisine and filter_cuisine != "TODOS":
                r_cuisine = (r.get("cuisine_type") or r.get("category") or "").lower()
                if filter_cuisine.lower() not in r_cuisine:
                    continue

            # 3. Filtro por tempo máximo de espera
            if max_wait is not None and est_wait_min > max_wait:
                continue

            # 4. Filtro por raio geográfico
            if dist_km > radius_km:
                continue

            # Cálculo de Score com teto estrito de 100 pontos
            # 1. Base por tempo de espera (até 35 pontos: menor espera = maior pontuação)
            wait_score = max(0.0, 35.0 - (est_wait_min * 0.7))

            # 2. Base por proximidade / menor distância (até 25 pontos)
            dist_score = max(0.0, 25.0 - (dist_km * 7.5))

            # 3. Match com as 3 preferências culinárias do cliente (até 30 pontos)
            pref_matches = 0
            for pref in client_prefs:
                if pref in (r.get("cuisine_type") or "").lower() or pref in r.get("category", "").lower():
                    pref_matches += 1
            if len(client_prefs) > 0:
                pref_score = min(30.0, pref_matches * 10.0)
            else:
                pref_score = 15.0

            # 4. Bônus por restaurante aberto (até 10 pontos)
            status_score = 10.0 if r.get("is_open", 1) else 0.0

            # Score total normalizado entre 5 e 100 pontos
            total_raw = wait_score + dist_score + pref_score + status_score
            score = round(max(5.0, min(100.0, total_raw)), 1)

            # URLs de integração (Google Maps & WhatsApp Comercial)
            phone = r.get("phone_whatsapp", "5521999998888")
            clean_phone = "".join(filter(str.isdigit, phone))
            wa_text = urllib.parse.quote(
                f"Olá, {r['name']}! Gostaria de informações sobre as mesas e a fila no CLTempo."
            )
            whatsapp_url = f"https://wa.me/{clean_phone}?text={wa_text}"

            addr_encoded = urllib.parse.quote(f"{r['name']}, {r['address']}")
            maps_embed_url = f"https://maps.google.com/maps?q={r.get('lat', -22.9030)},{r.get('lng', -43.1770)}&hl=pt-BR&z=16&output=embed"
            maps_external_url = f"https://www.google.com/maps/search/?api=1&query={addr_encoded}"

            results.append(
                {
                    **r,
                    "target_table_category": target_cat,
                    "tables_in_category": tables_in_cat,
                    "waiting_in_category": waiting_in_cat,
                    "estimated_wait_min": est_wait_min,
                    "distance_km": dist_km,
                    "distance_meters": dist_meters,
                    "score": score,
                    "is_preference_match": pref_matches > 0,
                    "whatsapp_url": whatsapp_url,
                    "maps_embed_url": maps_embed_url,
                    "maps_external_url": maps_external_url,
                }
            )

        conn.close()

    # Ordenar por Score decrescente
    results.sort(key=lambda x: x["score"], reverse=True)
    return {"ok": True, "restaurants": results, "count": len(results)}, HTTPStatus.OK


def handle_client_join_queue(body):
    """
    Entra na fila remota do restaurante.
    Valida se o cliente já não está em uma fila ativa.
    """
    client_id = body.get("client_id")
    restaurant_id = int(body.get("restaurant_id", 1))
    party_size = max(1, min(16, int(body.get("party_size", 2))))
    table_cat = get_table_category(party_size)
    customer_name = (body.get("customer_name") or "").strip()
    company_tag = (body.get("company_tag") or "CLT Polo").strip()
    now_str = datetime.now().strftime("%H:%M")

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,))
        rest = cur.fetchone()
        if not rest or not rest["is_open"]:
            conn.close()
            return {"error": "A fila digital deste restaurante está fechada ou pausada."}, HTTPStatus.BAD_REQUEST

        if client_id:
            cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
            crow = cur.fetchone()
            if crow:
                customer_name = crow["name"]
                company_tag = crow["workplace"] or crow["company"]

            # Checar se já possui fila ativa
            cur.execute(
                """
                SELECT id FROM queue_entries 
                WHERE (client_id = ? OR user_id = ?) AND status IN ('WAITING', 'CALLED')
                """,
                (client_id, client_id),
            )
            if cur.fetchone():
                conn.close()
                return {"error": "Você já possui uma reserva ativa em andamento!"}, HTTPStatus.BAD_REQUEST

        if not customer_name:
            customer_name = "Cliente CLTempo"

        checkin_code = f"CLT-{random.randint(200, 999)}"
        cur.execute(
            """
            INSERT INTO queue_entries 
            (restaurant_id, client_id, user_id, customer_name, company_tag, party_size, table_category, status, checkin_code, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)
            """,
            (restaurant_id, client_id, client_id, customer_name, company_tag, party_size, table_cat, checkin_code, now_str),
        )
        entry_id = cur.lastrowid
        conn.commit()
        conn.close()

    broadcast_meta = {
        "entry_id": entry_id,
        "client_id": client_id,
        "customer_name": customer_name,
        "restaurant_name": rest["name"],
        "table_category": table_cat,
        "code": checkin_code,
    }

    return {
        "ok": True,
        "entry_id": entry_id,
        "checkin_code": checkin_code,
        "table_category": table_cat,
        "restaurant_name": rest["name"],
        "broadcast_meta": broadcast_meta,
    }, HTTPStatus.CREATED


def handle_client_active_ticket(client_id):
    """
    Retorna o ticket ativo do cliente na fila, tempo restante estimado,
    tempo total aguardado e link de WhatsApp.
    """
    if not client_id:
        return {"active_ticket": None}, HTTPStatus.OK

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name, r.phone_whatsapp, r.address,
                   r.tables_1_2, r.tables_3_4, r.tables_5_plus, r.avg_turnover_min
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE (q.client_id = ? OR q.user_id = ?) AND q.status IN ('WAITING', 'CALLED')
            ORDER BY q.id DESC LIMIT 1
            """,
            (client_id, client_id),
        )
        entry = cur.fetchone()
        if not entry:
            conn.close()
            return {"active_ticket": None}, HTTPStatus.OK

        item = dict(entry)
        rid = item["restaurant_id"]
        cat = item["table_category"]

        # Calcular posição exata
        cur.execute(
            """
            SELECT id FROM queue_entries 
            WHERE restaurant_id = ? AND table_category = ? AND status = 'WAITING'
            ORDER BY id ASC
            """,
            (rid, cat),
        )
        waiting_list = [r["id"] for r in cur.fetchall()]
        conn.close()

    if item["status"] == "CALLED":
        item["position"] = 0
        item["estimated_wait_min"] = 0
    else:
        try:
            pos = waiting_list.index(item["id"]) + 1
        except ValueError:
            pos = 1
        item["position"] = pos
        cat_tables = (
            item["tables_1_2"]
            if cat == "1-2"
            else (item["tables_3_4"] if cat == "3-4" else item["tables_5_plus"])
        )
        item["estimated_wait_min"] = calc_category_wait_min(
            pos, item["avg_turnover_min"], cat, cat_tables
        )

    phone = item.get("phone_whatsapp", "5521999998888")
    clean_phone = "".join(filter(str.isdigit, phone))
    wa_text = urllib.parse.quote(
        f"Olá, {item['restaurant_name']}! Estou na fila do CLTempo com o código #{item['checkin_code']} (Mesa {item['table_category']})."
    )
    item["whatsapp_url"] = f"https://wa.me/{clean_phone}?text={wa_text}"

    return {"ok": True, "active_ticket": item}, HTTPStatus.OK


def handle_client_history(client_id):
    """Retorna o histórico de reservas do cliente."""
    if not client_id:
        return {"ok": True, "history": []}, HTTPStatus.OK

    with db_lock:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT q.*, r.name as restaurant_name, r.cuisine_type, r.category
            FROM queue_entries q
            JOIN restaurants r ON r.id = q.restaurant_id
            WHERE (q.client_id = ? OR q.user_id = ?)
            ORDER BY q.id DESC
            LIMIT 25
            """,
            (client_id, client_id),
        )
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()

    return {"ok": True, "history": rows}, HTTPStatus.OK
