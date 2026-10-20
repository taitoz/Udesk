const path = require('path');
const { FfmpegAgent } = require('./index');

async function main() {
    const args = process.argv.slice(2);
    if (!args.length) throw new Error('Usage: GEMINI_API_KEY=... node test-run.js <input-dir> [output-dir]');
    const agent = new FfmpegAgent();
    const inputDir = path.resolve(args[0]);
    const outputDir = args[1] ? path.resolve(args[1]) : null;
    const originalLog = console.log;
    console.log = (...values) => console.error(...values);
    try {
        // ── Stage 1: Scan Folder ────────────────────────────────
        const files = await agent.scanFolder(inputDir);
        // ── Stage 2 loop: Analyze → Assess → Confirm or Retry ───
        const queue = await agent.analyzeAndEstimate(files, progress => {
            console.error(JSON.stringify(progress));
        });
        // PASS and WARN items make it into the encode queue
        const encodeQueue = queue.filter(task => task.action !== 'skip' && task.assessment?.status !== 'FAIL');
        // From here on the active queue includes non-critical warnings
        // ── Stage 3: Execute Batch ────────────────────────────
        const tasks = await agent.executeBatch(encodeQueue, outputDir);
        // ── Summary ─────────────────────────────────────────────
        console.error(`Generated: ${tasks.length}; excluded: ${queue.length - tasks.length}. No final encoding started.`);
        process.stdout.write(`${JSON.stringify(tasks.length === 1 ? tasks[0] : tasks, null, 2)}\n`);
    } finally {
        console.log = originalLog;
    }
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exitCode = 1;
});
