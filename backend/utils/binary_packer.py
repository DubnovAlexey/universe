# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/utils/binary_packer.py
# НАЗНАЧЕНИЕ: Заголовок UNVS little-endian и сериализация координат Float32.
# ОГЛАВЛЕНИЕ:
# 1. ИМПОРТЫ И КОНТРАКТЫ.
# 2. sanitize_finite.
# 3. unpack_and_validate_header.
# Функции: sanitize_finite, pack_scene_binary_frame, unpack_and_validate_header.
# ============================================================================

# --- НАЧАЛО РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---
from __future__ import annotations
from dataclasses import dataclass
import math
import struct
from typing import Sequence

SCENE_BUFFER_MAGIC: int = 0x53564E55  # 'UNVS' в Little-Endian
SCENE_SCHEMA_VERSION: int = 2
HEADER_STRUCT_FORMAT: str = "<IHHIIII"  # 24 байта, Little-Endian
HEADER_BYTE_LENGTH: int = 24


# --- НАЧАЛО КЛАССА ScenePacketHeader ---
@dataclass(frozen=True)
class ScenePacketHeader:
    magic: int
    schema_version: int
    flags: int
    tick: int
    count: int
    seed: int
    digest: int
# --- КОНЕЦ КЛАССА ScenePacketHeader ---


# --- КОНЕЦ РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---

# --- НАЧАЛО РАЗДЕЛА 2: sanitize_finite ---
# --- НАЧАЛО ФУНКЦИИ sanitize_finite ---
def sanitize_finite(value: float, fallback: float = 0.0) -> float:
    """Защита от NaN и Infinity перед упаковкой в бинарный буфер."""
    return value if math.isfinite(value) else fallback
# --- КОНЕЦ ФУНКЦИИ sanitize_finite ---


# --- НАЧАЛО ФУНКЦИИ pack_scene_binary_frame ---
def pack_scene_binary_frame(
        tick: int,
        seed: int,
        digest: int,
        positions_xyz: Sequence[float],
        flags: int = 1,
) -> bytes:
    """
    Упаковывает заголовок 'UNVS' (24 байта) и массив координат float32[3 * N] в Little-Endian.
    """
    entity_count = len(positions_xyz) // 3
    header_bytes = struct.pack(
        HEADER_STRUCT_FORMAT,
        SCENE_BUFFER_MAGIC,
        SCENE_SCHEMA_VERSION,
        flags & 0xFFFF,
        tick & 0xFFFFFFFF,
        entity_count & 0xFFFFFFFF,
        seed & 0xFFFFFFFF,
        digest & 0xFFFFFFFF,
        )

    clean_floats = [sanitize_finite(float(v), 0.0) for v in positions_xyz[: entity_count * 3]]
    payload_format = f"<{len(clean_floats)}f"
    payload_bytes = struct.pack(payload_format, *clean_floats)

    return header_bytes + payload_bytes
# --- КОНЕЦ ФУНКЦИИ pack_scene_binary_frame ---


# --- КОНЕЦ РАЗДЕЛА 2: sanitize_finite ---

# --- НАЧАЛО РАЗДЕЛА 3: unpack_and_validate_header ---
# --- НАЧАЛО ФУНКЦИИ unpack_and_validate_header ---
def unpack_and_validate_header(packet: bytes) -> ScenePacketHeader | None:
    """
    Проверяет 24-байтный заголовок бинарного пакета. Возвращает None при повреждении.
    """
    if len(packet) < HEADER_BYTE_LENGTH:
        return None

    magic, version, flags, tick, count, seed, digest = struct.unpack(
        HEADER_STRUCT_FORMAT, packet[:HEADER_BYTE_LENGTH]
    )

    if magic != SCENE_BUFFER_MAGIC or version != SCENE_SCHEMA_VERSION:
        return None

    expected_min_len = HEADER_BYTE_LENGTH + count * 12
    if len(packet) < expected_min_len:
        return None

    return ScenePacketHeader(
        magic=magic,
        schema_version=version,
        flags=flags,
        tick=tick,
        count=count,
        seed=seed,
        digest=digest,
    )
# --- КОНЕЦ ФУНКЦИИ unpack_and_validate_header ---
# --- КОНЕЦ РАЗДЕЛА 3: unpack_and_validate_header ---
