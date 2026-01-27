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
    const tbody = document.getElementById('active-patients-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading data...</td></tr>';

    try {
        const data = await API.getPatients();
        // Since GAS might return array or object wrapped
        appState.patients = Array.isArray(data) ? data : (data.data || []);
        appState.viewCtx = [...appState.patients];

        renderDashboard();
        renderPatientLists();

    } catch (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-400">Failed to load data. Use Settings to configure Backend URL.</td></tr>';
    }
}

// --- Patient List Rendering ---

let currentAreaDetail = null;

function renderPatientLists() {
    // If we are currently in a detail view, we should re-render that detail view
    // This allows filters to work 'live' inside the detail view
    if (currentAreaDetail) {
        openAreaDetail(currentAreaDetail); // Re-open (refresh) current area
        return;
    }

    const patients = appState.viewCtx;
    const grid = document.getElementById('area-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Group By Area
    const grouped = {};
    patients.forEach(p => {
        const rawArea = p['Adress'] || 'Other';
        // Normalize area name (Title Case)
        const area = rawArea.trim().charAt(0).toUpperCase() + rawArea.trim().slice(1).toLowerCase();

        if (!grouped[area]) grouped[area] = { active: [], died: [], totalVisits: 0 };

        if (p['Servival Status'] === 'Died') {
            grouped[area].died.push(p);
        } else {
            grouped[area].active.push(p);
        }
        grouped[area].totalVisits += (parseInt(p['number of visits']) || 0);
    });

    const areas = Object.keys(grouped).sort();

    if (areas.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-slate-400 py-12">No areas found matching your filter.</div>`;
        return;
    }

    // Render Cards
    areas.forEach(area => {
        const stats = grouped[area];
        const total = stats.active.length + stats.died.length;

        // Dynamic Icon/Emoji based on Area Name (Simple Hash)
        const icons = ['fa-city', 'fa-tree-city', 'fa-mountain-city', 'fa-map-location-dot'];
        const iconInfo = icons[area.length % icons.length];

        // Card HTML
        const card = document.createElement('div');
        card.className = "group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden";
        card.onclick = () => openAreaDetail(area);

        card.innerHTML = `
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i class="fa-solid ${iconInfo} text-6xl text-blue-600"></i>
            </div>
            
            <div class="relative z-10">
                <h3 class="text-xl font-display font-bold text-slate-800 mb-1">${area}</h3>
                <p class="text-sm text-slate-500 mb-4">${total} Patients Total</p>
                
                <div class="flex gap-4 mb-4">
                     <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-400 uppercase">Active</span>
                        <span class="text-lg font-bold text-green-600"><i class="fa-solid fa-heart-pulse mr-1"></i>${stats.active.length}</span>
                     </div>
                     <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-400 uppercase">Passed</span>
                        <span class="text-lg font-bold text-slate-500"><i class="fa-solid fa-ribbon mr-1"></i>${stats.died.length}</span>
                     </div>
                     <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-400 uppercase">Visits</span>
                        <span class="text-lg font-bold text-blue-600"><i class="fa-solid fa-car-side mr-1"></i>${stats.totalVisits}</span>
                     </div>
                </div>

                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-blue-500 h-full rounded-full" style="width: ${(stats.active.length / total) * 100}%"></div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openAreaDetail(areaName) {
    currentAreaDetail = areaName;

    // Hide Grid, Show Detail
    document.getElementById('area-grid').classList.add('hidden');
    document.getElementById('area-detail-view').classList.remove('hidden');

    // Set Title
    document.getElementById('area-detail-title').innerText = areaName;

    // Filter Patients for this Area ONLY (respecting global filters if any, from viewCtx)
    const allFiltered = appState.viewCtx;
    const areaPatients = allFiltered.filter(p => {
        const pArea = (p['Adress'] || 'Other').trim().toLowerCase();
        return pArea === areaName.toLowerCase();
    });

    const active = areaPatients.filter(p => p['Servival Status'] !== 'Died');
    const died = areaPatients.filter(p => p['Servival Status'] === 'Died');

    // Reuse existing renderTable
    renderTable(active, 'active-patients-body', 'table-header-row-active');
    renderTable(died, 'died-patients-body', 'table-header-row-died', true);

    // Update Counts (Scoped to this view now)
    document.getElementById('showing-count-active').innerText = `Showing ${active.length} active patients in ${areaName}`;
    document.getElementById('showing-count-died').innerText = `Showing ${died.length} deceased patients in ${areaName}`;
    document.getElementById('died-badge-count').innerText = `Counts: ${died.length}`;
}

function closeAreaDetail() {
    currentAreaDetail = null;
    document.getElementById('area-detail-view').classList.add('hidden');
    document.getElementById('area-grid').classList.remove('hidden');
    renderPatientLists(); // Re-render grid to update stats if filters changed
}

function toggleDiedSection() {
    const content = document.getElementById('died-section-content');
    const arrow = document.getElementById('died-arrow');
    content.classList.toggle('hidden');
    arrow.classList.toggle('rotate-180');
}

function renderTable(patients, containerId, headerId, isDiedList = false) {
    const tbody = document.getElementById(containerId);
    const headerRow = document.getElementById(headerId);
    if (!tbody || !headerRow) return;

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
        return;
    }

    patients.forEach(p => {
        // Visual Highlight for Died
        let trClass = "hover:bg-blue-50/50 transition-colors border-b border-slate-50 last:border-0";
        if (p['Servival Status'] === 'Died') {
            trClass = "bg-slate-100 border-l-4 border-l-slate-400 grayscale opacity-90";
        }

        const tr = document.createElement('tr');
        tr.className = trClass;

        // Priority Badge
        let priorityBadge = '';
        if (p['priority'] == 1) priorityBadge = '<span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full ml-2">HIGH</span>';
        if (p['Servival Status'] === 'Died') priorityBadge += '<span class="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full ml-2">DIED</span>';

        // Address Display Logic
        let specificAddr = p['Home Address '] || p['Home Address'] || '';
        let cityAddr = p['Adress'] || '';

        if (specificAddr === 'N/A') specificAddr = '';
        if (cityAddr === 'N/A') cityAddr = '';
        if (specificAddr.trim() === cityAddr.trim()) cityAddr = '';
        if (!specificAddr && cityAddr) { specificAddr = cityAddr; cityAddr = ''; }

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

        // Extra Columns
        if (showVisits) colsHTML += `<td class="p-4 text-sm text-slate-700 font-bold">${p['number of visits'] || 0}</td>`;
        if (showStage) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['Stage of Disease'] || '-'}</td>`;
        if (showEcog) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['ECOG'] || '-'}</td>`;
        if (showReferral) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['Site of Referral'] || '-'}</td>`;
        if (showSurvival) colsHTML += `<td class="p-4 text-sm text-slate-600">${p['Servival Status'] || '-'}</td>`;

        // Actions
        colsHTML += `<td class="p-4 text-right flex justify-end gap-2">`;

        if (!isDiedList) {
            colsHTML += `
                <button class="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-colors btn-visit" title="Record Visit">
                    <i class="fa-solid fa-person-walking-luggage"></i>
                </button>
                <button class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white transition-colors btn-died" title="Mark Died">
                    <i class="fa-solid fa-skull"></i>
                </button>
            `;
        }

        colsHTML += `
            <button class="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors btn-transfer" title="Transfer to P1">
                <i class="fa-solid fa-cloud-arrow-up"></i>
            </button>
        </td>`;

        tr.innerHTML = colsHTML;

        // Bind Actions
        if (!isDiedList) {
            tr.querySelector('.btn-visit').addEventListener('click', () => handleQuickVisit(p));
            tr.querySelector('.btn-died').addEventListener('click', () => openDiedModal(p));
        }
        tr.querySelector('.btn-transfer').addEventListener('click', () => handleTransfer(p));

        tbody.appendChild(tr);
    });
}

