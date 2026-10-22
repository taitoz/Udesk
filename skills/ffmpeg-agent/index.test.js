const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { FfmpegAgent } = require('./index');

const metadata = (width = 3840, height = 1920, fps = '60000/1001') => ({
    format: { duration: '1800', bit_rate: '12000000' },
    streams: [{ codec_type: 'video', codec_name: 'h264', width, height,
        pix_fmt: 'yuv420p', avg_frame_rate: fps }],
});
const agent = () => new FfmpegAgent({ apiKey: 'test-placeholder' });

test('low AVC gets 2400p restoration, explicit CPU/CUDA transitions and original fps', () => {
    const profile = agent()._restorationProfile(metadata(), { remove_grid: true, color_correct: true });
    const filter = profile.output_args[1];
    assert.match(filter, /^hwdownload,format=nv12,format=yuv420p,spp=4:0:1,hqdn3d=1:1:1:1/);
    assert.match(filter, /temperature=7500,eq=contrast=1\.03:brightness=0\.01,unsharp=5:5:1.6:5:5:0,format=yuv420p,hwupload_cuda,scale_cuda=4800:2400:format=nv12:interp_algo=bicubic$/);
    assert.equal(profile.output_args[profile.output_args.indexOf('-r') + 1], '60000/1001');
    assert.equal(profile.mandatory, true);
    const tenBit = metadata();
    tenBit.streams[0].pix_fmt = 'yuv420p10le';
    assert.match(agent()._restorationProfile(tenBit, { remove_grid: true, color_correct: true }).output_args[1],
        /^hwdownload,format=p010le,format=yuv420p,spp=4:0:1,hqdn3d=1:1:1:1,colortemperature=temperature=7500,eq=contrast=1\.03:brightness=0\.01,unsharp=5:5:1.6:5:5:0,format=yuv420p,hwupload_cuda,scale_cuda=/);
});

test('pure CUDA variant is GPU-only; full variant always adds unsharp plus flag-driven filters', () => {
    const a = agent();
    const hevcMid = metadata(5760, 2880);
    hevcMid.streams[0].codec_name = 'hevc';
    const clean = a._restorationProfile(hevcMid);
    assert.equal(clean.pure_cuda_output_args[1], 'scale_cuda=5760:2880:format=nv12:interp_algo=bicubic');
    assert.match(clean.full_restored_output_args[1],
        /^hwdownload,format=nv12,format=yuv420p,unsharp=5:5:1\.6:5:5:0,format=yuv420p,hwupload_cuda,scale_cuda=5760:2880/);
    assert.doesNotMatch(clean.full_restored_output_args[1], /spp|hqdn3d|colortemperature|eq=/);

    const gridProfile = a._restorationProfile(metadata(), { remove_grid: true });
    assert.match(gridProfile.full_restored_output_args[1], /^hwdownload,format=nv12,format=yuv420p,spp=4:0:1,hqdn3d=1:1:1:1/);
    assert.match(gridProfile.full_restored_output_args[1], /unsharp=5:5:1\.6:5:5:0,format=yuv420p,hwupload_cuda,scale_cuda=4800:2400/);
    assert.doesNotMatch(gridProfile.full_restored_output_args[1], /colortemperature/);

    const flagged = a._restorationProfile(hevcMid, { color_correct: true, adjust_contrast: true });
    assert.match(flagged.full_restored_output_args[1], /colortemperature=temperature=7500,eq=contrast=1\.03:brightness=0\.01,unsharp=5:5:1\.6:5:5:0/);
    assert.doesNotMatch(flagged.full_restored_output_args[1], /spp|hqdn3d/);

    // Oversized 8K sources never touch the CPU path regardless of flags, in both variants
    const eightK = a._restorationProfile(metadata(8192, 4096), { remove_grid: true, color_correct: true, adjust_contrast: true });
    for (const variant of [eightK.pure_cuda_output_args, eightK.full_restored_output_args, eightK.output_args]) {
        assert.equal(variant[1], 'scale_cuda=6144:3072:format=nv12:interp_algo=bicubic');
    }
});

