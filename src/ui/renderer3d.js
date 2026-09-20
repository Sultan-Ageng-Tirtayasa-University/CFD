function init3D() {
    const container = document.getElementById('canvas3d');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x102236);
    camera = new THREE.PerspectiveCamera(42, Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1), 0.5, 6000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.replaceChildren(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x17202d, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(350, -250, 500);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6eb8ff, 0.7);
    fill.position.set(-300, 250, -180);
    scene.add(fill);

    const grid = new THREE.GridHelper(800, 24, 0x36526d, 0x233a50);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -5;
    scene.add(grid);
    const axes = new THREE.AxesHelper(80);
    scene.add(axes);

    impellerGroup = new THREE.Group();
    scene.add(impellerGroup);

    window.addEventListener('resize', resize3D);
    animate3D();
}

function resize3D() {
    const container = document.getElementById('canvas3d');
    if (!renderer || !camera || !container || container.clientWidth <= 0) return;
    camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, Math.max(container.clientHeight, 1));
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (is3DMode && renderer && scene && camera) {
        controls.update();
        renderer.render(scene, camera);
    }
}

function disposeObject(object) {
    if (!object) return;
    object.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => material.dispose());
        }
    });
    if (object.parent) object.parent.remove(object);
}

function makeRingGeometry(innerRadius, outerRadius, thickness) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 96 });
}

