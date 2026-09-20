// CFD and Geometry Math Utilities
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

