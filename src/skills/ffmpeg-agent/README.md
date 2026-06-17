# FFmpeg Agent — Oculus Quest 2 / WiFi 6 Streaming Optimizer

Локальный AI-скилл для автоматической пережатия видео под стриминг на **Oculus Quest 2** через **XBVR** по **WiFi 6** с использованием аппаратного кодирования на **NVIDIA RTX 3070 (CUDA / NVENC)**.

## Стек

- **Node.js** — стандартные модули (`child_process`, `fs`, `path`).
- **@google/genai** — официальный SDK Gemini (`gemini-2.5-flash`).
- **ffmpeg / ffprobe** — предполагается глобально доступные в системе.

## Локация

```
src/skills/ffmpeg-agent/
├── index.js      # основной класс FfmpegAgent
├── test-run.js   # демо-скрипт с readline-подтверждением
└── README.md     # этот файл
```

## Архитектура — 3 этапа

### Stage 1: Scan Folder

Сканирует заданную папку, ищет видеофайлы (только `.mp4` по умолчанию; расширения настраиваются через `options.videoExts`).
Для каждого файла запускает `ffprobe -v error -show_format -show_streams -print_format json` и собирает полные метаданные.

Если `ffprobe` вернёт битый JSON или файл заблокирован — файл пропускается с предупреждением в консоль.

### Stage 2: Analyze & Estimate (цикл с подтверждением)

Для каждого файла:

1. **AI-анализ**. Метаданные отправляются в Gemini с жёстким системным промптом (`QUEST2_OPTIMIZATION_PROMPT`). Модель возвращает строгий JSON с `ffmpeg_args` (массив строк) и `rationale`.

2. **Тестовое пережатие** (60 секунд). Отрезок `00:10:00` → `+60s` перекодируется предложенными параметрами во временный файл. Замеряется реальное время обработки через `Date.now()`.

3. **Повторный ffprobe** выходного файла.

4. **AI-оценка качества** (`QUALITY_ASSESSMENT_PROMPT`). Сравниваются метаданные входа и выхода. Возвращается вердикт:
    - `PASS` — готово к батчу
    - `WARN` — есть нюансы, но скорее всего сойдёт
    - `FAIL` — критические проблемы, требуются изменения

5. **Экстраполяция времени**. `(testDurationMs / 1000) * (duration / 60)` — примерное время на весь файл.

**Цикл подтверждения**: после оценки пользователю предлагается три варианта:

- `y` — подтвердить, перейти к Stage 3
- `n` — отменить всё
- `r` — повторить Stage 2 с новым промптом (можно скорректировать требования)

### Stage 3: Execute Batch

Поочерёдная обработка подтверждённой очереди через `spawn('ffmpeg', args)`:

- Создаётся выходная директория (если отсутствует).
- Каждый файл кодируется с параметрами из Stage 2.
- `stderr` парсится в реальном времени: ищется `time=HH:MM:SS.mm`.
- Рассчитывается `% прогресса` от общей длительности файла.
- Результат и elapsed time сохраняются.

## CUDA / RTX 3070 Оптимизации

Промпт жёстко требует от Gemini генерировать аргументы с учётом аппаратного кодирования:

| Параметр         | Требование                                         |
| ---------------- | -------------------------------------------------- |
| `-c:v`           | `h264_nvenc` (или `hevc_nvenc` если > 4096 px)     |
| `-preset`        | `p4` (качество) или `p5` (баланс) — Ampere оптимал |
| `-tune`          | `hq` (по умолчанию) или `ll` (low latency)         |
| `-profile:v`     | `high` для H.264                                   |
| `-rc`            | `vbr` с `-b:v`, `-maxrate`, `-bufsize`             |
| `-bf` / `-refs`  | `3` / `4` — стабильно для Quest 2                  |
| `-hwaccel cuda`  | перед `-i`, чтобы декод + фильтры шли на GPU       |
| `-vf scale_cuda` | если нужно скейлить — CUDA-ускоренный, а не CPU    |

**Запрещено**: `libx264`, `libx265`, `libsvtav1`, любое CPU-кодирование.

## Запуск

### 1. Подготовка

Убедитесь, что в системе доступны:

```bash
ffmpeg -version      # должен показывать nvenc / cuda support
ffprobe -version
```

Если `ffmpeg` не собран с `--enable-nvenc` — CUDA-кодирование не заработает. Нужен билд с поддержкой `h264_nvenc`.

### 2. Зависимости

Если переносите `ffmpeg-agent/` в другой проект:

```bash
cd ffmpeg-agent
npm init -y
npm install @google/genai
```

### 3. Запуск

Все параметры передаются через аргументы командной строки:

```bash
node test-run.js <input-dir> <output-dir> <gemini-api-key>
```

Пример:

```bash
node test-run.js ./videos ./out AIzaSy...
```

Поведение:

- Сканирует **только `.mp4`** (другие расширения игнорируются).
- Stage 1: автоматический скан
- Stage 2: AI-анализ → **тестовый отрезок с 10-й минуты, 60 секунд** → повторный ffprobe → AI-оценка → запрос подтверждения
- Stage 3: батч-обработка после `y`

### 4. Выход

Готовые файлы сохраняются в `<output-dir>/`.

## Структура очереди (queue item)

```js
{
  name: 'video.mp4',
  path: '/abs/path/to/video.mp4',
  ext: '.mp4',
  metadata: { /* ffprobe input */ },
  ffmpegArgs: ['-c:v', 'h264_nvenc', '-preset', 'p4', ...],
  rationale: 'H.264 NVENC p4 for Quest 2 compat, 25 Mbps VBR',
  testSuccess: true,
  testDurationMs: 3400,
  outputProbe: { /* ffprobe output */ },
  assessment: { assessment: 'PASS', notes: '...', recommended_changes: [] },
  estimatedSeconds: 120.5,
  duration: 2120
}
```

## Изменение цели без редактирования кода

При `r` (retry) в консоли можно ввести новый промпт. Пример:

```
Enter new optimization prompt: Target is Pico 4 over 5GHz WiFi, prioritize low latency over quality. Use hevc_nvenc with -tune ll.
```

Агент применит его ко всем файлам и перезапустит Stage 2.

## Перенос в другой проект (standalone)

Скопируйте папку `ffmpeg-agent/` куда угодно. Внутри неё:

```bash
npm init -y
npm install @google/genai
```

`index.js` экспортирует `FfmpegAgent` и `VIDEO_EXTS`. Импортируйте как обычный модуль:

```js
const { FfmpegAgent } = require('./ffmpeg-agent');

const agent = new FfmpegAgent({
    apiKey: 'YOUR_KEY',
    model: 'gemini-2.5-flash',
    promptTemplate: '...your custom prompt...',
    videoExts: ['.mp4', '.mkv'], // default: ['.mp4']
    testOffsetMin: 5, // default: 10 (minutes)
});

const files = await agent.scanFolder('./videos');
const queue = await agent.analyzeAndEstimate(files);
const results = await agent.executeBatch(queue, './out');
```

Никаких внешних зависимостей кроме `@google/genai`.

## Ограничения

- Только «плоское» сканирование (не рекурсивное).
- Один GPU (RTX 3070), без `-gpu` выбора.
- Тестовый отрезок начинается с 10-й минуты (`-ss 00:10:00`), 60 секунд.
- Оценка качества зависит от корректности ответа Gemini; fallback на H.264/AAC NVENC при ошибке AI.
