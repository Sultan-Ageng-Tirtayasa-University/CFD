let impellerChart = null;
let currentRotation = 0;
let animationId = null;
let is3DMode = false;

// --- Three.js Variables ---
let scene, camera, renderer, controls;
let impellerGroup, voluteMesh, suctionPipe, dischargePipe;

function deg2rad(deg) {
    return deg * Math.PI / 180.0;
}

// --- CFD Simulation Helpers ---
// --- CFD Wasm / JS Engine ---
// We provide a high-performance JavaScript fallback that mimics the C++ engine
// while the user compiles cfd_engine.cpp to WebAssembly.

function getBladeTheta(r, baseCurve) {
    if (!baseCurve || baseCurve.length === 0) return 0;
    if (r <= baseCurve[0].r) return baseCurve[0].theta;
    if (r >= baseCurve[baseCurve.length-1].r) return baseCurve[baseCurve.length-1].theta;
    for(let i=0; i<baseCurve.length-1; i++) {
        if (r >= baseCurve[i].r && r <= baseCurve[i+1].r) {
            const t = (r - baseCurve[i].r) / (baseCurve[i+1].r - baseCurve[i].r);
            return baseCurve[i].theta + t * (baseCurve[i+1].theta - baseCurve[i].theta);
        }
    }
    return 0;
}

function getJetColor(t) {
    if (t < -0.05) {
        return { r: 0.95, g: 0.95, b: 1.0 }; // Cavitation Vapor (White)
    }
    t = Math.max(0, Math.min(1, t));
    return {
        r: Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 3))),
        g: Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 2))),
        b: Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 1)))
    };
}

