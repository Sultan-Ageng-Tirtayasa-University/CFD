// Keep the generated Emscripten module reachable by the application.
Module = globalThis.PumpCFDModule || Module || {};
globalThis.PumpCFDModule = Module;
