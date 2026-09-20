window.lbm_uArr = null;
window.lbm_vArr = null;
window.lbm_maxVelSq = 0;
window.activePumpPreset = null;
let performanceResult = null;
let animationFrameCounter = 0;
let updateTimer = null;

const geometryFields = ['suctionDN', 'dischargeDN', 'D1', 'Dh', 'D2', 'b2', 'bladeThickness', 'beta1', 'beta2', 'Z', 'rotorInterface', 'voluteStartWidth', 'voluteEndWidth', 'suctionL', 'dischargeL'];
const operationFields = ['rpm', 'ratedFlow', 'ratedHead', 'operatingFlow', 'fluidTemperature', 'fluidDensity', 'dynamicViscosity', 'npshAvailable'];
const sourceLabels = {
    oem: ['OEM', 'source-oem'], assumption: ['ASUMSI', 'source-assumption'],
    cfd: ['CFD', 'source-cfd'], family: ['FAMILY', 'source-family'],
    property: ['PROPERTI', 'source-property'], missing: ['BELUM ADA', 'source-missing']
};

function numberValue(id, fallback = null) {
    const element = document.getElementById(id);
    if (!element || element.value === '') return fallback;
    const value = Number(element.value);
    return Number.isFinite(value) ? value : fallback;
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value == null ? '' : value;
}

function formatNumber(value, decimals, unit = '') {
    if (value == null || !Number.isFinite(Number(value))) return '–';
    return `${Number(value).toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ''}`;
}

function readInputs() {
    const data = {};
    [...geometryFields, ...operationFields].forEach(id => { data[id] = numberValue(id); });
    return data;
}

function updateSourceBadges(preset) {
    document.querySelectorAll('[data-source-for]').forEach(element => {
        const source = preset.provenance[element.dataset.sourceFor] || 'assumption';
        const [label, className] = sourceLabels[source] || sourceLabels.assumption;
        element.className = `source-badge ${className}`;
        element.textContent = label;
    });
}