// Academic Transient CFD Fallback (Javascript matching the C++ logic)
function applyCFDColors(geometry, domain, r1, r2, dischargeL, baseCurve = null, Z_blades = 7, rpm = 1500) {
    const pos = geometry.attributes.position;
    
    let colorAttr = geometry.attributes.color;
    if (!colorAttr || colorAttr.count !== pos.count) {
        colorAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
        geometry.setAttribute('color', colorAttr);
    }
    const colors = colorAttr.array;
    
    const PI = Math.PI;
    const pitch = 2.0 * PI / Z_blades;
    const voluteTongueTheta = PI / 2.0; 
    
    // Academic Calibration: Pressure rise is proportional to RPM squared (Euler Pump Equation)
    // When RPM = 0, rpmFactor = 0.
    const rpmFactor = Math.max(0.0, Math.min(4.0, Math.pow(rpm / 1500.0, 2)));
    
    // Base static pressure of the system (e.g., uniform suction pressure everywhere when pump is off)
    const basePressure = 0.15; // Set to a light blue/cyan so it's clearly visible as a solid fluid block
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x*x + y*y);

        let t = basePressure;

        if (domain === 'suction') {
            // Translating transient flow entering the pump (moving along -Z axis)
            const suctionPulse = 0.08 * Math.sin(z * 0.05 + currentRotation * Z_blades * 2.0);
            t = basePressure + suctionPulse * rpmFactor; 
        } else if (domain === 'impeller') {
            if (r <= r1 * 0.5) {
                t = basePressure; 
            } else if (r > r2 * 1.02) {
                // Outer boundary matches inner volute pressure
                t = basePressure + 0.45 * rpmFactor; 
            } else {
                const r_norm = Math.max(0, Math.min(1, (r - r1) / (r2 - r1)));
                
                // Radial pressure rise scales with RPM^2
                const p_rad = basePressure + 0.45 * r_norm * rpmFactor;
                
                let p_blade = 0;
                let cavitationDrop = 0;
                let wakeEffect = 0;

                if (baseCurve && Z_blades > 0 && r >= r1 * 0.8) {
                    const vertexTheta = Math.atan2(y, x);
                    const bTheta = getBladeTheta(r, baseCurve);
                    
                    let dTheta = vertexTheta - bTheta;
                    dTheta = (dTheta % pitch + pitch) % pitch;
                    const f = dTheta / pitch; 

                    const envelope = Math.sqrt(r_norm); 
                    
                    // Blade pressure differential scales with RPM^2
                    p_blade = 0.45 * envelope * (0.5 - f) * rpmFactor;

                    // Pulsating Cavitation scales with RPM^2
                    if (r_norm < 0.35 && f > 0.6) {
                        const cav_intensity = (1.0 - r_norm/0.35) * ((f - 0.6) / 0.4);
                        cavitationDrop = 0.85 * cav_intensity * rpmFactor; 
                        
                        const shedding = 0.15 * Math.sin(currentRotation * Z_blades * 4.0);
                        cavitationDrop += shedding * cav_intensity * rpmFactor;
                    }
                    
                    // Rotor-Stator Interaction (Volute Tongue)
                    const relativeTongueTheta = voluteTongueTheta - currentRotation;
                    let distToTongueAng = (vertexTheta - relativeTongueTheta) % (2*PI);
                    if (distToTongueAng < 0) distToTongueAng += 2*PI;
                    
                    if (r_norm > 0.75) {
                        if (distToTongueAng < 0.4 || distToTongueAng > (2*PI - 0.4)) {
                            const tongueProximity = (r_norm - 0.75) / 0.25;
                            const pulse = 0.25 * Math.cos(distToTongueAng * 1.5) * Math.sin(currentRotation * Z_blades);
                            wakeEffect = pulse * tongueProximity * rpmFactor;
                        }
                    }
                }
                t = p_rad + p_blade - cavitationDrop + wakeEffect;
            }
        } else if (domain === 'volute') {
            let normY = dischargeL > 0 ? Math.max(0, y / dischargeL) : 0;
            // Base pressure + Impeller exit pressure rise + Diffuser conversion
            t = basePressure + 0.45 * rpmFactor + 0.25 * normY * rpmFactor;
            
            const vertexTheta = Math.atan2(y, x);
            const swirlOffset = (r - r2) * 1.5; 
            let dTheta = vertexTheta - currentRotation - swirlOffset;
            dTheta = (dTheta % pitch + pitch) % pitch;
            const f = dTheta / pitch;
            
            const r_norm_vol = Math.max(0, (r - r2) / (r2 * 0.8));
            if (r_norm_vol < 1.0) {
                const decay = Math.pow(1.0 - r_norm_vol, 2.0);
                const wake = 0.3 * decay * Math.sin(f * 2.0 * PI);
                t += wake * rpmFactor;
            }
            
            // Academic Transient Feature: Bulk Flow Pulsation in Discharge
            // Create visible pressure waves traveling outwards along the discharge pipe (+Y direction)
            if (normY > 0.05) {
                // Wave formula: sin( spatial_freq * distance - temporal_freq * time )
                const flowPulse = 0.15 * Math.sin(normY * 20.0 - currentRotation * Z_blades * 1.5);
                const pipeFactor = Math.min(1.0, (normY - 0.05) * 4.0); // Smooth fade-in from volute to pipe
                t += flowPulse * pipeFactor * rpmFactor;
            }
        }

        const c = getJetColor(t);
        colors[i*3] = c.r;
        colors[i*3+1] = c.g;
        colors[i*3+2] = c.b;
    }
    
    colorAttr.needsUpdate = true;
}
// Generate a single blade profile curve
function generateBladeCurve(r1, r2, beta1_deg, beta2_deg, numPoints = 100) {
    const blade = [];
    const beta1 = deg2rad(beta1_deg);
    const beta2 = deg2rad(beta2_deg);
    
    let r = r1;
    const dr = (r2 - r1) / (numPoints - 1);
    let theta = 0.0;
    
    for (let i = 0; i < numPoints; i++) {
        r = r1 + i * dr;
        blade.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), r: r, theta: theta });
        
        if (i < numPoints - 1) {
            const t = (r - r1) / (r2 - r1);
            const beta = beta1 + t * (beta2 - beta1);
            const dtheta = dr / (r * Math.tan(beta));
            theta -= dtheta; // Mirrored curvature (backward curved blades)
        }
    }
    return blade;
}

function rotatePoint(p, angleRad) {
    return {
        x: p.x * Math.cos(angleRad) - p.y * Math.sin(angleRad),
        y: p.x * Math.sin(angleRad) + p.y * Math.cos(angleRad)
    };
}

