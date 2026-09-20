// This runs inside the Emscripten module closure and exposes the current heap
// view. The getter remains valid after ALLOW_MEMORY_GROWTH replaces the view.
Object.defineProperty(Module, 'HEAPU8', {
    configurable: true,
    get: function () { return HEAPU8; }
});
globalThis.PumpCFDModule = Module;