function render3D() {
    if (!scene) init3D();

    const D1 = Number(document.getElementById('D1').value);
    const Dh = Number(document.getElementById('Dh').value);
    const D2 = Number(document.getElementById('D2').value);
    const b2 = Number(document.getElementById('b2').value);
    const bladeThickness = Number(document.getElementById('bladeThickness').value);
    const beta1 = Number(document.getElementById('beta1').value);
    const beta2 = Number(document.getElementById('beta2').value);
    const Z = Number(document.getElementById('Z').value);
    const suctionDN = Number(document.getElementById('suctionDN').value);
    const dischargeDN = Number(document.getElementById('dischargeDN').value);
    const interfaceDiameter = Number(document.getElementById('rotorInterface').value);
    const startWidth = Number(document.getElementById('voluteStartWidth').value);
    const endWidth = Number(document.getElementById('voluteEndWidth').value);
    const suctionL = Number(document.getElementById('suctionL').value);
    const dischargeL = Number(document.getElementById('dischargeL').value);
    const showVolute = document.getElementById('showVolute').checked;
    const isContour = document.getElementById('cfdMode').checked;
    const r1 = D1 / 2;
    const r2 = D2 / 2;
    const ri = interfaceDiameter / 2;
    const shroudThickness = Math.max(2.5, bladeThickness * 0.75);

    while (impellerGroup.children.length) disposeObject(impellerGroup.children[0]);
    disposeObject(voluteMesh); voluteMesh = null;
    disposeObject(suctionPipe); suctionPipe = null;
    disposeObject(dischargePipe); dischargePipe = null;

    const bronze = new THREE.MeshStandardMaterial({ color: 0xc8752d, metalness: 0.78, roughness: 0.28, side: THREE.DoubleSide });
    const shroudGlass = new THREE.MeshStandardMaterial({ color: 0xdca061, metalness: 0.55, roughness: 0.35, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
    const rotorFluid = new THREE.MeshPhysicalMaterial({ color: 0x3b93d1, transparent: true, opacity: isContour ? 0.28 : 0.16, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false });
    const statorFluid = new THREE.MeshPhysicalMaterial({ color: 0x30a789, transparent: true, opacity: isContour ? 0.55 : 0.28, roughness: 0.18, side: THREE.DoubleSide, depthWrite: false });
    const inletFluid = new THREE.MeshPhysicalMaterial({ color: 0x55a9e5, transparent: true, opacity: 0.3, roughness: 0.12, side: THREE.DoubleSide, depthWrite: false });

    const baseCurve = generateBladeCurve(r1, r2, beta1, beta2, 72);
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(baseCurve[0].x, baseCurve[0].y);
    for (let i = 1; i < baseCurve.length; i++) bladeShape.lineTo(baseCurve[i].x, baseCurve[i].y);
    for (let i = baseCurve.length - 1; i >= 0; i--) {
        const point = baseCurve[i];
        const offset = bladeThickness / Math.max(point.r, 1);
        bladeShape.lineTo(point.r * Math.cos(point.theta + offset), point.r * Math.sin(point.theta + offset));
    }
    bladeShape.closePath();
    const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: b2, bevelEnabled: false, steps: 1 });
    for (let k = 0; k < Z; k++) {
        const blade = new THREE.Mesh(bladeGeometry, bronze);
        blade.rotation.z = k * Math.PI * 2 / Z;
        impellerGroup.add(blade);
    }

    const backPlateGeometry = new THREE.CylinderGeometry(r2, r2, shroudThickness, 96);
    backPlateGeometry.rotateX(Math.PI / 2);
    backPlateGeometry.translate(0, 0, -shroudThickness / 2);
    impellerGroup.add(new THREE.Mesh(backPlateGeometry, bronze));

    const hubGeometry = new THREE.CylinderGeometry(Dh / 2, Dh / 2, b2, 64);
    hubGeometry.rotateX(Math.PI / 2);
    hubGeometry.translate(0, 0, b2 / 2);
    impellerGroup.add(new THREE.Mesh(hubGeometry, bronze));

    const frontShroud = new THREE.Mesh(makeRingGeometry(suctionDN / 2, r2, shroudThickness), shroudGlass);
    frontShroud.position.z = b2;
    impellerGroup.add(frontShroud);

    const rotatingZoneGeometry = new THREE.CylinderGeometry(ri, ri, b2 + 2 * shroudThickness, 96, 1, true);
    rotatingZoneGeometry.rotateX(Math.PI / 2);
    rotatingZoneGeometry.translate(0, 0, b2 / 2);
    impellerGroup.add(new THREE.Mesh(rotatingZoneGeometry, rotorFluid));

    if (showVolute) {
        const rings = 144;
        const profile = 40;
        const vertices = [];
        const indices = [];
        for (let i = 0; i <= rings; i++) {
            const t = i / rings;
            const theta = t * Math.PI * 2;
            const sectionRadius = (startWidth + t * (endWidth - startWidth)) / 2;
            const centerRadius = ri + sectionRadius;
            for (let j = 0; j < profile; j++) {
                const a = j * Math.PI * 2 / profile;
                const radial = centerRadius + sectionRadius * Math.cos(a);
                vertices.push(radial * Math.cos(theta), radial * Math.sin(theta), b2 / 2 + sectionRadius * Math.sin(a));
            }
        }
        for (let i = 0; i < rings; i++) {
            for (let j = 0; j < profile; j++) {
                const next = (j + 1) % profile;
                const a = i * profile + j;
                const b = i * profile + next;
                const c = (i + 1) * profile + j;
                const d = (i + 1) * profile + next;
                indices.push(a, b, d, a, d, c);
            }
        }
        const voluteGeometry = new THREE.BufferGeometry();
        voluteGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        voluteGeometry.setIndex(indices);
        voluteGeometry.computeVertexNormals();
        voluteMesh = new THREE.Mesh(voluteGeometry, statorFluid);
        scene.add(voluteMesh);

        const outletX = ri + endWidth / 2;
        const outletGeometry = new THREE.CylinderGeometry(dischargeDN / 2, dischargeDN / 2, dischargeL, 64, 1, true);
        outletGeometry.translate(outletX, dischargeL / 2, b2 / 2);
        dischargePipe = new THREE.Mesh(outletGeometry, statorFluid.clone());
        scene.add(dischargePipe);
    }

    const suctionGeometry = new THREE.CylinderGeometry(suctionDN / 2, suctionDN / 2, suctionL, 64, 1, true);
    suctionGeometry.rotateX(Math.PI / 2);
    suctionGeometry.translate(0, 0, b2 + shroudThickness + suctionL / 2);
    suctionPipe = new THREE.Mesh(suctionGeometry, inletFluid);
    scene.add(suctionPipe);

    impellerGroup.rotation.z = currentRotation;
    const extent = Math.max(2 * (ri + endWidth), dischargeL, suctionL);
    camera.position.set(extent * 0.75, -extent * 1.05, extent * 0.72);
    controls.target.set(0, Math.min(dischargeL * 0.18, 60), Math.min(suctionL * 0.16, 55));
    controls.update();
    resize3D();

    const hud = document.getElementById('cfdHUD');
    hud.classList.toggle('hidden', !(isContour && is3DMode));
}