// --- 2D RENDERING LOGIC ---
function render2D() {
    const Ds = parseFloat(document.getElementById('Ds').value);
    const Dh = parseFloat(document.getElementById('Dh').value);
    const D2 = parseFloat(document.getElementById('D2').value);
    const beta1 = parseFloat(document.getElementById('beta1').value);
    const beta2 = parseFloat(document.getElementById('beta2').value);
    const Z = parseInt(document.getElementById('Z').value);

    const r1 = Ds / 2.0; 
    const r2 = D2 / 2.0;

    const baseBladeCurve = generateBladeCurve(r1, r2, beta1, beta2, 50);
    const datasets = [];

    // Add blades
    for (let k = 0; k < Z; k++) {
        const angleOffset = k * (2.0 * Math.PI / Z) + currentRotation;
        const rotatedBlade = baseBladeCurve.map(p => rotatePoint(p, angleOffset));
        
        datasets.push({
            label: `Blade ${k + 1}`,
            data: rotatedBlade,
            borderColor: '#2563eb',
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            showLine: true
        });
    }

    // Add inner and outer circles for reference
    const innerCircle = [];
    const outerCircle = [];
    for(let i=0; i<=100; i++) {
        const ang = i * 2 * Math.PI / 100;
        innerCircle.push({x: r1 * Math.cos(ang), y: r1 * Math.sin(ang)});
        outerCircle.push({x: r2 * Math.cos(ang), y: r2 * Math.sin(ang)});
    }

    datasets.push({
        label: 'Inner Radius',
        data: innerCircle,
        borderColor: '#94a3b8',
        borderDash: [5, 5],
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        showLine: true
    });

    datasets.push({
        label: 'Outer Radius',
        data: outerCircle,
        borderColor: '#94a3b8',
        borderDash: [5, 5],
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        showLine: true
    });

    // Volute Generation
    const showVolute = document.getElementById('showVolute').checked;
    if (showVolute) {
        const voluteD = parseFloat(document.getElementById('voluteD').value);
        const r3 = r2 * 1.05; 
        const volutePoints = [];
        const numVolutePoints = 150;
        
        for (let i = 0; i <= numVolutePoints; i++) {
            const theta = i * (2 * Math.PI / numVolutePoints);
            const r_volute = r3 + (theta / (2 * Math.PI)) * voluteD;
            volutePoints.push({
                x: r_volute * Math.cos(theta),
                y: r_volute * Math.sin(theta)
            });
        }

        datasets.push({
            label: 'Volute',
            data: volutePoints,
            borderColor: '#ef4444', 
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            showLine: true
        });
    }

    window.currentDatasets = datasets;

    const ctx = document.getElementById('impellerChart').getContext('2d');
    let maxVal = r2 * 1.1;
    if (showVolute) {
        const voluteD = parseFloat(document.getElementById('voluteD').value);
        const r3 = r2 * 1.05;
        maxVal = r3 + voluteD * 1.1; 
    }

    if (impellerChart) {
        impellerChart.data.datasets = datasets;
        impellerChart.options.scales.x.min = -maxVal;
        impellerChart.options.scales.x.max = maxVal;
        impellerChart.options.scales.y.min = -maxVal;
        impellerChart.options.scales.y.max = maxVal;
        impellerChart.update('none');
    } else {
        impellerChart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'center',
                        min: -maxVal,
                        max: maxVal,
                        grid: { color: '#e2e8f0' }
                    },
                    y: {
                        type: 'linear',
                        position: 'center',
                        min: -maxVal,
                        max: maxVal,
                        grid: { color: '#e2e8f0' }
                    }
                }
            }
        });
    }
}

