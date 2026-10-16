// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/sceneBuffer.ts
// НАЗНАЧЕНИЕ: Единый буфер состояния SceneBuffer (Structure of Arrays — SoA, MASTER 00B)
// ЗАДАЧИ ФАЙЛА:
// 1. Хранить 24-байтный бинарный заголовок 'UNVS' (little-endian) и массивы сущностей SoA.
// 2. Поддерживать двойную буферизацию координат (prevPos / pos) для гладкой интерполяции
//    рендера при фиксированном шаге физики (accumulator).
// 3. Проверять границы массивов и защищать буфер от NaN / Infinity (NaN/Inf-guard).
// 4. Вычислять и обновлять единый State Digest для оптик ILLUSION, NEXUS и X-RAY.
// ============================================================================

import { EntityKindCode } from './contracts';
import { computeQuantizedStateDigest, formatDigestHex } from './prng';

// ----------------------------------------------------------------------------
// 1. КОНСТАНТЫ БИНАРНОГО ЗАГОЛОВКА SCENEBUFFER ('UNVS' LITTLE-ENDIAN)
// ----------------------------------------------------------------------------
export const SCENE_BUFFER_MAGIC = 0x53564e55; // 'UNVS' в little-endian
export const SCENE_SCHEMA_VERSION = 2;
export const HEADER_BYTE_LENGTH = 24;

export interface SceneBufferHeader {
    magic: number;         // u32 (offset 0)
    schemaVersion: number; // u16 (offset 4)
    flags: number;         // u16 (offset 6)
    tick: number;          // u32 (offset 8)
    count: number;         // u32 (offset 12)
    seed: number;          // u32 (offset 16)
    digest: number;        // u32 (offset 20)
}

// ----------------------------------------------------------------------------
// 2. КЛАСС SOA-БУФЕРА СОСТОЯНИЯ СЦЕНЫ
// ----------------------------------------------------------------------------
export class SceneBufferSoA {
    public readonly capacity: number;
    private readonly headerBuffer: ArrayBuffer;
    private readonly headerView: DataView;

    // Выровненные типизированные массивы сущностей (Structure of Arrays)
    public readonly id: Uint32Array;
    public readonly kind: Uint8Array;
    public readonly pos: Float32Array;     // [x, y, z] * capacity
    public readonly prevPos: Float32Array; // [prevX, prevY, prevZ] * capacity (для интерполяции)
    public readonly interpPos: Float32Array; // Выходной буфер интерполированных координат для рендера
    public readonly vel: Float32Array;     // [vx, vy, vz] * capacity
    public readonly depthZ: Float32Array;
    public readonly energy: Float32Array;
    public readonly flags: Uint32Array;

    private nanGuardTriggeredCount = 0;

    constructor(capacity = 1024, initialSeed = 104729) {
        this.capacity = capacity;
        this.headerBuffer = new ArrayBuffer(HEADER_BYTE_LENGTH);
        this.headerView = new DataView(this.headerBuffer);

        this.id = new Uint32Array(capacity);
        this.kind = new Uint8Array(capacity);
        this.pos = new Float32Array(capacity * 3);
        this.prevPos = new Float32Array(capacity * 3);
        this.interpPos = new Float32Array(capacity * 3);
        this.vel = new Float32Array(capacity * 3);
        this.depthZ = new Float32Array(capacity);
        this.energy = new Float32Array(capacity);
        this.flags = new Uint32Array(capacity);

        this.writeHeader({
            magic: SCENE_BUFFER_MAGIC,
            schemaVersion: SCENE_SCHEMA_VERSION,
            flags: 0,
            tick: 0,
            count: 0,
            seed: initialSeed >>> 0,
            digest: 0,
        });
    }

    // Чтение заголовка с гарантированным порядком байт little-endian
    public readHeader(): SceneBufferHeader {
        return {
            magic: this.headerView.getUint32(0, true),
            schemaVersion: this.headerView.getUint16(4, true),
            flags: this.headerView.getUint16(6, true),
            tick: this.headerView.getUint32(8, true),
            count: this.headerView.getUint32(12, true),
            seed: this.headerView.getUint32(16, true),
            digest: this.headerView.getUint32(20, true),
        };
    }

