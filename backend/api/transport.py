# noinspection SpellCheckingInspection,PyUnresolvedReferences
# ============================================================================
# ФАЙЛ: backend/api/transport.py
# НАЗНАЧЕНИЕ: Эталонный отчёт математического паритета и генерация бинарных кадров UNVS.
# ОГЛАВЛЕНИЕ:
# 1. ИМПОРТЫ И КОНТРАКТЫ.
# 2. build_health_and_parity_report.
# 3. generate_live_binary_step.
# Функции: build_health_and_parity_report, generate_live_binary_step.
# ============================================================================

# --- НАЧАЛО РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---
from __future__ import annotations
import math
from typing import Any

from backend.core.prng import (
    DeterministicPRNG,
    GOLDEN_SEED,
    GOLDEN_U32_VECTORS,
    compute_state_digest_fnv1a,
    format_digest_hex,
    verify_golden_prng_parity,
)
from backend.core.graph_logic import GraphNodeDTO, compute_nexus_topology
from backend.core.stress_solver import evaluate_breach_lens_refraction
from backend.core.singularity import evaluate_black_hole_optics
from backend.utils.binary_packer import (
    pack_scene_binary_frame,
    unpack_and_validate_header,
)



# --- КОНЕЦ РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---

# --- НАЧАЛО РАЗДЕЛА 2: build_health_and_parity_report ---
# --- НАЧАЛО ФУНКЦИИ build_health_and_parity_report ---
def build_health_and_parity_report() -> dict[str, Any]:
    """
    Возвращает полный отчёт о здоровье Python-ядра и паритете всех 5 подсистем:
    PRNG, бинарного пакета 'UNVS', графа NEXUS, кольца преломления BREACH LENS
    и релятивистской оптики Чёрной дыры.
    """
    prng_ok = verify_golden_prng_parity()

    rng = DeterministicPRNG(GOLDEN_SEED)
    pos_xyz: list[float] = []
    vel_xyz: list[float] = []
    energies: list[float] = []
    nodes: list[GraphNodeDTO] = []

    for i in range(24):
        x = rng.next_range(-320.0, 320.0)
        y = rng.next_range(-240.0, 240.0)
        z = rng.next_range(0.1, 1.5)
        vx = rng.next_range(-18.0, 18.0)
        vy = rng.next_range(-18.0, 18.0)
        e = rng.next_range(0.3, 0.95)

        pos_xyz.extend([x, y, z])
        vel_xyz.extend([vx, vy, 0.0])
        energies.append(e)
        nodes.append(
            GraphNodeDTO(
                index=i,
                node_id=i,
                x=x,
                y=y,
                cluster_id=i % 6,
                energy=e,
            )
        )

    digest = compute_state_digest_fnv1a(1, len(nodes), pos_xyz, vel_xyz, energies)
    packet = pack_scene_binary_frame(1, GOLDEN_SEED, digest, pos_xyz)
    unpacked = unpack_and_validate_header(packet)

    edges, _deg, metrics = compute_nexus_topology(nodes, 220.0, GOLDEN_SEED, 1.0)

    # Точка (232.0, 80.0) относительно центра линзы (100.0, 80.0)
    # при радиусе 140.0 лежит непосредственно в кольце преломления (dist=132, d≈0.94, u<1.0),
    # что даёт ненулевые значения dx, dy, rim_bell и truth_reveal_factor.
    lens_sample = evaluate_breach_lens_refraction(
        px=232.0,
        py=80.0,
        lens_x=100.0,
        lens_y=80.0,
        lens_radius=140.0,
        reveal_intensity=0.85,
        global_stress=0.35,
        sim_time_sec=1.0,
    )
    bh_sample = evaluate_black_hole_optics(56.0, 0.0, 0.0, 0.0, 38.0, 1.0)

    header_ok = (
            unpacked is not None
            and unpacked.count == len(nodes)
            and unpacked.digest == digest
    )
    topology_ok = len(edges) > 0 and metrics.trunk_count > 0
    lens_ok = lens_sample.rim_bell > 0.0 and abs(lens_sample.dx) > 0.0
    bh_ok = (
            bh_sample.einstein_deflection_alpha > 0.0
            and bh_sample.photon_ring_intensity > 0.0
    )

    all_checks_ok = prng_ok and header_ok and topology_ok and lens_ok and bh_ok

    return {
        "status": "ok" if all_checks_ok else "degraded",
        "goldenSeed": GOLDEN_SEED,
        "goldenVectorsParity": prng_ok,
        "goldenVectors": list(GOLDEN_U32_VECTORS),
        "stateDigestHex": format_digest_hex(digest),
        "binaryPacketBytes": len(packet),
        "binaryHeaderValid": header_ok,
        "nexusTopology": {
            "totalEdges": len(edges),
            "trunks": metrics.trunk_count,
            "bridges": metrics.bridge_count,
            "dendrites": metrics.dendrite_count,
            "avgDegree": metrics.avg_degree,
            "clusteringCoeff": metrics.clustering_coeff,
            "diameterHops": metrics.diameter_hops,
            "avgPathLength": metrics.avg_path_length,
            "computeTimeMs": metrics.compute_time_ms,
        },
        "breachLensSample": {
            "dx": lens_sample.dx,
            "dy": lens_sample.dy,
            "rimBell": lens_sample.rim_bell,
            "truthRevealFactor": lens_sample.truth_reveal_factor,
        },
        "blackHoleOpticsSample": {
            "einsteinDeflectionAlpha": bh_sample.einstein_deflection_alpha,
            "photonRingIntensity": bh_sample.photon_ring_intensity,
            "dopplerBeamingFactor": bh_sample.doppler_beaming_factor,
            "catsEyeShellFactor": bh_sample.cats_eye_shell_factor,
            "rsPuppisLightEcho": bh_sample.rs_puppis_light_echo,
        },
    }
# --- КОНЕЦ ФУНКЦИИ build_health_and_parity_report ---



# --- КОНЕЦ РАЗДЕЛА 2: build_health_and_parity_report ---

# --- НАЧАЛО РАЗДЕЛА 3: generate_live_binary_step ---
# --- НАЧАЛО ФУНКЦИИ generate_live_binary_step ---
def generate_live_binary_step(
        tick: int,
        seed: int = GOLDEN_SEED,
        count: int = 64,
) -> bytes:
    """Генерирует бинарный кадр 'UNVS' для заданного монотонного номера тика."""
    safe_tick = max(1, int(tick))
    rng = DeterministicPRNG(seed)
    pos_xyz: list[float] = []
    vel_xyz: list[float] = []
    energies: list[float] = []
    sim_t = safe_tick * (1.0 / 60.0)

    for i in range(count):
        base_angle = rng.next_range(0.0, math.tau) + sim_t * 0.25
        radius = rng.next_range(30.0, 420.0)
        x = math.cos(base_angle) * radius
        y = math.sin(base_angle) * radius * 0.78
        z = rng.next_range(0.15, 1.45)
        vx = -math.sin(base_angle) * 12.0
        vy = math.cos(base_angle) * 12.0
        e = rng.next_range(0.35, 0.95)

        pos_xyz.extend([x, y, z])
        vel_xyz.extend([vx, vy, 0.0])
        energies.append(e)

    digest = compute_state_digest_fnv1a(safe_tick, count, pos_xyz, vel_xyz, energies)
    return pack_scene_binary_frame(safe_tick, seed, digest, pos_xyz)
# --- КОНЕЦ ФУНКЦИИ generate_live_binary_step ---
# --- КОНЕЦ РАЗДЕЛА 3: generate_live_binary_step ---
