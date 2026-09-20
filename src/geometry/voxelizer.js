// CSG and Grid Voxelization for LBM C++ Engine

function updateVoxelPreview() {
    const canvas = document.getElementById('voxelCanvas');
    if (!canvas) return;
    
    const res = parseInt(document.getElementById('lbmResolution').value) || 128;
    
    // Prevent clearing the canvas if size is already correct
    if (canvas.width !== res) canvas.width = res;
    if (canvas.height !== res) canvas.height = res;
    
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(res, res);
    const data = imgData.data;

    // Get Parameters
    const D1 = parseFloat(document.getElementById('D1').value);
    const D2 = parseFloat(document.getElementById('D2').value);
    const r1 = D1 / 2.0;
    const r2 = D2 / 2.0;
    const beta1 = parseFloat(document.getElementById('beta1').value);
    const beta2 = parseFloat(document.getElementById('beta2').value);
    const Z = parseInt(document.getElementById('Z').value);
    const rotorRadius = parseFloat(document.getElementById('rotorInterface').value) / 2.0;
    const voluteStartWidth = parseFloat(document.getElementById('voluteStartWidth').value);
    const voluteEndWidth = parseFloat(document.getElementById('voluteEndWidth').value);
    const dischargeDN = parseFloat(document.getElementById('dischargeDN').value);
    const dischargeL = parseFloat(document.getElementById('dischargeL').value);
    
    // Define physical bounding box for the grid
    // Ensure the box is large enough to contain the volute and discharge
    const max_radius = rotorRadius + voluteEndWidth;
    const physical_size = max_radius * 2.2; // slight padding
    window.lbmPhysicalSize = physical_size;
    
    const baseCurve = generateBladeCurve(r1, r2, beta1, beta2, 50);
    const pitch = 2.0 * Math.PI / Z;
    
    // Impeller thickness in radians (approximate based on radius)
    const bladeThicknessMm = parseFloat(document.getElementById('bladeThickness').value) || 4.0;
    
    for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
            // Map grid (x,y) to physical coordinates (px, py)
            const px = ((x / (res - 1)) - 0.5) * physical_size;
            const py = -((y / (res - 1)) - 0.5) * physical_size; // Flip Y for Cartesian
            
            const r = Math.sqrt(px*px + py*py);
            let theta = Math.atan2(py, px);
            if (theta < 0) theta += 2 * Math.PI;
            
            let cellType = 0; // 0: Fluid
            
            // 1. Check Volute (Stator Boundary)
            const r_inner_volute = rotorRadius;
            const spiral_t = theta / (2 * Math.PI);
            const radialWidth = voluteStartWidth + spiral_t * (voluteEndWidth - voluteStartWidth);
            const r_outer_volute = r_inner_volute + radialWidth;
            
            // Discharge pipe simplified bounding
            let inDischarge = false;
            // The discharge pipe extends upwards at the right side of the volute
            const outletCenterX = r_inner_volute + voluteEndWidth / 2;
            if (Math.abs(px - outletCenterX) <= dischargeDN / 2 && py >= 0 && py <= dischargeL) {
                inDischarge = true;
            }

            if (r > r_outer_volute && !inDischarge) {
                cellType = 1; // Solid Volute Wall
            } else if (r >= r1 && r <= r2) {
            // Check Impeller Blades (Moving Boundary)
                if (Z > 0) {
                    const bTheta = getBladeTheta(r, baseCurve);
                    const angThickness = bladeThicknessMm / r;
                    
                    let relativeTheta = theta - currentRotation;
                    relativeTheta = (relativeTheta % pitch + pitch) % pitch;
                    
                    let bThetaMod = (bTheta % pitch + pitch) % pitch;
                    
                    let dAng = Math.abs(relativeTheta - bThetaMod);
                    if (dAng > pitch / 2) dAng = pitch - dAng;
                    
                    if (dAng <= angThickness / 2.0) {
                        cellType = 2; // Solid Blade
                    }
                }
            } else if (r < r1) {
                cellType = 0;
            }
            
            const cellIndex = y * res + x;

            // --- PHASE 1 COMPLETION: MEMORY INJECTION TO C++ ---
            // If WebAssembly module is loaded and initialized, push this cellType directly into C++ RAM!
            if (window.wasmInitialized && window.wasmGeometryView) {
                window.wasmGeometryView[cellIndex] = cellType;
            }
            
            // Draw pixels based on matrix values for UI Preview
            const idx = cellIndex * 4;
            if (cellType === 0) {
                // Fluid - Dark Blueish
                data[idx] = 15; data[idx+1] = 20; data[idx+2] = 40; data[idx+3] = 255;
            } else if (cellType === 1) {
                // Volute Stator - Gray
                data[idx] = 120; data[idx+1] = 120; data[idx+2] = 130; data[idx+3] = 255;
            } else if (cellType === 2) {
                // Impeller Rotor - Bright Orange/White
                data[idx] = 255; data[idx+1] = 140; data[idx+2] = 0; data[idx+3] = 255;
            }
        }
    }
    
    if (!window.wasmInitialized || !document.getElementById('cfdMode')?.checked) {
        ctx.putImageData(imgData, 0, 0);
    }
}