// --- 3D RENDERING LOGIC ---
function init3D() {
    const container = document.getElementById('canvas3d');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b); // Dark slate background for premium look
    
    // Add grid and axes (subtle)
    const gridHelper = new THREE.GridHelper(1000, 20, 0x475569, 0x334155);
    gridHelper.rotation.x = Math.PI / 2; // Make it XY plane
    scene.add(gridHelper);
    
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 5000);
    camera.position.set(0, 0, 800);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    // Tone mapping for realistic lighting
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Realistic Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(500, 500, 1000);
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.6); // slight blueish fill
    fillLight.position.set(-500, -500, -500);
    scene.add(fillLight);

    // Light attached to camera to illuminate wherever we look
    const camLight = new THREE.PointLight(0xffffff, 0.5);
    camera.add(camLight);
    scene.add(camera);

    impellerGroup = new THREE.Group();
    scene.add(impellerGroup);
    
    // Resize handler
    window.addEventListener('resize', () => {
        if (is3DMode && container.clientWidth > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });

    animate3D();
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (is3DMode) {
        controls.update();
        renderer.render(scene, camera);
    }
}

function render3D() {
    if (!scene) init3D();

    const Ds = parseFloat(document.getElementById('Ds').value);
    const Dh = parseFloat(document.getElementById('Dh').value);
    const D2 = parseFloat(document.getElementById('D2').value);
    const b2 = parseFloat(document.getElementById('b2').value);
    const beta1 = parseFloat(document.getElementById('beta1').value);
    const beta2 = parseFloat(document.getElementById('beta2').value);
    const Z = parseInt(document.getElementById('Z').value);
    const showVolute = document.getElementById('showVolute').checked;
    const voluteD = parseFloat(document.getElementById('voluteD').value);
    const suctionL = parseFloat(document.getElementById('suctionL').value);
    const dischargeL = parseFloat(document.getElementById('dischargeL').value);

    const r1 = Ds / 2.0; 
    const r2 = D2 / 2.0;
    
    // Clear old geometry
    while(impellerGroup.children.length > 0){ 
        impellerGroup.remove(impellerGroup.children[0]); 
    }
    if (voluteMesh) scene.remove(voluteMesh);
    if (suctionPipe) scene.remove(suctionPipe);
    if (dischargePipe) scene.remove(dischargePipe);

    // CFD State
    const cfdToggle = document.getElementById('cfdMode');
    const isCFD = cfdToggle ? cfdToggle.checked : false;
    
    // Update CFD HUD
    const cfdHUD = document.getElementById('cfdHUD');
    if (cfdHUD) {
        if (isCFD && is3DMode) {
            cfdHUD.classList.remove('hidden');
            const rpmVal = parseFloat(document.getElementById('rpm').value) || 0;
            document.getElementById('hudRPM').innerText = rpmVal;

            const omega = rpmVal * Math.PI / 30.0;
            const r1_m = r1 / 1000.0;
            const r2_m = r2 / 1000.0;

            const v_max = omega * r2_m;
            const dp_pa = 0.5 * 997 * omega * omega * (r2_m * r2_m - r1_m * r1_m);
            const dp_bar = dp_pa / 100000.0;

            document.getElementById('hudVel').innerText = v_max.toFixed(2) + ' m/s';
            document.getElementById('hudPres').innerText = dp_bar.toFixed(3) + ' bar';
            document.getElementById('hudPresMax').innerText = dp_bar.toFixed(2) + ' bar';
        } else {
            cfdHUD.classList.add('hidden');
        }
    }

    // High-Quality Realistic Materials
    const impellerMat = new THREE.MeshStandardMaterial({ 
        color: 0xcd7f32,
        metalness: 0.8,
        roughness: 0.25,
        side: THREE.DoubleSide
    });

    const fluidMat = isCFD 
        ? new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.3,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1.0,
            depthWrite: true
        })
        : new THREE.MeshStandardMaterial({  
            color: 0x0ea5e9, 
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false 
        });

    // 1. Build Blades (Thick extruded shape)
    const baseCurve = generateBladeCurve(r1, r2, beta1, beta2, 50);
    const bladeShape = new THREE.Shape();
    
    // Draw forward curve
    bladeShape.moveTo(baseCurve[0].x, baseCurve[0].y);
    for (let i = 1; i < baseCurve.length; i++) {
        bladeShape.lineTo(baseCurve[i].x, baseCurve[i].y);
    }
    // Draw backward curve (offset angle to simulate 4mm thickness)
    for (let i = baseCurve.length - 1; i >= 0; i--) {
        const pt = baseCurve[i];
        const offsetAng = 4.0 / pt.r; // 4mm thickness
        const nx = pt.r * Math.cos(pt.theta + offsetAng);
        const ny = pt.r * Math.sin(pt.theta + offsetAng);
        bladeShape.lineTo(nx, ny);
    }
    
    const extrudeSettings = { depth: b2, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.5, bevelThickness: 0.5 };
    const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);

    for (let k = 0; k < Z; k++) {
        const mesh = new THREE.Mesh(bladeGeometry, impellerMat);
        mesh.rotation.z = k * (2.0 * Math.PI / Z);
        impellerGroup.add(mesh);
    }

    // 2. Hub (Back Plate)
    // Subtracting inner hole for the shaft
    const shaftRadius = r1 * 0.4; // approximate shaft size
    const hubGeom = new THREE.CylinderGeometry(r2, r2, 4, 64, 1, false);
    const hubMesh = new THREE.Mesh(hubGeom, impellerMat);
    hubMesh.rotation.x = Math.PI / 2;
    hubMesh.position.z = -2; // back plate
    impellerGroup.add(hubMesh);

    // Note: Front plate (shroud) removed per user request for better visibility
    // of the spinning blades.

    // 2.5 Impeller Fluid Domain (Central fluid covering the impeller)
    const r3 = r2 * 1.05;
    const iFluidHeight = b2 + 0.2; 
    
    // Group to hold the fluid, added to impellerGroup so it rotates with the blades!
    const iFluidGroup = new THREE.Group();
    iFluidGroup.name = 'iFluidGroup';

    // Wall (Outer edge)
    const iFluidWallGeom = new THREE.CylinderGeometry(r3, r3, iFluidHeight, 128, 4, true);
    iFluidWallGeom.rotateX(Math.PI / 2);
    iFluidWallGeom.translate(0, 0, b2 / 2);
    if (isCFD) applyCFDColors(iFluidWallGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);
    const iFluidWall = new THREE.Mesh(iFluidWallGeom, fluidMat);
    iFluidGroup.add(iFluidWall);

    // Top Cap (Dense ring for CFD visualization)
    const iFluidTopGeom = new THREE.RingGeometry(0.001, r3, 128, 32);
    iFluidTopGeom.translate(0, 0, b2 + 0.1);
    if (isCFD) applyCFDColors(iFluidTopGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);
    const iFluidTop = new THREE.Mesh(iFluidTopGeom, fluidMat);
    iFluidGroup.add(iFluidTop);

    // Bottom Cap
    const iFluidBotGeom = new THREE.RingGeometry(0.001, r3, 128, 32);
    iFluidBotGeom.translate(0, 0, -0.1);
    if (isCFD) applyCFDColors(iFluidBotGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);
    const iFluidBot = new THREE.Mesh(iFluidBotGeom, fluidMat);
    iFluidGroup.add(iFluidBot);

    // Add to impellerGroup to spin with blades!
    impellerGroup.add(iFluidGroup);
    
    // 3. Volute Fluid Domain (Smooth Circular Cross-Section)
    if (showVolute) {
        const r3 = r2 * 1.05;
        const voluteB = b2; 
        
        // Vastly increased resolution for buttery smooth surface
        const numTheta = 120;
        const numProfile = 48; 
        
        const vertices = [];
        const indices = [];
        
        // --- A. Sweep the Volute Spiral (Circular Profile) ---
        for (let i = 0; i <= numTheta; i++) {
            const t = i / numTheta;
            const theta = t * 2 * Math.PI;
            
            // Volute cross-section radius grows linearly
            const R_c = (voluteB / 2.0) + t * (voluteD / 2.0 - voluteB / 2.0);
            const r_center = r3 + R_c;
            const z_center = voluteB / 2.0;
            
            // Build Circular profile for this angle
            const profilePts = [];
            for(let j=0; j<numProfile; j++) {
                const angle = (j / numProfile) * 2 * Math.PI;
                profilePts.push({
                    r: r_center + R_c * Math.cos(angle),
                    z: z_center + R_c * Math.sin(angle)
                });
            }
            
            // Map 2D profile to 3D space
            for(let j=0; j<numProfile; j++) {
                const p = profilePts[j];
                const x = p.r * Math.cos(theta);
                const y = p.r * Math.sin(theta);
                vertices.push(x, y, p.z);
            }
        }
        
        // --- B. Extrude the Discharge Nozzle (Straight UP) ---
        const nozzleSteps = 25;
        const baseIdx = numTheta * numProfile;
        const baseProfile = [];
        
        // Extract the very last ring (theta = 2PI), which is already a perfect circle!
        for(let j=0; j<numProfile; j++) {
            const vx = vertices[(baseIdx + j)*3];
            const vy = vertices[(baseIdx + j)*3 + 1];
            const vz = vertices[(baseIdx + j)*3 + 2];
            baseProfile.push({x: vx, z: vz}); // at 2PI, y is 0
        }
        
        for (let k = 1; k <= nozzleSteps; k++) {
            const y_offset = (k / nozzleSteps) * dischargeL;
            for(let j=0; j<numProfile; j++) {
                const bp = baseProfile[j];
                // Nozzle goes upwards (+Y direction)
                vertices.push(bp.x, y_offset, bp.z);
            }
        }
        
        // --- C. Build Mesh Faces (Indices) ---
        const totalRings = numTheta + nozzleSteps;
        for (let i = 0; i < totalRings; i++) {
            for (let j = 0; j < numProfile; j++) {
                const next_j = (j + 1) % numProfile;
                const a = i * numProfile + j;
                const b = i * numProfile + next_j;
                const c = (i + 1) * numProfile + j;
                const d = (i + 1) * numProfile + next_j;
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
        }
        
        // Cap the top of the discharge nozzle
        const topCenterIdx = vertices.length / 3;
        const final_R_c = voluteD / 2.0;
        const final_r_center = r3 + final_R_c;
        vertices.push(final_r_center, dischargeL, voluteB/2.0); 
        const topRingIdx = totalRings * numProfile;
        for (let j = 0; j < numProfile; j++) {
            const next_j = (j + 1) % numProfile;
            indices.push(topRingIdx + j, topCenterIdx, topRingIdx + next_j);
        }
        
        // (Tongue cap removed so fluid merges seamlessly without internal walls)

        const vGeom = new THREE.BufferGeometry();
        vGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        vGeom.setIndex(indices);
        vGeom.computeVertexNormals();
        
        if (isCFD) applyCFDColors(vGeom, 'volute', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);

        voluteMesh = new THREE.Mesh(vGeom, fluidMat);
        scene.add(voluteMesh);
    }

    // 4. Suction Pipe Fluid Domain (Water entering)
    // Transform BEFORE coloring so vertices are in correct space for calculate
    const sGeom = new THREE.CylinderGeometry(r1, r1, suctionL, 32);
    sGeom.rotateX(Math.PI / 2);
    sGeom.translate(0, 0, (b2 + 0.2) + suctionL/2);
    if (isCFD) applyCFDColors(sGeom, 'suction', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);
    const sPipeMesh = new THREE.Mesh(sGeom, fluidMat);
    
    suctionPipe = new THREE.Group();
    suctionPipe.add(sPipeMesh);
    scene.add(suctionPipe);
}


