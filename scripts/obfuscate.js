/**
 * Obfuscates all JS source files into dist-obfuscated/
 * electron-builder then packages from there via extraFiles config
 */

import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'src-obfuscated');

const OBFUSCATOR_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true,
    shuffleStringArray: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
};

// Files to skip obfuscation (third-party / binary-like)
const SKIP = ['chart.umd.min.js'];

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (entry.isFile()) {
            if (entry.name.endsWith('.js') && !SKIP.includes(entry.name)) {
                console.log(`  obfuscating: src/${path.relative(SRC, srcPath)}`);
                const code = fs.readFileSync(srcPath, 'utf8');
                const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);
                fs.writeFileSync(destPath, result.getObfuscatedCode());
            } else {
                // Copy non-JS files as-is (HTML, CSS, assets, etc.)
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

console.log('🔒 Obfuscating source files...');

// Clean output dir
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });

copyDir(SRC, OUT);

console.log('✅ Obfuscation complete → src-obfuscated/');
console.log('   electron-builder will package from src-obfuscated/');
