(function () {
    const G = 9.80665;

    function finite(value, fallback = 0) {
        if (value === '' || value === null || value === undefined) return fallback;
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function interpolate(points, q, field) {
        if (!points || points.length === 0) return null;
        if (q <= points[0].q) return finite(points[0][field], null);
        if (q >= points[points.length - 1].q) return finite(points[points.length - 1][field], null);
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            if (q >= a.q && q <= b.q) {
                const t = (q - a.q) / (b.q - a.q);
                const av = finite(a[field], NaN);
                const bv = finite(b[field], NaN);
                return Number.isFinite(av) && Number.isFinite(bv) ? av + t * (bv - av) : null;
            }
        }
        return null;
    }

    function scaleCurve(preset, rpm) {
        const baseRpm = finite(preset.operation.rpm, rpm || 1);
        const ratio = baseRpm > 0 ? finite(rpm, baseRpm) / baseRpm : 1;
        return (preset.curve || []).map(point => ({
            q: point.q * ratio,
            h: point.h * ratio * ratio,
            p2: point.p2 * ratio * ratio * ratio,
            p1: point.p1 * ratio * ratio * ratio,
            eta1: point.eta1,
            npsh: point.npsh * ratio * ratio,
            rated: Boolean(point.rated)
        }));
    }

    function calculate(inputs, preset) {
        const rpm = Math.max(0, finite(inputs.rpm));
        const flow = Math.max(0, finite(inputs.operatingFlow));
        const rho = Math.max(1, finite(inputs.fluidDensity, 997));
        const mu = Math.max(1e-9, finite(inputs.dynamicViscosity, 0.001));
        const curve = scaleCurve(preset, rpm);
        const head = interpolate(curve, flow, 'h');
        const p2 = interpolate(curve, flow, 'p2');
        const p1 = interpolate(curve, flow, 'p1');
        const npshr = interpolate(curve, flow, 'npsh');
        const qM3s = flow / 3600;
        const hydraulicPower = head == null ? null : rho * G * qM3s * head / 1000;
        const pumpEfficiency = hydraulicPower != null && p2 > 0 ? hydraulicPower / p2 * 100 : null;
        const totalEfficiency = hydraulicPower != null && p1 > 0 ? hydraulicPower / p1 * 100 : null;
        const omega = rpm * Math.PI / 30;
        const torque = p2 != null && omega > 0 ? p2 * 1000 / omega : null;
        const tipSpeed = Math.PI * finite(inputs.D2) / 1000 * rpm / 60;
        const suctionArea = Math.PI * Math.pow(finite(inputs.suctionDN) / 1000, 2) / 4;
        const dischargeArea = Math.PI * Math.pow(finite(inputs.dischargeDN) / 1000, 2) / 4;
        const suctionVelocity = suctionArea > 0 ? qM3s / suctionArea : null;
        const dischargeVelocity = dischargeArea > 0 ? qM3s / dischargeArea : null;
        const reynoldsDischarge = dischargeVelocity == null ? null : rho * dischargeVelocity * finite(inputs.dischargeDN) / 1000 / mu;
        const pressureRiseBar = head == null ? null : rho * G * head / 100000;
        const ratio = preset.operation.rpm > 0 ? rpm / preset.operation.rpm : 1;
        const scaledMin = preset.limits.qMin == null ? null : preset.limits.qMin * ratio;
        const scaledMax = preset.limits.qMax == null ? null : preset.limits.qMax * ratio;
        const inRecommendedRange = scaledMin == null || scaledMax == null ? null : flow >= scaledMin && flow <= scaledMax;
        const npsha = finite(inputs.npshAvailable, NaN);
        const npshMargin = Number.isFinite(npsha) && npshr != null ? npsha - npshr : null;

        return {
            rpm, flow, head, p2, p1, npshr, hydraulicPower, pumpEfficiency,
            totalEfficiency, torque, tipSpeed, suctionVelocity, dischargeVelocity,
            reynoldsDischarge, pressureRiseBar, scaledMin, scaledMax,
            inRecommendedRange, npshMargin, curve,
            model: curve.length ? 'Interpolasi linear kurva OEM + affinity law' : 'Data kurva tidak tersedia'
        };
    }

    window.PumpPerformance = { calculate, interpolate, scaleCurve };
})();
