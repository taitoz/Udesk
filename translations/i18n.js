import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import fs from 'fs';
import {app} from 'electron';

let loadedLanguage;

export function loadTranslation(locale) {
    // Try loading from built Angular assets first (packaged app), then from src/assets (dev)
    const assetsDir = app.isPackaged
        ? path.join(process.resourcesPath, 'app', 'dist', 'uchet-desktop', 'browser', 'assets', 'i18n')
        : path.join(__dirname, '..', 'src', 'assets', 'i18n')

    const pathToTranslation = path.join(assetsDir, locale + '.json')
    const pathToDefaultTranslation = path.join(assetsDir, 'en.json')

    // Fallback to legacy translations/ folder if assets not found
    const fallbackPath = path.join(__dirname, locale + '.json')
    const fallbackDefault = path.join(__dirname, 'en.json')

    let filePath
    if (fs.existsSync(pathToTranslation)) {
        filePath = pathToTranslation
    } else if (fs.existsSync(pathToDefaultTranslation)) {
        filePath = pathToDefaultTranslation
    } else if (fs.existsSync(fallbackPath)) {
        filePath = fallbackPath
    } else {
        filePath = fallbackDefault
    }

    loadedLanguage = JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function translate(phrase) {
    // Look up with menu. prefix first (shared i18n format), then plain key
    let translation = loadedLanguage['menu.' + phrase]
    if (translation === undefined) {
        translation = loadedLanguage[phrase]
    }
    if (translation === undefined) {
        translation = phrase
    }
    return translation
}