function populatePresetSelector() {
    const select = document.getElementById('pumpPreset');
    select.replaceChildren();
    window.PUMP_PRESET_ORDER.forEach(id => {
        const preset = window.PUMP_PRESETS[id];
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${preset.name} · ${preset.productNumber}`;
        select.appendChild(option);
    });
}

function applyPreset(id) {
    const preset = window.PUMP_PRESETS[id];
    if (!preset) return;
    window.activePumpPreset = preset;
    document.getElementById('pumpPreset').value = id;
    Object.entries(preset.geometry).forEach(([key, value]) => setValue(key, value));
    Object.entries(preset.operation).forEach(([key, value]) => setValue(key, value));
    setValue('npshAvailable', null);
    document.getElementById('productName').textContent = `${preset.name} ${preset.variant}`;
    document.getElementById('productMeta').textContent = `Product ${preset.productNumber} · ${preset.modelStatus}`;
    document.getElementById('productSource').textContent = `Sumber: ${preset.sourceFile}`;
    const cadLink = document.getElementById('cadDownloadBtn');
    cadLink.href = preset.cadPackage;
    cadLink.download = preset.cadPackage.split('/').pop();
    updateSourceBadges(preset);
    updateAll();
}

function validateGeometry(inputs) {
    const checks = [
        { ok: inputs.Dh > 0 && inputs.Dh < inputs.suctionDN, text: 'Hub harus lebih kecil dari eye/suction.' },
        { ok: inputs.suctionDN <= inputs.D1 && inputs.D1 < inputs.D2, text: 'Diameter harus memenuhi eye ≤ D1 < D2.' },
        { ok: inputs.rotorInterface > inputs.D2, text: 'Interface rotor harus berada di luar tip impeller.' },
        { ok: (inputs.rotorInterface - inputs.D2) / 2 >= 3, text: 'Jarak radial tip–interface harus minimum 3 mm.' },
        { ok: inputs.voluteEndWidth > inputs.voluteStartWidth, text: 'Penampang volute harus membesar menuju discharge.' },
        { ok: inputs.b2 > 2 * inputs.bladeThickness, text: 'Lebar kanal harus lebih dari dua kali tebal sudu.' },
        { ok: inputs.suctionL >= 5 * inputs.suctionDN, text: 'Ekstensi suction harus minimum 5×DN.' },
        { ok: inputs.dischargeL >= 5 * inputs.dischargeDN, text: 'Ekstensi discharge harus minimum 5×DN.' }
    ];
    const failures = checks.filter(check => !check.ok);
    return { checks, ok: failures.length === 0, failures };
}

function sourceBadgeHtml(source) {
    const [label, className] = sourceLabels[source] || sourceLabels.assumption;
    return `<span class="source-badge ${className}">${label}</span>`;
}

function updateDimensionTable(inputs, preset) {
    const dimensions = [
        ['Suction / discharge', `DN ${inputs.suctionDN} / ${inputs.dischargeDN}`, 'suctionDN'],
        ['Impeller D2', `${inputs.D2} mm`, 'D2'],
        ['Inlet sudu D1', `${inputs.D1} mm`, 'D1'],
        ['Hub Dh', `${inputs.Dh} mm`, 'Dh'],
        ['Lebar kanal b2', `${inputs.b2} mm`, 'b2'],
        ['Sudu', `${inputs.Z} × ${inputs.bladeThickness} mm`, 'Z'],
        ['Sudut β1 / β2', `${inputs.beta1}° / ${inputs.beta2}°`, 'beta1'],
        ['Interface rotor', `Ø ${inputs.rotorInterface} mm`, 'rotorInterface'],
        ['Lebar volute awal / akhir', `${inputs.voluteStartWidth} / ${inputs.voluteEndWidth} mm`, 'voluteStartWidth'],
        ['Ekstensi suction / discharge', `${inputs.suctionL} / ${inputs.dischargeL} mm`, 'suctionL']
    ];
    document.getElementById('dimensionTableBody').innerHTML = dimensions.map(([label, value, field]) =>
        `<tr><td>${label} ${sourceBadgeHtml(preset.provenance[field])}</td><td>${value}</td></tr>`
    ).join('');
}

function updateGeometryStatus(validation) {
    const element = document.getElementById('geometryStatus');
    element.className = `validation-box ${validation.ok ? 'ok' : 'warn'}`;
    element.innerHTML = validation.ok
        ? '<strong>Dimensi konsisten.</strong> Model dapat dipakai sebagai geometri konsep dan pre-processing CFD.'
        : `<strong>${validation.failures.length} pemeriksaan perlu diperbaiki:</strong> ${validation.failures.map(item => item.text).join(' ')}`;
}

function updateMetrics(result) {
    document.getElementById('resultHead').textContent = formatNumber(result.head, 2, 'm');
    document.getElementById('resultPressure').textContent = formatNumber(result.pressureRiseBar, 2, 'bar');
    document.getElementById('resultEfficiency').textContent = formatNumber(result.pumpEfficiency, 1, '%');
    document.getElementById('resultPower').textContent = formatNumber(result.p2, 2, 'kW');
    document.getElementById('resultNpsh').textContent = formatNumber(result.npshr, 2, 'm');
    document.getElementById('resultTorque').textContent = formatNumber(result.torque, 1, 'N·m');
}

function updatePerformanceTable(result) {
    const rangeText = result.scaledMin == null ? 'Rentang belum tersedia' : `${formatNumber(result.scaledMin, 2)} – ${formatNumber(result.scaledMax, 2)} m³/h`;
    const npshText = result.npshMargin == null ? 'Isi NPSHa dari sistem suction' : `Margin ${formatNumber(result.npshMargin, 2, 'm')}`;
    const rows = [
        ['Debit terpilih', formatNumber(result.flow, 2, 'm³/h'), rangeText],
        ['Head', formatNumber(result.head, 2, 'm'), result.model],
        ['Daya hidraulik', formatNumber(result.hydraulicPower, 2, 'kW'), 'ρgQH'],
        ['Daya poros P2', formatNumber(result.p2, 2, 'kW'), 'Kurva produk'],
        ['Daya listrik P1', formatNumber(result.p1, 2, 'kW'), 'Kurva produk'],
        ['Efisiensi pompa', formatNumber(result.pumpEfficiency, 1, '%'), 'P hidraulik / P2'],
        ['Efisiensi total', formatNumber(result.totalEfficiency, 1, '%'), 'P hidraulik / P1'],
        ['Kecepatan tip', formatNumber(result.tipSpeed, 2, 'm/s'), 'πD2n/60'],
        ['Kecepatan suction', formatNumber(result.suctionVelocity, 2, 'm/s'), 'Berdasarkan DN'],
        ['Kecepatan discharge', formatNumber(result.dischargeVelocity, 2, 'm/s'), 'Berdasarkan DN'],
        ['Reynolds discharge', formatNumber(result.reynoldsDischarge, 0), 'ρVD/μ'],
        ['NPSHr', formatNumber(result.npshr, 2, 'm'), npshText]
    ];
    document.getElementById('performanceTableBody').innerHTML = rows.map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('');
}

function renderPerformanceChart(result, preset) {
    const canvas = document.getElementById('performanceChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const datasets = [];
    if (result.curve.length) {
        datasets.push({ label: 'Head H [m]', data: result.curve.map(p => ({ x: p.q, y: p.h })), borderColor: '#1769aa', backgroundColor: 'rgba(23,105,170,.12)', borderWidth: 2.5, pointRadius: 2, fill: true, yAxisID: 'y' });
        datasets.push({ label: 'Daya P2 [kW]', data: result.curve.map(p => ({ x: p.q, y: p.p2 })), borderColor: '#d86d24', borderWidth: 2, pointRadius: 1.5, yAxisID: 'yAux' });
        datasets.push({ label: 'NPSHr [m]', data: result.curve.map(p => ({ x: p.q, y: p.npsh })), borderColor: '#18836b', borderWidth: 2, borderDash: [6, 4], pointRadius: 1.5, yAxisID: 'yAux' });
        if (result.head != null) datasets.push({ label: 'Titik operasi', data: [{ x: result.flow, y: result.head }], borderColor: '#a4243b', backgroundColor: '#a4243b', pointRadius: 6, pointHoverRadius: 7, showLine: false, yAxisID: 'y' });
    }
    const config = {
        type: 'scatter', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'nearest', intersect: false },
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${formatNumber(context.parsed.y, 2)}` } } },
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Debit Q [m³/h]' }, grid: { color: '#e3e8ef' } },
                y: { position: 'left', beginAtZero: true, title: { display: true, text: 'Head [m]' }, grid: { color: '#e3e8ef' } },
                yAux: { position: 'right', beginAtZero: true, title: { display: true, text: 'P2 [kW] / NPSHr [m]' }, grid: { drawOnChartArea: false } }
            }
        }
    };
    if (performanceChart) { performanceChart.data = config.data; performanceChart.options = config.options; performanceChart.update('none'); }
    else performanceChart = new Chart(canvas.getContext('2d'), config);
    document.getElementById('curveModelLabel').textContent = result.curve.length ? `${preset.curveTolerance} · ${result.rpm} rpm` : 'Kurva belum tersedia';
}