async function handleQuickVisit(p) {
    if (!confirm(`Record a new visit for ${p['Pt Name']} today?`)) return;

    // 1. Determine next V slot
    let nextV = 1;
    while (p[`V${nextV}`] && p[`V${nextV}`] !== "") {
        nextV++;
    }
    const vField = `V${nextV}`;

    // 2. Increment count
    let currentCount = parseInt(p['number of visits']) || 0;
    const newCount = currentCount + 1;

    const today = new Date().toISOString().split('T')[0];

    // Optimistic Update
    p[vField] = today;
    p['number of visits'] = newCount;
    renderPatientLists();

    try {
        await API.updatePatient(p['Pt file Num.'], {
            [vField]: today,
            'number of visits': newCount
        });
        alert(`Visit recorded! (${vField})`);
    } catch (e) {
        alert("Failed to save visit: " + e.message);
        loadData();
    }
}

// --- Died Workflow ---
let currentDiedPatient = null;

function openDiedModal(p) {
    currentDiedPatient = p;
    document.getElementById('died-modal-patient-name').innerText = p['Pt Name'];
    document.getElementById('died-modal').classList.remove('hidden');
}

function closeDiedModal() {
    document.getElementById('died-modal').classList.add('hidden');
    document.getElementById('died-form').reset();
    currentDiedPatient = null;
}

