"""
RSA Verificador - Herramienta para verificar el cifrado RSA híbrido
Permite cifrar/descifrar claves AES con RSA y ver el proceso paso a paso
"""

import sys
import base64
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QTextEdit, QPushButton, QGroupBox, QLineEdit, QTabWidget,
    QTableWidget, QTableWidgetItem, QHeaderView, QMessageBox, QSplitter
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

try:
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("Instalando cryptography...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography"])
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    from cryptography.hazmat.backends import default_backend


class RSAVerificador(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("RSA Verificador - Cifrado Híbrido")
        self.setMinimumSize(1200, 800)
        self.setStyleSheet(self.get_stylesheet())
        
        self.init_ui()
    
    def get_stylesheet(self):
        return """
            QMainWindow {
                background-color: #1a1a2e;
            }
            QLabel {
                color: #eee;
                font-size: 12px;
            }
            QTextEdit, QLineEdit {
                background-color: #16213e;
                color: #00ff88;
                border: 1px solid #0f3460;
                border-radius: 4px;
                padding: 8px;
                font-family: 'Consolas', monospace;
                font-size: 11px;
            }
            QPushButton {
                background-color: #e94560;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 10px 20px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #ff6b6b;
            }
            QPushButton:pressed {
                background-color: #c73e54;
            }
            QPushButton#encrypt {
                background-color: #00b894;
            }
            QPushButton#encrypt:hover {
                background-color: #00cec9;
            }
            QPushButton#decrypt {
                background-color: #6c5ce7;
            }
            QPushButton#decrypt:hover {
                background-color: #a29bfe;
            }
            QGroupBox {
                color: #fff;
                font-weight: bold;
                border: 1px solid #0f3460;
                border-radius: 6px;
                margin-top: 12px;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
            QTabWidget::pane {
                border: 1px solid #0f3460;
                background-color: #1a1a2e;
            }
            QTabBar::tab {
                background-color: #16213e;
                color: #888;
                padding: 10px 20px;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            QTabBar::tab:selected {
                background-color: #e94560;
                color: white;
            }
            QTableWidget {
                background-color: #16213e;
                color: #eee;
                gridline-color: #0f3460;
                border: none;
            }
            QTableWidget::item {
                padding: 8px;
            }
            QHeaderView::section {
                background-color: #0f3460;
                color: white;
                padding: 8px;
                border: none;
            }
        """
    
    def init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Header
        header = QLabel("🔐 RSA Verificador - Cifrado Híbrido")
        header.setFont(QFont("Arial", 18, QFont.Weight.Bold))
        header.setStyleSheet("color: #e94560;")
        layout.addWidget(header)
        
        # Tabs
        tabs = QTabWidget()
        layout.addWidget(tabs)
        
        # Tab 1: Cifrar/Descifrar
        tabs.addTab(self.create_crypto_tab(), "🔑 Cifrar/Descifrar")
        
        # Tab 2: CrypTool v2
        tabs.addTab(self.create_cryptool_tab(), "🧰 CrypTool v2")
        
        # Tab 3: Proceso Paso a Paso
        tabs.addTab(self.create_steps_tab(), "📋 Proceso Detallado")
        
        # Tab 4: Base de Datos
        tabs.addTab(self.create_db_tab(), "🗄️ Base de Datos")
    
    def create_crypto_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Splitter para claves RSA
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Clave Pública RSA
        pub_group = QGroupBox("Clave Pública RSA (PEM)")
        pub_layout = QVBoxLayout(pub_group)
        self.public_key_edit = QTextEdit()
        self.public_key_edit.setPlaceholderText("-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----")
        self.public_key_edit.setMaximumHeight(200)
        pub_layout.addWidget(self.public_key_edit)
        splitter.addWidget(pub_group)
        
        # Clave Privada RSA
        priv_group = QGroupBox("Clave Privada RSA (PEM)")
        priv_layout = QVBoxLayout(priv_group)
        self.private_key_edit = QTextEdit()
        self.private_key_edit.setPlaceholderText("-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----")
        self.private_key_edit.setMaximumHeight(200)
        priv_layout.addWidget(self.private_key_edit)
        splitter.addWidget(priv_group)
        
        layout.addWidget(splitter)
        
        # Clave AES
        aes_group = QGroupBox("Clave AES-256 (Hex)")
        aes_layout = QVBoxLayout(aes_group)
        self.aes_key_edit = QLineEdit()
        self.aes_key_edit.setPlaceholderText("64 caracteres hexadecimales (256 bits)")
        aes_layout.addWidget(self.aes_key_edit)
        
        # Botón generar AES
        gen_btn = QPushButton("🎲 Generar AES Aleatoria")
        gen_btn.clicked.connect(self.generate_aes_key)
        aes_layout.addWidget(gen_btn)
        layout.addWidget(aes_group)
        
        # Botones de acción
        btn_layout = QHBoxLayout()
        
        encrypt_btn = QPushButton("🔒 CIFRAR con RSA")
        encrypt_btn.setObjectName("encrypt")
        encrypt_btn.clicked.connect(self.encrypt_aes_key)
        btn_layout.addWidget(encrypt_btn)
        
        decrypt_btn = QPushButton("🔓 DESCIFRAR con RSA")
        decrypt_btn.setObjectName("decrypt")
        decrypt_btn.clicked.connect(self.decrypt_aes_key)
        btn_layout.addWidget(decrypt_btn)
        
        layout.addLayout(btn_layout)
        
        # Resultado cifrado
        result_group = QGroupBox("Resultado (Base64)")
        result_layout = QVBoxLayout(result_group)
        self.result_edit = QTextEdit()
        self.result_edit.setPlaceholderText("El resultado del cifrado/descifrado aparecerá aquí...")
        result_layout.addWidget(self.result_edit)
        layout.addWidget(result_group)
        
        return widget
    
    def create_cryptool_tab(self):
        """Tab para extraer parámetros RSA compatibles con CrypTool v2"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Instrucciones
        info = QLabel(
            "Extrae los parámetros RSA (N, e, d, p, q) de las claves PEM para usar en CrypTool v2.\n"
            "Pega las claves en la pestaña 'Cifrar/Descifrar' y luego haz clic en 'Extraer Parámetros'."
        )
        info.setStyleSheet("color: #888; font-style: italic;")
        layout.addWidget(info)
        
        # Botón extraer
        extract_btn = QPushButton("🔍 Extraer Parámetros RSA")
        extract_btn.clicked.connect(self.extract_rsa_params)
        extract_btn.setStyleSheet("background-color: #9b59b6;")
        layout.addWidget(extract_btn)
        
        # Parámetros en grid
        params_group = QGroupBox("Parámetros RSA para CrypTool v2")
        params_layout = QVBoxLayout(params_group)
        
        # N (Módulo)
        n_row = QHBoxLayout()
        n_row.addWidget(QLabel("N (Módulo Público):"))
        self.n_decimal = QLineEdit()
        self.n_decimal.setReadOnly(True)
        self.n_decimal.setPlaceholderText("Decimal")
        n_row.addWidget(self.n_decimal)
        copy_n = QPushButton("📋")
        copy_n.setFixedWidth(40)
        copy_n.clicked.connect(lambda: self.copy_to_clipboard(self.n_decimal.text()))
        n_row.addWidget(copy_n)
        params_layout.addLayout(n_row)
        
        self.n_hex = QLineEdit()
        self.n_hex.setReadOnly(True)
        self.n_hex.setPlaceholderText("Hexadecimal (0x...)")
        params_layout.addWidget(self.n_hex)
        
        # e (Exponente Público)
        e_row = QHBoxLayout()
        e_row.addWidget(QLabel("e (Exponente Público):"))
        self.e_decimal = QLineEdit()
        self.e_decimal.setReadOnly(True)
        self.e_decimal.setPlaceholderText("Generalmente 65537")
        e_row.addWidget(self.e_decimal)
        copy_e = QPushButton("📋")
        copy_e.setFixedWidth(40)
        copy_e.clicked.connect(lambda: self.copy_to_clipboard(self.e_decimal.text()))
        e_row.addWidget(copy_e)
        params_layout.addLayout(e_row)
        
        self.e_hex = QLineEdit()
        self.e_hex.setReadOnly(True)
        self.e_hex.setPlaceholderText("Hex: 0x10001")
        params_layout.addWidget(self.e_hex)
        
        # d (Exponente Privado)
        d_row = QHBoxLayout()
        d_row.addWidget(QLabel("d (Exponente Privado):"))
        self.d_decimal = QLineEdit()
        self.d_decimal.setReadOnly(True)
        self.d_decimal.setPlaceholderText("Requiere clave privada")
        d_row.addWidget(self.d_decimal)
        copy_d = QPushButton("📋")
        copy_d.setFixedWidth(40)
        copy_d.clicked.connect(lambda: self.copy_to_clipboard(self.d_decimal.text()))
        d_row.addWidget(copy_d)
        params_layout.addLayout(d_row)
        
        self.d_hex = QLineEdit()
        self.d_hex.setReadOnly(True)
        self.d_hex.setPlaceholderText("Hexadecimal")
        params_layout.addWidget(self.d_hex)
        
        # p y q (Factores primos)
        pq_row = QHBoxLayout()
        pq_group = QGroupBox("Factores Primos (p, q)")
        pq_layout = QVBoxLayout(pq_group)
        
        p_row = QHBoxLayout()
        p_row.addWidget(QLabel("p:"))
        self.p_value = QLineEdit()
        self.p_value.setReadOnly(True)
        p_row.addWidget(self.p_value)
        pq_layout.addLayout(p_row)
        
        q_row = QHBoxLayout()
        q_row.addWidget(QLabel("q:"))
        self.q_value = QLineEdit()
        self.q_value.setReadOnly(True)
        q_row.addWidget(self.q_value)
        pq_layout.addLayout(q_row)
        
        params_layout.addWidget(pq_group)
        layout.addWidget(params_group)
        
        # Info adicional
        info_group = QGroupBox("Información de la Clave")
        info_layout = QVBoxLayout(info_group)
        self.key_info = QTextEdit()
        self.key_info.setReadOnly(True)
        self.key_info.setMaximumHeight(150)
        info_layout.addWidget(self.key_info)
        layout.addWidget(info_group)
        
        # Botón copiar todo
        copy_all_btn = QPushButton("📋 Copiar Todo para CrypTool")
        copy_all_btn.clicked.connect(self.copy_all_params)
        layout.addWidget(copy_all_btn)
        
        return widget
    
    def extract_rsa_params(self):
        """Extrae los parámetros RSA de las claves PEM"""
        try:
            info_text = []
            
            # Intentar extraer de clave pública
            pub_pem = self.public_key_edit.toPlainText().strip()
            if pub_pem:
                public_key = serialization.load_pem_public_key(
                    pub_pem.encode(),
                    backend=default_backend()
                )
                pub_numbers = public_key.public_numbers()
                
                # N y e
                n = pub_numbers.n
                e = pub_numbers.e
                
                self.n_decimal.setText(str(n))
                self.n_hex.setText(hex(n))
                self.e_decimal.setText(str(e))
                self.e_hex.setText(hex(e))
                
                info_text.append(f"Tamaño de clave: {public_key.key_size} bits")
                info_text.append(f"Longitud de N: {n.bit_length()} bits")
                info_text.append(f"Exponente público (e): {e}")
            
            # Intentar extraer de clave privada
            priv_pem = self.private_key_edit.toPlainText().strip()
            if priv_pem:
                private_key = serialization.load_pem_private_key(
                    priv_pem.encode(),
                    password=None,
                    backend=default_backend()
                )
                priv_numbers = private_key.private_numbers()
                
                # d, p, q
                d = priv_numbers.d
                p = priv_numbers.p
                q = priv_numbers.q
                
                self.d_decimal.setText(str(d))
                self.d_hex.setText(hex(d))
                self.p_value.setText(str(p))
                self.q_value.setText(str(q))
                
                # Si no teníamos la pública, extraer n y e de la privada
                if not pub_pem:
                    pub_nums = priv_numbers.public_numbers
                    self.n_decimal.setText(str(pub_nums.n))
                    self.n_hex.setText(hex(pub_nums.n))
                    self.e_decimal.setText(str(pub_nums.e))
                    self.e_hex.setText(hex(pub_nums.e))
                
                info_text.append(f"Longitud de d: {d.bit_length()} bits")
                info_text.append(f"Longitud de p: {p.bit_length()} bits")
                info_text.append(f"Longitud de q: {q.bit_length()} bits")
                info_text.append(f"Verificación: p * q == N: {p * q == priv_numbers.public_numbers.n}")
            
            if not pub_pem and not priv_pem:
                raise ValueError("Ingresa al menos una clave RSA (pública o privada) en la pestaña 'Cifrar/Descifrar'")
            
            self.key_info.setText("\n".join(info_text))
            QMessageBox.information(self, "Éxito", "Parámetros RSA extraídos correctamente.\nPuedes copiarlos para usar en CrypTool v2.")
            
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
    
    def copy_to_clipboard(self, text):
        """Copia texto al portapapeles"""
        if text:
            QApplication.clipboard().setText(text)
            # No mostrar mensaje para copias individuales
    
    def copy_all_params(self):
        """Copia todos los parámetros en formato para CrypTool"""
        params = []
        params.append("=== Parámetros RSA para CrypTool v2 ===")
        params.append(f"N (Módulo):\n{self.n_decimal.text()}")
        params.append(f"\nN (Hex):\n{self.n_hex.text()}")
        params.append(f"\ne (Exponente Público): {self.e_decimal.text()}")
        params.append(f"e (Hex): {self.e_hex.text()}")
        
        if self.d_decimal.text():
            params.append(f"\nd (Exponente Privado):\n{self.d_decimal.text()}")
            params.append(f"\nd (Hex):\n{self.d_hex.text()}")
        
        if self.p_value.text():
            params.append(f"\np (Factor primo):\n{self.p_value.text()}")
            params.append(f"\nq (Factor primo):\n{self.q_value.text()}")
        
        text = "\n".join(params)
        QApplication.clipboard().setText(text)
        QMessageBox.information(self, "Copiado", "Todos los parámetros han sido copiados al portapapeles.")
    
    def create_steps_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        info = QLabel(
            "Este panel muestra el proceso paso a paso del cifrado híbrido RSA.\n"
            "Ejecuta una operación de cifrado/descifrado para ver los detalles."
        )
        info.setStyleSheet("color: #888; font-style: italic;")
        layout.addWidget(info)
        
        self.steps_edit = QTextEdit()
        self.steps_edit.setReadOnly(True)
        self.steps_edit.setStyleSheet("font-size: 12px;")
        layout.addWidget(self.steps_edit)
        
        return widget
    
    def create_db_tab(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Configuración Supabase
        config_group = QGroupBox("Configuración Supabase")
        config_layout = QHBoxLayout(config_group)
        
        config_layout.addWidget(QLabel("URL:"))
        self.supabase_url = QLineEdit()
        self.supabase_url.setPlaceholderText("https://xxx.supabase.co")
        config_layout.addWidget(self.supabase_url)
        
        config_layout.addWidget(QLabel("Key:"))
        self.supabase_key = QLineEdit()
        self.supabase_key.setPlaceholderText("anon-key")
        self.supabase_key.setEchoMode(QLineEdit.EchoMode.Password)
        config_layout.addWidget(self.supabase_key)
        
        load_btn = QPushButton("📥 Cargar Claves")
        load_btn.clicked.connect(self.load_from_supabase)
        config_layout.addWidget(load_btn)
        
        layout.addWidget(config_group)
        
        # Tabla de claves
        self.keys_table = QTableWidget()
        self.keys_table.setColumnCount(5)
        self.keys_table.setHorizontalHeaderLabels(["UUID", "Hostname", "AES Key", "Encrypted AES", "Fecha"])
        self.keys_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.keys_table.itemDoubleClicked.connect(self.use_key_from_table)
        layout.addWidget(self.keys_table)
        
        hint = QLabel("💡 Doble clic en una fila para usar esa clave AES en el verificador")
        hint.setStyleSheet("color: #888;")
        layout.addWidget(hint)
        
        return widget
    
    def generate_aes_key(self):
        import os
        key = os.urandom(32).hex()
        self.aes_key_edit.setText(key)
        self.log_step("🎲 Clave AES generada", f"Bytes aleatorios: {key}")
    
    def encrypt_aes_key(self):
        try:
            self.steps_edit.clear()
            self.log_step("=== PROCESO DE CIFRADO RSA ===", "")
            
            # Obtener clave pública
            pub_pem = self.public_key_edit.toPlainText().strip()
            if not pub_pem:
                raise ValueError("Ingresa la clave pública RSA")
            
            self.log_step("PASO 1: Cargar clave pública RSA", f"PEM:\n{pub_pem[:100]}...")
            
            public_key = serialization.load_pem_public_key(
                pub_pem.encode(),
                backend=default_backend()
            )
            
            key_size = public_key.key_size
            self.log_step("PASO 2: Clave pública cargada", f"Tamaño: {key_size} bits")
            
            # Obtener clave AES
            aes_hex = self.aes_key_edit.text().strip()
            if not aes_hex or len(aes_hex) != 64:
                raise ValueError("La clave AES debe tener 64 caracteres hex (256 bits)")
            
            aes_bytes = bytes.fromhex(aes_hex)
            self.log_step("PASO 3: Clave AES a cifrar", 
                         f"Hex: {aes_hex}\nBytes: {len(aes_bytes)} bytes\nBinario: {aes_bytes[:16].hex()}...")
            
            # Cifrar con RSA-OAEP
            self.log_step("PASO 4: Aplicando cifrado RSA-OAEP", 
                         "Algoritmo: RSA\nPadding: OAEP\nHash: SHA-256\nMGF: MGF1-SHA256")
            
            encrypted = public_key.encrypt(
                aes_bytes,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            encrypted_b64 = base64.b64encode(encrypted).decode()
            
            self.log_step("PASO 5: Resultado cifrado",
                         f"Bytes cifrados: {len(encrypted)} bytes\n"
                         f"Hex: {encrypted.hex()[:100]}...\n"
                         f"Base64: {encrypted_b64}")
            
            self.result_edit.setText(encrypted_b64)
            self.log_step("✅ CIFRADO COMPLETADO", 
                         "La clave AES está ahora cifrada con RSA.\n"
                         "Solo puede ser descifrada con la clave privada correspondiente.")
            
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            self.log_step("❌ ERROR", str(e))
    
    def decrypt_aes_key(self):
        try:
            self.steps_edit.clear()
            self.log_step("=== PROCESO DE DESCIFRADO RSA ===", "")
            
            # Obtener clave privada
            priv_pem = self.private_key_edit.toPlainText().strip()
            if not priv_pem:
                raise ValueError("Ingresa la clave privada RSA")
            
            self.log_step("PASO 1: Cargar clave privada RSA", f"PEM:\n{priv_pem[:100]}...")
            
            private_key = serialization.load_pem_private_key(
                priv_pem.encode(),
                password=None,
                backend=default_backend()
            )
            
            key_size = private_key.key_size
            self.log_step("PASO 2: Clave privada cargada", f"Tamaño: {key_size} bits")
            
            # Obtener datos cifrados
            encrypted_b64 = self.result_edit.toPlainText().strip()
            if not encrypted_b64:
                raise ValueError("No hay datos cifrados para descifrar")
            
            encrypted = base64.b64decode(encrypted_b64)
            self.log_step("PASO 3: Datos cifrados a descifrar",
                         f"Base64: {encrypted_b64[:50]}...\n"
                         f"Bytes: {len(encrypted)} bytes\n"
                         f"Hex: {encrypted.hex()[:100]}...")
            
            # Descifrar con RSA-OAEP
            self.log_step("PASO 4: Aplicando descifrado RSA-OAEP",
                         "Algoritmo: RSA\nPadding: OAEP\nHash: SHA-256\nMGF: MGF1-SHA256")
            
            decrypted = private_key.decrypt(
                encrypted,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            decrypted_hex = decrypted.hex()
            
            self.log_step("PASO 5: Resultado descifrado",
                         f"Bytes descifrados: {len(decrypted)} bytes\n"
                         f"Hex: {decrypted_hex}")
            
            self.aes_key_edit.setText(decrypted_hex)
            self.log_step("✅ DESCIFRADO COMPLETADO",
                         "La clave AES original ha sido recuperada.\n"
                         f"Clave AES: {decrypted_hex}")
            
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            self.log_step("❌ ERROR", str(e))
    
    def log_step(self, title, content):
        self.steps_edit.append(f"\n{'='*50}")
        self.steps_edit.append(f"📌 {title}")
        self.steps_edit.append(f"{'='*50}")
        if content:
            self.steps_edit.append(content)
    
    def load_from_supabase(self):
        try:
            url = self.supabase_url.text().strip()
            key = self.supabase_key.text().strip()
            
            if not url or not key:
                raise ValueError("Ingresa la URL y Key de Supabase")
            
            # Intentar importar supabase
            try:
                from supabase import create_client
            except ImportError:
                import subprocess
                subprocess.check_call([sys.executable, "-m", "pip", "install", "supabase"])
                from supabase import create_client
            
            client = create_client(url, key)
            response = client.table('keys').select('*').limit(50).execute()
            
            self.keys_table.setRowCount(0)
            for row in response.data:
                row_idx = self.keys_table.rowCount()
                self.keys_table.insertRow(row_idx)
                self.keys_table.setItem(row_idx, 0, QTableWidgetItem(str(row.get('uuid', ''))[:12] + '...'))
                self.keys_table.setItem(row_idx, 1, QTableWidgetItem(str(row.get('hostname', ''))))
                self.keys_table.setItem(row_idx, 2, QTableWidgetItem(str(row.get('aes_key', ''))[:20] + '...'))
                self.keys_table.setItem(row_idx, 3, QTableWidgetItem(str(row.get('encrypted_aes_key', ''))[:20] + '...'))
                self.keys_table.setItem(row_idx, 4, QTableWidgetItem(str(row.get('created_at', ''))[:19]))
                
                # Guardar datos completos en el item
                self.keys_table.item(row_idx, 2).setData(Qt.ItemDataRole.UserRole, row.get('aes_key'))
                self.keys_table.item(row_idx, 3).setData(Qt.ItemDataRole.UserRole, row.get('encrypted_aes_key'))
            
            QMessageBox.information(self, "Éxito", f"Cargadas {len(response.data)} claves")
            
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
    
    def use_key_from_table(self, item):
        row = item.row()
        aes_key = self.keys_table.item(row, 2).data(Qt.ItemDataRole.UserRole)
        encrypted = self.keys_table.item(row, 3).data(Qt.ItemDataRole.UserRole)
        
        if aes_key:
            self.aes_key_edit.setText(aes_key)
        if encrypted:
            self.result_edit.setText(encrypted)
        
        QMessageBox.information(self, "Clave cargada", 
                               "Clave AES y versión cifrada cargadas.\n"
                               "Ve a la pestaña 'Cifrar/Descifrar' para verificar.")


def main():
    app = QApplication(sys.argv)
    window = RSAVerificador()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