function updateChecklist(inputs, preset, validation, result) {
    const items = validation.checks.map(check => ({ state: check.ok ? 'ok' : 'fail', text: check.text }));
    items.push({ state: result.inRecommendedRange === false ? 'warn' : 'ok', text: result.inRecommendedRange === false ? 'Debit berada di luar Qmin–Qmax pada putaran ini.' : 'Debit berada dalam rentang kurva produk.' });
    items.push({ state: result.npshMargin == null ? 'warn' : result.npshMargin > 0 ? 'ok' : 'fail', text: result.npshMargin == null ? 'NPSHa belum diisi; kavitasi belum dapat dinilai.' : `Margin NPSH = ${formatNumber(result.npshMargin, 2, 'm')}.` });
    items.push({ state: 'ok', text: 'Zona disiapkan sebagai InletFluid, RotorFluid, dan StatorFluid.' });
    items.push({ state: 'warn', text: 'Mesh 3D, y+, residual, mass balance, dan studi independensi mesh tetap diperlukan.' });
    if (!preset.curve.length) items.push({ state: 'warn', text: 'Preset ini belum mempunyai kurva pabrikan untuk validasi performa.' });
    document.getElementById('cfdChecklist').innerHTML = items.map(item => `<li class="${item.state === 'ok' ? '' : item.state}">${item.text}</li>`).join('');
}

function updateHud(inputs, result) {
    document.getElementById('hudRho').textContent = `${inputs.fluidDensity} kg/m³`;
    document.getElementById('hudVisc').textContent = `${Number(inputs.dynamicViscosity).toExponential(3)} Pa·s`;
    document.getElementById('hudRPM').textContent = `${inputs.rpm} rpm`;
    document.getElementById('hudPresMax').textContent = formatNumber(result.head, 2, 'm');
    if (!window.wasmInitialized) document.getElementById('hudVel').textContent = 'belum berjalan';
}

