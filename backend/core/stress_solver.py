# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/core/stress_solver.py
# НАЗНАЧЕНИЕ: Решатель упругого напряжения мембраны и C¹-рефракции BREACH LENS
# ЗАДАЧИ ФАЙЛА:
# 1. Вычислять C¹-непрерывное радиальное и тангенциальное смещение
#    delta(p) = r_hat * A * g(d) + t_hat * B * g(d) с колоколом g(u) = (1 - u^2)^2.
# 2. Гарантировать строгое равенство g(d) = 0 за пределами кольца (u >= 1.0).
# 3. Поддерживать полный математический паритет с stressState.ts и breach_math.rs.
# ============================================================================

from __future__ import annotations
from dataclasses import dataclass
import math


@dataclass(frozen=True)
class LensRefractionSample:
    dx: float
    dy: float
    rim_bell: float
    truth_reveal_factor: float


def evaluate_breach_lens_refraction(
        px: float,
        py: float,
        lens_x: float,
        lens_y: float,
        lens_radius: float,
        reveal_intensity: float,
        global_stress: float = 0.25,
        sim_time_sec: float = 0.0,
) -> LensRefractionSample:
    """
    Вычисляет вектор оптического преломления и фактор раскрытия X-RAY в точке (px, py).
    """
    if lens_radius < 8.0:
        return LensRefractionSample(dx=0.0, dy=0.0, rim_bell=0.0, truth_reveal_factor=0.0)

    delta_x = px - lens_x
    delta_y = py - lens_y
    dist = math.hypot(delta_x, delta_y) + 0.0001
    angle = math.atan2(delta_y, delta_x)

    warp = 1.0 + (
            math.sin(angle * 3.0 + sim_time_sec * 1.7) * 0.042
            + math.cos(angle * 5.0 - sim_time_sec * 1.1) * 0.024
    ) * (0.5 + global_stress * 0.5)

    local_r = max(8.0, lens_radius * warp)
    d = dist / local_r

    # Фактор раскрытия слоя X-RAY внутри линзы (ядро d <= 0.55 + полоса смешивания 0.55..1.0)
    truth_reveal = 0.0
    if d < 1.0:
        if d <= 0.55:
            truth_reveal = 0.45 + reveal_intensity * 0.55
        else:
            t = max(0.0, min(1.0, (d - 0.55) / 0.45))
            smooth = t * t * (3.0 - 2.0 * t)
            truth_reveal = (1.0 - smooth) * (0.45 + reveal_intensity * 0.55)

    ring_half_width = 0.24
    u = abs(d - 1.0) / ring_half_width

    # Строго g(d) = 0 за пределами кольца преломления (u >= 1.0) по MASTER 04
    if u >= 1.0:
        return LensRefractionSample(
            dx=0.0,
            dy=0.0,
            rim_bell=0.0,
            truth_reveal_factor=round(truth_reveal, 4),
        )

    one_minus_u2 = 1.0 - u * u
    g = one_minus_u2 * one_minus_u2

    r_hat_x = delta_x / dist
    r_hat_y = delta_y / dist
    t_hat_x = -r_hat_y
    t_hat_y = r_hat_x

    radial_amp = (6.5 + reveal_intensity * 8.5) * g
    tangent_amp = math.sin(angle * 4.0 + sim_time_sec * 2.0) * 3.4 * g

    offset_x = r_hat_x * radial_amp + t_hat_x * tangent_amp
    offset_y = r_hat_y * radial_amp + t_hat_y * tangent_amp

    return LensRefractionSample(
        dx=round(offset_x, 3),
        dy=round(offset_y, 3),
        rim_bell=round(g, 4),
        truth_reveal_factor=round(truth_reveal, 4),
    )