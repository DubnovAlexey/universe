# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/core/prng.py
# НАЗНАЧЕНИЕ: Детерминированный ГПСЧ SplitMix32 и хеш FNV-1a State Digest (v2.0)
# ЗАДАЧИ ФАЙЛА:
# 1. Гарантировать побитовый паритет случайных чисел u32 между TypeScript
#    (frontend/src/core/prng.ts), Rust (physics_engine/src/prng.rs) и Python.
# 2. Проверять совпадение первых 4 значений с эталоном GOLDEN_U32_VECTORS.
# 3. Вычислять 32-битный FNV-1a дайджест квантованного состояния симуляции.
# ============================================================================

from __future__ import annotations
from typing import Sequence

GOLDEN_SEED: int = 104729
GOLDEN_U32_VECTORS: tuple[int, int, int, int] = (
    2440595534,
    3339150257,
    2107725929,
    4067807368,
)

FNV_OFFSET_BASIS: int = 0x811C9DC5
FNV_PRIME: int = 0x01000193


def _u32(val: int) -> int:
    """Приведение целого числа к беззнаковому 32-битному диапазону uint32."""
    return val & 0xFFFFFFFF


def _imul32(a: int, b: int) -> int:
    """Точный аналог Math.imul(a, b) и wrapping_mul в 32-битной арифметике."""
    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF


class DeterministicPRNG:
    """Детерминированный генератор псевдослучайных чисел SplitMix32."""

    __slots__ = ("_state",)

    def __init__(self, seed: int = GOLDEN_SEED) -> None:
        clean_seed = _u32(seed)
        self._state: int = 0x6D2B79F5 if clean_seed == 0 else clean_seed

    def next_u32(self) -> int:
        self._state = _u32(self._state + 0x6D2B79F5)
        z = self._state
        z = _imul32(z ^ (z >> 15), z | 1)
        z ^= _u32(z + _imul32(z ^ (z >> 7), z | 61))
        return _u32(z ^ (z >> 14))

    def next_float(self) -> float:
        return self.next_u32() / 4294967296.0

    def next_range(self, min_val: float, max_val: float) -> float:
        return min_val + self.next_float() * (max_val - min_val)

    @staticmethod
    def hash_u32(seed: int, index: int) -> int:
        h = _u32(_u32(seed) ^ _imul32(_u32(index), 0x9E3779B9))
        h = _imul32(h ^ (h >> 16), 0x85EBCA6B)
        h = _imul32(h ^ (h >> 13), 0xC2B2AE35)
        return _u32(h ^ (h >> 16))

    @staticmethod
    def hash_float(seed: int, index: int) -> float:
        return DeterministicPRNG.hash_u32(seed, index) / 4294967296.0


def verify_golden_prng_parity() -> bool:
    """Проверка побитового совпадения с эталонными векторами TypeScript и Rust."""
    rng = DeterministicPRNG(GOLDEN_SEED)
    for expected in GOLDEN_U32_VECTORS:
        if rng.next_u32() != expected:
            return False
    return True


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
        qx = int(round(pos_xyz[i3] * 10.0))
        qy = int(round(pos_xyz[i3 + 1] * 10.0))
        qvx = int(round(vel_xyz[i3] * 10.0))
        qvy = int(round(vel_xyz[i3 + 1] * 10.0))
        qe = int(round(energy[i] * 100.0))

        h = _imul32(h ^ _u32(qx & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qy & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qvx & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qvy & 0xFFFF), FNV_PRIME)
        h = _imul32(h ^ _u32(qe & 0xFF), FNV_PRIME)

    return _u32(h)


def format_digest_hex(digest: int) -> str:
    return f"{_u32(digest):08X}"