const geometryDimensionOverlay = {
    id: 'geometryDimensionOverlay',
    afterDraw(chart) {
        const D2 = Number(document.getElementById('D2')?.value || 0);
        const D1 = Number(document.getElementById('D1')?.value || 0);
        const suctionDN = Number(document.getElementById('suctionDN')?.value || 0);
        const dischargeDN = Number(document.getElementById('dischargeDN')?.value || 0);
        const b2 = Number(document.getElementById('b2')?.value || 0);
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.x || !scales.y || D2 <= 0) return;

        const x1 = scales.x.getPixelForValue(-D2 / 2);
        const x2 = scales.x.getPixelForValue(D2 / 2);
        const y = scales.y.getPixelForValue(0);
        ctx.save();
        ctx.strokeStyle = '#173b5c';
        ctx.fillStyle = '#173b5c';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
        for (const [x, direction] of [[x1, 1], [x2, -1]]) {
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x + direction * 8, y - 4); ctx.lineTo(x + direction * 8, y + 4); ctx.closePath(); ctx.fill();
        }
        ctx.font = '700 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`D2 = ${D2.toFixed(1)} mm`, (x1 + x2) / 2, y - 9);

        const boxX = chartArea.left + 12;
        const boxY = chartArea.top + 12;
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.strokeStyle = '#d5dee8';
        ctx.beginPath(); ctx.roundRect(boxX, boxY, 192, 72, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#405169';
        ctx.textAlign = 'left';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText(`D1 ${D1} · b2 ${b2} · Eye ${suctionDN} mm`, boxX + 10, boxY + 21);
        ctx.fillText(`Suction/Discharge DN ${suctionDN}/${dischargeDN}`, boxX + 10, boxY + 41);
        ctx.fillStyle = '#a3521b';
        ctx.fillText('Internal: engineering assumption', boxX + 10, boxY + 60);
        ctx.restore();
    }
};

function circlePoints(radius, count = 120) {
    const points = [];
    for (let i = 0; i <= count; i++) {
        const angle = i * Math.PI * 2 / count;
        points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    }
    return points;
}

function lineDataset(label, data, color, width = 1.5, dash = []) {
    return { label, data, borderColor: color, borderWidth: width, borderDash: dash, fill: false, pointRadius: 0, showLine: true, tension: 0 };
}

function render2D() {
    const D1 = Number(document.getElementById('D1').value);
    const Dh = Number(document.getElementById('Dh').value);
    const D2 = Number(document.getElementById('D2').value);
    const suctionDN = Number(document.getElementById('suctionDN').value);
    const beta1 = Number(document.getElementById('beta1').value);
    const beta2 = Number(document.getElementById('beta2').value);
    const Z = Number(document.getElementById('Z').value);
    const rotorInterface = Number(document.getElementById('rotorInterface').value);
    const startWidth = Number(document.getElementById('voluteStartWidth').value);
    const endWidth = Number(document.getElementById('voluteEndWidth').value);
    const r1 = D1 / 2;
    const r2 = D2 / 2;
    const ri = rotorInterface / 2;
    const baseBladeCurve = generateBladeCurve(r1, r2, beta1, beta2, 70);
    const datasets = [];

    for (let k = 0; k < Z; k++) {
        const angleOffset = k * Math.PI * 2 / Z + currentRotation;
        datasets.push(lineDataset(`Sudu ${k + 1}`, baseBladeCurve.map(p => rotatePoint(p, angleOffset)), '#1769aa', 2.2));
    }

    datasets.push(lineDataset('Hub', circlePoints(Dh / 2), '#67758a', 1.2));
    datasets.push(lineDataset('Eye DN', circlePoints(suctionDN / 2), '#18836b', 1.5, [5, 4]));
    datasets.push(lineDataset('D1', circlePoints(r1), '#7a8aa0', 1, [3, 4]));
    datasets.push(lineDataset('D2', circlePoints(r2), '#0b2745', 1.6));
    datasets.push(lineDataset('Interface rotor', circlePoints(ri), '#d86d24', 1.4, [6, 4]));

    if (document.getElementById('showVolute').checked) {
        const inner = [];
        const outer = [];
        const count = 180;
        for (let i = 0; i <= count; i++) {
            const t = i / count;
            const theta = t * Math.PI * 2;
            const width = startWidth + t * (endWidth - startWidth);
            inner.push({ x: ri * Math.cos(theta), y: ri * Math.sin(theta) });
            outer.push({ x: (ri + width) * Math.cos(theta), y: (ri + width) * Math.sin(theta) });
        }
        datasets.push(lineDataset('Volute dalam', inner, '#18836b', 1.4));
        datasets.push(lineDataset('Volute luar', outer, '#18836b', 2.2));
    }

    window.currentDatasets = datasets;
    const maxRadius = Math.max(ri + endWidth, r2) * 1.18;
    const canvas = document.getElementById('impellerChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
            x: { type: 'linear', min: -maxRadius, max: maxRadius, title: { display: true, text: 'X [mm]', color: '#64748b' }, grid: { color: '#dfe6ee' }, ticks: { color: '#64748b' } },
            y: { type: 'linear', min: -maxRadius, max: maxRadius, title: { display: true, text: 'Y [mm]', color: '#64748b' }, grid: { color: '#dfe6ee' }, ticks: { color: '#64748b' } }
        }
    };

    if (impellerChart) {
        impellerChart.data.datasets = datasets;
        impellerChart.options = options;
        impellerChart.update('none');
    } else {
        impellerChart = new Chart(canvas.getContext('2d'), { type: 'scatter', data: { datasets }, options, plugins: [geometryDimensionOverlay] });
    }
}