    public writeHeader(header: SceneBufferHeader): void {
        const safeCount = Math.max(0, Math.min(this.capacity, header.count));
        this.headerView.setUint32(0, header.magic >>> 0, true);
        this.headerView.setUint16(4, header.schemaVersion & 0xffff, true);
        this.headerView.setUint16(6, header.flags & 0xffff, true);
        this.headerView.setUint32(8, header.tick >>> 0, true);
        this.headerView.setUint32(12, safeCount >>> 0, true);
        this.headerView.setUint32(16, header.seed >>> 0, true);
        this.headerView.setUint32(20, header.digest >>> 0, true);
    }

    // Сохранение текущих позиций в prevPos перед выполнением очередного фиксированного шага физики
    public snapshotPreviousPositions(activeCount: number): void {
        const limit = Math.min(this.capacity, activeCount) * 3;
        for (let i = 0; i < limit; i++) {
            this.prevPos[i] = this.pos[i];
        }
    }

    // Вычисление интерполированных позиций между prevPos и pos с коэффициентом alpha ∈ [0, 1]
    public computeInterpolatedPositions(activeCount: number, alpha: number): void {
        const t = Math.max(0, Math.min(1, alpha));
        const invT = 1.0 - t;
        const limit = Math.min(this.capacity, activeCount) * 3;
        for (let i = 0; i < limit; i++) {
            this.interpPos[i] = this.prevPos[i] * invT + this.pos[i] * t;
        }
    }

    // Запись сущности с автоматической защитой от NaN / Infinity (NaN/Inf-guard по MASTER 00B)
    public syncEntityFromParticle(
        index: number,
        id: number,
        kindCode: EntityKindCode,
        x: number,
        y: number,
        z: number,
        vx: number,
        vy: number,
        vz: number,
        depthZ: number,
        energy: number,
        flagBits = 0
    ): void {
        if (index < 0 || index >= this.capacity) return;

        const safeX = Number.isFinite(x) ? x : 0;
        const safeY = Number.isFinite(y) ? y : 0;
        const safeZ = Number.isFinite(z) ? z : 0;
        const safeVx = Number.isFinite(vx) ? vx : 0;
        const safeVy = Number.isFinite(vy) ? vy : 0;
        const safeVz = Number.isFinite(vz) ? vz : 0;
        const safeEnergy = Number.isFinite(energy) ? Math.max(0, Math.min(10, energy)) : 0;

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(vx) || !Number.isFinite(vy)) {
            this.nanGuardTriggeredCount++;
        }

        const i3 = index * 3;
        this.id[index] = id >>> 0;
        this.kind[index] = kindCode;
        this.pos[i3] = safeX;
        this.pos[i3 + 1] = safeY;
        this.pos[i3 + 2] = safeZ;
        this.vel[i3] = safeVx;
        this.vel[i3 + 1] = safeVy;
        this.vel[i3 + 2] = safeVz;
        this.depthZ[index] = Number.isFinite(depthZ) ? depthZ : 1.0;
        this.energy[index] = safeEnergy;
        this.flags[index] = flagBits >>> 0;
    }

    // Фиксация тика и пересчёт контрольной суммы State Digest
    public commitTickAndComputeDigest(tick: number, activeCount: number, seed: number): number {
        const clampedCount = Math.max(0, Math.min(this.capacity, activeCount));
        const digest = computeQuantizedStateDigest(
            tick,
            clampedCount,
            this.pos,
            this.vel,
            this.energy,
            4
        );

        this.writeHeader({
            magic: SCENE_BUFFER_MAGIC,
            schemaVersion: SCENE_SCHEMA_VERSION,
            flags: 1,
            tick: tick >>> 0,
            count: clampedCount,
            seed: seed >>> 0,
            digest,
        });

        return digest;
    }

    public getDigestHex(): string {
        return formatDigestHex(this.headerView.getUint32(20, true));
    }

    public getNanGuardTriggers(): number {
        return this.nanGuardTriggeredCount;
    }

    public reset(newSeed: number): void {
        this.id.fill(0);
        this.kind.fill(0);
        this.pos.fill(0);
        this.prevPos.fill(0);
        this.interpPos.fill(0);
        this.vel.fill(0);
        this.depthZ.fill(0);
        this.energy.fill(0);
        this.flags.fill(0);
        this.writeHeader({
            magic: SCENE_BUFFER_MAGIC,
            schemaVersion: SCENE_SCHEMA_VERSION,
            flags: 0,
            tick: 0,
            count: 0,
            seed: newSeed >>> 0,
            digest: 0,
        });
    }
}