test('new restoration flags: noise, fisheye, interlaced and swapped eyes', () => {
    const a = agent();
    const hevcMid = metadata(5760, 2880);
    hevcMid.streams[0].codec_name = 'hevc';

    // remove_noise enables hqdn3d alone, without spp
    const noisy = a._restorationProfile(hevcMid, { remove_noise: true });
    assert.match(noisy.full_restored_output_args[1], /^hwdownload,format=nv12,format=yuv420p,hqdn3d=3:2:6:4\.5,/);
    assert.doesNotMatch(noisy.full_restored_output_args[1], /spp/);

    // fisheye triggers v360 reprojection and forces encode (mandatory)
    const fisheye = a._restorationProfile(hevcMid, { projection_type: 'fisheye' });
    assert.match(fisheye.full_restored_output_args[1], /v360=input=fisheye:output=equirectangular:ih_fov=180:iv_fov=180/);
    assert.equal(fisheye.mandatory, true);

    // interlaced adds yadif to both variants (GPU-native in pure, CPU in full)
    const interlaced = a._restorationProfile(hevcMid, { interlaced: true });
    assert.match(interlaced.pure_cuda_output_args[1], /^yadif_cuda=mode=1,scale_cuda=/);
    assert.match(interlaced.full_restored_output_args[1], /format=yuv420p,yadif=mode=1,/);
    assert.equal(interlaced.mandatory, true);

    // swap_lr inserts stereo3d eye swap before restoration filters
    const swapped = a._restorationProfile(hevcMid, { swap_lr: true });
    assert.match(swapped.full_restored_output_args[1], /format=yuv420p,stereo3d=sbsl:sbsr,/);
    assert.equal(swapped.mandatory, true);

    // filter order: v360 and deinterlace run before denoise/sharpen
    const combo = a._restorationProfile(metadata(), {
        interlaced: true, correct_geometry: true, remove_grid: true, remove_noise: true, swap_lr: true,
    }).full_restored_output_args[1];
    assert.ok(combo.indexOf('yadif') < combo.indexOf('v360') && combo.indexOf('v360') < combo.indexOf('spp'));
    assert.match(combo, /spp=4:0:1,hqdn3d=1:1:1:1/); // remove_grid takes precedence over remove_noise strength
});

test('8K downscales to fixed 6144x3072 and >60 fps is capped', () => {
    const a = agent();
    const profile = a._restorationProfile(metadata(8192, 4096, '120'));
    assert.match(profile.output_args[1], /scale_cuda=6144:3072/);
    assert.equal(profile.output_args[profile.output_args.indexOf('-r') + 1], '60');
    assert.match(a._restorationProfile(metadata(4096, 4096)).output_args[1], /scale_cuda=6144:3072/);
    assert.doesNotMatch(a._restorationProfile(metadata()).output_args[1], /colortemperature/);
});

test('sample offsets stay in short clips and central region of long clips', () => {
    const a = agent();
    for (const duration of [0, 1, 4, 10, 70, 3600]) {
        const offset = a._sampleOffset(duration);
        assert.ok(offset >= 0 && offset <= Math.max(0, duration - 5));
        if (duration === 3600) assert.ok(offset >= 1260 && offset <= 2340);
    }
});

test('executeBatch generates every PASS/WARN task, excludes only skip/FAIL and never launches FFmpeg', async () => {
    const a = agent();
    a._runFfmpeg = () => assert.fail('Final encoding must never run');
    const profile = a._restorationProfile(metadata());
    const task = { name: 'input file.mp4', ext: '.mp4', path: 'input file.mp4', action: 'encode',
        inputArgs: profile.input_args, outputArgs: profile.output_args,
        pureCudaArgs: profile.pure_cuda_output_args, fullRestoredArgs: profile.full_restored_output_args,
        rationale: 'Реставрация',
        assessment: { status: 'PASS', grid_removed: true, color_corrected: false, notes: 'OK' } };
    const warning = { ...task, name: 'warning.mp4', path: 'warning.mp4', assessment: { status: 'WARN', notes: 'Остаточная сетка' } };
    const tasks = await a.executeBatch([task, warning, { ...task, assessment: { status: 'FAIL' } }, { ...task, action: 'skip' }, { ...task, assessment: null }]);
    assert.equal(tasks.length, 3);
    assert.deepEqual(tasks.map(result => result.assessment.status), ['PASS', 'WARN', 'WARN']);
    assert.equal(tasks[1].assessment.notes, 'Остаточная сетка');
    assert.equal(tasks[1].file_name, 'warning.mp4');
    assert.deepEqual(Object.keys(tasks[0]), ['file_name', 'action', 'target_resolution', 'input_args', 'cpu_fallback', 'pure_cuda', 'full_restored', 'rationale', 'assessment']);
    assert.equal(tasks[0].target_resolution, '4800:2400');
    assert.match(tasks[0].pure_cuda.full_command, /input file\.mp4/);
    assert.match(tasks[0].pure_cuda.full_command, /input file_pure_cuda\.mp4/);
    assert.doesNotMatch(tasks[0].pure_cuda.output_args[1], /hwdownload|spp|hqdn3d/);
    assert.match(tasks[0].full_restored.full_command, /input file_restored\.mp4/);
    assert.match(tasks[0].full_restored.output_args[1], /hwdownload.*unsharp.*hwupload_cuda/);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(tasks[0])));
});

