// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/qualityGovernor.ts
// НАЗНАЧЕНИЕ: Автоматический регулятор качества QualityGovernor с гистерезисом (MASTER 00)
// ЗАДАЧИ ФАЙЛА:
// 1. Измерять ограниченное EMA для управления и фактический p95 последних 45 кадров.
// 2. Плавно переключать профиль HIGH / MEDIUM / LOW с гистерезисом (без дребезга).
// 3. Возвращать параметры масштабирования (число частиц, октавы FBM, DPR-кэп).
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. QualityGovernor: constructor, feedFrameTime, recordFrameSample, getProfile,
//      getFrameP95Ms, setTierManual.
// ============================================================================


import type { QualityTier } from './contracts';

export interface QualityProfileConfig {
    tier: QualityTier;
    particleMultiplier: number;
    fbmOctaves: number;
    maxDpr: number;
    bloomEnabled: boolean;
    pulseTailSegments: number;
}

const QUALITY_PROFILES: Record<QualityTier, QualityProfileConfig> = {
    HIGH: {
        tier: 'HIGH',
        particleMultiplier: 1.0,
        fbmOctaves: 5,
        maxDpr: 2.0,
        bloomEnabled: true,
        pulseTailSegments: 3,
    },
    MEDIUM: {
        tier: 'MEDIUM',
        particleMultiplier: 0.72,
        fbmOctaves: 4,
        maxDpr: 1.5,
        bloomEnabled: true,
        pulseTailSegments: 2,
    },
    LOW: {
        tier: 'LOW',
        particleMultiplier: 0.48,
        fbmOctaves: 3,
        maxDpr: 1.25,
        bloomEnabled: false,
        pulseTailSegments: 1,
    },
};

// ============================================================================
// РАЗДЕЛ 2. КЛАСС QualityGovernor
// ============================================================================

export class QualityGovernor {
    private currentTier: QualityTier = 'HIGH';
    private lockedByUser = false;
    private emaFrameMs = 16.0;
    private readonly frameWindow = new Float64Array(45);
    private readonly sortedFrameWindow = new Float64Array(45);
    private frameWindowCount = 0;
    private frameWindowCursor = 0;
    private lastSampleTimestampMs = -Infinity;
    private lastSwitchTimestampMs = 0;
    private readonly cooldownMs = 3500; // Гистерезис 3.5 секунды между переключениями ступеней

    // --- НАЧАЛО ФУНКЦИИ constructor (QualityGovernor) ---
    constructor(search = typeof window !== 'undefined' ? window.location?.search ?? '' : '') {
        const params = new URLSearchParams(search);
        const q = params.get('quality')?.toUpperCase();
        if (q === 'HIGH' || q === 'MEDIUM' || q === 'LOW') {
            this.currentTier = q;
            this.lockedByUser = true;
        }
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (QualityGovernor) ---

    // --- НАЧАЛО ФУНКЦИИ feedFrameTime (QualityGovernor) ---
    public feedFrameTime(frameTimeMs: number, nowMs: number): QualityTier {
        // Ошибочный внешний образец не должен навсегда отравлять EMA или часы гистерезиса.
        if (!Number.isFinite(frameTimeMs) || frameTimeMs < 0 || !Number.isFinite(nowMs) ||
            nowMs < 0 || nowMs < this.lastSampleTimestampMs) return this.currentTier;
        this.lastSampleTimestampMs = nowMs;
        const clamped = Math.max(1, Math.min(100, frameTimeMs));
        this.emaFrameMs = this.emaFrameMs * 0.92 + clamped * 0.08;
        this.recordFrameSample(Math.max(1, frameTimeMs));

        if (this.lockedByUser || nowMs - this.lastSwitchTimestampMs < this.cooldownMs) {
            return this.currentTier;
        }

        // Понижение ступени при превышении бюджета кадра (> 24.5 мс ~ < 41 FPS)
        if (this.emaFrameMs > 24.5) {
            if (this.currentTier === 'HIGH') {
                this.currentTier = 'MEDIUM';
                this.lastSwitchTimestampMs = nowMs;
            } else if (this.currentTier === 'MEDIUM' && this.emaFrameMs > 31.0) {
                this.currentTier = 'LOW';
                this.lastSwitchTimestampMs = nowMs;
            }
        }
        // Повышение ступени с гистерезисом при стабильном запасе (< 14.2 мс)
        else if (this.emaFrameMs < 14.2 && this.frameWindowCount >= 40) {
            if (this.currentTier === 'LOW') {
                this.currentTier = 'MEDIUM';
                this.lastSwitchTimestampMs = nowMs;
            } else if (this.currentTier === 'MEDIUM' && this.emaFrameMs < 11.8) {
                this.currentTier = 'HIGH';
                this.lastSwitchTimestampMs = nowMs;
            }
        }

        return this.currentTier;
    }
    // --- КОНЕЦ ФУНКЦИИ feedFrameTime (QualityGovernor) ---

    // --- НАЧАЛО ФУНКЦИИ recordFrameSample (QualityGovernor) ---
    /** Точное скользящее окно: O(45) сдвиги без сортировки и выделения массива на каждом кадре. */
    private recordFrameSample(frameTimeMs: number): void {
        let count = this.frameWindowCount;
        if (count === this.frameWindow.length) {
            const expired = this.frameWindow[this.frameWindowCursor]!;
            let index = 0;
            while (index < count && this.sortedFrameWindow[index] !== expired) index++;
            for (; index + 1 < count; index++) this.sortedFrameWindow[index] = this.sortedFrameWindow[index + 1]!;
            count--;
        }
        let insert = count;
        while (insert > 0 && this.sortedFrameWindow[insert - 1]! > frameTimeMs) {
            this.sortedFrameWindow[insert] = this.sortedFrameWindow[insert - 1]!;
            insert--;
        }
        this.sortedFrameWindow[insert] = frameTimeMs;
        this.frameWindow[this.frameWindowCursor] = frameTimeMs;
        this.frameWindowCursor = (this.frameWindowCursor + 1) % this.frameWindow.length;
        this.frameWindowCount = count + 1;
    }
    // --- КОНЕЦ ФУНКЦИИ recordFrameSample (QualityGovernor) ---

    // --- НАЧАЛО ФУНКЦИИ getProfile (QualityGovernor) ---
    public getProfile(): Readonly<QualityProfileConfig> {
        return QUALITY_PROFILES[this.currentTier];
    }
    // --- КОНЕЦ ФУНКЦИИ getProfile (QualityGovernor) ---

    // --- НАЧАЛО ФУНКЦИИ getFrameP95Ms (QualityGovernor) ---
    public getFrameP95Ms(): number {
        if (this.frameWindowCount === 0) return 16.7;
        const index = Math.min(this.frameWindowCount - 1, Math.floor(this.frameWindowCount * 0.95));
        // Статистика сохраняет настоящий длинный интервал; EMA выше ограничена только для управления.
        return Math.round(this.sortedFrameWindow[index]! * 10) / 10;
    }
    // --- КОНЕЦ ФУНКЦИИ getFrameP95Ms (QualityGovernor) ---

    // --- НАЧАЛО ФУНКЦИИ setTierManual (QualityGovernor) ---
    public setTierManual(tier: QualityTier): void {
        this.currentTier = tier;
        this.lockedByUser = true;
    }
    // --- КОНЕЦ ФУНКЦИИ setTierManual (QualityGovernor) ---
}

export const qualityGovernor = new QualityGovernor();