function updateAll() {
    const preset = window.activePumpPreset;
    if (!preset) return;
    const inputs = readInputs();
    const validation = validateGeometry(inputs);
    performanceResult = window.PumpPerformance.calculate(inputs, preset);
    updateMetrics(performanceResult);
    updatePerformanceTable(performanceResult);
    renderPerformanceChart(performanceResult, preset);
    updateDimensionTable(inputs, preset);
    updateGeometryStatus(validation);
    updateChecklist(inputs, preset, validation, performanceResult);
    updateHud(inputs, performanceResult);
    if (is3DMode) render3D(); else render2D();
    if (typeof updateVoxelPreview === 'function') updateVoxelPreview();
}

function drawCFDHeatmap(res, uArray, vArray, maxVelocitySquared) {
    const canvas = document.getElementById('voxelCanvas');
    if (!canvas || !window.wasmGeometryView) return;
    const context = canvas.getContext('2d');
    const image = context.createImageData(res, res);
    const maxVelocity = Math.sqrt(maxVelocitySquared) || 1;
    for (let i = 0; i < res * res; i++) {
        const cellType = window.wasmGeometryView[i];
        const offset = i * 4;
        if (cellType === 1) { image.data.set([76, 87, 103, 255], offset); continue; }
        if (cellType === 2) { image.data.set([226, 123, 47, 255], offset); continue; }
        const speed = Math.sqrt(uArray[i] * uArray[i] + vArray[i] * vArray[i]);
        const t = Math.max(0, Math.min(1, speed / maxVelocity));
        image.data[offset] = Math.round(30 + 220 * t);
        image.data[offset + 1] = Math.round(70 + 150 * Math.sin(Math.PI * t));
        image.data[offset + 2] = Math.round(185 - 150 * t);
        image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
}

function runLbmStep() {
    const lbmModule = window.PumpCFDModule;
    if (!window.wasmInitialized || !document.getElementById('cfdMode').checked || typeof lbmModule?.ccall !== 'function') return;
    const rpm = numberValue('rpm', 0);
    const latticeOmega = Math.min(0.006, Math.max(0, rpm / 2930 * 0.003));
    lbmModule.ccall('stepLBM', null, ['number', 'number', 'number'], [0.58, latticeOmega, 0]);
    const res = numberValue('lbmResolution', 128);
    const count = res * res;
    const uPointer = lbmModule.ccall('getUPointer', 'number', [], []);
    const vPointer = lbmModule.ccall('getVPointer', 'number', [], []);
    const heapBuffer = lbmModule.HEAPU8?.buffer;
    if (!heapBuffer) return;
    const uArray = new Float64Array(heapBuffer, uPointer, count);
    const vArray = new Float64Array(heapBuffer, vPointer, count);
    let maxVelocitySquared = 0;
    for (let i = 0; i < count; i += 3) {
        if (window.wasmGeometryView[i] !== 0) continue;
        const speedSquared = uArray[i] * uArray[i] + vArray[i] * vArray[i];
        if (Number.isFinite(speedSquared) && speedSquared > maxVelocitySquared) maxVelocitySquared = speedSquared;
    }
    window.lbm_uArr = uArray; window.lbm_vArr = vArray; window.lbm_maxVelSq = maxVelocitySquared;
    drawCFDHeatmap(res, uArray, vArray, maxVelocitySquared);
    document.getElementById('hudVel').textContent = `${Math.sqrt(maxVelocitySquared).toFixed(4)} lattice`;
}

function animationLoop(timestamp) {
    if (!document.getElementById('animateImpeller').checked) { animationId = null; lastTime = 0; return; }
    if (!lastTime) lastTime = timestamp;
    const deltaSeconds = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    const rpm = numberValue('rpm', 0);
    currentRotation = (currentRotation + rpm * Math.PI * 2 / 60 * deltaSeconds * 0.025) % (Math.PI * 2);
    if (is3DMode && impellerGroup) impellerGroup.rotation.z = currentRotation;
    if (!is3DMode && animationFrameCounter % 6 === 0) render2D();
    if (animationFrameCounter % 2 === 0) runLbmStep();
    animationFrameCounter++;
    animationId = requestAnimationFrame(animationLoop);
}

function ensureAnimation() {
    if (document.getElementById('animateImpeller').checked && !animationId) animationId = requestAnimationFrame(animationLoop);
}

function initializeWasmGrid() {
    const lbmModule = window.PumpCFDModule;
    if (typeof lbmModule?.ccall !== 'function') return;
    const res = numberValue('lbmResolution', 128);
    lbmModule.ccall('initLBM', null, ['number', 'number'], [res, res]);
    const pointer = lbmModule.ccall('getGeometryPointer', 'number', [], []);
    const heapBuffer = lbmModule.HEAPU8?.buffer;
    if (!heapBuffer) {
        window.wasmInitialized = false;
        console.warn('Buffer memori LBM tidak tersedia; pratinjau geometri tetap aktif tanpa solver.');
        return;
    }
    window.wasmGeometryView = new Int32Array(heapBuffer, pointer, res * res);
    window.wasmInitialized = true;
    updateVoxelPreview();
}

function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportProject() {
    const preset = window.activePumpPreset;
    const payload = {
        schema: 'pump-cfd-studio/v2', exportedAt: new Date().toISOString(),
        preset: preset.id, productNumber: preset.productNumber,
        geometry: Object.fromEntries(geometryFields.map(id => [id, numberValue(id)])),
        operation: Object.fromEntries(operationFields.map(id => [id, numberValue(id)])),
        performance: performanceResult,
        provenance: preset.provenance,
        limitation: 'Kurva OEM dengan geometri internal asumsi; bukan hasil RANS 3D.'
    };
    downloadText(`pump_${preset.productNumber}_project.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function exportGeometryCsv() {
    const rows = ['Group,Point,X_mm,Y_mm,Z_mm'];
    let group = 1;
    (window.currentDatasets || []).filter(dataset => dataset.label.startsWith('Sudu') || dataset.label.startsWith('Volute')).forEach(dataset => {
        dataset.data.forEach((point, index) => rows.push(`${group},${index + 1},${point.x.toFixed(5)},${point.y.toFixed(5)},0`));
        group++;
    });
    downloadText(`pump_${window.activePumpPreset.productNumber}_profiles.csv`, rows.join('\n'), 'text/csv;charset=utf-8');
}

function exportCurveCsv() {
    const rows = ['Q_m3h,H_m,P2_kW,P1_kW,NPSHr_m'];
    (performanceResult?.curve || []).forEach(point => rows.push([point.q, point.h, point.p2, point.p1, point.npsh].map(value => Number(value).toFixed(6)).join(',')));
    downloadText(`pump_${window.activePumpPreset.productNumber}_curve.csv`, rows.join('\n'), 'text/csv;charset=utf-8');
}

function bindUi() {
    document.getElementById('pumpPreset').addEventListener('change', event => applyPreset(event.target.value));
    document.getElementById('updateBtn').addEventListener('click', updateAll);
    document.getElementById('exportProjectBtn').addEventListener('click', exportProject);
    document.getElementById('exportBtn').addEventListener('click', exportGeometryCsv);
    document.getElementById('exportCurveBtn').addEventListener('click', exportCurveCsv);
    [...geometryFields, ...operationFields, 'showVolute', 'cfdMode'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => { clearTimeout(updateTimer); updateTimer = setTimeout(updateAll, 120); });
    });
    document.getElementById('lbmResolution').addEventListener('change', () => { initializeWasmGrid(); updateAll(); });
    document.getElementById('animateImpeller').addEventListener('change', ensureAnimation);

    document.getElementById('view2dBtn').addEventListener('click', () => {
        is3DMode = false;
        document.getElementById('view2dBtn').classList.add('active');
        document.getElementById('view3dBtn').classList.remove('active');
        document.getElementById('impellerChart').style.display = 'block';
        document.getElementById('canvas3d').style.display = 'none';
        document.getElementById('cfdHUD').classList.add('hidden');
        render2D();
    });
    document.getElementById('view3dBtn').addEventListener('click', () => {
        is3DMode = true;
        document.getElementById('view3dBtn').classList.add('active');
        document.getElementById('view2dBtn').classList.remove('active');
        document.getElementById('impellerChart').style.display = 'none';
        document.getElementById('canvas3d').style.display = 'block';
        render3D();
        requestAnimationFrame(resize3D);
    });
    document.querySelectorAll('.tab-button').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(item => item.classList.toggle('active', item === button));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === button.dataset.panel));
        if (button.dataset.panel === 'performancePanel' && performanceChart) requestAnimationFrame(() => performanceChart.resize());
        if (button.dataset.panel === 'domainsPanel') updateVoxelPreview();
    }));
}

window.PumpCFDModule = window.PumpCFDModule || {};
window.PumpCFDModule.onRuntimeInitialized = function () { initializeWasmGrid(); };

populatePresetSelector();
bindUi();
applyPreset('nk65_180_93052617');
