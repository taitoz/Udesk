const readline = require('readline');
const path = require('path');
const { FfmpegAgent } = require('./index');

function printUsage() {
    console.log('Usage: node test-run.js <input-dir> [output-dir] <gemini-api-key>');
    console.log('');
    console.log('Examples:');
    console.log('  node test-run.js ./videos ./out AIza...');
    console.log('  node test-run.js ./videos AIza...        (output in same folder as source)');
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 2) {
    printUsage();
}

const INPUT_DIR = path.resolve(args[0]);
let OUTPUT_DIR = null;
let GEMINI_KEY = null;

if (args.length === 2) {
    GEMINI_KEY = args[1];
} else {
    OUTPUT_DIR = path.resolve(args[1]);
    GEMINI_KEY = args[2];
}

async function promptUser(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const answer = await new Promise(resolve => rl.question(question, resolve));
    rl.close();
    return answer;
}

async function main() {
    console.log('========================================');
    console.log(' FFmpeg Agent — Oculus Quest 2 / WiFi 6');
    console.log('========================================\n');

    const agent = new FfmpegAgent({ apiKey: GEMINI_KEY });

    // ── Stage 1: Scan Folder ────────────────────────────────
    console.log('=== Stage 1: Scan Folder ===');
    console.log(`Input directory:  ${INPUT_DIR}`);
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    let files;
    try {
        files = await agent.scanFolder(INPUT_DIR);
    } catch (err) {
        console.error(`[Stage 1] Error: ${err.message}`);
        process.exit(1);
    }

    console.log(`Found ${files.length} video file(s).`);
    if (files.length === 0) {
        console.log('No files to process. Exiting.');
        return;
    }
    files.forEach(f => console.log(`  - ${f.name} (${Math.round(parseFloat(f.metadata.format?.duration || 0))}s)`));

    // ── Stage 2 loop: Analyze → Assess → Confirm or Retry ───
    let approved = false;
    let queue = [];

    while (!approved) {
        console.log('\n=== Stage 2: Analyze & Estimate (5 s test slice) ===');
        queue = await agent.analyzeAndEstimate(files, p => {
            if (p.stage === 'analyze') {
                console.log(`  [${p.current}/${p.total}] Analyzing "${p.file}" ...`);
            }
            if (p.stage === 'estimate') {
                const est = p.estimatedSeconds ? `~${(p.estimatedSeconds / 60).toFixed(1)} min` : 'test failed';
                const a = p.assessment;
                const verdict = a ? `[${a.assessment}] ${a.notes}` : '[no assessment]';
                console.log(`  [${p.current}/${p.total}] Est: ${est} | ${verdict}`);
            }
        });

        // Only PASS items make it into the encode queue
        const passQueue = queue.filter(t => t.assessment?.assessment === 'PASS');
        const excluded = queue.filter(t => t.assessment?.assessment !== 'PASS');

        console.log('\n--- Proposed Queue (PASS only) ---');
        if (passQueue.length === 0) {
            console.log('  (none — no files passed quality assessment)');
        }
        passQueue.forEach((t, i) => {
            const est = t.estimatedSeconds > 0 ? `${(t.estimatedSeconds / 60).toFixed(1)} min` : 'N/A';
            const a = t.assessment;
            const verdict = a ? `${a.assessment}: ${a.notes}` : 'N/A';

            const inputStr = t.inputArgs?.length ? t.inputArgs.join(' ') : 'N/A';
            const outputStr = t.outputArgs?.length ? t.outputArgs.join(' ') : 'N/A';

            console.log(
                `  ${i + 1}. [PASS] ${t.name}\n` +
                    `     Input:  ${inputStr}\n` +
                    `     Output: ${outputStr}\n` +
                    `     Why:    ${t.rationale}\n` +
                    `     Est:    ${est}\n` +
                    `     QA:     ${verdict}`
            );
        });

        if (excluded.length > 0) {
            console.log('\n--- Excluded (will NOT be encoded) ---');
            excluded.forEach((t, i) => {
                let reason;
                if (t.action === 'skip') reason = 'SKIP';
                else if (!t.testSuccess) reason = 'TEST FAILED';
                else reason = t.assessment?.assessment || 'NO ASSESSMENT';
                const note = t.assessment?.notes || t.rationale || '';
                console.log(`  ${i + 1}. [${reason}] ${t.name}\n     ${note}`);
            });
        }

        // From here on the active queue is PASS-only
        queue = passQueue;

        if (queue.length === 0) {
            const retry = await promptUser('\nNothing to encode. (n = abort, r = retry with new prompt): ');
            if (retry.trim().toLowerCase() === 'r') {
                const newPrompt = await promptUser('Enter new optimization prompt (or press Enter for default): ');
                if (newPrompt.trim()) {
                    agent.promptTemplate = newPrompt.trim();
                    console.log('Prompt updated. Re-running Stage 2 ...\n');
                } else {
                    console.log('Keeping current prompt. Re-running Stage 2 ...\n');
                }
                continue;
            }
            console.log('Aborted by user.');
            return;
        }

        const answer = await promptUser('\nApprove batch? (y = yes, n = abort, r = retry with new prompt): ');
        const norm = answer.trim().toLowerCase();
        if (norm === 'y') {
            approved = true;
        } else if (norm === 'n') {
            console.log('Aborted by user.');
            return;
        } else {
            const newPrompt = await promptUser('Enter new optimization prompt (or press Enter for default): ');
            if (newPrompt.trim()) {
                agent.promptTemplate = newPrompt.trim();
                console.log('Prompt updated. Re-running Stage 2 ...\n');
            } else {
                console.log('Keeping current prompt. Re-running Stage 2 ...\n');
            }
        }
    }

    // ── Stage 3: Execute Batch ────────────────────────────
    console.log('\n=== Stage 3: Execute Batch ===');
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    let encodeStartTime = null;

    const results = await agent.executeBatch(queue, OUTPUT_DIR, p => {
        if (p.stage === 'encode-start') {
            encodeStartTime = Date.now();
            console.log(`\n[${p.current}/${p.total}] Starting "${p.file}" ...`);
        }
        if (p.stage === 'encode') {
            const pct = p.progressPercent || 0;
            const speed = p.speed || '1x';
            const time = p.currentTime ? p.currentTime.toFixed(1) : '0';

            let etaStr = '--:--:--';
            if (!encodeStartTime) encodeStartTime = Date.now();
            if (pct > 0.5) {
                const elapsedMs = Date.now() - encodeStartTime;
                const totalEstimatedMs = (elapsedMs / pct) * 100;
                const remainingMs = totalEstimatedMs - elapsedMs;

                const totalSeconds = Math.floor(remainingMs / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                etaStr = [
                    hours.toString().padStart(2, '0'),
                    minutes.toString().padStart(2, '0'),
                    seconds.toString().padStart(2, '0'),
                ].join(':');
            }

            process.stdout.write(`\r   -> Encoding: [${pct.toFixed(1)}%] | Processed: ${time}s | Speed: ${speed} | ETA: ${etaStr} `);
        }
        if (p.stage === 'encode-done') {
            process.stdout.write('\n   [DONE] Encoding finished successfully.\n');
        }
        if (p.stage === 'encode-error') {
            process.stdout.write(`\n   [ERROR] Encoding failed: ${p.error}\n`);
        }
    });

    // ── Summary ─────────────────────────────────────────────
    console.log('\n--- Summary ---');
    const succeeded = results.filter(r => r.success && !r.skipped);
    const skipped = results.filter(r => r.skipped);
    const failed = results.filter(r => !r.success);
    console.log(`  Encoded: ${succeeded.length}`);
    console.log(`  Skipped: ${skipped.length}`);
    console.log(`  Failed:  ${failed.length}`);
    succeeded.forEach(r => console.log(`    [OK] ${r.outputFile} (${(r.elapsed / 1000).toFixed(1)}s)`));
    skipped.forEach(r => console.log(`    [SKIP] ${r.task.name}: ${r.task.rationale}`));
    failed.forEach(r => console.log(`    [ERR] ${r.task.name}: ${r.error}`));

    console.log('\nAll done.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
