@echo off
echo Compiling src/solver/cfd_engine.cpp to WebAssembly using Emscripten...
echo Ensure you have activated the emsdk environment (emsdk_env.bat) before running this.

emcc src/solver/cfd_engine.cpp -O3 -s WASM=1 -s EXPORTED_RUNTIME_METHODS=ccall,cwrap -s ALLOW_MEMORY_GROWTH=1 --pre-js src/solver/wasm_pre.js --post-js src/solver/wasm_post.js -o build/cfd_engine.js

if %errorlevel% neq 0 (
    echo.
    echo Compilation FAILED!
    echo Please make sure Emscripten is installed and added to your PATH.
    pause
    exit /b %errorlevel%
)

echo.
echo Compilation SUCCESSFUL! 
echo cfd_engine.wasm and build/cfd_engine.js have been generated.
pause
