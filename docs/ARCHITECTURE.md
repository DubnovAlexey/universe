# 🏛 Архитектура и техническое устройство UNIVERSE (v2.5)

## 1. Назначение и архитектурный обзор

**UNIVERSE (Нейроверс)** — интерактивная полноэкранная аудиовизуальная инсталляция и полиглот-витрина («Из Нуля в Ноль», 108-секундный непрерывный цикл), разработанная **Алексеем Дубновым (`DubnovAlexey`)** для демонстрации на **GitHub Pages**.

Проект объединяет три синхронные оптики над единым детерминированным состоянием:
1. **`ILLUSION` (Космическая оптика):** нестабильные дышащие кольца светового эха цефеиды `RS Puppis`, спиральные пылевые рукава и каньоны поглощения света (`M31` / `NGC 3169`), 7-оболочечная корона «Кошачьего глаза» (`NGC 6543`) и аккреционный диск Чёрной дыры.
2. **`NEXUS` (Когнитивная топология):** двухполушарная нейронная сеть поверх 5 встречных кеплеровских колец с тремя классами рёбер (`Class A: MST Trunks`, `Class B: Gabriel Bridges`, `Class C: Murray Dendrites`) и кометами синаптических импульсов.
3. **`X-RAY / TRUTH` (Инженерная изнанка):** интерактивная мембрана преломления `BREACH LENS`, глубинная суб-квантовая сеть `Z4` («обратная сторона Вселенной»), векторы скоростей и парящие бесконтурные выноски узлов.

---

## 2. Матрица реальных путей исполнения (Truth Policy v2.5)

В соответствии с политикой **Zero Fake Telemetry** каждый модуль в `IntegrationRegistry` (`frontend/src/core/integrationRegistry.ts`) стартует с нулевыми замерами (`0 ms`) и отражает фактический статус среды исполнения:

| Модуль реестра | Файл-владелец | Статус на GitHub Pages (Static) | Фактическая роль в конвейере v2.5 |
| :--- | :--- | :---: | :--- |
| **`ts-core`** | `frontend/src/store/universeState.ts` | `READY` | Монотонные часы 108 с, C²-интерполяция Перлина `smootherstep`, `SceneBufferSoA`, `State Digest`. |
| **`canvas2d-render`** | `frontend/src/engine/renderer.ts` | `READY` | Основной высокоточный рендерер всех 5 фаз, дизеринга `Blue-Noise`, линзы `BREACH` и `Z4`. |
| **`webgpu-render`** | `frontend/src/engine/pipeline.ts` | `FALLBACK` / `UNSUPPORTED` | Выполняет проверку адаптера `navigator.gpu.requestAdapter()`; WGSL-шейдеры (`illusion.wgsl`, `truth.wgsl`, `breach.wgsl`) включены как эталонные шейдерные спецификации. |
| **`wasm-physics`** | `frontend/src/bridge/wasmBridge.ts` | `READY` / `FALLBACK` | Проверяет бинарную сигнатуру `\0asm` и экспорты `physics_engine.wasm`. При отсутствии собранного `.wasm` автоматически исполняет детерминированный симплектический интегратор `Velocity Verlet` и модель Курамото в TypeScript. |
| **`worker-physics`** | `frontend/src/bridge/simulationWorker.ts` | `FALLBACK` | Синтез графа `NEXUS` (`MST + Gabriel + Murray`) и BFS-метрик в детерминированном TS-ядре. |
| **`pyodide-graph`** | `backend/core/graph_logic.py` | `FALLBACK` | Эталонная Python-реализация топологии `NEXUS`, идентичная по структуре `simulationWorker.ts`. |
| **`server-ws`** | `backend/main.py` | `INACTIVE` (`CLIENT_ONLY`) | Автономный Python HTTP/Binary сервер (`/api/health`, `/api/topology`, `/api/frame.bin`) и CLI-верификатор паритета (`python -m backend.main --verify`). |
| **`web-audio`** | `frontend/src/utils/audioSync.ts` | `READY` / `FALLBACK` | Бесшовное воспроизведение `/audio/cosmic_ambient.mp3` через `GainNode -> AnalyserNode` с единым снимком спектра на кадр и LFO-фолбэком до первого жеста пользователя. |

---

## 3. Контракт памяти `SceneBufferSoA` и `State Digest`

Все координаты и скорости активных частиц синхронизируются в плоском буфере `SceneBufferSoA` (`frontend/src/core/sceneBuffer.ts`) с 24-байтным заголовком `Little-Endian`:
* `magic`: `0x53564E55` (`'UNVS'`)
* `schemaVersion`: `2`
* `flags`: `uint16`
* `tick`: `uint32`
* `count`: `uint32`
* `seed`: `uint32` (`GOLDEN_SEED = 104729`)
* `digest`: `uint32` (32-битный хеш `FNV-1a` по квантованным координатам и скоростям `quantizeHalfUp(v)`).

Генератор псевдослучайных чисел `DeterministicPRNG` (32-битный алгоритм Mulberry32 + хеш-функция SplitMix32) побитово идентичен в `frontend/src/core/prng.ts`, `physics_engine/src/prng.rs` и `backend/core/prng.py`, выдавая на стартовом зерне `104729` эталонный вектор:
`[325253669, 3481002091, 881690241, 2630884050]`.

---

## 4. Жизненный цикл 5-й фазы и постоянная полупрозрачная визитка

В фазе `05_SINGULARITY` (`79.0–108.0 с`):
1. **Акт A (`79.0–87.5 с`, `ACT_A_ACCRETION`):** из Точки Нуля разворачиваются 7 оболочек короны `NGC 6543`, аккреционный диск и полярные джеты.
2. **Акт B (`87.5–92.6 с`, `ACT_B_LOGIC`):** корона, диск и оптическое кольцо конвергенции плавно сжимаются по спирали строго в центральную Точку Нуля (`radius -> 0 px`).
3. **Акт C (`92.6–93.05 с`, `ACT_C_ZERO_SILENCE`):** короткий 0.45-секундный световой импульс максимального сжатия в Точке Нуля без остановки музыки и без мёртвой паузы.
4. **Акт D (`93.05–108.0 с`, `ACT_D_GITHUB_CARD`):** из центральной точки вылетает визитка `DUBNOV ALEXEY` (`Layer5_CipherFinale.tsx`) с парящей в воздухе без рамок квантовой строкой и тремя кнопками (`GITHUB PROFILE`, `PROJECT REPOSITORY`, `RESTART UNIVERSE CYCLE`).
5. **Постоянный полупрозрачный режим (`.ambient-loop`):** после первого достижения финала флаг `finaleReachedOnce` остаётся равным `true`. Когда космос на 108-й секунде уходит на второй и последующие круги (`01_VOID -> ... -> 05_SINGULARITY`), визитка остаётся полупрозрачно парить в центре экрана (`opacity: 0.46`) и плавно проявляется до `0.98` при наведении мыши.