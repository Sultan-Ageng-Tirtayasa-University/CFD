import sys

with open('app.js', 'r') as f:
    content = f.read()

# 1. Replace applyCFDColors
old_cfd = '''function applyCFDColors(geometry, domain, r1, r2, dischargeL, baseCurve = null, Z_blades = 7) {
    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const PI = Math.PI;
    const pitch = 2.0 * PI / Z_blades;
    const voluteTongueTheta = PI / 2.0; 
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x*x + y*y);

        let t = 0;
        if (domain === 'suction') {
            t = 0.05; 
        } else if (domain === 'impeller') {
            if (r <= r1 * 0.5) {
                t = 0.05; 
            } else if (r > r2 * 1.02) {
                t = 0.75; 
            } else {
                const r_norm = Math.max(0, Math.min(1, (r - r1) / (r2 - r1)));
                const p_rad = 0.2 + 0.45 * r_norm;
                
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
                    p_blade = 0.45 * envelope * (0.5 - f);

                    // Academic Transient Feature: Cavitation Shedding
                    if (r_norm < 0.35 && f > 0.6) {
                        const cav_intensity = (1.0 - r_norm/0.35) * ((f - 0.6) / 0.4);
                        cavitationDrop = 0.85 * cav_intensity; 
                        
                        // Transient pulsation based on global rotation
                        const shedding = 0.1 * Math.sin(currentRotation * Z_blades * 3.0);
                        cavitationDrop += shedding * cav_intensity;
                    }
                    
                    // Academic Transient Feature: Rotor-Stator Interaction (Volute Tongue)
                    const relativeTongueTheta = voluteTongueTheta - currentRotation;
                    let distToTongueAng = (vertexTheta - relativeTongueTheta) % (2*PI);
                    if (distToTongueAng < 0) distToTongueAng += 2*PI;
                    
                    if (r_norm > 0.8) {
                        if (distToTongueAng < 0.5 || distToTongueAng > (2*PI - 0.5)) {
                            const tongueProximity = (r_norm - 0.8) / 0.2;
                            const pulse = 0.15 * Math.cos(distToTongueAng) * Math.sin(currentRotation * Z_blades);
                            wakeEffect = pulse * tongueProximity;
                        }
                    }
                }
                t = p_rad + p_blade - cavitationDrop + wakeEffect;
            }
        } else if (domain === 'volute') {
            let normY = dischargeL > 0 ? Math.max(0, y / dischargeL) : 0;
            t = 0.7 + 0.25 * normY;
            
            // Academic Transient Feature: Wakes hitting volute from blades
            const vertexTheta = Math.atan2(y, x);
            let dTheta = vertexTheta - currentRotation;
            dTheta = (dTheta % pitch + pitch) % pitch;
            const f = dTheta / pitch;
            
            const r_norm_vol = Math.max(0, (r - r2) / (r2 * 0.5));
            if (r_norm_vol < 1.0) {
                const wake = 0.15 * (1.0 - r_norm_vol) * Math.sin(f * 2.0 * PI);
                t += wake;
            }
        }

        const c = getJetColor(t);
        colors[i*3] = c.r;
        colors[i*3+1] = c.g;
        colors[i*3+2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // NOTE: Wasm implementation ready in cfd_engine.cpp. 
    // Once compiled, we will swap this block out to call the Wasm memory pointers directly.
}'''

