# noinspection SpellCheckingInspection,PyUnresolvedReferences
# ============================================================================
# ФАЙЛ: backend/core/singularity.py
# НАЗНАЧЕНИЕ: Релятивистская модель Чёрной дыры, светового эха RS Puppis и кодового потока
# ЗАДАЧИ ФАЙЛА:
# 1. Вычислять гравитационное отклонение лучей Эйнштейна alpha = 4GM / (c^2 * b) = 2 * R_s / b
#    и релятивистское доплеровское усиление яркости аккреционного диска D^3.
# 2. Моделировать волну светового эха переменной звезды RS Кормы (RS Puppis, Hubble)
#    и многослойные оболочки звезды Вольфа — Райе («Кошачий глаз» NGC 6543).
# 3. Генерировать непрерывный поток символов и структур для финального экрана.
# ============================================================================

from __future__ import annotations
import math

try:
    from backend.core.prng import DeterministicPRNG
except ImportError:
    from .prng import DeterministicPRNG

CIPHER_STREAM_ALPHABET: str = (
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴"
)

CIPHER_STREAM_PALETTE: tuple[str, ...] = (
    "#F8FAFC",
    "#7DD3FC",
    "#38BDF8",
    "#6366F1",
    "#8B5CF6",
    "#F59E0B",
)


class RelativisticBlackHoleSample:
    """Результат расчёта релятивистской оптики Чёрной дыры и оболочек туманности."""

    __slots__ = (
        "impact_parameter_b",
        "einstein_deflection_alpha",
        "photon_ring_intensity",
        "doppler_beaming_factor",
        "cats_eye_shell_factor",
        "rs_puppis_light_echo",
    )

    def __init__(
            self,
            impact_parameter_b: float,
            einstein_deflection_alpha: float,
            photon_ring_intensity: float,
            doppler_beaming_factor: float,
            cats_eye_shell_factor: float,
            rs_puppis_light_echo: float,
    ) -> None:
        self.impact_parameter_b = impact_parameter_b
        self.einstein_deflection_alpha = einstein_deflection_alpha
        self.photon_ring_intensity = photon_ring_intensity
        self.doppler_beaming_factor = doppler_beaming_factor
        self.cats_eye_shell_factor = cats_eye_shell_factor
        self.rs_puppis_light_echo = rs_puppis_light_echo


def evaluate_black_hole_optics(
        px: float,
        py: float,
        center_x: float,
        center_y: float,
        schwarzschild_radius: float = 38.0,
        sim_time_sec: float = 0.0,
) -> RelativisticBlackHoleSample:
    """
    Рассчитывает оптические параметры Чёрной дыры (EHT / M87* / Sgr A*), оболочек
    NGC 6543 («Кошачий глаз») и светового эха цефеиды RS Puppis в точке (px, py).
    """
    dx = px - center_x
    dy = py - center_y
    b = math.hypot(dx, dy) + 0.1
    r_s = max(10.0, schwarzschild_radius)

    if b < r_s:
        return RelativisticBlackHoleSample(
            impact_parameter_b=round(b, 2),
            einstein_deflection_alpha=2.0,
            photon_ring_intensity=0.0,
            doppler_beaming_factor=0.0,
            cats_eye_shell_factor=0.0,
            rs_puppis_light_echo=0.0,
        )

    # 1. Гравитационное отклонение луча Эйнштейна: alpha ≈ 4GM / (c^2 * b) = 2 * R_s / b
    deflection_alpha = min(2.0, (2.0 * r_s) / b)

    # 2. Узкое фотонное кольцо на критическом прицельном параметре b_c ≈ 1.5 * R_s
    photon_ring = math.exp(-(((b - r_s * 1.48) / (r_s * 0.18)) ** 2))

    # 3. Релятивистское доплеровское усиление приближающегося крыла диска (dx < 0)
    beta_proj = max(-0.55, min(0.55, -dx / max(40.0, r_s * 4.5)))
    gamma = 1.0 / math.sqrt(max(0.1, 1.0 - beta_proj * beta_proj))
    doppler_d = 1.0 / (gamma * (1.0 - beta_proj))
    doppler_beaming = max(0.25, min(2.4, doppler_d ** 2.2))

    # 4. Концентрические газовые коконы по аналогии с туманностью «Кошачий глаз» (NGC 6543)
    angle = math.atan2(dy, dx)
    filament_mod = 1.0 + 0.08 * math.sin(angle * 8.0 + sim_time_sec * 0.5)
    shell_wave = math.sin((b * filament_mod) / (r_s * 0.65) - sim_time_sec * 0.9)
    cats_eye_shell = (max(0.0, shell_wave) ** 2) * math.exp(-b / (r_s * 7.5))

    # 5. Расходящееся световое эхо по аналогии с переменной звездой RS Кормы (RS Puppis)
    echo_phase = (b / (r_s * 1.2) - sim_time_sec * 1.65) % (math.pi * 2.0)
    light_echo = (0.5 + 0.5 * math.sin(echo_phase)) * math.exp(-b / (r_s * 9.0))

    return RelativisticBlackHoleSample(
        impact_parameter_b=round(b, 2),
        einstein_deflection_alpha=round(deflection_alpha, 4),
        photon_ring_intensity=round(photon_ring, 4),
        doppler_beaming_factor=round(doppler_beaming, 4),
        cats_eye_shell_factor=round(cats_eye_shell, 4),
        rs_puppis_light_echo=round(light_echo, 4),
    )


def sample_endless_cipher_stream(
        seed: int,
        row_index: int,
        col_index: int,
        sim_time_sec: float,
) -> tuple[str, str]:
    """
    Возвращает текущий символ и HEX-цвет для непрерывного кодового потока в финале.
    """
    rate_hz = 4.5 + (DeterministicPRNG.hash_u32(seed, row_index * 31 + col_index) % 7) * 0.85
    step_tick = int(math.floor(sim_time_sec * rate_hz))
    h = DeterministicPRNG.hash_u32(seed + step_tick * 17, row_index * 131 + col_index * 19)

    glyph = CIPHER_STREAM_ALPHABET[h % len(CIPHER_STREAM_ALPHABET)]
    color = CIPHER_STREAM_PALETTE[(h >> 8) % len(CIPHER_STREAM_PALETTE)]
    return glyph, color