// Init Modal Logic
document.getElementById('died-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentDiedPatient) return;

    const date = document.getElementById('died-date').value;
    const place = document.getElementById('died-place').value;
    const p = currentDiedPatient;

    // Optimistic UI
    p['Servival Status'] = 'Died';
    p['Date of death'] = date;
    p['Place of death'] = place;

    closeDiedModal();
    renderPatientLists(); // Will move patient to Died list instantly

    try {
        await API.updatePatient(p['Pt file Num.'], {
            'Servival Status': 'Died',
            'Date of death': date,
            'Place of death': place
        });
        alert("Patient status updated to Died.");
        loadData(); // Reload to refresh stats fully
    } catch (e) {
        alert("Failed to update status: " + e.message);
        loadData();
    }
});

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

        renderPatientLists();
    };

    areaInput.addEventListener('input', runFilter);
    searchInput.addEventListener('input', runFilter);
}

// --- Dashboard & Analytics ---

let charts = {}; // Store chart instances

function renderDashboard() {
    const patients = appState.patients;
    if (!patients) return;

    // 1. Key Metrics
    const total = patients.length;
    const active = patients.filter(p => p['Servival Status'] !== 'Died').length;
    const died = patients.filter(p => p['Servival Status'] === 'Died').length;
    const highPri = patients.filter(p => p['priority'] == 1).length;

    // Calculate Total Visits (Sum of 'number of visits')
    const totalVisits = patients.reduce((sum, p) => sum + (parseInt(p['number of visits']) || 0), 0);

    // animate numbers
    animateValue("stat-total", 0, total, 1000);
    animateValue("stat-active", 0, active, 1000);
    animateValue("stat-died", 0, died, 1000);
    animateValue("stat-priority", 0, highPri, 1000);
    animateValue("stat-visits", 0, totalVisits, 1000);

    document.getElementById('dash-total-badge').innerText = total;

    // 2. Prepare Data for Charts
    const diagnosisData = getDistribution(patients, 'Diagnosis');
    const genderData = getDistribution(patients, 'Gender');
    const geoData = getDistribution(patients, 'Adress');
    const intentData = getDistribution(patients, 'Intent of care');
    const referralData = getDistribution(patients, 'Site of Referral');
    const stageData = getDistribution(patients, 'Stage of Disease');
    const socialData = getDistribution(patients, 'Social status');

    // 3. Render Charts

    // --- Chart Configs ---
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: "'Outfit', sans-serif" } } }
        }
    };

    // A. Diagnosis (Bar)
    renderChart('chart-diagnosis', 'bar', {
        labels: diagnosisData.labels,
        datasets: [{
            label: 'Patients',
            data: diagnosisData.values,
            backgroundColor: '#3b82f6',
            borderRadius: 6,
        }]
    }, { ...commonOptions, plugins: { legend: { display: false } } });

    // B. Gender (Doughnut)
    renderChart('chart-gender', 'doughnut', {
        labels: genderData.labels,
        datasets: [{
            data: genderData.values,
            backgroundColor: ['#3b82f6', '#ec4899', '#cbd5e1'],
            borderWidth: 0
        }]
    }, commonOptions);

    // C. Geo (Horizontal Bar)
    renderChart('chart-geo', 'bar', {
        labels: geoData.labels,
        datasets: [{
            label: 'Patients',
            data: geoData.values,
            backgroundColor: '#10b981', // Emerald
            borderRadius: 4
        }]
    }, {
        ...commonOptions,
        indexAxis: 'y',
        plugins: { legend: { display: false } }
    });

    // D. Intent (Pie)
    renderChart('chart-intent', 'pie', {
        labels: intentData.labels,
        datasets: [{
            data: intentData.values,
            backgroundColor: ['#8b5cf6', '#f59e0b', '#64748b', '#cbd5e1'], // Purple, Amber, Slate
            borderWidth: 0
        }]
    }, commonOptions);

    // E. Referral (Polar Area)
    renderChart('chart-referral', 'polarArea', {
        labels: referralData.labels,
        datasets: [{
            data: referralData.values,
            backgroundColor: ['rgba(59, 130, 246, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(245, 158, 11, 0.5)'],
            borderWidth: 1
        }]
    }, commonOptions);

    // F. Stage (Bar)
    renderChart('chart-stage', 'bar', {
        labels: stageData.labels,
        datasets: [{
            label: 'Count',
            data: stageData.values,
            backgroundColor: '#6366f1',
            borderRadius: 4
        }]
    }, { ...commonOptions, plugins: { legend: { display: false } } });

    // G. Social (Doughnut)
    renderChart('chart-social', 'doughnut', {
        labels: socialData.labels,
        datasets: [{
            data: socialData.values,
            backgroundColor: ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b'],
            borderWidth: 0,
            cutout: '70%'
        }]
    }, commonOptions);
}

