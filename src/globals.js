// Global State Variables
let impellerChart = null;
let performanceChart = null;
let currentRotation = 0;
let animationId = null;
let is3DMode = false;
let scene, camera, renderer, controls;
let impellerGroup, voluteMesh, suctionPipe, dischargePipe;
let lastTime = 0;

// WebAssembly State
window.wasmInitialized = false;
window.wasmGeometryView = null;
