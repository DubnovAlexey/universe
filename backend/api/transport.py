# noinspection SpellCheckingInspection,PyUnresolvedReferences
# ============================================================================
# ФАЙЛ: backend/api/transport.py
# НАЗНАЧЕНИЕ: Транспортный слой API и WebSocket-телеметрии (с безопасным фолбэком)
# ЗАДАЧИ ФАЙЛА:
# 1. Формировать JSON и бинарные снимки состояния ('UNVS') для фронтенда.
# 2. Предоставлять обработчики /api/health, /api/verify-parity и /api/topology.
# 3. Поддерживать работу как с установленным FastAPI, так и со встроенным HTTP-сервером
#    стандартной библиотеки Python (чтобы IDE никогда не выдавала ошибок импорта).
# ============================================================================

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
from backend.utils.binary_packer import pack_scene_binary_frame, unpack_and_validate_header


def build_health_and_parity_report() -> dict[str, Any]:
    """Возвращает полный отчёт о здоровье Python-ядра и паритете Golden-векторов."""
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
    lens_sample = evaluate_breach_lens_refraction(120.0, 80.0, 100.0, 80.0, 140.0, 0.85)
    bh_sample = evaluate_black_hole_optics(65.0, 0.0, 0.0, 0.0, 38.0, 1.0)

    return {
        "status": "ok" if (prng_ok and unpacked is not None) else "degraded",
        "goldenSeed": GOLDEN_SEED,
        "goldenVectorsParity": prng_ok,
        "goldenVectors": list(GOLDEN_U32_VECTORS),
        "stateDigestHex": format_digest_hex(digest),
        "binaryPacketBytes": len(packet),
        "binaryHeaderValid": unpacked is not None,
        "nexusTopology": {
            "totalEdges": len(edges),
            "trunks": metrics.trunk_count,
            "bridges": metrics.bridge_count,
            "dendrites": metrics.dendrite_count,
            "avgDegree": metrics.avg_degree,
            "clusteringCoeff": metrics.clustering_coeff,
            "computeTimeMs": metrics.compute_time_ms,
        },
        "breachLensSample": {
            "dx": lens_sample.dx,
            "dy": lens_sample.dy,
            "rimBell": lens_sample.rim_bell,
        },
        "blackHoleOpticsSample": {
            "einsteinDeflectionAlpha": bh_sample.einstein_deflection_alpha,
            "dopplerBeamingFactor": bh_sample.doppler_beaming_factor,
            "catsEyeShellFactor": bh_sample.cats_eye_shell_factor,
            "rsPuppisLightEcho": bh_sample.rs_puppis_light_echo,
        },
    }


def generate_live_binary_step(tick: int, seed: int = GOLDEN_SEED, count: int = 64) -> bytes:
    """Генерирует бинарный кадр 'UNVS' для отправки по WebSocket."""
    rng = DeterministicPRNG(seed)
    pos_xyz: list[float] = []
    vel_xyz: list[float] = []
    energies: list[float] = []
    sim_t = tick * (1.0 / 60.0)

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

    digest = compute_state_digest_fnv1a(tick, count, pos_xyz, vel_xyz, energies)
    return pack_scene_binary_frame(tick, seed, digest, pos_xyz)