// Helper: Render or Update Chart
function renderChart(canvasId, type, data, options) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: data,
        options: options
    });
}

// Helper: Get Distribution of a field
function getDistribution(patients, field) {
    const counts = {};
    patients.forEach(p => {
        const val = p[field] || 'Unknown';
        counts[val] = (counts[val] || 0) + 1;
    });

    // Sort by count desc
    const sortedProps = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    return {
        labels: sortedProps,
        values: sortedProps.map(k => counts[k])
    };
}

// Helper: Animate Number
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
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
window.closeDiedModal = closeDiedModal;
window.toggleDiedSection = toggleDiedSection;
window.toggleDeathFields = toggleDeathFields;

// --- Advanced Analysis Module ---

let analysisChart = null;

function renderAnalysis() {
    const patients = appState.patients;
    if (!patients || patients.length === 0) return;

    const var1Idx = document.getElementById('analysis-var1');
    const var2Idx = document.getElementById('analysis-var2');

    const var1 = var1Idx.value;
    const var2 = var2Idx.value;

    if (!var1) return;

    // 1. Prepare Data
    const crossTab = calculateCrossTab(patients, var1, var2);

    // 2. Render Pivot Table
    renderPivotTable(crossTab, var1, var2);

    // 3. Render Chart
    renderAnalysisChart(crossTab, var1, var2);

    // 4. Calculate Stats (Chi-Square) if 2 variables
    if (var2 && var2 !== "") {
        const stats = calculateChiSquare(crossTab);
        document.getElementById('stats-p-value').innerText = stats.pValueStr;
        document.getElementById('stats-p-value').className = `text-lg font-bold ${stats.significant ? 'text-green-600' : 'text-slate-500'}`;
    } else {
        document.getElementById('stats-p-value').innerText = "--";
        document.getElementById('stats-p-value').className = "text-lg font-bold text-slate-400";
    }
}

function calculateCrossTab(patients, var1, var2) {
    const data = {
        rows: [],
        cols: [],
        values: {} // Key: "rowVal|colVal" -> count
    };

    const rowCounts = {};
    const colCounts = {};

    patients.forEach(p => {
        let rVal = p[var1] || "Unknown";
        let cVal = var2 ? (p[var2] || "Unknown") : "Total";

        // Clean values
        if (String(rVal).trim() === '') rVal = "Unknown";
        if (String(cVal).trim() === '') cVal = "Unknown";

        // Count Rows (Var 1)
        rowCounts[rVal] = (rowCounts[rVal] || 0) + 1;

        // Count Cols (Var 2)
        if (var2) colCounts[cVal] = (colCounts[cVal] || 0) + 1;

        // Cross Tab
        const key = `${rVal}|${cVal}`;
        data.values[key] = (data.values[key] || 0) + 1;
    });

    // Sort Keys by Count Descending for better visual
    data.rows = Object.keys(rowCounts).sort();
    data.cols = var2 ? Object.keys(colCounts).sort() : ["Count"];

    return data;
}

