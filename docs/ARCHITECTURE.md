# 🏛 Архитектура и техническое устройство UNIVERSE (v2.5)

## 1. Назначение и архитектурный обзор

**UNIVERSE (Нейроверс)** — интерактивная полноэкранная научно-художественная аудиовизуальная инсталляция и полиглот-витрина («Из Нуля в Ноль», 108-секундный непрерывный цикл), разработанная **Алексеем Дубновым (`DubnovAlexey`)** для демонстрации на **GitHub Pages**.

Проект объединяет три синхронные оптики над единым детерминированным состоянием:
1. **`ILLUSION` (Космическая оптика):** нестабильные дышащие кольца светового эха по мотивам цефеиды `RS Puppis`, спиральные пылевые рукава и каньоны поглощения света (`M31` / `NGC 3169`), 7-оболочечная корона «Кошачьего глаза» (`NGC 6543`) и аккреционный диск Чёрной дыры.
2. **`NEXUS` (Когнитивная топология):** двухполушарная нейронная сеть поверх 5 встречных кеплеровских колец с тремя классами рёбер (`Class A: MST Trunks`, `Class B: Gabriel Bridges`, `Class C: Murray Dendrites`) и кометами синаптических импульсов.
3. **`X-RAY / TRUTH` (Инженерная изнанка):** интерактивная мембрана преломления `BREACH LENS`, глубинная суб-квантовая сеть `Z4` («обратная сторона Вселенной»), векторы скоростей и парящие бесконтурные выноски узлов.

---

## 2. Матрица реальных путей исполнения (Truth Policy v2.5)

В соответствии с политикой **Zero Fake Telemetry** все 8 модулей в `IntegrationRegistry` (`frontend/src/core/integrationRegistry.ts`) стартуют с нулевыми замерами (`0 ms`), выводятся в `LAYER_04 // TERMINAL & REGISTRY` и отражают фактический статус среды исполнения:

| Модуль реестра | Файл-владелец | Статус на GitHub Pages (Static) | Фактическая роль в конвейере v2.5 |
| :--- | :--- | :---: | :--- |
| **`ts-core`** | `frontend/src/store/universeState.ts` | `READY` | Монотонные часы 108 с, C²-интерполяция Перлина `smootherstep`, `SceneBufferSoA`, `State Digest`, симплектический шаг в режиме `TS_FALLBACK`. |
| **`canvas2d-render`** | `frontend/src/engine/renderer.ts` | `READY` | Основной высокоточный рендерер всех 5 фаз, дизеринга `Blue-Noise`, линзы `BREACH` и `Z4`. |
| **`web-audio`** | `frontend/src/utils/audioSync.ts` | `READY` / `FALLBACK` | Бесшовное воспроизведение `/audio/cosmic_ambient.mp3` (с `2.6 с`) с единым снимком спектра на кадр и поддержкой `navigator.audioSession.type = 'playback'` на iOS/Android. |
| **`wasm-physics`** | `frontend/src/bridge/wasmBridge.ts` | `FALLBACK` / `READY` | При `?wasm=1` проверяет сигнатуру `\0asm` и экспорты `physics_engine.wasm`. По умолчанию на статическом хостинге исполняет детерминированный симплектический интегратор `Velocity Verlet` (с истинным дрейфом $\Delta E / E_0$) и модель Курамото в TypeScript (`[ts/wasmBridge.ts]`). |
| **`worker-physics`** | `frontend/src/bridge/simulationWorker.ts` | `FALLBACK` | Синтез графа `NEXUS` (`MST + Gabriel + Murray`) и выборочных `BFS-28` метрик в детерминированном TS-ядре (`[ts/graph_engine]`). |
| **`webgpu-render`** | `frontend/src/engine/pipeline.ts` | `FALLBACK` / `UNSUPPORTED` | Выполняет проверку адаптера `navigator.gpu.requestAdapter()`; WGSL-шейдеры (`illusion.wgsl`, `truth.wgsl`, `breach.wgsl`) включены как эталонные спецификации. |
| **`pyodide-graph`** | `backend/core/graph_logic.py` | `FALLBACK` | Эталонная Python-реализация топологии `NEXUS`, идентичная `simulationWorker.ts` на ансамблях $N \le 260$ и проверяемая в CI. |
| **`server-ws`** | `backend/main.py` | `INACTIVE` (`CLIENT_ONLY`) | Локальный Python HTTP/Binary сервер (`/api/health`, `/api/topology`, `/api/frame.bin`), CLI-верификатор (`--verify`) и подготовленный клиентский валидатор пакетов `'UNVS'` (`PythonSocketClient`). |

---

## 3. Контракт памяти `SceneBufferSoA`, 8-польный `NaN-Guard` и `ResourceLedger`

* Все координаты и скорости активных частиц синхронизируются в плоском буфере `SceneBufferSoA` (`frontend/src/core/sceneBuffer.ts`) с 24-байтным заголовком `Little-Endian` (`magic = 0x53564E55`, `schemaVersion = 2`, `flags`, `tick`, `count`, `seed = 104729`, `digest`).
* Метод `syncEntityFromParticle` проверяет на конечность (`Number.isFinite`) и учитывает в `nanGuardTriggeredCount` все 8 числовых полей (`x, y, z, vx, vy, vz, depthZ, energy`).
* Книга учёта ресурсов `ResourceLedger` контролирует все 5 категорий (`buffers, textures, audioNodes, listeners, workers`) и диагностирует `underflowCount` и `disposerErrors`.