function updateVisuals() {
    if (!document.getElementById('animateImpeller').checked) {
        currentRotation = 0;
    }
    
    if (is3DMode) {
        render3D();
    } else {
        render2D();
    }
}

let lastTime = 0;

function animationLoop(timestamp) {
    // If called manually or via an event listener, timestamp won't be a valid DOMHighResTimeStamp
    if (typeof timestamp !== 'number') {
        timestamp = performance.now();
    }

    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (document.getElementById('animateImpeller').checked) {
        const rpm = parseFloat(document.getElementById('rpm').value) || 0;
        const visualScaleFactor = 0.05; // Slow down high RPMs so they don't just blur
        
        // Calculate radians to rotate based on real elapsed time (deltaTime in ms)
        const radPerSec = (rpm / 60.0) * 2.0 * Math.PI * visualScaleFactor;
        const radPerDelta = radPerSec * (deltaTime / 1000.0);
        
        currentRotation += radPerDelta;
        
        if (is3DMode && impellerGroup) {
            impellerGroup.rotation.z = currentRotation;
            
            // TRANSIENT CFD: Update colors dynamically every frame
            const cfdToggle = document.getElementById('cfdMode');
            if (cfdToggle && cfdToggle.checked) {
                const Ds = parseFloat(document.getElementById('Ds').value);
                const D2 = parseFloat(document.getElementById('D2').value);
                const r1 = Ds / 2.0; 
                const r2 = D2 / 2.0;
                const dischargeL = parseFloat(document.getElementById('dischargeL').value);
                const Z = parseInt(document.getElementById('Z').value);
                const beta1 = parseFloat(document.getElementById('beta1').value);
                const beta2 = parseFloat(document.getElementById('beta2').value);
                const rpm = parseFloat(document.getElementById('rpm').value) || 1500;
                
                const baseCurve = generateBladeCurve(r1, r2, beta1, beta2, 50);
                
                // Update specific meshes efficiently without traverse overhead
                if (voluteMesh && voluteMesh.geometry) {
                    applyCFDColors(voluteMesh.geometry, 'volute', r1, r2, dischargeL, baseCurve, Z, rpm);
                }
                
                if (impellerGroup) {
                    impellerGroup.children.forEach(child => {
                        if (child.name === 'iFluidGroup') {
                            child.children.forEach(fluidMesh => {
                                if (fluidMesh.geometry) {
                                    applyCFDColors(fluidMesh.geometry, 'impeller', r1, r2, dischargeL, baseCurve, Z, rpm);
                                }
                            });
                        }
                    });
                }
            }
        } else {
            render2D();
        }
        
        animationId = requestAnimationFrame(animationLoop);
    } else {
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        lastTime = 0;
        currentRotation = 0;
        if (is3DMode && impellerGroup) impellerGroup.rotation.z = 0;
        else render2D();
    }
}