test('analysis supplies labelled inline images, forces low AVC restoration and cleans temp files', async () => {
    const a = agent();
    const screenshots = [];
    const commands = [];
    a._captureScreenshot = async (input, offset, output) => {
        screenshots.push({ input, offset, output });
        fs.writeFileSync(output, Buffer.from('png-test-data'));
    };
    a._runFfmpeg = async args => commands.push(args);
    a._runFfprobe = async () => {
        const output = metadata(4800, 2400);
        output.streams[0].codec_name = 'hevc';
        return output;
    };
    let calls = 0;
    a.genai = { models: { generateContent: async request => {
        const parts = request.contents[0].parts;
        calls++;
        assert.equal(parts.filter(part => part.inlineData).length, calls === 1 ? 1 : 2);
        return { text: JSON.stringify(calls === 1 ? { action: 'skip', source_clean: true, rationale: 'Реставрация' }
            : { status: 'PASS', grid_removed: true, color_corrected: false, notes: 'OK' }) };
    } } };
    const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', ext: '.mp4', path: 'input.mp4', metadata: metadata() }]);
    assert.equal(queue[0].action, 'encode');
    assert.equal(queue[0].assessment.status, 'PASS');
    assert.equal(commands.length, 1);
    assert.ok(commands[0].includes('5'));
    assert.equal(screenshots[1].offset, 0);
    assert.equal(fs.existsSync(screenshots[0].output), false);
});

test('failed sample cannot enter queue and temporary images are removed', async () => {
    const a = agent();
    let screenshot;
    a._captureScreenshot = async (input, offset, output) => {
        screenshot = output;
        fs.writeFileSync(output, 'image');
    };
    a.genai = { models: { generateContent: async () => ({ text: '{"action":"encode"}' }) } };
    a._runFfmpeg = async () => { throw new Error('CUDA unavailable'); };
    const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', path: 'input.mp4', ext: '.mp4', metadata: metadata() }]);
    assert.equal(queue[0].assessment.status, 'FAIL');
    assert.equal(fs.existsSync(screenshot), false);
    assert.deepEqual(await a.executeBatch(queue), []);
});

test('only confirmed clean and decoder-compatible originals may skip', async () => {
    const cases = [
        { clean: true, width: 4800, height: 2400, fps: '60', codec: 'hevc', expected: 'skip' },
        { clean: false, width: 4800, height: 2400, fps: '60', codec: 'hevc', expected: 'encode' },
        { width: 4800, height: 2400, fps: '60', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 8192, height: 4096, fps: '60', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 4800, height: 2400, fps: '120', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 4800, height: 2400, fps: '0/0', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 4800, height: 2400, fps: '60', codec: 'vp9', expected: 'encode' },
    ];
    for (const entry of cases) {
        const a = agent();
        const source = metadata(entry.width, entry.height, entry.fps);
        source.streams[0].codec_name = entry.codec;
        a._captureScreenshot = async (input, offset, output) => fs.writeFileSync(output, 'image');
        a._runFfmpeg = async () => {};
        a._runFfprobe = async () => {
            const output = metadata(4800, 2400);
            output.streams[0].codec_name = 'hevc';
            return output;
        };
        let calls = 0;
        a.genai = { models: { generateContent: async () => ({ text: JSON.stringify(++calls === 1
            ? { action: 'skip', source_clean: entry.clean }
            : { action: 'encode', status: 'WARN', notes: 'Остаточная сетка' }) }) } };
        const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', path: 'input.mp4', ext: '.mp4', metadata: source }]);
        assert.equal(queue[0].action, entry.expected, JSON.stringify(entry));
        const tasks = await a.executeBatch(queue);
        assert.equal(tasks.length, entry.expected === 'skip' ? 0 : 1);
        if (tasks.length) assert.equal(tasks[0].assessment.status, 'WARN');
    }
});

