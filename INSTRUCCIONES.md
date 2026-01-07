# 📖 Instrucciones de Uso - Cliente Remoto

## 🚀 Configuración Inicial

### PC1 (Servidor)

1. **Instalar dependencias:**
```bash
npm install
```

2. **Iniciar el servidor:**
```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

3. **Obtener la IP de tu PC1:**
   - Abre CMD y ejecuta: `ipconfig`
   - Busca "Dirección IPv4" (ejemplo: 192.168.1.100)

### PC2 (Cliente)

#### Opción 1: Ejecutar directamente con Node.js

1. **Copiar `cliente.js` a PC2**

2. **Instalar dependencias:**
```bash
npm install socket.io-client
```

3. **Editar `cliente.js`** y cambiar la línea:
```javascript
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
```
Por:
```javascript
const SERVER_URL = process.env.SERVER_URL || 'http://IP_DE_PC1:3000';
```
Reemplaza `IP_DE_PC1` con la IP que obtuviste (ejemplo: `http://192.168.1.100:3000`)

4. **Ejecutar el cliente:**
```bash
node cliente.js
```

O usando variable de entorno:
```bash
$env:SERVER_URL="http://192.168.1.100:3000"; node cliente.js
```

#### Opción 2: Crear ejecutable (.exe)

Desde PC1 (o cualquier PC con Node.js):

1. **Instalar pkg:**
```bash
npm install -g pkg
```

2. **Crear ejecutable:**
```bash
npm run build-client
```

Esto creará `cliente.exe` en la carpeta del proyecto.

3. **Configurar el ejecutable:**
   
   **Opción A:** Editar `cliente.js` antes de crear el ejecutable (ver Opción 1, paso 3)
   
   **Opción B:** Crear un archivo de configuración `config.json` o usar variables de entorno

4. **Copiar `cliente.exe` a PC2**

5. **Crear un archivo `.bat` en PC2** para ejecutar el cliente:
   
   `iniciar-cliente.bat`:
   ```batch
   @echo off
   set SERVER_URL=http://192.168.1.100:3000
   cliente.exe
   pause
   ```
   
   Reemplaza `192.168.1.100` con la IP de PC1.

6. **Ejecutar `iniciar-cliente.bat`** en PC2

## 🔧 Uso

### Desde PC1 (Interfaz Web)

1. Abre el navegador en: `http://localhost:3000`

2. Verás la lista de clientes conectados en la sección "Clientes Conectados"

3. Selecciona el destino:
   - **🖥️ PC Local**: Ejecuta comandos en PC1
   - **📡 Cliente-X**: Ejecuta comandos en PC2 u otros clientes conectados

4. Ingresa un comando (ejemplo: `dir`, `ipconfig`, `whoami`)

5. Haz clic en "Ejecutar" o presiona Enter

6. El resultado se mostrará en pantalla

### Verificación

- El cliente mostrará mensajes en consola cuando:
  - Se conecta al servidor
  - Recibe un comando
  - Ejecuta un comando exitosamente
  - Ocurre un error

## 🔒 Seguridad

⚠️ **IMPORTANTE:** Este sistema ejecuta comandos directamente en las PCs. Úsalo solo en redes confiables o con autenticación adicional.

### Recomendaciones:

1. **Firewall:** Asegúrate de que el puerto 3000 esté abierto solo en tu red local
2. **Autenticación:** Considera agregar autenticación antes de usar en producción
3. **Red privada:** Úsalo solo en redes privadas, nunca expongas a internet

## 🐛 Solución de Problemas

### El cliente no se conecta

1. Verifica que el servidor esté corriendo en PC1
2. Verifica que la IP en `cliente.js` sea correcta
3. Verifica que el firewall de PC1 permita conexiones en el puerto 3000
4. Verifica que ambas PCs estén en la misma red

### Comandos no se ejecutan remotamente

1. Verifica que el cliente esté conectado (debería aparecer en la lista de clientes)
2. Verifica que seleccionaste el cliente correcto en el selector
3. Revisa los logs del cliente para ver si recibió el comando

### El ejecutable no funciona

1. Verifica que tengas Node.js instalado si ejecutas directamente
2. Si creaste el ejecutable, verifica que sea compatible con la arquitectura de PC2 (64-bit)
3. Intenta ejecutar `cliente.js` directamente con Node.js primero para verificar la conexión

## 📝 Ejemplos de Comandos

- `dir` - Listar archivos
- `ipconfig` - Información de red
- `whoami` - Usuario actual
- `systeminfo` - Información del sistema
- `echo Hola Mundo` - Imprimir texto
- `cd C:\ && dir` - Cambiar directorio y listar

pkg cliente.js --targets node18-win-x64 --output cliente.exe                                                                  