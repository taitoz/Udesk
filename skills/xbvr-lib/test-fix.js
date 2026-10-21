const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Config
const DB_PATH = 'G:\\$XBVR\\xbvr\\main.db';
const COVERS_DIR = 'G:\\$XBVR\\xbvr\\myfiles\\covers';
const PREVIEW_DIR = 'X:\\$XVR_Lib\\video_preview';
// Relative path stored in DB. The web UI serves it as-is, and XBVR's deovr.go
// (deoAbsoluteURL helper) prepends the DeoVR connection host automatically.
const BASE_URL = '/myfiles/covers';
// Legacy absolute prefixes to rewrite to relative for scenes that have a poster.
const OLD_BASE_URLS = [
  'http://localhost:9999/myfiles/covers/',
  'http://192.168.1.3:9999/myfiles/covers/'
];

const sourceDir = process.argv[2];

if (!sourceDir) {
  console.error('Usage: node test-fix.js <source-folder>');
  process.exit(1);
}

if (!fs.existsSync(sourceDir)) {
  console.error('Source folder does not exist:', sourceDir);
  process.exit(1);
}

// Ensure destination dirs exist
fs.mkdirSync(COVERS_DIR, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

// Open DB
const db = new Database(DB_PATH);

const stmtFile = db.prepare('SELECT scene_id FROM files WHERE filename = ?');
const stmtScene = db.prepare('SELECT scene_id FROM scenes WHERE id = ?');
const stmtUpdateCover = db.prepare('UPDATE scenes SET cover_url = ? WHERE id = ?');
const stmtUpdatePreview = db.prepare('UPDATE scenes SET has_video_preview = 0 WHERE id = ?');

// Recursively collect .mp4 files
function collectMp4Files(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMp4Files(fullPath, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) {
      files.push(fullPath);
    }
  }
  return files;
}

const mp4Files = collectMp4Files(sourceDir);
console.log(`Found ${mp4Files.length} mp4 file(s) in ${sourceDir}\n`);

const scenesWithPoster = new Set();

for (const mp4Path of mp4Files) {
  const dir = path.dirname(mp4Path);
  const basename = path.basename(mp4Path, '.mp4');
  const filename = path.basename(mp4Path);

  console.log(`Processing: ${filename}`);

  // Query DB for scene
  const fileRow = stmtFile.get(filename);
  if (!fileRow || !fileRow.scene_id) {
    console.warn(`  -> No DB entry for "${filename}", skipping.`);
    continue;
  }

  const sceneNumericId = fileRow.scene_id;
  const sceneRow = stmtScene.get(sceneNumericId);
  if (!sceneRow || !sceneRow.scene_id) {
    console.warn(`  -> Scene not found for file id ${sceneNumericId}, skipping.`);
    continue;
  }

  const sceneId = sceneRow.scene_id;
  console.log(`  -> scene_id = ${sceneId}`);

  // 1. Handle poster
  const posterName = `${basename}-poster.jpg`;
  const posterPath = path.join(dir, posterName);
  if (fs.existsSync(posterPath)) {
    const destPoster = path.join(COVERS_DIR, `${sceneId}.jpg`);
    if (fs.existsSync(destPoster)) {
      console.log(`  -> Skipped poster copy (already exists): ${destPoster}`);
    } else {
      fs.copyFileSync(posterPath, destPoster);
      console.log(`  -> Copied poster to ${destPoster}`);
    }

    const coverUrl = `${BASE_URL}/${sceneId}.jpg`;
    stmtUpdateCover.run(coverUrl, sceneNumericId);
    scenesWithPoster.add(sceneNumericId);
    console.log(`  -> Updated cover_url for id=${sceneNumericId}`);
  } else {
    console.log(`  -> No poster file (${posterName})`);
  }

  // 2. Handle trailer
  const trailerName = `${basename}-trailer.webm`;
  const trailerPath = path.join(dir, trailerName);
  if (fs.existsSync(trailerPath)) {
    const destTrailer = path.join(PREVIEW_DIR, `${sceneId}.mp4`);
    if (fs.existsSync(destTrailer)) {
      console.log(`  -> Skipped trailer copy (already exists): ${destTrailer}`);
    } else {
      fs.copyFileSync(trailerPath, destTrailer);
      console.log(`  -> Copied trailer to ${destTrailer}`);
    }
  } else {
    console.log(`  -> No trailer file (${trailerName}), resetting has_video_preview`);
    stmtUpdatePreview.run(sceneNumericId);
  }
}

// Bulk-rewrite any remaining absolute cover URLs to relative for scenes that have a poster
if (scenesWithPoster.size > 0) {
  const stmtBulkUpdate = db.prepare('UPDATE scenes SET cover_url = REPLACE(cover_url, ?, ?) WHERE id = ?');
  const tx = db.transaction((ids) => {
    for (const id of ids) {
      for (const oldPrefix of OLD_BASE_URLS) {
        stmtBulkUpdate.run(oldPrefix, BASE_URL + '/', id);
      }
    }
  });
  tx(Array.from(scenesWithPoster));
  console.log(`\nBulk-rewrote ${scenesWithPoster.size} cover_url entries to relative paths.`);
}

db.close();
console.log('\nDone.');
