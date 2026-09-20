// Read-only diagnostic of the existing Wasm and geometry code.
// Run: node docs/cfd_review_probe.cjs
// This does not run ANSYS, validate pump performance, or change application files.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const wasm = fs.readFileSync(path.join(root, 'build/cfd_engine.wasm'));
const loader = read('build/cfd_engine.js');
const html = read('index.html');
const defaults = {};
for (const match of html.matchAll(/<input\b[^>]*>/g)) {
  const id = /\bid="([^"]+)"/.exec(match[0]);
  const value = /\bvalue="([^"]*)"/.exec(match[0]);
  if (id && value && !(id[1] in defaults)) defaults[id[1]] = value[1];
}
defaults.lbmResolution = '128';
const names = {};
for (const name of ['initLBM','getGeometryPointer','getRhoPointer','getUPointer','getVPointer','stepLBM']) {
  const match = loader.match(new RegExp('Module\\["_' + name + '"\\]=wasmExports\\["([^"]+)"\\]'));
  if (!match) throw new Error('Cannot map Wasm export: ' + name);
  names[name] = match[1];
}
function makeCase(overrides = {}) {
  const params = { ...defaults, ...overrides };
  const res = Number(params.lbmResolution);
  let ex;
  const instance = new WebAssembly.Instance(new WebAssembly.Module(wasm), {a:{a:bytes => {
    try { ex.b.grow(Math.ceil((bytes - ex.b.buffer.byteLength)/65536)); return 1; }
    catch { return 0; }
  }}});
  ex = instance.exports;
  // Constructor and memory names are verified against the checked-in loader.
  ex.c();
  const call = (name,...args) => ex[names[name]](...args);
  call('initLBM',res,res);
  const geometry = new Int32Array(ex.b.buffer,call('getGeometryPointer'),res*res);
  const canvas = { width:res,height:res,getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}
  })};
  const context = vm.createContext({
    window:{wasmInitialized:true,wasmGeometryView:geometry},
    currentRotation:0,
    document:{getElementById:id=>id==='voxelCanvas'?canvas:{value:params[id]}}
  });
  vm.runInContext(read('src/geometry/math_utils.js'),context);
  vm.runInContext(read('src/geometry/voxelizer.js'),context);
  const voxelize = angle => { context.currentRotation=angle; context.updateVoxelPreview(); };
  voxelize(0);
  const arrays = Object.fromEntries(['Rho','U','V'].map(n=>[n,new Float64Array(ex.b.buffer,call('get'+n+'Pointer'),res*res)]));
  return {params,res,geometry,arrays,call,context,voxelize};
}
function metrics(c) {
  let minRho=Infinity,maxRho=-Infinity,maxSpeed=0,mass=0,nonFinite=0,fluidCells=0;
  for (let i=0;i<c.geometry.length;i++) {
    if (c.geometry[i]!==0) continue;
    fluidCells++;
    const rho=c.arrays.Rho[i], speed=Math.hypot(c.arrays.U[i],c.arrays.V[i]);
    if (!Number.isFinite(rho) || !Number.isFinite(speed)) { nonFinite++; continue; }
    minRho=Math.min(minRho,rho); maxRho=Math.max(maxRho,rho);
    maxSpeed=Math.max(maxSpeed,speed); mass+=rho;
  }
  return {fluidCells,minRho,maxRho,maxSpeed,mass,nonFinite};
}
function runProbe({rpm=50,fps=60,steps=600,moving=true,viscosity=defaults.fluidViscosity}) {
  const c=makeCase({rpm:String(rpm),fluidViscosity:String(viscosity)});
  const omega=rpm/60*2*Math.PI*0.05/fps;
  const initial=metrics(c);
  let firstDensityExcursion=null,firstNonFinite=null,angle=0,completedSteps=0;
  for (let s=1;s<=steps;s++) {
    angle+=omega;
    // Match UI: one solver step/frame; geometry update AFTER every second step.
    c.call('stepLBM',0.55,omega,0);
    const m=metrics(c);
    if (firstDensityExcursion===null && (m.minRho<0.9 || m.maxRho>1.1)) firstDensityExcursion=s;
    if (m.nonFinite) { firstNonFinite=s; completedSteps=s; break; }
    if (moving && s%2===0) c.voxelize(angle);
    completedSteps=s;
  }
  // Last geometry update may relabel nodes; compare recorded fields to that mask,
  // as the UI can do. Density is the pre-collision macroscopic output of the solver.
  const last=metrics(c);
  const hash=crypto.createHash('sha256').update(Buffer.from(c.arrays.Rho.buffer,c.arrays.Rho.byteOffset,c.arrays.Rho.byteLength)).digest('hex');
  return {rpm,fps,moving,inputViscosity:Number(viscosity),requestedSteps:steps,completedSteps,
    firstDensityExcursion,firstNonFinite,initial,last,
    fluidMassChangePercent:(last.mass/initial.mass-1)*100,rhoHash:hash};
}
const c=makeCase();
const sizeMm=c.context.window.lbmPhysicalSize;
const r2m=Number(defaults.D2)/2000;
const rLattice=r2m*1000/sizeMm*c.res;
const scaling=[];
for (const rpm of [50,1500]) for (const fps of [30,60,120]) {
  const omega=rpm/60*2*Math.PI*0.05/fps;
  const dx=sizeMm/1000/c.res;
  const dt=0.05/fps;
  const nu=(0.55-0.5)/3*dx*dx/dt;
  scaling.push({rpm,fps,deltaTheta:omega,tipLatticeVelocity:omega*rLattice,
    tipLatticeMach:omega*rLattice*Math.sqrt(3),impliedPhysicalDt:dt,
    impliedPhysicalViscosity:nu,viscosityRatio:nu/Number(defaults.fluidViscosity)});
}
const types=[0,0,0];for (const t of c.geometry) types[t]++;
let boundaryFluidCells=0;
for(let y=0;y<c.res;y++)for(let x=0;x<c.res;x++)if((x===0||y===0||x===c.res-1||y===c.res-1)&&c.geometry[y*c.res+x]===0)boundaryFluidCells++;
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const signature = obj => crypto.createHash('sha256').update(Buffer.from(obj.geometry.buffer,obj.geometry.byteOffset,obj.geometry.byteLength)).digest('hex');
const geometrySensitivity={};
for (const [name,value] of [['Dh','100'],['suctionL','950']]) geometrySensitivity[name]={changedValue:Number(value),maskUnchanged:signature(c)===signature(makeCase({[name]:value}))};
const results={
  generatedAt:new Date().toISOString(),
  scope:'Controlled headless probes of existing Wasm, original geometry functions, and UI scheduling; not an ANSYS run or full browser test.',
  wasmSha256:crypto.createHash('sha256').update(wasm).digest('hex'),
  defaults,duplicateIds:[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))],
  geometry:{sizeMm,spacingMm:sizeMm/(c.res-1),nominalBladeThicknessMm:6,
    bladeThicknessInCells:6/(sizeMm/(c.res-1)),cellTypes:types,boundaryFluidCells,geometrySensitivity},
  scaling,
  probes:[
    runProbe({rpm:0,moving:false}),
    runProbe({rpm:50,moving:false}),
    runProbe({rpm:50}),
    runProbe({rpm:50,viscosity:0.001004}),
    runProbe({rpm:50,fps:30,steps:300}),
    runProbe({rpm:50,fps:120,steps:1200}),
    runProbe({rpm:1500,steps:600})
  ]
};
fs.writeFileSync(path.join(__dirname,'cfd_review_probe_results.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