test('recoverable Gemini assessment failure preserves a WARN task after successful encoding', async () => {
    const a = agent();
    a._captureScreenshot = async (input, offset, output) => fs.writeFileSync(output, 'image');
    a._runFfmpeg = async () => {};
    a._runFfprobe = async () => {
        const output = metadata(4800, 2400);
        output.streams[0].codec_name = 'hevc';
        return output;
    };
    let calls = 0;
    a.genai = { models: { generateContent: async () => {
        if (++calls === 1) return { text: '{"action":"encode"}' };
        throw new Error('Gemini service unavailable');
    } } };
    const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', path: 'input.mp4', ext: '.mp4', metadata: metadata() }]);
    const tasks = await a.executeBatch(queue);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].assessment.status, 'WARN');
    assert.match(tasks[0].assessment.notes, /Gemini service unavailable/);
});

test('critical analysis failure in one file does not abort the rest of the batch', async () => {
    const a = agent();
    a._captureScreenshot = async (input, offset, output) => fs.writeFileSync(output, 'image');
    a._runFfmpeg = async () => {};
    a._runFfprobe = async () => {
        const output = metadata(4800, 2400);
        output.streams[0].codec_name = 'hevc';
        return output;
    };
    a.genai = { models: { generateContent: async () => ({ text: '{"action":"encode","status":"WARN"}' }) } };
    const queue = await a.analyzeAndEstimate([
        { name: 'broken.mp4', path: 'broken.mp4', ext: '.mp4', metadata: { streams: [] } },
        { name: 'valid.mp4', path: 'valid.mp4', ext: '.mp4', metadata: metadata() },
    ]);
    assert.deepEqual(queue.map(task => task.assessment.status), ['FAIL', 'WARN']);
    const tasks = await a.executeBatch(queue);
    assert.deepEqual(tasks.map(task => task.file_name), ['valid.mp4']);
});

test('missing visual verdict is never a PASS', () => {
    assert.equal(agent()._normalizeAssessment({ assessment: 'PASS' }).status, 'WARN');
    assert.equal(agent()._normalizeAssessment(null).grid_removed, false);
});

function launcherFixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-launcher-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function runLauncher(args, mock = true) {
    const launcher = path.join(__dirname, 'test-run.js');
    const script = `
        const { main } = require(${JSON.stringify(launcher)});
        const { FfmpegAgent } = require(${JSON.stringify(path.join(__dirname, 'index.js'))});
        class MockAgent extends FfmpegAgent {
            constructor() { super({ apiKey: 'test-placeholder' }); }
            async scanFolder(input) {
                if (require('path').basename(input) === 'scan-error') throw new Error('Scan failed');
                return super.scanFolder(input);
            }
            async _runFfprobe() { return ${JSON.stringify(metadata())}; }
            async _runFfmpeg() { throw new Error('Unexpected encoding'); }
            async analyzeAndEstimate(files) {
                return files.map(file => {
                    const profile = this._restorationProfile(file.metadata);
                    return { ...file, action: file.name.startsWith('skip') ? 'skip' : 'encode',
                        inputArgs: profile.input_args, outputArgs: profile.output_args,
                        pureCudaArgs: profile.pure_cuda_output_args,
                        fullRestoredArgs: profile.full_restored_output_args,
                        assessment: { status: file.name.startsWith('fail') ? 'FAIL' : file.name.startsWith('warn') ? 'WARN' : 'PASS' } };
                });
            }
        }
        main(JSON.parse(process.argv[1]), MockAgent).catch(error => {
            console.error(error.message);
            process.exitCode = 1;
        });
    `;
    return spawnSync(process.execPath, mock ? ['-e', script, JSON.stringify(args)] : [launcher, ...args],
        { encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
}

test('scanFolder accepts a single video without scanning siblings', async t => {
    const directory = launcherFixture(t);
    const selected = path.join(directory, 'selected.MP4');
    fs.writeFileSync(selected, 'video');
    fs.writeFileSync(path.join(directory, 'sibling.mp4'), 'video');
    const a = agent();
    const probed = [];
    a._runFfprobe = async input => { probed.push(input); return metadata(); };
    const files = await a.scanFolder(selected);
    assert.deepEqual(files.map(file => file.name), ['selected.MP4']);
    assert.deepEqual(probed, [selected]);
});

test('launcher saves only the selected file and never overwrites existing reports', t => {
    const directory = launcherFixture(t);
    const selected = path.join(directory, 'warn clip.mp4');
    fs.writeFileSync(selected, 'video');
    fs.writeFileSync(path.join(directory, 'sibling.mp4'), 'video');
    const existingReport = path.join(directory, 'warn clip_commands.txt');
    fs.writeFileSync(existingReport, 'keep original');
    const result = runLauncher([selected]);
    assert.equal(result.status, 0, result.stderr);
    const task = JSON.parse(result.stdout);
    assert.equal(task.file_name, 'warn clip.mp4');
    assert.equal(task.assessment.status, 'WARN');
    assert.equal(fs.readFileSync(existingReport, 'utf8'), 'keep original');
    const reportText = fs.readFileSync(path.join(directory, 'warn clip_commands_1.txt'), 'utf8');
    assert.match(reportText, /rem warn clip\.mp4 — pure_cuda\r?\n/);
    assert.match(reportText, /rem warn clip\.mp4 — full_restored\r?\n/);
    assert.ok(reportText.includes(task.pure_cuda.full_command));
    assert.ok(reportText.includes(task.full_restored.full_command));
    assert.equal(fs.existsSync(path.join(directory, 'warn clip_encoded.mp4')), false);
});

test('launcher scans folders, preserves WARN and excludes skip/FAIL', t => {
    const directory = launcherFixture(t);
    for (const name of ['pass.mp4', 'warn.mp4', 'fail.mp4', 'skip.mp4', 'ignored.txt']) {
        fs.writeFileSync(path.join(directory, name), 'video');
    }
    const output = path.join(directory, 'reports');
    const result = runLauncher([directory, output]);
    assert.equal(result.status, 0, result.stderr);
    const tasks = JSON.parse(result.stdout);
    assert.deepEqual(tasks.map(task => task.file_name), ['pass.mp4', 'warn.mp4']);
    const reportText = fs.readFileSync(path.join(output, 'optimization_commands.txt'), 'utf8');
    for (const task of tasks) {
        assert.ok(reportText.includes(task.pure_cuda.full_command));
        assert.ok(reportText.includes(task.full_restored.full_command));
        assert.ok(reportText.includes(`rem ${task.file_name} — pure_cuda`));
        assert.ok(reportText.includes(`rem ${task.file_name} — full_restored`));
    }
});

test('empty input produces JSON [] in stdout and a report', t => {
    const directory = launcherFixture(t);
    const result = runLauncher([directory]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), []);
    assert.equal(fs.existsSync(path.join(directory, 'optimization_commands.txt')), true);
});

test('launcher validates arguments and paths before requesting credentials', t => {
    const directory = launcherFixture(t);
    const outputFile = path.join(directory, 'not-a-directory');
    fs.writeFileSync(outputFile, 'keep');
    const cases = [
        { args: [], error: /Usage:/ },
        { args: [directory, directory, 'extra'], error: /Usage:/ },
        { args: [path.join(directory, 'missing')], error: /Input path not found/ },
        { args: [outputFile], error: /Unsupported video extension/ },
        { args: [directory, outputFile], error: /Output path is not a directory/ },
        { args: [directory, path.join(outputFile, 'nested')], error: /Output path is not a directory/ },
    ];
    for (const entry of cases) {
        const result = runLauncher(entry.args, false);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, entry.error);
        assert.doesNotMatch(result.stderr, /GEMINI_API_KEY is not configured/);
        assert.equal(result.stdout, '');
    }
    assert.equal(fs.readFileSync(outputFile, 'utf8'), 'keep');
});

test('scan errors do not create output directories and importing the launcher has no side effects', t => {
    const directory = launcherFixture(t);
    const input = path.join(directory, 'scan-error');
    const output = path.join(directory, 'output');
    fs.mkdirSync(input);
    const result = runLauncher([input, output]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Scan failed/);
    assert.equal(fs.existsSync(output), false);
    const imported = spawnSync(process.execPath,
        ['-e', `require(${JSON.stringify(path.join(__dirname, 'test-run.js'))});`],
        { encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, '');
    assert.equal(imported.stderr, '');
});
