// app.js - Main Application Logic

let appState = {
    patients: [],
    viewCtx: []
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Setup Routing
    setupNavigation();

    // Setup Form
    setupRegistrationForm();

    // Setup Filters
    setupFilters();

    // Load Data
    await loadData();
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            showSection(section);
        });
    });
}

function showSection(id) {
    // Update Tabs
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-link[data-section="${id}"]`)?.classList.add('active');

    // Update Pages
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function setupRegistrationForm() {
    const form = document.getElementById('reg-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => data[key] = value);

        console.log("Registering:", data);

        try {
            await API.registerPatient(data);
            alert("Patient Registered Successfully!");
            form.reset();
            // Reload data
            loadData();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

async function loadData() {
    const tbody = document.getElementById('patients-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading data...</td></tr>';

    try {
        const data = await API.getPatients();
        // Since GAS might return array or object wrapped
        appState.patients = Array.isArray(data) ? data : (data.data || []);
        appState.viewCtx = [...appState.patients];

        updateStats();
        renderTable(appState.viewCtx);

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-400">Failed to load data. Use Settings to configure Backend URL.</td></tr>';
    }
}

function renderTable(patients) {
    const tbody = document.getElementById('patients-table-body');
    const headerRow = document.getElementById('table-header-row');
    tbody.innerHTML = '';

    // 1. Determine Visible Extra Columns
    const showVisits = document.querySelector('input[data-col="visits"]')?.checked;
    const showStage = document.querySelector('input[data-col="stage"]')?.checked;
    const showEcog = document.querySelector('input[data-col="ecog"]')?.checked;
    const showReferral = document.querySelector('input[data-col="referral"]')?.checked;
    const showSurvival = document.querySelector('input[data-col="survival"]')?.checked;

    // 2. Rebuild Header
    let headerHTML = `
        <th class="p-4 font-semibold text-slate-600 text-sm">Patient</th>
        <th class="p-4 font-semibold text-slate-600 text-sm">Diagnosis</th>
        <th class="p-4 font-semibold text-slate-600 text-sm">Address</th>
        <th class="p-4 font-semibold text-slate-600 text-sm">Status</th>
        <th class="p-4 font-semibold text-slate-600 text-sm">Priority</th>
    `;

    if (showVisits) headerHTML += `<th class="p-4 font-semibold text-slate-600 text-sm">Visits</th>`;
    if (showStage) headerHTML += `<th class="p-4 font-semibold text-slate-600 text-sm">Stage</th>`;
    if (showEcog) headerHTML += `<th class="p-4 font-semibold text-slate-600 text-sm">ECOG</th>`;
    if (showReferral) headerHTML += `<th class="p-4 font-semibold text-slate-600 text-sm">Referral</th>`;
    if (showSurvival) headerHTML += `<th class="p-4 font-semibold text-slate-600 text-sm">Survival</th>`;

    headerHTML += `<th class="p-4 font-semibold text-slate-600 text-sm text-right">Actions</th>`;
    headerRow.innerHTML = headerHTML;

    if (patients.length === 0) {
        // Calculate colspan dynamically
        const colCount = 6 + [showVisits, showStage, showEcog, showReferral, showSurvival].filter(Boolean).length;
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="p-8 text-center text-slate-400">No patients found.</td></tr>`;
        document.getElementById('showing-count').innerText = 'Showing 0 patients';
        return;
    }

    patients.forEach(p => {
        // Visual Highlight for Died
        let trClass = "hover:bg-blue-50/50 transition-colors border-b border-slate-50 last:border-0";
        if (p['Servival Status'] === 'Died') {
            trClass = "bg-slate-100 border-l-4 border-l-slate-400 opacity-75 grayscale";
        }

        const tr = document.createElement('tr');
        tr.className = trClass;

        // Priority Badge
        let priorityBadge = '';
        if (p['priority'] == 1) priorityBadge = '<span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full ml-2">HIGH</span>';
        if (p['Servival Status'] === 'Died') priorityBadge += '<span class="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full ml-2">DIED</span>';

        // Address Display Logic
        // 'Home Address ' = Specific Details (e.g., Street)
        // 'Adress' = City/Area (e.g., Hebron)

        let specificAddr = p['Home Address '] || p['Home Address'] || ''; // Handle trailing space or not
        let cityAddr = p['Adress'] || '';

        // Clean up N/A
        if (specificAddr === 'N/A') specificAddr = '';
        if (cityAddr === 'N/A') cityAddr = '';

        // Deduplicate
        if (specificAddr.trim() === cityAddr.trim()) {
            cityAddr = ''; // Don't show twice
        }

        // If specific is empty, promote city to top
        if (!specificAddr && cityAddr) {
            specificAddr = cityAddr;
            cityAddr = '';
        }

        const addrHtml = `
             <div class="text-sm text-slate-700 font-medium">${specificAddr}</div>
             <div class="text-xs text-slate-400">${cityAddr}</div>
        `;

        let colsHTML = `
            <td class="p-4">
                <div class="font-bold text-slate-800">${p['Pt Name']} ${priorityBadge}</div>
                <div class="text-xs text-slate-400 font-mono">${p['Pt file Num.']}</div>
            </td>
            <td class="p-4">
                <div class="text-sm text-slate-700">${p['Diagnosis']}</div>
                <div class="text-xs text-slate-400 italic">${p['Specific Diagnosis'] || ''}</div>
            </td>
            <td class="p-4">
                 ${addrHtml}
            </td>
            <td class="p-4">
                <span class="text-xs font-semibold px-2 py-1 rounded-md ${getStatusClass(p['Intent of care'])}">
                    ${p['Intent of care'] || 'Unknown'}
                </span>
            </td>
            <td class="p-4">
               <div class="text-sm font-bold text-slate-600">${p['priority'] || '-'}</div>
            </td>
        `;

        if (showVisits) colsHTML += `<td class="p-4 text-sm text-slate-700 font-bold">${p['number of visits'] || 0}</td>`;
        if (showStage) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['Stage of Disease'] || '-'}</td>`;
        if (showEcog) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['ECOG'] || '-'}</td>`;
        if (showReferral) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['Site of Referral'] || '-'}</td>`;
        if (showSurvival) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['Servival Status'] || '-'}</td>`;

        colsHTML += `
            <td class="p-4 text-right flex justify-end gap-2">
                <button class="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-colors btn-visit" title="Record Visit">
                    <i class="fa-solid fa-person-walking-luggage"></i>
                </button>
                <button class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white transition-colors btn-died" title="Mark Died">
                    <i class="fa-solid fa-skull"></i>
                </button>
                <button class="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors btn-transfer" title="Transfer to P1">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </button>
            </td>
        `;

        tr.innerHTML = colsHTML;

        // Bind Actions
        tr.querySelector('.btn-visit').addEventListener('click', () => handleQuickVisit(p));
        tr.querySelector('.btn-died').addEventListener('click', () => handleMarkDied(p));
        tr.querySelector('.btn-transfer').addEventListener('click', () => handleTransfer(p));

        tbody.appendChild(tr);
    });

    document.getElementById('showing-count').innerText = `Showing ${patients.length} patients`;
}

