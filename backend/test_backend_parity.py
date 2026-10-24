# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/test_backend_parity.py
# НАЗНАЧЕНИЕ: Регрессионные тесты PRNG, UNVS, NEXUS, оптики и отчёта.
# ОГЛАВЛЕНИЕ:
# 1. ИМПОРТЫ И КОНТРАКТЫ.
# 2. TestUniverseBackendParity.
# 3. ЗАПУСК UNITTEST.
# Функции: test_golden_prng_vectors_and_hash, test_state_digest_fnv1a_determinism,
# test_binary_packer_header_and_nan_sanitization,
# test_nexus_decimal_rounding_contract,
# test_cross_language_nexus_6node_fixture_exact_parity,
# test_cross_language_nexus_24node_shared_fixture,
# test_breach_lens_and_black_hole_optics_bounds, test_health_report_and_live_binary_step.
# ============================================================================

# --- НАЧАЛО РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---
from __future__ import annotations
import json
import math
from pathlib import Path
import unittest

from backend.api.transport import (
    build_health_and_parity_report,
    generate_live_binary_step,
)
from backend.core.graph_logic import (
    GraphNodeDTO,
    build_bezier_arc_length_lut,
    compute_nexus_topology,
    round_decimal,
)
from backend.core.prng import (
    DeterministicPRNG,
    GOLDEN_SEED,
    GOLDEN_U32_VECTORS,
    compute_state_digest_fnv1a,
    verify_golden_prng_parity,
)
from backend.core.singularity import evaluate_black_hole_optics
from backend.core.stress_solver import evaluate_breach_lens_refraction
from backend.utils.binary_packer import (
    SCENE_BUFFER_MAGIC,
    SCENE_SCHEMA_VERSION,
    pack_scene_binary_frame,
    unpack_and_validate_header,
)


# --- КОНЕЦ РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---

