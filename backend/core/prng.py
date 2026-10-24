# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/core/prng.py
# НАЗНАЧЕНИЕ: Детерминированные Mulberry32, SplitMix32 и квантованный FNV-1a дайджест.
# ОГЛАВЛЕНИЕ:
# 1. ИМПОРТЫ И КОНТРАКТЫ.
# 2. DeterministicPRNG.
# 3. verify_golden_prng_parity.
# Функции: _u32, _imul32, quantize_half_up, verify_golden_prng_parity,
# compute_state_digest_fnv1a, format_digest_hex, __init__, next_u32, next_float, next_range,
# hash_u32, hash_float.
# ============================================================================

# --- НАЧАЛО РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---
from __future__ import annotations
import math
from typing import Sequence

GOLDEN_SEED: int = 104729
GOLDEN_U32_VECTORS: tuple[int, int, int, int] = (
    325253669,
    3481002091,
    881690241,
    2630884050,
)

FNV_OFFSET_BASIS: int = 0x811C9DC5
FNV_PRIME: int = 0x01000193



# --- НАЧАЛО ФУНКЦИИ _u32 ---
def _u32(val: int) -> int:
    """Приведение целого числа к беззнаковому 32-битному диапазону uint32."""
    return val & 0xFFFFFFFF
# --- КОНЕЦ ФУНКЦИИ _u32 ---


# --- НАЧАЛО ФУНКЦИИ _imul32 ---
def _imul32(a: int, b: int) -> int:
    """Точный аналог Math.imul(a, b) и u32::wrapping_mul в 32-битной арифметике."""
    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF
# --- КОНЕЦ ФУНКЦИИ _imul32 ---


# --- НАЧАЛО ФУНКЦИИ quantize_half_up ---
def quantize_half_up(val: float) -> int:
    """Единое правило округления floor(x + 0.5), идентичное TypeScript и Rust."""
    return int(math.floor(val + 0.5))
# --- КОНЕЦ ФУНКЦИИ quantize_half_up ---


# --- КОНЕЦ РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---

# --- НАЧАЛО РАЗДЕЛА 2: DeterministicPRNG ---
# --- НАЧАЛО КЛАССА DeterministicPRNG ---
class DeterministicPRNG:
    """Детерминированный 32-битный генератор псевдослучайных чисел."""

    __slots__ = ("_state",)

    # --- НАЧАЛО ФУНКЦИИ __init__ ---
    def __init__(self, seed: int = GOLDEN_SEED) -> None:
        clean_seed = _u32(seed)
        self._state: int = 0x6D2B79F5 if clean_seed == 0 else clean_seed
    # --- КОНЕЦ ФУНКЦИИ __init__ ---

    # --- НАЧАЛО ФУНКЦИИ next_u32 ---
    def next_u32(self) -> int:
        self._state = _u32(self._state + 0x6D2B79F5)
        z = self._state
        z = _imul32(z ^ (z >> 15), z | 1)
        z ^= _u32(z + _imul32(z ^ (z >> 7), z | 61))
        return _u32(z ^ (z >> 14))
    # --- КОНЕЦ ФУНКЦИИ next_u32 ---

    # --- НАЧАЛО ФУНКЦИИ next_float ---
    def next_float(self) -> float:
        return self.next_u32() / 4294967296.0
    # --- КОНЕЦ ФУНКЦИИ next_float ---

    # --- НАЧАЛО ФУНКЦИИ next_range ---
    def next_range(self, min_val: float, max_val: float) -> float:
        return min_val + self.next_float() * (max_val - min_val)
    # --- КОНЕЦ ФУНКЦИИ next_range ---

    # --- НАЧАЛО ФУНКЦИИ hash_u32 ---
    @staticmethod
    def hash_u32(seed: int, index: int) -> int:
        h = _u32(_u32(seed) ^ _imul32(_u32(index), 0x9E3779B9))
        h = _imul32(h ^ (h >> 16), 0x85EBCA6B)
        h = _imul32(h ^ (h >> 13), 0xC2B2AE35)
        return _u32(h ^ (h >> 16))
    # --- КОНЕЦ ФУНКЦИИ hash_u32 ---

    # --- НАЧАЛО ФУНКЦИИ hash_float ---
    @staticmethod
    def hash_float(seed: int, index: int) -> float:
        return DeterministicPRNG.hash_u32(seed, index) / 4294967296.0
    # --- КОНЕЦ ФУНКЦИИ hash_float ---
# --- КОНЕЦ КЛАССА DeterministicPRNG ---



# --- КОНЕЦ РАЗДЕЛА 2: DeterministicPRNG ---

# --- НАЧАЛО РАЗДЕЛА 3: verify_golden_prng_parity ---
# --- НАЧАЛО ФУНКЦИИ verify_golden_prng_parity ---
def verify_golden_prng_parity() -> bool:
    """Проверка побитового совпадения с эталонными векторами TypeScript и Rust."""
    rng = DeterministicPRNG(GOLDEN_SEED)
    for expected in GOLDEN_U32_VECTORS:
        if rng.next_u32() != expected:
            return False
    return True
# --- КОНЕЦ ФУНКЦИИ verify_golden_prng_parity ---


# --- НАЧАЛО ФУНКЦИИ compute_state_digest_fnv1a ---
def compute_state_digest_fnv1a(
        tick: int,
        active_count: int,
        pos_xyz: Sequence[float],
        vel_xyz: Sequence[float],
        energy: Sequence[float],
        stride: int = 4,
) -> int:
    """
    Вычисляет 32-битный FNV-1a дайджест состояния (полный паритет с prng.ts и prng.rs).
    """
    h = FNV_OFFSET_BASIS
    h = _imul32(h ^ _u32(tick), FNV_PRIME)
    h = _imul32(h ^ _u32(active_count), FNV_PRIME)

    limit = min(active_count, len(pos_xyz) // 3, len(vel_xyz) // 3, len(energy))
    step = max(1, stride)

    for i in range(0, limit, step):
        i3 = i * 3
        qx = quantize_half_up(pos_xyz[i3] * 10.0)
        qy = quantize_half_up(pos_xyz[i3 + 1] * 10.0)
        qvx = quantize_half_up(vel_xyz[i3] * 10.0)
        qvy = quantize_half_up(vel_xyz[i3 + 1] * 10.0)
        qe = quantize_half_up(energy[i] * 100.0)

        h = _imul32(h ^ _u32(qx & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qy & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qvx & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qvy & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qe & 0xFF), FNV_PRIME)

    return _u32(h)
# --- КОНЕЦ ФУНКЦИИ compute_state_digest_fnv1a ---


# --- НАЧАЛО ФУНКЦИИ format_digest_hex ---
def format_digest_hex(digest: int) -> str:
    return f"0x{_u32(digest):08X}"
# --- КОНЕЦ ФУНКЦИИ format_digest_hex ---
# --- КОНЕЦ РАЗДЕЛА 3: verify_golden_prng_parity ---
