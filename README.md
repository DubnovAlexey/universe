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

На узких экранах технические панели открываются по одной. Финальная визитка остаётся доступной в следующих циклах и плавно перемещается в свободную верхнюю область.

## Технологии

- **Astro и TypeScript** — статическая оболочка, состояние сцены и управление циклом.
- **Canvas 2D и собственная DOM/SVG-фабрика** — изображение, интерфейс и телеметрия.
- **Rust/WASM** — фазы Курамото и контрольная орбитальная модель с резервной реализацией TypeScript.
- **Web Audio API** — воспроизведение и музыкальные огибающие.
- **Python** — независимые математические эталоны и проверки. WGSL-файлы содержат спецификации графических проходов; активный рендерер — Canvas 2D.

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

`npm run verify:all` проверяет исходники, Python/Rust/TypeScript, реальный WASM и статический артефакт GitHub Pages.

- [Архитектура и конвейер данных](docs/ARCHITECTURE.md)
- [Технический справочник и карта модулей](UNIVERSE_BIBLE.md)
- [Архитектурное решение: вычислительные модули](docs/ADR-001-POLYGLOT-RUNTIME.md)
- [Математические модели](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)
- [Визуальная и музыкальная режиссура](docs/VISUAL_AUDIO_DIRECTION.md)
- [Сценарий демонстрации](docs/DEMO_SCRIPT.md)

## Автор и лицензия

[Alexey Dubnov / DubnovAlexey](https://github.com/DubnovAlexey). Код распространяется по [лицензии MIT](LICENSE). Шрифтовые поднаборы Noto — по [SIL OFL 1.1](frontend/public/fonts/LICENSE.txt). Условия использования саундтрека указаны в [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md).
