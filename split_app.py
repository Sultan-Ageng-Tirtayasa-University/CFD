import os
import shutil

dirs = ['src/solver', 'src/geometry', 'src/ui', 'build', 'docs']
for d in dirs:
    os.makedirs(d, exist_ok=True)

if os.path.exists('cfd_engine.cpp'):
    shutil.move('cfd_engine.cpp', 'src/solver/cfd_engine.cpp')

with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

content_globals = '''// Global State Variables
let impellerChart = null;
let currentRotation = 0;
let animationId = null;
let is3DMode = false;
let scene, camera, renderer, controls;
let impellerGroup, voluteMesh, suctionPipe, dischargePipe;
let lastTime = 0;
'''

start_math = app_js.find('function deg2rad')
start_2d = app_js.find('// --- 2D RENDERING LOGIC ---')
start_3d = app_js.find('// --- 3D RENDERING LOGIC ---')
start_main = app_js.find('function updateVisuals()')

math_js = app_js[start_math:start_2d]
render2d_js = app_js[start_2d:start_3d]
render3d_js = app_js[start_3d:start_main]
main_js = app_js[start_main:]

with open('src/globals.js', 'w', encoding='utf-8') as f:
    f.write(content_globals)

with open('src/geometry/math_utils.js', 'w', encoding='utf-8') as f:
    f.write('// CFD and Geometry Math Utilities\n' + math_js)

with open('src/ui/chart2d.js', 'w', encoding='utf-8') as f:
    f.write(render2d_js)

with open('src/ui/renderer3d.js', 'w', encoding='utf-8') as f:
    f.write(render3d_js)

with open('src/ui/main.js', 'w', encoding='utf-8') as f:
    f.write('// Main UI Controllers and Loop\n' + main_js)

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_script = '<script src="app.js"></script>'
new_scripts = '''
    <!-- Modularized App Scripts -->
    <script src="src/globals.js"></script>
    <script src="src/geometry/math_utils.js"></script>
    <script src="src/ui/chart2d.js"></script>
    <script src="src/ui/renderer3d.js"></script>
    <script src="src/ui/main.js"></script>
'''

if old_script in html:
    html = html.replace(old_script, new_scripts)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('index.html updated.')
else:
    print('Warning: script not found in index.html.')

if os.path.exists('compile.bat'):
    with open('compile.bat', 'r', encoding='utf-8') as f:
        bat_content = f.read()
    bat_content = bat_content.replace('cfd_engine.cpp', 'src/solver/cfd_engine.cpp')
    bat_content = bat_content.replace('cfd_engine.js', 'build/cfd_engine.js')
    with open('compile.bat', 'w', encoding='utf-8') as f:
        f.write(bat_content)

# Rename old app.js to app_backup.js
os.rename('app.js', 'app_backup.js')

print('Success')