// UI Listeners
document.getElementById('view2dBtn').addEventListener('click', () => {
    is3DMode = false;
    document.getElementById('view2dBtn').style.backgroundColor = '#2563eb';
    document.getElementById('view3dBtn').style.backgroundColor = '#94a3b8';
    document.getElementById('impellerChart').style.display = 'block';
    document.getElementById('canvas3d').style.display = 'none';
    updateVisuals();
});

document.getElementById('view3dBtn').addEventListener('click', () => {
    is3DMode = true;
    document.getElementById('view3dBtn').style.backgroundColor = '#2563eb';
    document.getElementById('view2dBtn').style.backgroundColor = '#94a3b8';
    document.getElementById('impellerChart').style.display = 'none';
    document.getElementById('canvas3d').style.display = 'block';
    // Trigger resize to fix initial canvas size
    window.dispatchEvent(new Event('resize'));
    updateVisuals();
});

document.querySelectorAll('input').forEach(input => {
    if (input.id !== 'animateImpeller') {
        input.addEventListener('change', updateVisuals);
    }
});

document.getElementById('animateImpeller').addEventListener('change', () => {
    if (document.getElementById('animateImpeller').checked) {
        if (!animationId) animationLoop();
    } else {
        // Handled inside loop
    }
});

// Update button just calls updateVisuals
document.getElementById('updateBtn').addEventListener('click', updateVisuals);

document.getElementById('exportBtn').addEventListener('click', () => {
    if (!window.currentDatasets) return;
    let csvContent = "Group,Point,X,Y,Z\n";
    let groupNum = 1;
    window.currentDatasets.forEach(dataset => {
        if (dataset.label.startsWith('Blade') || dataset.label === 'Volute') {
            dataset.data.forEach((point, index) => {
                csvContent += `${groupNum},${index + 1},${point.x.toFixed(4)},${point.y.toFixed(4)},0.0\n`;
            });
            groupNum++;
        }
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "pump_geometry_ansys.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Initial draw
updateVisuals();

// Auto-start animation if checkbox is checked on load
if (document.getElementById('animateImpeller').checked && !animationId) {
    animationLoop(performance.now());
}