function renderPivotTable(data, var1, var2) {
    const table = document.getElementById('analysis-table');
    table.innerHTML = "";

    // Header
    let thead = `<thead class="bg-slate-50 border-b border-slate-200"><tr><th class="p-4 font-bold text-slate-600">${var1} \\ ${var2 || 'Count'}</th>`;
    data.cols.forEach(c => {
        thead += `<th class="p-4 font-bold text-slate-600">${c}</th>`;
    });
    thead += `<th class="p-4 font-bold text-slate-800 bg-slate-100">Total</th></tr></thead>`; // Row Total Header
    table.innerHTML += thead;

    // Body
    let tbody = `<tbody class="divide-y divide-slate-100">`;
    let colTotals = new Array(data.cols.length).fill(0);

    data.rows.forEach(r => {
        tbody += `<tr><td class="p-4 font-medium text-slate-700 bg-slate-50/50">${r}</td>`;
        let rowTotal = 0;

        data.cols.forEach((c, idx) => {
            const key = `${r}|${c}`;
            const val = data.values[key] || 0;
            rowTotal += val;
            colTotals[idx] += val;

            // Heatmap Style Color (Subtle)
            let bgStyle = "";
            if (val > 0) bgStyle = `style="background-color: rgba(59, 130, 246, ${Math.min(val / 20, 0.3)})"`;

            tbody += `<td class="p-4 text-slate-600" ${bgStyle}>${val}</td>`;
        });
        tbody += `<td class="p-4 font-bold text-slate-800 bg-slate-50">${rowTotal}</td></tr>`; // Row Total
    });

    // Footer (Column Totals)
    tbody += `<tr class="bg-slate-100 font-bold text-slate-800 border-t border-slate-200"><td class="p-4">Total</td>`;
    let grandTotal = 0;
    colTotals.forEach(t => {
        grandTotal += t;
        tbody += `<td class="p-4">${t}</td>`;
    });
    tbody += `<td class="p-4 text-blue-600">${grandTotal}</td></tr>`;

    tbody += `</tbody>`;
    table.innerHTML += tbody;
}

function renderAnalysisChart(data, var1, var2) {
    const ctx = document.getElementById('analysis-chart').getContext('2d');

    if (analysisChart) analysisChart.destroy();

    const datasets = [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

    if (!var2) {
        // Simple Bar
        datasets.push({
            label: 'Count',
            data: data.rows.map(r => data.values[`${r}|Total`] || 0),
            backgroundColor: '#3b82f6',
            borderRadius: 4
        });
    } else {
        // Stacked Bar
        data.cols.forEach((c, idx) => {
            datasets.push({
                label: c,
                data: data.rows.map(r => data.values[`${r}|${c}`] || 0),
                backgroundColor: colors[idx % colors.length],
                borderRadius: 4
            });
        });
    }

    analysisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.rows, // X-Axis
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}

function calculateChiSquare(data) {
    // Basic Pearson Chi-Square implementation
    // X^2 = Sum ( (O - E)^2 / E )

    let total = 0;
    const rowTotals = {};
    const colTotals = {};

    // First Pass: Totals
    data.rows.forEach(r => {
        data.cols.forEach(c => {
            const val = data.values[`${r}|${c}`] || 0;
            total += val;
            rowTotals[r] = (rowTotals[r] || 0) + val;
            colTotals[c] = (colTotals[c] || 0) + val;
        });
    });

    let chiSq = 0;
    let valid = true;

    // Second Pass: Calc Statistic
    data.rows.forEach(r => {
        data.cols.forEach(c => {
            const observed = data.values[`${r}|${c}`] || 0;
            const expected = (rowTotals[r] * colTotals[c]) / total;

            if (expected < 5 && expected > 0) valid = false; // Warning for small samples
            if (expected > 0) {
                chiSq += Math.pow(observed - expected, 2) / expected;
            }
        });
    });

    // Degrees of Freedom
    const df = (data.rows.length - 1) * (data.cols.length - 1);

    let pValueLabel = `Chi²: ${chiSq.toFixed(2)} (df=${df})`;
    let isSig = false;

    // Simple Significance Check (p<0.05) using Critical Values for common df
    const critMap = { 1: 3.84, 2: 5.99, 3: 7.81, 4: 9.49, 5: 11.07, 6: 12.59 };
    const crit = critMap[df] || (df * 2) + Math.sqrt(2 * df) * 1.64;

    if (chiSq > crit) {
        pValueLabel += " | p < 0.05 *";
        isSig = true;
    } else {
        pValueLabel += " | p > 0.05 (ns)";
    }

    if (!valid) pValueLabel += " (Low counts)";

    return { val: chiSq, pValueStr: pValueLabel, significant: isSig };
}

window.renderAnalysis = renderAnalysis;
window.closeAreaDetail = closeAreaDetail;
