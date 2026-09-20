from pathlib import Path


path = Path(__file__).resolve().parents[2] / "build" / "cfd_engine.js"
source = path.read_text(encoding="utf-8")
old_prefix = 'var Module=typeof Module!="undefined"?Module:{};'
new_prefix = 'var Module=globalThis.PumpCFDModule||{};globalThis.PumpCFDModule=Module;'

if old_prefix in source:
    source = source.replace(old_prefix, new_prefix, 1)

getter_marker = "Object.defineProperty(Module, 'HEAPU8'"
if getter_marker not in source:
    post = (Path(__file__).with_name("wasm_post.js")).read_text(encoding="utf-8")
    source = source.rstrip() + "\n" + post
elif "globalThis.PumpCFDModule = Module;" not in source:
    source = source.rstrip() + "\nglobalThis.PumpCFDModule = Module;\n"

path.write_text(source, encoding="utf-8")
print(path)