async function handleQuickVisit(p) {
    if (!confirm(`Record a new visit for ${p['Pt Name']} today?`)) return;

    // 1. Determine next V slot
    let nextV = 1;
    while (p[`V${nextV}`] && p[`V${nextV}`] !== "") {
        nextV++;
    }
    const vField = `V${nextV}`; // e.g., V6

    // 2. Increment count
    let currentCount = parseInt(p['number of visits']) || 0;
    const newCount = currentCount + 1;

    const today = new Date().toISOString().split('T')[0];

    // Optimistic UI Update
    p[vField] = today;
    p['number of visits'] = newCount;
    renderTable(appState.viewCtx); // Re-render immediately

    try {
        const updates = {};
        updates[vField] = today;
        updates['number of visits'] = newCount;

        await API.updatePatient(p['Pt file Num.'], updates);
        alert(`Visit recorded! (${vField})`);
    } catch (e) {
        alert("Failed to save visit: " + e.message);
        // revert?
        loadData();
    }
}

async function handleMarkDied(p) {
    if (!confirm(`Mark ${p['Pt Name']} as DIED?\nThis cannot be easily undone from the app.`)) return;

    const today = new Date().toISOString().split('T')[0];

    // Optimistic UI
    p['Servival Status'] = 'Died';
    p['Date of death'] = today;
    renderTable(appState.viewCtx);

    try {
        await API.updatePatient(p['Pt file Num.'], {
            'Servival Status': 'Died',
            'Date of death': today
        });
        alert("Patient status updated to Died.");
    } catch (e) {
        alert("Failed to update status: " + e.message);
        loadData();
    }
}

