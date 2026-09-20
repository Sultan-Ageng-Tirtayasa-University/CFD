window.PUMP_PRESETS = {
    nk65_180_93052617: {
        id: 'nk65_180_93052617',
        name: 'Grundfos NK 65-180/172',
        variant: 'AA1F2S3ESBQQEOW1',
        productNumber: '93052617',
        modelStatus: 'Data produk OEM + geometri internal konsep R2',
        sourceFile: '93052617_NK_65180172_AA1F2S3ESBQQEOW1.pdf dan Pump_curve.xlsx',
        curveTolerance: 'ISO 9906:2012 grade 2B',
        geometry: {
            suctionDN: 80,
            dischargeDN: 65,
            D1: 100,
            Dh: 48,
            D2: 172,
            b2: 20,
            bladeThickness: 4,
            beta1: 22,
            beta2: 30,
            Z: 7,
            rotorInterface: 184,
            voluteStartWidth: 8,
            voluteEndWidth: 48,
            suctionL: 400,
            dischargeL: 325
        },
        operation: {
            rpm: 2930,
            ratedFlow: 88.61,
            ratedHead: 34.93,
            operatingFlow: 88.61,
            motorPower: 15,
            fluidTemperature: 50,
            fluidDensity: 988,
            dynamicViscosity: 0.000547
        },
        limits: { qMin: 9.011, qMax: 114.8 },
        curve: [
            { q: 0, h: 44.50, p2: 3.730, p1: 5.525, eta1: 0, npsh: 1.262 },
            { q: 9.011, h: 44.34, p2: 4.342, p1: 6.131, eta1: 17.542944, npsh: 1.307 },
            { q: 16.40, h: 44.29, p2: 4.915, p1: 6.674, eta1: 29.286540, npsh: 1.300 },
            { q: 32.80, h: 43.90, p2: 6.301, p1: 7.912, eta1: 48.970217, npsh: 1.344 },
            { q: 49.19, h: 42.50, p2: 7.684, p1: 9.109, eta1: 61.779389, npsh: 1.578 },
            { q: 65.59, h: 40.06, p2: 8.928, p1: 10.400, eta1: 67.993855, npsh: 2.031 },
            { q: 81.99, h: 36.97, p2: 9.969, p1: 11.460, eta1: 71.207533, npsh: 2.770 },
            { q: 88.61, h: 34.93, p2: 10.31655, p1: 11.803110, eta1: 71.423322, npsh: 3.239859, rated: true },
            { q: 98.39, h: 33.36, p2: 10.830, p1: 12.310, eta1: 71.742117, npsh: 3.934 },
            { q: 114.80, h: 28.55, p2: 11.610, p1: 13.110, eta1: 67.295741, npsh: 5.638 }
        ],
        provenance: {
            suctionDN: 'oem', dischargeDN: 'oem', D2: 'oem', rpm: 'oem',
            ratedFlow: 'oem', ratedHead: 'oem', motorPower: 'oem',
            fluidTemperature: 'oem', fluidDensity: 'oem',
            D1: 'assumption', Dh: 'assumption', b2: 'assumption',
            bladeThickness: 'assumption', beta1: 'assumption', beta2: 'assumption',
            Z: 'assumption', rotorInterface: 'assumption',
            voluteStartWidth: 'assumption', voluteEndWidth: 'assumption',
            suctionL: 'cfd', dischargeL: 'cfd', dynamicViscosity: 'property'
        },
        cadPackage: 'cad_model/nk65_180/Pump_CFD_NK65_180_R2.zip'
    },
    nk50_350_concept: {
        id: 'nk50_350_concept',
        name: 'NK 50-350 concept R1',
        variant: '4-pole, 11 kW',
        productNumber: 'concept-r1',
        modelStatus: 'Geometri konsep tanpa kurva OEM',
        sourceFile: 'Lampiran CAD awal; geometri internal tidak tersedia',
        curveTolerance: 'Tidak tersedia',
        geometry: {
            suctionDN: 80, dischargeDN: 50, D1: 110, Dh: 60, D2: 324,
            b2: 30, bladeThickness: 6, beta1: 20, beta2: 34, Z: 7,
            rotorInterface: 340, voluteStartWidth: 12, voluteEndWidth: 65,
            suctionL: 400, dischargeL: 250
        },
        operation: {
            rpm: 1450, ratedFlow: null, ratedHead: null, operatingFlow: 60,
            motorPower: 11, fluidTemperature: 25, fluidDensity: 997,
            dynamicViscosity: 0.000890
        },
        limits: { qMin: null, qMax: null },
        curve: [],
        provenance: {
            suctionDN: 'family', dischargeDN: 'family', D2: 'assumption',
            D1: 'assumption', Dh: 'assumption', b2: 'assumption',
            bladeThickness: 'assumption', beta1: 'assumption', beta2: 'assumption',
            Z: 'assumption', rotorInterface: 'assumption',
            voluteStartWidth: 'assumption', voluteEndWidth: 'assumption',
            suctionL: 'cfd', dischargeL: 'cfd', rpm: 'assumption',
            ratedFlow: 'missing', ratedHead: 'missing', motorPower: 'family',
            fluidTemperature: 'assumption', fluidDensity: 'property',
            dynamicViscosity: 'property'
        },
        cadPackage: 'cad_model/Pump_CFD_CAD_Package_R1.zip'
    }
};

window.PUMP_PRESET_ORDER = ['nk65_180_93052617', 'nk50_350_concept'];