# --- НАЧАЛО РАЗДЕЛА 2: TestUniverseBackendParity ---
# --- НАЧАЛО КЛАССА TestUniverseBackendParity ---
class TestUniverseBackendParity(unittest.TestCase):
    """Проверяет математические и бинарные инварианты Python-ядра UNIVERSE v2.5."""

    # --- НАЧАЛО ФУНКЦИИ test_golden_prng_vectors_and_hash ---
    def test_golden_prng_vectors_and_hash(self) -> None:
        self.assertTrue(verify_golden_prng_parity())
        rng = DeterministicPRNG(GOLDEN_SEED)
        generated = tuple(rng.next_u32() for _ in range(4))
        self.assertEqual(generated, GOLDEN_U32_VECTORS)

        h1 = DeterministicPRNG.hash_u32(GOLDEN_SEED, 42)
        h2 = DeterministicPRNG.hash_u32(GOLDEN_SEED, 42)
        self.assertEqual(h1, h2)
        self.assertGreater(h1, 0)
    # --- КОНЕЦ ФУНКЦИИ test_golden_prng_vectors_and_hash ---

    # --- НАЧАЛО ФУНКЦИИ test_state_digest_fnv1a_determinism ---
    def test_state_digest_fnv1a_determinism(self) -> None:
        pos = [120.5, -84.25, 1.0, -45.0, 62.0, 0.8]
        vel = [4.0, -3.5, 0.0, -2.0, 5.0, 0.0]
        energy = [0.75, 0.55]

        d1 = compute_state_digest_fnv1a(10, 2, pos, vel, energy, stride=1)
        d2 = compute_state_digest_fnv1a(10, 2, pos, vel, energy, stride=1)
        self.assertEqual(d1, d2)
        self.assertNotEqual(d1, 0)
    # --- КОНЕЦ ФУНКЦИИ test_state_digest_fnv1a_determinism ---

    # --- НАЧАЛО ФУНКЦИИ test_binary_packer_header_and_nan_sanitization ---
    def test_binary_packer_header_and_nan_sanitization(self) -> None:
        pos_with_nan = [10.0, float("nan"), 1.0, float("inf"), -20.0, 0.5]
        packet = pack_scene_binary_frame(
            tick=7,
            seed=GOLDEN_SEED,
            digest=0x12345678,
            positions_xyz=pos_with_nan,
        )
        self.assertEqual(len(packet), 24 + 2 * 12)

        header = unpack_and_validate_header(packet)
        self.assertIsNotNone(header)
        assert header is not None
        self.assertEqual(header.magic, SCENE_BUFFER_MAGIC)
        self.assertEqual(header.schema_version, SCENE_SCHEMA_VERSION)
        self.assertEqual(header.tick, 7)
        self.assertEqual(header.count, 2)
        self.assertEqual(header.seed, GOLDEN_SEED)
        self.assertEqual(header.digest, 0x12345678)
        self.assertIsNone(unpack_and_validate_header(packet[:12]))
    # --- КОНЕЦ ФУНКЦИИ test_binary_packer_header_and_nan_sanitization ---

    # --- НАЧАЛО ФУНКЦИИ test_nexus_decimal_rounding_contract ---
    def test_nexus_decimal_rounding_contract(self) -> None:
        cases = [(1.125, 1.13), (-1.125, -1.12), (2.625, 2.63), (-2.625, -2.62)]
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(round_decimal(value), expected)
        self.assertEqual(round_decimal(0.0625, 3), 0.063)
        self.assertEqual(round_decimal(-0.0625, 3), -0.062)

        # Exact binary ties reach the published graph coordinates through the same contract.
        nodes = [
            GraphNodeDTO(index=0, node_id=0, x=-1.125, y=2.625, cluster_id=0, energy=0.8),
            GraphNodeDTO(index=1, node_id=1, x=81.125, y=-2.625, cluster_id=0, energy=0.8),
            GraphNodeDTO(index=2, node_id=2, x=40.0, y=80.0, cluster_id=1, energy=0.8),
        ]
        edges, _, _ = compute_nexus_topology(nodes, 220.0, GOLDEN_SEED, 0.0)
        first_edge = edges[0]
        self.assertEqual((first_edge.x1, first_edge.y1), (-1.12, 2.63))
        self.assertEqual((first_edge.x2, first_edge.y2), (81.13, -2.62))
    # --- КОНЕЦ ФУНКЦИИ test_nexus_decimal_rounding_contract ---

    # --- НАЧАЛО ФУНКЦИИ test_cross_language_nexus_6node_fixture_exact_parity ---
    def test_cross_language_nexus_6node_fixture_exact_parity(self) -> None:
        """
        Общая каноническая 6-узловая выборка (идентичная parityAndSeams.test.ts),
        доказывающая 100% совпадение рёбер, классов, радиусов Мюррея, LUT и BFS-метрик
        между Python и TypeScript.
        """
        arc_len, lut = build_bezier_arc_length_lut(0.0, 0.0, 50.0, 30.0, 100.0, 0.0)
        self.assertEqual(arc_len, 105.39)
        self.assertEqual(lut, (0.0, 27.41, 52.69, 77.97, 105.39))

        fixture_nodes = [
            GraphNodeDTO(index=0, node_id=0, x=0.0, y=0.0, cluster_id=0, energy=0.9),
            GraphNodeDTO(index=1, node_id=1, x=80.0, y=0.0, cluster_id=0, energy=0.8),
            GraphNodeDTO(index=2, node_id=2, x=40.0, y=80.0, cluster_id=0, energy=0.85),
            GraphNodeDTO(index=3, node_id=3, x=160.0, y=0.0, cluster_id=1, energy=0.75),
            GraphNodeDTO(index=4, node_id=4, x=240.0, y=0.0, cluster_id=1, energy=0.7),
            GraphNodeDTO(index=5, node_id=5, x=200.0, y=80.0, cluster_id=1, energy=0.8),
        ]
        edges, deg_map, metrics = compute_nexus_topology(
            fixture_nodes, 220.0, GOLDEN_SEED, 0.0
        )

        edge_ids = [e.edge_id for e in edges]
        edge_classes = [e.edge_class for e in edges]
        murray_radii = [e.murray_radius_px for e in edges]

        self.assertEqual(
            edge_ids,
            ["0_1", "1_3", "3_4", "0_2", "3_5", "1_2", "2_5", "4_5"],
        )
        self.assertEqual(
            edge_classes,
            [
                "AXON_TRUNK",
                "AXON_TRUNK",
                "AXON_TRUNK",
                "AXON_TRUNK",
                "AXON_TRUNK",
                "DENDRITE",
                "BRIDGE",
                "DENDRITE",
            ],
        )
        self.assertEqual(
            murray_radii,
            [1.95, 1.95, 1.95, 1.95, 1.95, 1.14, 1.35, 1.31],
        )
        self.assertEqual(metrics.trunk_count, 5)
        self.assertEqual(metrics.bridge_count, 1)
        self.assertEqual(metrics.dendrite_count, 2)
        self.assertEqual(metrics.avg_degree, 2.67)
        self.assertEqual(metrics.clustering_coeff, 0.556)
        self.assertEqual(metrics.diameter_hops, 3)
        self.assertEqual(metrics.avg_path_length, 1.53)
        self.assertEqual(deg_map, {0: 2, 1: 3, 2: 3, 3: 3, 4: 2, 5: 3})
    # --- КОНЕЦ ФУНКЦИИ test_cross_language_nexus_6node_fixture_exact_parity ---

    # --- НАЧАЛО ФУНКЦИИ test_cross_language_nexus_24node_shared_fixture ---
    def test_cross_language_nexus_24node_shared_fixture(self) -> None:
        fixture_path = Path(__file__).resolve().parents[1] / "frontend/src/tests/fixtures/nexusParity24.json"
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        inputs = fixture["inputs"]
        expected = fixture["expected"]
        self.assertEqual(len(inputs["nodes"]), 24)

        # Transport consumes x, y, z, vx, vy and energy for every node, in this order.
        rng = DeterministicPRNG(inputs["seed"])
        generated_nodes = []
        for index in range(24):
            x = rng.next_range(-320.0, 320.0)
            y = rng.next_range(-240.0, 240.0)
            rng.next_range(0.1, 1.5)
            rng.next_range(-18.0, 18.0)
            rng.next_range(-18.0, 18.0)
            energy = rng.next_range(0.3, 0.95)
            generated_nodes.append({
                "index": index, "id": index, "x": x, "y": y,
                "clusterId": index % 6, "energy": energy,
            })
        self.assertEqual(generated_nodes, inputs["nodes"])
        nodes = [GraphNodeDTO(
            index=node["index"], node_id=node["id"], x=node["x"], y=node["y"],
            cluster_id=node["clusterId"], energy=node["energy"],
        ) for node in inputs["nodes"]]
        edges, degree_map, metrics = compute_nexus_topology(
            nodes, inputs["maxConnectDist"], inputs["seed"], inputs["simTimeSec"],
        )
        serialized_edges = [{
            "id": edge.edge_id, "fromIndex": edge.from_index, "toIndex": edge.to_index,
            "edgeClass": edge.edge_class, "x1": edge.x1, "y1": edge.y1,
            "x2": edge.x2, "y2": edge.y2, "ctrlX": edge.ctrl_x, "ctrlY": edge.ctrl_y,
            "arcLength": edge.arc_length, "lengthLUT": list(edge.length_lut),
            "murrayRadiusPx": edge.murray_radius_px,
        } for edge in edges]
        self.assertEqual(serialized_edges, expected["edges"])
        self.assertEqual([degree_map[node.index] for node in nodes], expected["degreeByIndex"])
        telemetry = {
            "trunkCount": metrics.trunk_count, "bridgeCount": metrics.bridge_count,
            "dendriteCount": metrics.dendrite_count, "avgDegree": metrics.avg_degree,
            "clusteringCoeff": metrics.clustering_coeff, "diameterHops": metrics.diameter_hops,
            "avgPathLength": metrics.avg_path_length,
        }
        self.assertEqual(telemetry, expected["telemetry"])
        self.assertTrue(all(edge.length_lut[0] == 0 for edge in edges))
        self.assertTrue(all(edge.length_lut[-1] == edge.arc_length for edge in edges))
        self.assertTrue(any(
            edge.arc_length > math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1) + 0.5
            for edge in edges
        ))

        # This 24-node fixture runs BFS from every node; it does not cover sampled BFS.
        report_metrics = build_health_and_parity_report()["nexusTopology"]
        self.assertEqual(report_metrics["totalEdges"], len(expected["edges"]))
        for key, report_key in [("trunkCount", "trunks"), ("bridgeCount", "bridges"),
                                ("dendriteCount", "dendrites"), ("avgDegree", "avgDegree"),
                                ("clusteringCoeff", "clusteringCoeff"),
                                ("diameterHops", "diameterHops"), ("avgPathLength", "avgPathLength")]:
            self.assertEqual(report_metrics[report_key], telemetry[key])
    # --- КОНЕЦ ФУНКЦИИ test_cross_language_nexus_24node_shared_fixture ---

    # --- НАЧАЛО ФУНКЦИИ test_breach_lens_and_black_hole_optics_bounds ---
    def test_breach_lens_and_black_hole_optics_bounds(self) -> None:
        outside = evaluate_breach_lens_refraction(
            px=500.0,
            py=500.0,
            lens_x=100.0,
            lens_y=80.0,
            lens_radius=140.0,
            reveal_intensity=0.85,
        )
        self.assertEqual(outside.dx, 0.0)
        self.assertEqual(outside.dy, 0.0)
        self.assertEqual(outside.rim_bell, 0.0)

        on_rim = evaluate_breach_lens_refraction(
            px=232.0,
            py=80.0,
            lens_x=100.0,
            lens_y=80.0,
            lens_radius=140.0,
            reveal_intensity=0.85,
            global_stress=0.35,
            sim_time_sec=1.0,
        )
        self.assertGreater(on_rim.rim_bell, 0.0)
        self.assertNotEqual(on_rim.dx, 0.0)

        bh = evaluate_black_hole_optics(56.0, 0.0, 0.0, 0.0, 38.0, 1.0)
        self.assertGreater(bh.einstein_deflection_alpha, 0.0)
        self.assertGreater(bh.photon_ring_intensity, 0.0)
    # --- КОНЕЦ ФУНКЦИИ test_breach_lens_and_black_hole_optics_bounds ---

    # --- НАЧАЛО ФУНКЦИИ test_health_report_and_live_binary_step ---
    def test_health_report_and_live_binary_step(self) -> None:
        report = build_health_and_parity_report()
        self.assertEqual(report["status"], "ok")
        self.assertTrue(report["goldenVectorsParity"])
        self.assertTrue(report["binaryHeaderValid"])

        frame = generate_live_binary_step(tick=5, seed=GOLDEN_SEED, count=16)
        unpacked = unpack_and_validate_header(frame)
        self.assertIsNotNone(unpacked)
        assert unpacked is not None
        self.assertEqual(unpacked.tick, 5)
        self.assertEqual(unpacked.count, 16)
    # --- КОНЕЦ ФУНКЦИИ test_health_report_and_live_binary_step ---
# --- КОНЕЦ КЛАССА TestUniverseBackendParity ---


# --- КОНЕЦ РАЗДЕЛА 2: TestUniverseBackendParity ---

# --- НАЧАЛО РАЗДЕЛА 3: ЗАПУСК UNITTEST ---
if __name__ == "__main__":
    unittest.main()
# --- КОНЕЦ РАЗДЕЛА 3: ЗАПУСК UNITTEST ---
