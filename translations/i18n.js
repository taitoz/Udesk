import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import fs from 'fs';

let loadedLanguage;

export function loadTranslation(locale) {
    const pathToTranslation = path.join(__dirname, locale + '.json')
    const pathToDefaultTranslation = path.join(__dirname, 'en.json')
    loadedLanguage = fs.existsSync(pathToTranslation) ? JSON.parse(fs.readFileSync(pathToTranslation), 'utf8') : JSON.parse(fs.readFileSync(pathToDefaultTranslation, 'utf8'));
}

export function translate(phrase) {
    let translation = loadedLanguage[phrase]
    if (translation === undefined) {
        translation = phrase
    }
    return translation
}
