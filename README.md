# 🌌 UNIVERSE / НЕЙРОВЕРС

[![Live demo](https://img.shields.io/badge/Live_demo-GitHub_Pages-38bdf8?style=for-the-badge)](https://dubnovalexey.github.io/universe/)
[![Build](https://github.com/DubnovAlexey/universe/actions/workflows/deploy.yml/badge.svg)](https://github.com/DubnovAlexey/universe/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981)](LICENSE)

**UNIVERSE** — интерактивная аудиовизуальная инсталляция Алексея Дубнова. За 108 секунд световая точка превращается в галактику, нейронную структуру и чёрную дыру, затем раскрывается в визитку автора. Сцену сопровождает пространственный эмбиент; курсор открывает оптическую линзу и инженерные слои.

**UNIVERSE** is an interactive audiovisual installation by Alexey Dubnov. A continuous 108-second journey connects cosmic structures, neural topology and a final author card through generative visuals, ambient sound and interactive optics.

## Посмотреть

Откройте [живую демонстрацию](https://dubnovalexey.github.io/universe/). Если браузер блокирует автозапуск звука, нажмите на сцену или кнопку AUDIO. Визуальный цикл запускается независимо от звука.

| Управление | Действие |
|---|---|
| Кнопки `01`–`05` или `Shift+1`–`Shift+5` | Выбор фазы |
| Нажатие и движение указателя по сцене | Линза BREACH |
| `P` / PAUSE | Пауза и продолжение |
| `M` / AUDIO | Включение и выключение звука |
| METRICS, TOPOLOGY, TERMINAL, X-RAY | Инженерные слои |
| `2`–`5` | Переключение инженерных слоёв с клавиатуры |
| Стрелки / `Space` / `Esc` на свободной сцене | Перемещение / удержание / закрытие линзы BREACH |
| `Shift+R` | Перезапуск цикла |
| `HOW IT WORKS` / `КАК ЭТО УСТРОЕНО` внизу по центру | Общий путеводитель по сцене |
| `SCRAMBLER`, `KURAMOTO`, `fBm`, `VERLET`, `PLUMMER` в визитке | Объяснение выбранной модели |

На узких экранах технические панели открываются по одной. После сборки визитка плавно поднимается, освобождая центр для Уробороса из части окружающих частиц. Полевое облако продолжает жить вокруг него; внутри кольца медленно течёт разреженная пыль. В начале следующего цикла форма рассеивается обратно в поле; визитка и её ссылки остаются доступными.

## Технологии

- **Astro и TypeScript** — статическая оболочка, состояние сцены и управление циклом.
- **Canvas 2D и собственная DOM/SVG-фабрика** — изображение, интерфейс и телеметрия.
- **Rust/WASM** — фазы Курамото, контрольная орбитальная модель и объёмная геометрия с резервной реализацией TypeScript.
- **WebGPU/WGSL** — глубина и свет частиц Уробороса; при недоступности GPU эпизод рисует Canvas 2D.
- **Web Audio API** — воспроизведение и музыкальные огибающие.
- **Python** — независимые математические эталоны и проверки.

## Как это устроено

Пять кнопок `SCRAMBLER · KURAMOTO · fBm · VERLET · PLUMMER` стоят перед строкой технологий визитки. Они и вращающаяся кнопка внизу по центру (`HOW IT WORKS` спереди, `КАК ЭТО УСТРОЕНО` сзади) открывают путеводитель из 15 тем с уровнями «Просто» и «Технически». На desktop панель раскрывается слева под заголовком, на телефоне занимает читаемую область. Короткий звёздный след связывает нажатую кнопку с панелью; за текстом редко проходят падающие символы. Во время чтения сцена, музыка и остальные кнопки продолжают работать. Закрыть панель можно кнопкой или `Esc`, когда фокус внутри неё.

- **SCRAMBLER / PRNG** создаёт воспроизводимые исходные числа из зерна; индексный хеш задаёт свойства частицы по её номеру.
- **KURAMOTO** связывает внутренние ритмы частиц через средний угол; параметр `r` измеряет согласованность фаз.
- **fBm** складывает плавные неровности разных масштабов, оживляя пыль, эхо и кромку линзы.
- **VERLET** рассчитывает отдельные 64 контрольные орбиты маленькими подшагами; REF64 показывает отклонение их энергии.
- **PLUMMER** задаёт гладкое центральное притяжение контрольных орбит, убирая бесконечное ускорение точечной модели.

Уравнения, параметры реализации и границы применимости собраны в [математическом руководстве](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md).

## Локальный запуск

Нужны Node.js `>=22.23.4`, Python `3.11+` и Rust с target `wasm32-unknown-unknown`.

```sh
git clone https://github.com/DubnovAlexey/universe.git
cd universe
npm ci
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

Откройте адрес, выведенный Astro в терминале. Для production-сборки выполните `npm run build`, затем `npm run preview`.

## Проверки и документация

`npm run verify:all` проверяет исходники, Python/Rust/TypeScript, жизненный цикл графики, реальный WASM и статический артефакт GitHub Pages.

- [Архитектура и конвейер данных](docs/ARCHITECTURE.md)
- [Технический справочник и карта модулей](UNIVERSE_BIBLE.md)
- [Архитектурное решение: вычислительные модули](docs/ADR-001-POLYGLOT-RUNTIME.md)
- [Математические модели](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)
- [Визуальная и музыкальная режиссура](docs/VISUAL_AUDIO_DIRECTION.md)
- [Сценарий демонстрации](docs/DEMO_SCRIPT.md)

## Автор и лицензия

[Alexey Dubnov / DubnovAlexey](https://github.com/DubnovAlexey). Код распространяется по [лицензии MIT](LICENSE). Шрифтовые поднаборы Noto — по [SIL OFL 1.1](frontend/public/fonts/LICENSE.txt). Условия использования саундтрека указаны в [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md).
