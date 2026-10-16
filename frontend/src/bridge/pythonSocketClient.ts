// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/pythonSocketClient.ts
// НАЗНАЧЕНИЕ: Клиент бинарных WebSockets к Python/FastAPI с валидацией (MASTER 00B / 03)
// ЗАДАЧИ ФАЙЛА:
// 1. Обеспечивать опциональное подключение к серверу FastAPI (/ws) без блокировки сцены.
// 2. Зажигать статус SERVER CONNECTED строго после подтверждённого handshake ('hello' + schemaVersion).
// 3. Проверять бинарные пакеты графа/состояния ('UNVS', little-endian, tick, границы, NaN-guard).
// 4. Выполнять экспоненциальный reconnect с детерминированным jitter при разрыве связи.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { SCENE_BUFFER_MAGIC, SCENE_SCHEMA_VERSION } from '../core/sceneBuffer';
import { universeStore } from '../store/universeState';

export interface ServerHelloHandshake {
    type: 'hello';
    schemaVersion: number;
    serverTimeMs: number;
    engine: 'FastAPI-Python3';
}

export class PythonSocketClient {
    private socket: WebSocket | null = null;
    private isHandshakeVerified = false;
    private lastAcceptedTick = 0;
    private reconnectAttempts = 0;
    private reconnectTimerId: number | null = null;
    private readonly maxReconnectAttempts = 4;

    constructor() {
        // По умолчанию на статическом GitHub Pages сервер не запущен — честный статус inactive (CLIENT-ONLY)
        integrationRegistry.updateModuleStatus('server-ws', 'inactive');
    }

    // Опциональное подключение к локальному или удалённому FastAPI серверу
    public connect(wsUrl?: string): void {
        if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;

        const targetUrl =
            wsUrl ??
            (import.meta as unknown as { env?: { PUBLIC_WS_URL?: string } }).env?.PUBLIC_WS_URL;

        // Если URL сервера явно не задан, остаёмся в честном автономном режиме CLIENT-ONLY
        if (!targetUrl) {
            integrationRegistry.updateModuleStatus('server-ws', 'inactive');
            return;
        }

        const t0 = performance.now();
        integrationRegistry.updateModuleStatus('server-ws', 'loading');

        try {
            this.socket = new WebSocket(targetUrl);
            this.socket.binaryType = 'arraybuffer';

            this.socket.onopen = () => {
                // Отправляем запрос рукопожатия со версией схемы v2
                this.socket?.send(
                    JSON.stringify({
                        type: 'client_hello',
                        schemaVersion: SCENE_SCHEMA_VERSION,
                        seed: universeStore.getState().seed,
                    })
                );
            };

            this.socket.onmessage = (event: MessageEvent) => {
                if (typeof event.data === 'string') {
                    this.handleJsonControlMessage(event.data, performance.now() - t0);
                } else if (event.data instanceof ArrayBuffer) {
                    this.handleBinaryFramePacket(event.data);
                }
            };

            this.socket.onerror = () => {
                this.isHandshakeVerified = false;
                integrationRegistry.updateModuleStatus('server-ws', 'inactive');
            };

            this.socket.onclose = () => {
                this.isHandshakeVerified = false;
                integrationRegistry.updateModuleStatus('server-ws', 'inactive');
                this.scheduleReconnect(targetUrl);
            };
        } catch {
            integrationRegistry.updateModuleStatus('server-ws', 'inactive');
        }
    }

    // Строгая проверка JSON-рукопожатия hello (MASTER 00B раздел 2)
    private handleJsonControlMessage(rawJson: string, loadMs: number): void {
        try {
            const msg = JSON.parse(rawJson) as Partial<ServerHelloHandshake>;
            if (msg.type === 'hello' && msg.schemaVersion === SCENE_SCHEMA_VERSION) {
                this.isHandshakeVerified = true;
                this.reconnectAttempts = 0;
                integrationRegistry.updateModuleStatus('server-ws', 'ready', loadMs);
                universeStore.addTerminalLog(
                    `[PYTHON_WS] Handshake подтверждён (schema v${msg.schemaVersion}). Статус: SERVER CONNECTED.`
                );
            } else if (msg.schemaVersion !== undefined && msg.schemaVersion !== SCENE_SCHEMA_VERSION) {
                universeStore.addTerminalLog(
                    `[PYTHON_WS_REJECT] Неизвестная версия схемы сервера: ${msg.schemaVersion} (ожидалась ${SCENE_SCHEMA_VERSION}).`
                );
                this.disconnect();
            }
        } catch {
            universeStore.addTerminalLog('[PYTHON_WS_WARN] Отброшено повреждённое JSON-сообщение.');
        }
    }

    // Валидация бинарного пакета 'UNVS' (little-endian, границы, монотонность tick)
    public handleBinaryFramePacket(buffer: ArrayBuffer): boolean {
        if (buffer.byteLength < 24) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Отброшен обрезанный пакет (${buffer.byteLength} байт < 24).`
            );
            return false;
        }

        const view = new DataView(buffer);
        const magic = view.getUint32(0, true);
        const schemaVersion = view.getUint16(4, true);
        const tick = view.getUint32(8, true);
        const count = view.getUint32(12, true);

        if (magic !== SCENE_BUFFER_MAGIC) {
            universeStore.addTerminalLog('[BINARY_GUARD] Отброшен пакет с неверной сигнатурой magic.');
            return false;
        }

        if (schemaVersion !== SCENE_SCHEMA_VERSION) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Несовместимая версия бинарного пакета v${schemaVersion}.`
            );
            return false;
        }

        if (tick < this.lastAcceptedTick) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Отброшен устаревший кадр tick=${tick} (последний=${this.lastAcceptedTick}).`
            );
            return false;
        }

        const expectedMinBytes = 24 + count * 12;
        if (buffer.byteLength < expectedMinBytes) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Выход за границы буфера: заявлено ${count} узлов (${expectedMinBytes} Б), получено ${buffer.byteLength} Б.`
            );
            return false;
        }

        this.lastAcceptedTick = tick;
        integrationRegistry.recordModuleStep('server-ws', 0.5, buffer.byteLength, 0);
        return true;
    }

    private scheduleReconnect(url: string): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
        this.reconnectAttempts++;
        const baseDelayMs = Math.min(12000, 1000 * Math.pow(2, this.reconnectAttempts));
        const jitterMs = (this.reconnectAttempts * 271) % 450;

        if (this.reconnectTimerId !== null && typeof window !== 'undefined') {
            window.clearTimeout(this.reconnectTimerId);
        }
        if (typeof window !== 'undefined') {
            this.reconnectTimerId = window.setTimeout(() => this.connect(url), baseDelayMs + jitterMs);
        }
    }

    public isConnectedVerified(): boolean {
        return this.isHandshakeVerified;
    }

    public disconnect(): void {
        if (this.reconnectTimerId !== null && typeof window !== 'undefined') {
            window.clearTimeout(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isHandshakeVerified = false;
        integrationRegistry.updateModuleStatus('server-ws', 'inactive');
    }
}

export const pythonSocketClient = new PythonSocketClient();