new_cfd = '''function applyCFDColors(geometry, domain, r1, r2, dischargeL, baseCurve = null, Z_blades = 7, rpm = 1500) {
    const pos = geometry.attributes.position;
    
    // Crucial fix: Do not create a new BufferAttribute every frame, reuse the existing one!
    let colorAttr = geometry.attributes.color;
    if (!colorAttr || colorAttr.count !== pos.count) {
        colorAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
        geometry.setAttribute('color', colorAttr);
    }
    const colors = colorAttr.array;
    
    const PI = Math.PI;
    const pitch = 2.0 * PI / Z_blades;
    const voluteTongueTheta = PI / 2.0; 
    
    // Academic Calibration: Scale dynamic intensity by RPM (normalized around 1500)
    const rpmFactor = Math.max(0.1, Math.min(3.0, rpm / 1500.0));
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const r = Math.sqrt(x*x + y*y);

        let t = 0;
        if (domain === 'suction') {
            t = 0.05; 
        } else if (domain === 'impeller') {
            if (r <= r1 * 0.5) {
                t = 0.05; 
            } else if (r > r2 * 1.02) {
                t = 0.75; 
            } else {
                const r_norm = Math.max(0, Math.min(1, (r - r1) / (r2 - r1)));
                const p_rad = 0.2 + 0.45 * r_norm * rpmFactor;
                
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
                    p_blade = 0.45 * envelope * (0.5 - f) * rpmFactor;

                    // Academic Transient Feature: Pulsating Cavitation
                    if (r_norm < 0.35 && f > 0.6) {
                        const cav_intensity = (1.0 - r_norm/0.35) * ((f - 0.6) / 0.4);
                        cavitationDrop = 0.85 * cav_intensity; 
                        
                        // Shedding pulses based on actual RPM speed!
                        const shedding = 0.15 * Math.sin(currentRotation * Z_blades * 4.0);
                        cavitationDrop += shedding * cav_intensity * rpmFactor;
                    }
                    
                    // Academic Transient Feature: Rotor-Stator Interaction (Volute Tongue)
                    const relativeTongueTheta = voluteTongueTheta - currentRotation;
                    let distToTongueAng = (vertexTheta - relativeTongueTheta) % (2*PI);
                    if (distToTongueAng < 0) distToTongueAng += 2*PI;
                    
                    if (r_norm > 0.75) {
                        if (distToTongueAng < 0.4 || distToTongueAng > (2*PI - 0.4)) {
                            const tongueProximity = (r_norm - 0.75) / 0.25;
                            // Pressure pulse from tongue
                            const pulse = 0.25 * Math.cos(distToTongueAng * 1.5) * Math.sin(currentRotation * Z_blades);
                            wakeEffect = pulse * tongueProximity * rpmFactor;
                        }
                    }
                }
                t = p_rad + p_blade - cavitationDrop + wakeEffect;
            }
        } else if (domain === 'volute') {
            let normY = dischargeL > 0 ? Math.max(0, y / dischargeL) : 0;
            t = 0.65 + 0.3 * normY * rpmFactor;
            
            // Academic Transient Feature: Vortex Shedding / Wake Decay
            const vertexTheta = Math.atan2(y, x);
            
            // Swirl offset: wakes curve backwards as they expand radially
            const swirlOffset = (r - r2) * 1.5; 
            let dTheta = vertexTheta - currentRotation - swirlOffset;
            dTheta = (dTheta % pitch + pitch) % pitch;
            const f = dTheta / pitch;
            
            // Decay quadratically as radius increases
            const r_norm_vol = Math.max(0, (r - r2) / (r2 * 0.8));
            if (r_norm_vol < 1.0) {
                const decay = Math.pow(1.0 - r_norm_vol, 2.0);
                const wake = 0.3 * decay * Math.sin(f * 2.0 * PI);
                t += wake * rpmFactor;
            }
        }

        const c = getJetColor(t);
        colors[i*3] = c.r;
        colors[i*3+1] = c.g;
        colors[i*3+2] = c.b;
    }
    
    colorAttr.needsUpdate = true; // Signal WebGL to re-render
}'''
content = content.replace(old_cfd, new_cfd)

# 2. Replace Animation Loop
old_anim = '''        if (is3DMode && impellerGroup) {
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
                
                // Need base curve for blade theta
                const baseCurve = generateBladeCurve(r1, r2, beta1, beta2, 50);
                
                // Find all CFD meshes and update them
                scene.traverse(child => {
                    if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                        if (child === voluteMesh) {
                            applyCFDColors(child.geometry, 'volute', r1, r2, dischargeL, baseCurve, Z);
                            child.geometry.attributes.color.needsUpdate = true;
                        } else if (child.parent && child.parent.name === 'iFluidGroup') {
                            applyCFDColors(child.geometry, 'impeller', r1, r2, dischargeL, baseCurve, Z);
                            child.geometry.attributes.color.needsUpdate = true;
                        }
                    }
                });
                
                // Suction pipe doesn't change transiently based on rotation in our model, so we can skip it for performance
            }
        } else {
            render2D();
        }'''

new_anim = '''        if (is3DMode && impellerGroup) {
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
        }'''
content = content.replace(old_anim, new_anim)

# 3. Add rpm parameter to initial static calls in render3D
old_static1 = "if (isCFD) applyCFDColors(iFluidWallGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z);"
new_static1 = "if (isCFD) applyCFDColors(iFluidWallGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);"
content = content.replace(old_static1, new_static1)

old_static2 = "if (isCFD) applyCFDColors(iFluidTopGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z);"
new_static2 = "if (isCFD) applyCFDColors(iFluidTopGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);"
content = content.replace(old_static2, new_static2)

old_static3 = "if (isCFD) applyCFDColors(iFluidBotGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z);"
new_static3 = "if (isCFD) applyCFDColors(iFluidBotGeom, 'impeller', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);"
content = content.replace(old_static3, new_static3)

old_static4 = "if (isCFD) applyCFDColors(vGeom, 'volute', r1, r2, dischargeL);"
new_static4 = "if (isCFD) applyCFDColors(vGeom, 'volute', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);"
content = content.replace(old_static4, new_static4)

old_static5 = "if (isCFD) applyCFDColors(sGeom, 'suction', r1, r2, dischargeL, baseCurve, Z);"
new_static5 = "if (isCFD) applyCFDColors(sGeom, 'suction', r1, r2, dischargeL, baseCurve, Z, parseFloat(document.getElementById('rpm').value) || 1500);"
content = content.replace(old_static5, new_static5)

with open('app.js', 'w') as f:
    f.write(content)
print('Done updating CFD animation.')
