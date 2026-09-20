from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "release" / "Pump_CFD_Studio_R2.zip"
ARCHIVE_ROOT = Path("Pump_CFD_Studio_R2")

files: list[Path] = [
    ROOT / "index.html",
    ROOT / "style.css",
    ROOT / "README_APP_ID.md",
    ROOT / "start_app.bat",
    ROOT / "serve_app.py",
    ROOT / "cad_model" / "Pump_CFD_CAD_Package_R1.zip",
    ROOT / "cad_model" / "nk65_180" / "Pump_CFD_NK65_180_R2.zip",
    ROOT / "cad_model" / "nk65_180" / "README_CFD_ID.md",
]

for directory in [ROOT / "src", ROOT / "build", ROOT / "vendor"]:
    files.extend(sorted(path for path in directory.rglob("*") if path.is_file()))

files = sorted(set(files), key=lambda path: path.relative_to(ROOT).as_posix())
missing = [str(path) for path in files if not path.is_file()]
if missing:
    raise FileNotFoundError("Missing release files: " + ", ".join(missing))

manifest_lines = []
for path in files:
    relative = path.relative_to(ROOT).as_posix()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    manifest_lines.append(f"{digest}  {relative}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        archive.write(path, (ARCHIVE_ROOT / path.relative_to(ROOT)).as_posix())
    archive.writestr(
        (ARCHIVE_ROOT / "SHA256SUMS.txt").as_posix(),
        "\n".join(manifest_lines) + "\n",
    )

with zipfile.ZipFile(OUTPUT) as archive:
    bad_entry = archive.testzip()
    if bad_entry is not None:
        raise RuntimeError(f"ZIP integrity check failed at {bad_entry}")
    print(OUTPUT)
    print(f"size_bytes={OUTPUT.stat().st_size}")
    print(f"entries={len(archive.namelist())}")
