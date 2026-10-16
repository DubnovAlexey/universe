// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer2_Metrics.tsx
// НАЗНАЧЕНИЕ: Инспекционная панель METRICS v2.0 (MASTER 00B / 02 / 04)
// ЗАДАЧИ ФАЙЛА:
// 1. Отображать только реально измеренные показатели (FPS, frameTimeMs, p95, ΔE/E₀,
//    параметр синхронизации Курамото r(t), уровень тишины RMS и State Digest).
// 2. Помечать каждое значение точным языком и файлом-владельцем ([rust/gravity.rs],
//    [python/graph_logic.py], [wgsl/breach.wgsl], [web-audio]).
// 3. Поддерживать как декларативный рендер React, так и легковесную привязку к DOM.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { universeStore, type UniverseState } from '../store/universeState';

export const Layer2_Metrics: React.FC = () => {
    const [snap, setSnap] = useState<Readonly<UniverseState>>(() => universeStore.getState());

    useEffect(() => {
        return universeStore.subscribe((nextState) => {
            setSnap({ ...nextState });
        });
    }, []);

    if (!snap.layers.layer2_metricsHud) {
        return null;
    }

    const t = snap.telemetry;

    return (
        <aside
            className="hud-panel metrics-inspector-v2"
            data-ui-panel="true"
            aria-label="Инженерная телеметрия полиглот-ядра"
        >
            <div className="inspector-header">
                <span className="phase-codename">LAYER_02 // POLYGLOT TELEMETRY</span>
                <span className="digest-badge" title="32-bit FNV-1a State Digest (ILLUSION == NEXUS == X-RAY)">
          DIGEST: {t.stateDigestHex}
        </span>
            </div>

            <div className="metrics-grid-v2">
                <div className="metric-box">
                    <span className="label">КАДРЫ / P95 [ts/renderer.ts]</span>
                    <span className="value">
            {t.fps} FPS <small>({t.frameTimeMs} / {t.frameTimeP95Ms} ms)</small>
          </span>
                </div>

                <div className="metric-box">
                    <span className="label">ДРЕЙФ ЭНЕРГИИ ΔE/E₀ [rust/gravity.rs]</span>
                    <span className="value">{t.energyDriftRatio.toExponential(2)}</span>
                </div>

                <div className="metric-box">
                    <span className="label">СИНХРОНИЗАЦИЯ КУРАМОТО r(t) [rust/gravity.rs]</span>
                    <span className="value">{t.kuramotoOrderR.toFixed(3)}</span>
                </div>

                <div className="metric-box">
                    <span className="label">НЕЙРОНЫ / СИНАПСЫ [python/graph_logic.py]</span>
                    <span className="value">
            {t.activeParticles} / {t.activeConnections} <small>(pulses: {t.activePulses})</small>
          </span>
                </div>

                <div className="metric-box">
                    <span className="label">СТАТУС ЯДРА ФИЗИКИ / ГРАФА</span>
                    <span className="value">
            {t.wasmStatus} · {t.pythonBackendStatus}
          </span>
                </div>

                <div className="metric-box">
                    <span className="label">АУДИО RMS [web-audio]</span>
                    <span className="value">
            {t.audioStatus} ({t.silenceRmsDb.toFixed(1)} dBFS)
          </span>
                </div>
            </div>
        </aside>
    );
};

export default Layer2_Metrics;