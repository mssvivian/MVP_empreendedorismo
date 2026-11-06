"""
Testes automatizados do CLTempo (somente biblioteca padrão).

Rodar a partir da raiz do projeto:
    python3 -m unittest discover -s tests -v

Cada teste usa um banco SQLite temporário e recriado do zero (com os dados de
demonstração), e a geolocalização via OpenStreetMap fica desligada para os
testes não dependerem de internet.
"""

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

_TMP_DIR = tempfile.mkdtemp(prefix="cltempo-tests-")
os.environ["DB_PATH"] = os.path.join(_TMP_DIR, "test.db")
os.environ["CLTEMPO_DISABLE_OSM"] = "1"
os.environ.pop("GOOGLE_MAPS_API_KEY", None)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from http import HTTPStatus  # noqa: E402

import admin_api  # noqa: E402
import app  # noqa: E402
import client_api  # noqa: E402
import restaurant_api  # noqa: E402
from db import get_db_connection, init_db  # noqa: E402

VIVIAN_ID = 1  # cliente da demonstração sem reserva ativa
VERDE_ID = 5  # Verde & Fresco Saladas


def query_one(sql, params=()):
    conn = get_db_connection()
    row = conn.execute(sql, params).fetchone()
    conn.close()
    return dict(row) if row else None


class BaseTestCase(unittest.TestCase):
    def setUp(self):
        init_db(force_reset=True)

    def join_and_serve(self, client_id=VIVIAN_ID, restaurant_id=VERDE_ID):
        """Cliente entra na fila, é chamado e faz check-in. Retorna o entry_id."""
        data, status = client_api.handle_client_join_queue(
            {"client_id": client_id, "restaurant_id": restaurant_id, "party_size": 2, "customer_name": "Teste"}
        )
        self.assertEqual(status, HTTPStatus.CREATED, data)
        entry_id = data["entry_id"]

        data, status = restaurant_api.handle_restaurant_call_client({"entry_id": entry_id})
        self.assertEqual(status, HTTPStatus.OK, data)
        data, status = restaurant_api.handle_restaurant_seat_client({"entry_id": entry_id})
        self.assertEqual(status, HTTPStatus.OK, data)
        return entry_id


class FeedbackTests(BaseTestCase):
    def test_feedback_registra_tempo_e_linha_de_base(self):
        conn = get_db_connection()
        conn.execute("UPDATE clients SET baseline_standing_wait_min = NULL WHERE id = ?", (VIVIAN_ID,))
        conn.commit()
        conn.close()

        entry_id = self.join_and_serve()
        data, status = client_api.handle_client_feedback(
            {
                "entry_id": entry_id,
                "client_id": VIVIAN_ID,
                "perceived_standing_wait_min": 3,
                "baseline_standing_wait_min": 40,
            }
        )
        self.assertEqual(status, HTTPStatus.OK, data)
        self.assertEqual(data["client"]["baseline_standing_wait_min"], 40)

        entry = query_one("SELECT perceived_standing_wait_min FROM queue_entries WHERE id = ?", (entry_id,))
        self.assertEqual(entry["perceived_standing_wait_min"], 3)

    def test_feedback_recusado_antes_de_ser_atendido(self):
        data, status = client_api.handle_client_join_queue(
            {"client_id": VIVIAN_ID, "restaurant_id": VERDE_ID, "party_size": 2}
        )
        data, status = client_api.handle_client_feedback(
            {"entry_id": data["entry_id"], "client_id": VIVIAN_ID, "perceived_standing_wait_min": 5}
        )
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)

    def test_feedback_recusado_para_reserva_de_outro_cliente(self):
        entry_id = self.join_and_serve()
        data, status = client_api.handle_client_feedback(
            {"entry_id": entry_id, "client_id": 2, "perceived_standing_wait_min": 5}
        )
        self.assertEqual(status, HTTPStatus.FORBIDDEN)

    def test_feedback_exige_minutos(self):
        entry_id = self.join_and_serve()
        data, status = client_api.handle_client_feedback({"entry_id": entry_id, "client_id": VIVIAN_ID})
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)

    def test_linha_de_base_no_cadastro_e_no_perfil(self):
        data, status = client_api.handle_client_register(
            {"name": "Nova", "email": "nova@teste.com", "password": "1234", "baseline_standing_wait_min": "25"}
        )
        self.assertEqual(status, HTTPStatus.CREATED, data)
        self.assertEqual(data["client"]["baseline_standing_wait_min"], 25)

        client_id = data["client"]["id"]
        data, status = client_api.handle_client_update_profile(client_id, {"baseline_standing_wait_min": 30})
        self.assertEqual(status, HTTPStatus.OK, data)
        self.assertEqual(data["client"]["baseline_standing_wait_min"], 30)


