# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/test_backend_parity.py
# НАЗНАЧЕНИЕ: Модульные тесты Python-ядра для запуска через стандартный
#             раннер `python -B -m unittest discover -v` (UNIVERSE v2.5)
# ============================================================================

from __future__ import annotations
import unittest

from backend.api.transport import (
    build_health_and_parity_report,
    generate_live_binary_step,
)
from backend.core.graph_logic import (
    GraphNodeDTO,
    build_bezier_arc_length_lut,
    compute_nexus_topology,
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


class TestUniverseBackendParity(unittest.TestCase):
    """Проверяет математические и бинарные инварианты Python-ядра UNIVERSE v2.5."""

    def test_golden_prng_vectors_and_hash(self) -> None:
        self.assertTrue(verify_golden_prng_parity())
        rng = DeterministicPRNG(GOLDEN_SEED)
        generated = tuple(rng.next_u32() for _ in range(4))
        self.assertEqual(generated, GOLDEN_U32_VECTORS)

        h1 = DeterministicPRNG.hash_u32(GOLDEN_SEED, 42)
        h2 = DeterministicPRNG.hash_u32(GOLDEN_SEED, 42)
        self.assertEqual(h1, h2)
        self.assertGreater(h1, 0)

    def test_state_digest_fnv1a_determinism(self) -> None:
        pos = [120.5, -84.25, 1.0, -45.0, 62.0, 0.8]
        vel = [4.0, -3.5, 0.0, -2.0, 5.0, 0.0]
        energy = [0.75, 0.55]

        d1 = compute_state_digest_fnv1a(10, 2, pos, vel, energy, stride=1)
        d2 = compute_state_digest_fnv1a(10, 2, pos, vel, energy, stride=1)
        self.assertEqual(d1, d2)
        self.assertNotEqual(d1, 0)

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

        # Обрезанный пакет должен отклоняться
        self.assertIsNone(unpack_and_validate_header(packet[:12]))

    def test_nexus_topology_and_bezier_lut(self) -> None:
        arc_len, lut = build_bezier_arc_length_lut(0.0, 0.0, 50.0, 30.0, 100.0, 0.0)
        self.assertGreater(arc_len, 100.0)
        self.assertEqual(lut[0], 0.0)
        self.assertLessEqual(lut[1], lut[2])
        self.assertLessEqual(lut[2], lut[3])
        self.assertLessEqual(lut[3], lut[4])

        rng = DeterministicPRNG(GOLDEN_SEED)
        nodes = [
            GraphNodeDTO(
                index=i,
                node_id=i,
                x=rng.next_range(-320.0, 320.0),
                y=rng.next_range(-240.0, 240.0),
                cluster_id=i % 6,
                energy=rng.next_range(0.3, 0.95),
            )
            for i in range(24)
        ]
        edges, deg_map, metrics = compute_nexus_topology(nodes, 220.0, GOLDEN_SEED, 1.0)
        self.assertGreater(len(edges), 0)
        self.assertGreater(metrics.trunk_count, 0)
        self.assertEqual(
            len(edges),
            metrics.trunk_count + metrics.bridge_count + metrics.dendrite_count,
            )
        self.assertGreater(metrics.diameter_hops, 0)
        self.assertGreater(metrics.avg_path_length, 0.0)
        self.assertEqual(len(deg_map), 24)

    def test_breach_lens_and_black_hole_optics_bounds(self) -> None:
        # За пределами кольца преломления (u >= 1.0) смещение строго равно 0
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

        # На кольце преломления (px=232, d≈0.94, u<1.0) смещение ненулевое
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


if __name__ == "__main__":
    unittest.main()