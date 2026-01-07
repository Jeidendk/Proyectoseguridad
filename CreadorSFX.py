import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from PIL import Image, ImageTk
import os
import subprocess
import shutil
import tempfile
import base64

class SFXCreator:
    def __init__(self, root):
        self.root = root
        self.root.title("Creador de SFX con Icono Personalizado")
        self.root.geometry("700x750")
        self.root.configure(bg="#f0f0f0")
        
        # Variables
        self.files_list = []
        self.main_exe = tk.StringVar()
        self.output_name = tk.StringVar(value="Factura_Enero2026")
        self.icon_file = tk.StringVar()
        self.silent_mode = tk.BooleanVar(value=True)
        
        self.create_widgets()
    
    def create_widgets(self):
        # Header
        header = tk.Frame(self.root, bg="#8B0000", height=80)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        
        tk.Label(header, text="📦 Creador de SFX con Icono",
                font=("Arial", 18, "bold"), fg="white", bg="#8B0000").pack(pady=15)
        tk.Label(header, text="Usa PyInstaller para iconos personalizados",
                font=("Arial", 10), fg="#ffcccc", bg="#8B0000").pack()
        
        # Main content
        content = tk.Frame(self.root, bg="#f0f0f0")
        content.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Info
        info_frame = tk.Frame(content, bg="#d4edda", relief=tk.SOLID, borderwidth=1)
        info_frame.pack(fill=tk.X, pady=(0, 15))
        tk.Label(info_frame, 
                text="✓ Usa PyInstaller - el icono SE APLICA correctamente\n"
                     "✓ Crea un .exe que extrae y ejecuta el principal automáticamente\n"
                     "✓ No requiere 7-Zip ni Resource Hacker",
                font=("Arial", 9), fg="#155724", bg="#d4edda", justify=tk.LEFT).pack(padx=10, pady=10)
        
        # Paso 1: Agregar archivos
        tk.Label(content, text="Paso 1: Agrega los archivos a incluir", 
                font=("Arial", 11, "bold"), fg="#333", bg="#f0f0f0").pack(anchor=tk.W, pady=(10, 5))
        
        files_frame = tk.Frame(content, bg="white", relief=tk.SOLID, borderwidth=1)
        files_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        list_frame = tk.Frame(files_frame, bg="white")
        list_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        scrollbar = ttk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.files_listbox = tk.Listbox(list_frame, font=("Consolas", 9), 
                                         yscrollcommand=scrollbar.set, height=6)
        self.files_listbox.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.files_listbox.yview)
        
        btn_frame = tk.Frame(files_frame, bg="white")
        btn_frame.pack(fill=tk.X, padx=5, pady=5)
        
        tk.Button(btn_frame, text="➕ Agregar", command=self.add_files,
                 bg="#007bff", fg="white", font=("Arial", 9)).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_frame, text="❌ Quitar", command=self.remove_file,
                 bg="#dc3545", fg="white", font=("Arial", 9)).pack(side=tk.LEFT, padx=2)
        
        # Paso 2: Seleccionar ejecutable principal
        tk.Label(content, text="Paso 2: Ejecutable principal (se ejecuta automáticamente)", 
                font=("Arial", 11, "bold"), fg="#333", bg="#f0f0f0").pack(anchor=tk.W, pady=(10, 5))
        
        exe_frame = tk.Frame(content, bg="white", relief=tk.SOLID, borderwidth=1)
        exe_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.exe_combo = ttk.Combobox(exe_frame, textvariable=self.main_exe, 
                                      state="readonly", font=("Arial", 9))
        self.exe_combo.pack(fill=tk.X, padx=10, pady=10)
        
        # Paso 3: Configuración
        tk.Label(content, text="Paso 3: Configuración", 
                font=("Arial", 11, "bold"), fg="#333", bg="#f0f0f0").pack(anchor=tk.W, pady=(10, 5))
        
        config_frame = tk.Frame(content, bg="white", relief=tk.SOLID, borderwidth=1)
        config_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Nombre
        name_row = tk.Frame(config_frame, bg="white")
        name_row.pack(fill=tk.X, padx=10, pady=10)
        tk.Label(name_row, text="Nombre:", font=("Arial", 9), bg="white").pack(side=tk.LEFT)
        tk.Entry(name_row, textvariable=self.output_name, font=("Arial", 10), width=25).pack(side=tk.LEFT, padx=10)
        tk.Label(name_row, text=".exe", font=("Arial", 9), bg="white").pack(side=tk.LEFT)
        
        # Icono
        icon_row = tk.Frame(config_frame, bg="white")
        icon_row.pack(fill=tk.X, padx=10, pady=(0, 10))
        tk.Label(icon_row, text="Icono:", font=("Arial", 9), bg="white").pack(side=tk.LEFT)
        self.icon_label = tk.Label(icon_row, text="Ninguno", font=("Arial", 9), fg="#666", bg="white")
        self.icon_label.pack(side=tk.LEFT, padx=10)
        tk.Button(icon_row, text="Seleccionar .ico", command=self.select_icon,
                 bg="#6c757d", fg="white", font=("Arial", 8)).pack(side=tk.LEFT)
        
        # Preview
        self.preview_frame = tk.Frame(config_frame, bg="white", width=64, height=64)
        self.preview_frame.pack(pady=5)
        self.preview_label = tk.Label(self.preview_frame, bg="white", text="Vista previa")
        self.preview_label.pack()
        
        # Generar
        gen_btn = tk.Button(content, text="🔨 GENERAR SFX", 
                           command=self.create_sfx,
                           bg="#28a745", fg="white", font=("Arial", 12, "bold"),
                           cursor="hand2", pady=12)
        gen_btn.pack(fill=tk.X, pady=15)
        
        # Separador
        separator = tk.Frame(content, bg="#ccc", height=2)
        separator.pack(fill=tk.X, pady=10)
        
        # Sección: Cambiar icono de ejecutable existente
        tk.Label(content, text="⚙️ Cambiar Icono de Ejecutable Existente", 
                font=("Arial", 11, "bold"), fg="#333", bg="#f0f0f0").pack(anchor=tk.W, pady=(5, 5))
        
        change_icon_frame = tk.Frame(content, bg="white", relief=tk.SOLID, borderwidth=1)
        change_icon_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Fila para exe a modificar
        exe_mod_row = tk.Frame(change_icon_frame, bg="white")
        exe_mod_row.pack(fill=tk.X, padx=10, pady=10)
        tk.Label(exe_mod_row, text="Ejecutable:", font=("Arial", 9), bg="white").pack(side=tk.LEFT)
        self.exe_to_modify = tk.StringVar()
        self.exe_mod_label = tk.Label(exe_mod_row, text="Ninguno", font=("Arial", 9), fg="#666", bg="white")
        self.exe_mod_label.pack(side=tk.LEFT, padx=10, fill=tk.X, expand=True)
        tk.Button(exe_mod_row, text="Seleccionar .exe", command=self.select_exe_to_modify,
                 bg="#17a2b8", fg="white", font=("Arial", 8)).pack(side=tk.LEFT)
        
        # Fila para nuevo icono
        new_icon_row = tk.Frame(change_icon_frame, bg="white")
        new_icon_row.pack(fill=tk.X, padx=10, pady=(0, 10))
        tk.Label(new_icon_row, text="Nuevo Icono:", font=("Arial", 9), bg="white").pack(side=tk.LEFT)
        self.new_icon_file = tk.StringVar()
        self.new_icon_label = tk.Label(new_icon_row, text="Ninguno", font=("Arial", 9), fg="#666", bg="white")
        self.new_icon_label.pack(side=tk.LEFT, padx=10, fill=tk.X, expand=True)
        tk.Button(new_icon_row, text="Seleccionar .ico", command=self.select_new_icon,
                 bg="#6c757d", fg="white", font=("Arial", 8)).pack(side=tk.LEFT)
        
        # Botón aplicar
        tk.Button(change_icon_frame, text="🔄 Aplicar Icono (Recompila con PyInstaller)", 
                 command=self.change_exe_icon,
                 bg="#fd7e14", fg="white", font=("Arial", 10, "bold"),
                 cursor="hand2", pady=8).pack(fill=tk.X, padx=10, pady=10)
        
        # Status
        self.status_label = tk.Label(content, text="Esperando archivos...", 
                                     font=("Arial", 9), fg="#666", bg="#f0f0f0")
        self.status_label.pack()
    
    def add_files(self):
        files = filedialog.askopenfilenames(title="Seleccionar archivos")
        for f in files:
            if f not in self.files_list:
                self.files_list.append(f)
                self.files_listbox.insert(tk.END, os.path.basename(f))
        self.update_exe_combo()
    
    def remove_file(self):
        sel = self.files_listbox.curselection()
        if sel:
            idx = sel[0]
            self.files_listbox.delete(idx)
            del self.files_list[idx]
            self.update_exe_combo()
    
    def update_exe_combo(self):
        exes = [os.path.basename(f) for f in self.files_list if f.lower().endswith('.exe')]
        self.exe_combo['values'] = exes
        if exes and not self.main_exe.get():
            self.exe_combo.current(0)
    
    def select_icon(self):
        icon = filedialog.askopenfilename(
            title="Seleccionar icono .ico",
            filetypes=[("Iconos", "*.ico"), ("Todos", "*.*")]
        )
        if icon:
            self.icon_file.set(icon)
            self.icon_label.config(text=os.path.basename(icon), fg="#28a745")
            try:
                img = Image.open(icon)
                img = img.resize((48, 48), Image.Resampling.LANCZOS)
                self.preview_img = ImageTk.PhotoImage(img)
                self.preview_label.config(image=self.preview_img, text="")
            except:
                pass
    
    def create_sfx(self):
        if not self.files_list:
            messagebox.showerror("Error", "Agrega al menos un archivo")
            return
        if not self.main_exe.get():
            messagebox.showerror("Error", "Selecciona el ejecutable principal")
            return
        
        output_dir = filedialog.askdirectory(title="Carpeta de destino")
        if not output_dir:
            return
        
        try:
            self.status_label.config(text="Creando SFX...")
            self.root.update()
            
            # Crear directorio temporal
            temp_dir = tempfile.mkdtemp()
            
            # Copiar archivos al temp
            for f in self.files_list:
                shutil.copy(f, temp_dir)
            
            # Crear el script launcher
            main_exe = self.main_exe.get()
            launcher_code = f'''
import os
import sys
import subprocess
import tempfile
import shutil
import base64

# Datos embebidos de los archivos
EMBEDDED_FILES = {{
'''
            # Embeber archivos como base64
            for f in self.files_list:
                filename = os.path.basename(f)
                with open(f, 'rb') as file:
                    data = base64.b64encode(file.read()).decode('ascii')
                launcher_code += f'    "{filename}": """{data}""",\n'
            
            launcher_code += f'''}}

MAIN_EXE = "{main_exe}"

def main():
    import time
    import random
    import ctypes
    
    try:
        # Crear directorio único para evitar conflictos
        unique_id = str(int(time.time())) + str(random.randint(1000, 9999))
        extract_dir = os.path.join(tempfile.gettempdir(), "_sfx_" + unique_id)
        
        try:
            # Limpiar directorio anterior si existe
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir, ignore_errors=True)
            os.makedirs(extract_dir, exist_ok=True)
        except:
            # Fallback a directorio en AppData
            extract_dir = os.path.join(os.path.expanduser("~"), ".sfx_temp")
            os.makedirs(extract_dir, exist_ok=True)
        
        # Escribir archivos
        for filename, data in EMBEDDED_FILES.items():
            filepath = os.path.join(extract_dir, filename)
            try:
                with open(filepath, 'wb') as f:
                    f.write(base64.b64decode(data))
            except:
                pass  # Ignorar archivos que no se puedan escribir
        
        # Ejecutar SOLO el principal (los demas quedan extraidos para uso posterior)
        main_path = os.path.join(extract_dir, MAIN_EXE)
        if os.path.exists(main_path):
            subprocess.Popen(main_path, shell=True, cwd=extract_dir)
    except Exception as e:
        # Mostrar error en caso de fallo
        ctypes.windll.user32.MessageBoxW(0, str(e), "Error SFX", 0)

if __name__ == "__main__":
    main()
'''
            
            # Guardar el launcher
            launcher_path = os.path.join(temp_dir, "sfx_launcher.py")
            with open(launcher_path, 'w', encoding='utf-8') as f:
                f.write(launcher_code)
            
            # Compilar con PyInstaller
            output_name = self.output_name.get() or "output"
            output_path = os.path.join(output_dir, f"{output_name}.exe")
            
            icon_arg = ""
            if self.icon_file.get() and os.path.exists(self.icon_file.get()):
                icon_arg = f'--icon="{self.icon_file.get()}"'
            
            cmd = f'python -m PyInstaller --onefile --noconsole {icon_arg} --distpath "{output_dir}" --workpath "{temp_dir}/build" --specpath "{temp_dir}" --name "{output_name}" "{launcher_path}"'
            
            self.status_label.config(text="Compilando con PyInstaller...")
            self.root.update()
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=temp_dir)
            
            # Limpiar
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            if os.path.exists(output_path):
                messagebox.showinfo("✓ Éxito", 
                    f"SFX creado correctamente!\n\n"
                    f"Archivo: {output_path}\n\n"
                    f"✓ Icono aplicado\n"
                    f"✓ Auto-ejecuta: {main_exe}")
                self.status_label.config(text="✓ SFX creado")
            else:
                messagebox.showerror("Error", f"Falló la compilación:\n{result.stderr[:500]}")
                self.status_label.config(text="✗ Error")
                
        except Exception as e:
            messagebox.showerror("Error", str(e))
            self.status_label.config(text="✗ Error")
    
    def select_exe_to_modify(self):
        """Selecciona un ejecutable para cambiarle el icono"""
        exe = filedialog.askopenfilename(
            title="Seleccionar ejecutable",
            filetypes=[("Ejecutables", "*.exe"), ("Todos", "*.*")]
        )
        if exe:
            self.exe_to_modify.set(exe)
            self.exe_mod_label.config(text=os.path.basename(exe), fg="#28a745")
    
    def select_new_icon(self):
        """Selecciona el nuevo icono para el ejecutable"""
        icon = filedialog.askopenfilename(
            title="Seleccionar icono",
            filetypes=[("Iconos", "*.ico"), ("Imágenes", "*.png"), ("Todos", "*.*")]
        )
        if icon:
            self.new_icon_file.set(icon)
            self.new_icon_label.config(text=os.path.basename(icon), fg="#28a745")
    
    def change_exe_icon(self):
        """Cambia el icono de un ejecutable recompilándolo con PyInstaller"""
        if not self.exe_to_modify.get():
            messagebox.showerror("Error", "Selecciona un ejecutable")
            return
        if not self.new_icon_file.get():
            messagebox.showerror("Error", "Selecciona un icono")
            return
        
        exe_path = self.exe_to_modify.get()
        icon_path = self.new_icon_file.get()
        
        # Convertir a .ico si es png
        if icon_path.lower().endswith('.png'):
            try:
                ico_path = icon_path.replace('.png', '.ico')
                img = Image.open(icon_path)
                img.save(ico_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
                icon_path = ico_path
            except Exception as e:
                messagebox.showerror("Error", f"No se pudo convertir PNG a ICO: {e}")
                return
        
        try:
            self.status_label.config(text="Cambiando icono...")
            self.root.update()
            
            # Crear directorio temporal
            temp_dir = tempfile.mkdtemp()
            
            # Crear un launcher simple que ejecute el exe original
            exe_name = os.path.basename(exe_path)
            new_exe_name = exe_name.replace('.exe', '_nuevo.exe')
            
            launcher_code = f'''
import os
import sys
import subprocess
import base64

# Datos del ejecutable original embebido
EMBEDDED_EXE = """'''
            
            # Leer el exe original como base64
            with open(exe_path, 'rb') as f:
                exe_data = base64.b64encode(f.read()).decode('ascii')
            
            launcher_code += exe_data
            launcher_code += f'''"""

def main():
    import tempfile
    temp_dir = tempfile.gettempdir()
    exe_path = os.path.join(temp_dir, "{exe_name}")
    
    with open(exe_path, 'wb') as f:
        f.write(base64.b64decode(EMBEDDED_EXE))
    
    subprocess.Popen(exe_path, shell=True)

if __name__ == "__main__":
    main()
'''
            
            launcher_path = os.path.join(temp_dir, "launcher.py")
            with open(launcher_path, 'w', encoding='utf-8') as f:
                f.write(launcher_code)
            
            # Output en el mismo directorio que el original
            output_dir = os.path.dirname(exe_path)
            output_name = exe_name.replace('.exe', '_icono')
            
            cmd = f'python -m PyInstaller --onefile --noconsole --icon="{icon_path}" --distpath "{output_dir}" --workpath "{temp_dir}/build" --specpath "{temp_dir}" --name "{output_name}" "{launcher_path}"'
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=temp_dir)
            
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            output_path = os.path.join(output_dir, f"{output_name}.exe")
            if os.path.exists(output_path):
                messagebox.showinfo("✓ Éxito", 
                    f"Icono cambiado!\n\n"
                    f"Nuevo archivo: {output_path}\n\n"
                    f"El archivo original no fue modificado.")
                self.status_label.config(text="✓ Icono cambiado")
            else:
                messagebox.showerror("Error", f"Falló:\n{result.stderr[:500]}")
                self.status_label.config(text="✗ Error")
                
        except Exception as e:
            messagebox.showerror("Error", str(e))
            self.status_label.config(text="✗ Error")

if __name__ == "__main__":
    root = tk.Tk()
    app = SFXCreator(root)
    root.mainloop()