class MetricM4Tests(BaseTestCase):
    def test_sem_respostas_nao_inventa_valor(self):
        conn = get_db_connection()
        conn.execute("UPDATE queue_entries SET perceived_standing_wait_min = NULL")
        conn.execute("UPDATE clients SET baseline_standing_wait_min = NULL")
        conn.commit()
        conn.close()

        m4 = admin_api.calculate_canvas_metrics()["m4_standing_wait_reduction"]
        self.assertEqual(m4["feedback_count"], 0)
        self.assertIsNone(m4["avg_standing_with_app_min"])
        self.assertIsNone(m4["reduction_pct"])
        self.assertEqual(m4["baseline_source"], "benchmark")

    def test_reducao_usa_linha_de_base_dos_clientes(self):
        conn = get_db_connection()
        conn.execute("UPDATE queue_entries SET perceived_standing_wait_min = NULL")
        conn.execute("UPDATE clients SET baseline_standing_wait_min = NULL")
        conn.execute("UPDATE clients SET baseline_standing_wait_min = 40 WHERE id = ?", (VIVIAN_ID,))
        conn.commit()
        conn.close()

        entry_id = self.join_and_serve()
        client_api.handle_client_feedback(
            {"entry_id": entry_id, "client_id": VIVIAN_ID, "perceived_standing_wait_min": 4}
        )

        m4 = admin_api.calculate_canvas_metrics()["m4_standing_wait_reduction"]
        self.assertEqual(m4["baseline_source"], "clientes")
        self.assertEqual(m4["avg_standing_without_app_min"], 40.0)
        self.assertEqual(m4["avg_standing_with_app_min"], 4.0)
        self.assertEqual(m4["reduction_pct"], 90.0)
        self.assertEqual(m4["minutes_saved_per_lunch"], 36.0)


class LeadsTests(BaseTestCase):
    def test_adicionar_atualizar_e_remover_lead(self):
        before = admin_api.calculate_canvas_metrics()["m1_restaurant_conversion"]

        data, status = admin_api.handle_admin_leads_update(
            {"restaurant_name": "Restaurante Teste", "contact_person": "Ana", "status": "APPROACHED"}
        )
        self.assertEqual(status, HTTPStatus.OK, data)
        lead = query_one("SELECT * FROM restaurant_leads WHERE restaurant_name = 'Restaurante Teste'")
        self.assertEqual(lead["status"], "APPROACHED")

        data, status = admin_api.handle_admin_leads_update({"lead_id": lead["id"], "status": "ONBOARDED"})
        self.assertEqual(status, HTTPStatus.OK, data)
        after = admin_api.calculate_canvas_metrics()["m1_restaurant_conversion"]
        self.assertEqual(after["total_approached"], before["total_approached"] + 1)
        self.assertEqual(after["onboarded"], before["onboarded"] + 1)

        data, status = admin_api.handle_admin_leads_delete({"lead_id": lead["id"]})
        self.assertEqual(status, HTTPStatus.OK, data)
        self.assertIsNone(query_one("SELECT * FROM restaurant_leads WHERE id = ?", (lead["id"],)))

    def test_status_invalido_e_nome_obrigatorio(self):
        _, status = admin_api.handle_admin_leads_update({"restaurant_name": "X", "status": "TALVEZ"})
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        _, status = admin_api.handle_admin_leads_update({"status": "APPROACHED"})
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)

    def test_remover_lead_inexistente(self):
        _, status = admin_api.handle_admin_leads_delete({"lead_id": 99999})
        self.assertEqual(status, HTTPStatus.NOT_FOUND)


class GeocodingTests(unittest.TestCase):
    def test_marco_conhecido(self):
        self.assertEqual(client_api.geocode_address("Edifício RB1"), (-22.9018, -43.1764))

    def test_fallback_offline_e_deterministico(self):
        a = client_api.geocode_address("Endereço inventado 123")
        b = client_api.geocode_address("Endereço inventado 123")
        self.assertEqual(a, b)

    def test_autocomplete_catalogo(self):
        data, status = client_api.handle_client_places_autocomplete("rb1")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertTrue(data["predictions"])
        self.assertEqual(data["source"], "catalogo_polo")

    def test_formatacao_resultado_openstreetmap(self):
        feature = {
            "geometry": {"coordinates": [-43.176287, -22.901052]},
            "properties": {
                "name": "Centro Cultural Banco do Brasil",
                "street": "Rua Primeiro de Março",
                "housenumber": "66",
                "district": "Centro",
                "city": "Rio de Janeiro",
            },
        }
        item = client_api._format_osm_feature(feature)
        self.assertEqual(item["lat"], -22.901052)
        self.assertEqual(item["lng"], -43.176287)
        self.assertIn("Rua Primeiro de Março, 66", item["secondary_text"])


class HttpTests(BaseTestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = app.ReusableThreadingHTTPServer(("127.0.0.1", 0), app.CLTempoRequestHandler)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, path, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                return res.status, json.loads(res.read())
        except urllib.error.HTTPError as err:
            return err.code, json.loads(err.read())

    def test_estado_e_pagina_inicial(self):
        status, state = self.request("/api/state")
        self.assertEqual(status, 200)
        self.assertIn("m4_standing_wait_reduction", state["metrics"])
        with urllib.request.urlopen(self.base + "/", timeout=5) as res:
            self.assertEqual(res.status, 200)

    def test_rotas_de_feedback_e_leads(self):
        entry_id = self.join_and_serve()
        status, data = self.request(
            "/api/client/feedback",
            {"entry_id": entry_id, "client_id": VIVIAN_ID, "perceived_standing_wait_min": 2},
        )
        self.assertEqual(status, 200, data)

        status, data = self.request("/api/admin/leads/update", {"restaurant_name": "Via HTTP", "status": "DECLINED"})
        self.assertEqual(status, 200, data)
        lead = query_one("SELECT id FROM restaurant_leads WHERE restaurant_name = 'Via HTTP'")
        status, data = self.request("/api/admin/leads/delete", {"lead_id": lead["id"]})
        self.assertEqual(status, 200, data)


if __name__ == "__main__":
    unittest.main()
