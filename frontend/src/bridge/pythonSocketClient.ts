// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/pythonSocketClient.ts
// НАЗНАЧЕНИЕ: Клиент бинарных пакетов 'UNVS' к Python-серверу с валидацией (v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   РАЗДЕЛ 1. Интерфейс рукопожатия ServerHelloHandshake.
//   РАЗДЕЛ 2. Класс PythonSocketClient:
//     - Подраздел 2.1. Управление WebSocket-соединением, защита от ложного
//                      реконнекта после ручного disconnect() и сброс сессии.
//     - Подраздел 2.2. Валидация JSON-рукопожатия ('hello' + schemaVersion).
//     - Подраздел 2.3. Полная валидация бинарного пакета 'UNVS' (заголовок,
//                      монотонность tick, проверка конечности координат
//                      Number.isFinite и применение к SceneBufferSoA).
// ============================================================================

import { EntityKindCode } from '../core/contracts';
import { integrationRegistry } from '../core/integrationRegistry';
import { SCENE_BUFFER_MAGIC, SCENE_SCHEMA_VERSION } from '../core/sceneBuffer';
import { universeStore } from '../store/universeState';

// ============================================================================
// РАЗДЕЛ 1. ИНТЕРФЕЙС РУКОПОЖАТИЯ СЕРВЕРА
// ============================================================================

export interface ServerHelloHandshake {
    type: 'hello';
    schemaVersion: number;
    serverTimeMs: number;
    engine: 'FastAPI-Python3';
}

// ============================================================================
// РАЗДЕЛ 2. КЛАСС КЛИЕНТА БИНАРНОГО ПРОТОКОЛА PYTHON (PythonSocketClient)
// ============================================================================

export class PythonSocketClient {
    private socket: WebSocket | null = null;
    private isHandshakeVerified = false;
    private manualDisconnect = false;
    private lastAcceptedTick = 0;
    private reconnectAttempts = 0;
    private reconnectTimerId: number | null = null;
    private readonly maxReconnectAttempts = 4;

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.1. ПОДКЛЮЧЕНИЕ, ОТКЛЮЧЕНИЕ И СБРОС СЕССИИ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ constructor (PythonSocketClient) ---
    constructor() {
        integrationRegistry.updateModuleStatus('server-ws', 'inactive');
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (PythonSocketClient) ---

    // --- НАЧАЛО ФУНКЦИИ resetSession ---
    /**
     * Сбрасывает счётчик принятых тиков для новой сессии или тестового прогона.
     */
    public resetSession(): void {
        this.lastAcceptedTick = 0;
        this.reconnectAttempts = 0;
    }
    // --- КОНЕЦ ФУНКЦИИ resetSession ---

    // --- НАЧАЛО ФУНКЦИИ connect ---
    public connect(wsUrl?: string): void {
        if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;

        const targetUrl =
            wsUrl ??
            (import.meta as unknown as { env?: { PUBLIC_WS_URL?: string } }).env
                ?.PUBLIC_WS_URL;

        if (!targetUrl) {
            integrationRegistry.updateModuleStatus('server-ws', 'inactive');
            return;
        }

        this.manualDisconnect = false;
        this.isHandshakeVerified = false;
        this.lastAcceptedTick = 0;

        const t0 = performance.now();
        integrationRegistry.updateModuleStatus('server-ws', 'loading');

        try {
            this.socket = new WebSocket(targetUrl);
            this.socket.binaryType = 'arraybuffer';

            this.socket.onopen = () => {
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
                    // Запрещаем приём бинарных кадров по сокету до подтверждения рукопожатия
                    if (!this.isHandshakeVerified) {
                        universeStore.addTerminalLog(
                            '[BINARY_GUARD] Отброшен бинарный кадр до завершения handshake.'
                        );
                        return;
                    }
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
                if (!this.manualDisconnect) {
                    this.scheduleReconnect(targetUrl);
                }
            };
        } catch {
            integrationRegistry.updateModuleStatus('server-ws', 'inactive');
        }
    }
    // --- КОНЕЦ ФУНКЦИИ connect ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. ПРОВЕРКА JSON-РУКОПОЖАТИЯ HELLO
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ handleJsonControlMessage ---
    private handleJsonControlMessage(rawJson: string, loadMs: number): void {
        try {
            const msg = JSON.parse(rawJson) as Partial<ServerHelloHandshake>;
            if (msg.type === 'hello' && msg.schemaVersion === SCENE_SCHEMA_VERSION) {
                this.isHandshakeVerified = true;
                this.reconnectAttempts = 0;
                this.lastAcceptedTick = 0;
                integrationRegistry.updateModuleStatus('server-ws', 'ready', loadMs);
                universeStore.addTerminalLog(
                    `[PYTHON_WS] Handshake подтверждён (schema v${msg.schemaVersion}). Статус: SERVER CONNECTED.`
                );
            } else if (
                msg.schemaVersion !== undefined &&
                msg.schemaVersion !== SCENE_SCHEMA_VERSION
            ) {
                universeStore.addTerminalLog(
                    `[PYTHON_WS_REJECT] Неизвестная версия схемы сервера: ${msg.schemaVersion} (ожидалась ${SCENE_SCHEMA_VERSION}).`
                );
                this.disconnect();
            }
        } catch {
            universeStore.addTerminalLog(
                '[PYTHON_WS_WARN] Отброшено повреждённое JSON-сообщение.'
            );
        }
    }
    // --- КОНЕЦ ФУНКЦИИ handleJsonControlMessage ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.3. ВАЛИДАЦИЯ И ПРИМЕНЕНИЕ БИНАРНОГО ПАКЕТА 'UNVS'
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ handleBinaryFramePacket ---
    /**
     * Проверяет 24-байтный заголовок 'UNVS', монотонность tick, границы буфера,
     * конечность всех Float32-координат и применяет валидные координаты к SceneBufferSoA.
     */
    public handleBinaryFramePacket(buffer: ArrayBuffer): boolean {
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (buffer.byteLength < 24) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Отброшен обрезанный пакет (${buffer.byteLength} байт < 24).`
            );
            return false;
        }

        const view = new DataView(buffer);
        const magic = view.getUint32(0, true);
        const schemaVersion = view.getUint16(4, true);
        const flags = view.getUint16(6, true);
        const tick = view.getUint32(8, true);
        const count = view.getUint32(12, true);

        if (magic !== SCENE_BUFFER_MAGIC) {
            universeStore.addTerminalLog(
                '[BINARY_GUARD] Отброшен пакет с неверной сигнатурой magic.'
            );
            return false;
        }

        if (schemaVersion !== SCENE_SCHEMA_VERSION || flags === 0) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Несовместимая версия или флаги пакета (v${schemaVersion}, flags=${flags}).`
            );
            return false;
        }

