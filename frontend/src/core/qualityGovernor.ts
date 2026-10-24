// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/qualityGovernor.ts
// НАЗНАЧЕНИЕ: Автоматический регулятор качества QualityGovernor с гистерезисом (MASTER 00)
// ЗАДАЧИ ФАЙЛА:
// 1. Измерять экспоненциальное скользящее среднее (EMA) времени кадра и перцентиль p95.
// 2. Плавно переключать профиль HIGH / MEDIUM / LOW с гистерезисом (без дребезга).
// 3. Возвращать параметры масштабирования (число частиц, октавы FBM, DPR-кэп).
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. QualityGovernor: constructor, feedFrameTime, getProfile, getFrameP95Ms, setTierManual.
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
    private frameWindow: number[] = [];
    private lastSwitchTimestampMs = 0;
    private readonly cooldownMs = 3500; // Гистерезис 3.5 секунды между переключениями ступеней

    // --- НАЧАЛО ФУНКЦИИ constructor (QualityGovernor) ---
    constructor() {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const q = params.get('quality')?.toUpperCase();
            if (q === 'HIGH' || q === 'MEDIUM' || q === 'LOW') {
                this.currentTier = q;
                this.lockedByUser = true;
            }
        }
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (QualityGovernor) ---

    // --- НАЧАЛО ФУНКЦИИ feedFrameTime (QualityGovernor) ---
    public feedFrameTime(frameTimeMs: number, nowMs: number): QualityTier {
        const clamped = Math.max(1, Math.min(100, frameTimeMs));
        this.emaFrameMs = this.emaFrameMs * 0.92 + clamped * 0.08;

        this.frameWindow.push(clamped);
        if (this.frameWindow.length > 45) {
            this.frameWindow.shift();
        }

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
        else if (this.emaFrameMs < 14.2 && this.frameWindow.length >= 40) {
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

    // --- НАЧАЛО ФУНКЦИИ getProfile (QualityGovernor) ---
    public getProfile(): Readonly<QualityProfileConfig> {
        return QUALITY_PROFILES[this.currentTier];
    }
    // --- КОНЕЦ ФУНКЦИИ getProfile (QualityGovernor) ---

    // --- НАЧАЛО ФУНКЦИИ getFrameP95Ms (QualityGovernor) ---
    public getFrameP95Ms(): number {
        if (this.frameWindow.length === 0) return 16.7;
        const sorted = [...this.frameWindow].sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
        return Number(sorted[idx].toFixed(1));
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