async function handleTransfer(patient) {
    if (!confirm(`Transfer ${patient['Pt Name']} to P1 App (Home Visits)?`)) return;

    try {
        await API.transferToP1(patient); // Fires "no-cors" request
        alert("Transfer sent! Check P1 (Home Visits) in a moment.");
    } catch (e) {
        alert("Transfer failed: " + e.message);
    }
}

function getStatusClass(status) {
    if (status === 'End of Life') return 'bg-purple-100 text-purple-700';
    if (status === 'Palliative Care') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
}

function setupFilters() {
    const areaInput = document.getElementById('filter-area');
    const searchInput = document.getElementById('filter-search');

    const runFilter = () => {
        const areaTerm = areaInput.value.toLowerCase();
        const searchTerm = searchInput.value.toLowerCase();

        appState.viewCtx = appState.patients.filter(p => {
            // Filter by 'Adress' (City/Area) instead of 'Home Address'
            const pArea = (p['Adress'] || '').toLowerCase();
            const pName = (p['Pt Name'] || '').toLowerCase();
            const pId = (p['Pt file Num.'] || '').toString().toLowerCase();

            const matchArea = !areaTerm || pArea.includes(areaTerm);
            const matchSearch = !searchTerm || pName.includes(searchTerm) || pId.includes(searchTerm);

            return matchArea && matchSearch;
        });

        renderTable(appState.viewCtx);
    };

    areaInput.addEventListener('input', runFilter);
    searchInput.addEventListener('input', runFilter);
}

function updateStats() {
    const total = appState.patients.length;
    const active = appState.patients.filter(p => p['Servival Status'] !== 'Died').length;
    const highPri = appState.patients.filter(p => p['priority'] == 1).length;

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-active').innerText = active;
    document.getElementById('stat-priority').innerText = highPri;
}

// Settings
function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('settings-panel').classList.remove('translate-x-full');
    }, 10);

    // Fill Configs
    document.getElementById('p1-url').value = localStorage.getItem('p1_gas_url') || '';
    document.getElementById('hv-url').value = localStorage.getItem('hv_gas_url') || '';
}

function closeSettings() {
    document.getElementById('settings-panel').classList.add('translate-x-full');
    setTimeout(() => {
        document.getElementById('settings-modal').classList.add('hidden');
    }, 300);
}

function saveSettings() {
    const p1 = document.getElementById('p1-url').value;
    const hv = document.getElementById('hv-url').value;
    API.saveSettings(hv, p1);
    closeSettings();
    loadData(); // Reload with new settings
}

window.showSection = showSection;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;

function toggleDeathFields(select) {
    const isDead = select.value === 'Died';
    document.querySelectorAll('.death-field').forEach(el => {
        if (isDead) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}
window.toggleDeathFields = toggleDeathFields;