        const sceneBuffer = universeStore.getSceneBuffer();
        if (count === 0 || count > sceneBuffer.capacity) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Некорректное число сущностей в пакете: count=${count}.`
            );
            return false;
        }

        if (
            tick < this.lastAcceptedTick ||
            (this.socket !== null && tick <= this.lastAcceptedTick)
        ) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Отброшен устаревший или дублирующийся кадр tick=${tick} (последний=${this.lastAcceptedTick}).`
            );
            return false;
        }

        const expectedBytes = 24 + count * 12;
        if (buffer.byteLength < expectedBytes) {
            universeStore.addTerminalLog(
                `[BINARY_GUARD] Выход за границы буфера: заявлено ${count} узлов (${expectedBytes} Б), получено ${buffer.byteLength} Б.`
            );
            return false;
        }

        // Проверяем конечность всех координат payload перед записью в SceneBufferSoA
        for (let i = 0; i < count; i++) {
            const byteOffset = 24 + i * 12;
            const x = view.getFloat32(byteOffset, true);
            const y = view.getFloat32(byteOffset + 4, true);
            const z = view.getFloat32(byteOffset + 8, true);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                universeStore.addTerminalLog(
                    `[BINARY_GUARD] Отброшен пакет с NaN/Infinity в узле #${i}.`
                );
                return false;
            }
        }

        // Применяем проверенный кадр в SceneBufferSoA, если активна сессия сервера
        if (this.isHandshakeVerified) {
            for (let i = 0; i < count; i++) {
                const byteOffset = 24 + i * 12;
                const x = view.getFloat32(byteOffset, true);
                const y = view.getFloat32(byteOffset + 4, true);
                const z = view.getFloat32(byteOffset + 8, true);
                sceneBuffer.syncEntityFromParticle(
                    i,
                    i,
                    EntityKindCode.NODE,
                    x,
                    y,
                    z,
                    0,
                    0,
                    0,
                    z,
                    0.8,
                    1
                );
            }
        }

        this.lastAcceptedTick = tick;
        const durMs =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
        integrationRegistry.recordModuleStep(
            'server-ws',
            Math.max(0.1, durMs),
            buffer.byteLength,
            0
        );
        return true;
    }
    // --- КОНЕЦ ФУНКЦИИ handleBinaryFramePacket ---

    // --- НАЧАЛО ФУНКЦИИ scheduleReconnect ---
    private scheduleReconnect(url: string): void {
        if (this.manualDisconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }
        this.reconnectAttempts++;
        const baseDelayMs = Math.min(12000, 1000 * Math.pow(2, this.reconnectAttempts));
        const jitterMs = (this.reconnectAttempts * 271) % 450;

        if (this.reconnectTimerId !== null && typeof window !== 'undefined') {
            window.clearTimeout(this.reconnectTimerId);
        }
        if (typeof window !== 'undefined') {
            this.reconnectTimerId = window.setTimeout(
                () => this.connect(url),
                baseDelayMs + jitterMs
            );
        }
    }
    // --- КОНЕЦ ФУНКЦИИ scheduleReconnect ---

    // --- НАЧАЛО ФУНКЦИИ isConnectedVerified ---
    public isConnectedVerified(): boolean {
        return this.isHandshakeVerified;
    }
    // --- КОНЕЦ ФУНКЦИИ isConnectedVerified ---

    // --- НАЧАЛО ФУНКЦИИ disconnect ---
    public disconnect(): void {
        this.manualDisconnect = true;
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
    // --- КОНЕЦ ФУНКЦИИ disconnect ---
}

export const pythonSocketClient = new PythonSocketClient();