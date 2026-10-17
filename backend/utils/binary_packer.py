# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/utils/binary_packer.py
# НАЗНАЧЕНИЕ: Бинарный упаковщик/распаковщик пакетов SceneBuffer ('UNVS' Little-Endian)
# ЗАДАЧИ ФАЙЛА:
# 1. Паковать и распаковывать 24-байтный заголовок SceneBufferHeader ('UNVS' = 0x53564E55,
#    schema_version = 2, flags, tick, count, seed, digest) строго в формате '<IHHIIII'.
# 2. Выполнять санитизацию NaN / Infinity координат перед сериализацией.
# 3. Гарантировать 100%-ную бинарную совместимость с PythonSocketClient в TypeScript.
# ============================================================================

from __future__ import annotations
from dataclasses import dataclass
import math
import struct
from typing import Sequence

SCENE_BUFFER_MAGIC: int = 0x53564E55  # 'UNVS' в Little-Endian
SCENE_SCHEMA_VERSION: int = 2
HEADER_STRUCT_FORMAT: str = "<IHHIIII"  # 24 байта, Little-Endian
HEADER_BYTE_LENGTH: int = 24


@dataclass(frozen=True)
class ScenePacketHeader:
    magic: int
    schema_version: int
    flags: int
    tick: int
    count: int
    seed: int
    digest: int


def sanitize_finite(value: float, fallback: float = 0.0) -> float:
    """Защита от NaN и Infinity перед упаковкой в бинарный буфер."""
    return value if math.isfinite(value) else fallback


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