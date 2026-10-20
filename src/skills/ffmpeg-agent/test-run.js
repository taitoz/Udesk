const path = require('path');
const fs = require('fs');
const { FfmpegAgent, VIDEO_EXTS } = require('./index');

async function main(args = process.argv.slice(2), Agent = FfmpegAgent) {
    if (args.length < 1 || args.length > 2) {
        throw new Error('Usage: GEMINI_API_KEY=... node test-run.js <input-path> [output-dir]');
    }
    const inputPath = path.resolve(args[0]);
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Input path not found: ${inputPath}`);
    }

    const inputStat = fs.statSync(inputPath);
    if (!inputStat.isDirectory() && !inputStat.isFile()) {
        throw new Error(`Input path is not a file or directory: ${inputPath}`);
    }
    if (inputStat.isFile() && !VIDEO_EXTS.includes(path.extname(inputPath).toLowerCase())) {
        throw new Error(`Unsupported video extension: ${path.extname(inputPath)}`);
    }
    // Определяем папку источника: если передан файл, берем его директорию, иначе используем путь папки
    const inputDir = inputStat.isDirectory() ? inputPath : path.dirname(inputPath);

    // Если папка для вывода не задана явно, сохраняем в ту же папку, где лежат входные файлы
    const outputDir = args[1] ? path.resolve(args[1]) : inputDir;
    let existingParent = outputDir;
    while (!fs.existsSync(existingParent)) {
        const parent = path.dirname(existingParent);
        if (parent === existingParent) throw new Error(`Output parent path not found: ${existingParent}`);
        existingParent = parent;
    }
    if (!fs.statSync(existingParent).isDirectory()) {
        throw new Error(`Output path is not a directory: ${existingParent}`);
    }

    const agent = new Agent();
    const originalLog = console.log;
    console.log = (...values) => console.error(...values);

    try {
        // ── Stage 1: Scan File or Folder ────────────────────────
        const files = await agent.scanFolder(inputPath);
        if (files.length === 0) console.error('No valid video files found to process.');

        // ── Stage 2: Analyze & Estimate ────────────────────────
        const queue = files.length ? await agent.analyzeAndEstimate(files, progress => {
            console.error(JSON.stringify(progress));
        }) : [];

        // PASS и WARN попадают в очередь генерации команд
        const encodeQueue = queue.filter(task => task.action !== 'skip' && task.assessment?.status !== 'FAIL');

        // ── Stage 3: Generate Batch Tasks ──────────────────────
        const tasks = await agent.executeBatch(encodeQueue, outputDir);
        console.error(`Generated: ${tasks.length}; excluded: ${queue.length - tasks.length}. No final encoding started.`);
        const resultJson = JSON.stringify(tasks.length === 1 ? tasks[0] : tasks, null, 2);

        // Формирование имени и сохранение выходного файла с командами в целевую пакку
        const reportBaseName = inputStat.isFile()
            ? `${path.basename(inputPath, path.extname(inputPath))}_commands`
            : 'optimization_commands';
        fs.mkdirSync(outputDir, { recursive: true });
        let reportPath;
        for (let suffix = 0; ; suffix++) {
            reportPath = path.join(outputDir, `${reportBaseName}${suffix ? `_${suffix}` : ''}.json`);
            try {
                fs.writeFileSync(reportPath, resultJson, { encoding: 'utf-8', flag: 'wx' });
                break;
            } catch (err) {
                if (err.code !== 'EEXIST') throw err;
            }
        }
        console.error(`Commands saved to: ${reportPath}`);
        process.stdout.write(`${resultJson}\n`);
    } finally {
        console.log = originalLog;
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err.message);
        process.exitCode = 1;
    });
}

module.exports = { main };
