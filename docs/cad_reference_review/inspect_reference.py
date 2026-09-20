"""Read-only STEP/DXF inspection; writes diagnostics in this script's directory.

Dependencies: cadquery-ocp-novtk, ezdxf, numpy, matplotlib.
The optional --packages points to an isolated pip --target directory.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--step', required=True)
parser.add_argument('--packages')
args = parser.parse_args()
if args.packages:
    sys.path.insert(0, args.packages)

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from matplotlib.patches import Patch
import ezdxf
from ezdxf import bbox as dxf_bbox
from OCP.STEPControl import STEPControl_Reader
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID, TopAbs_FACE, TopAbs_EDGE, TopAbs_IN
from OCP.TopoDS import TopoDS
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepClass3d import BRepClass3d_SolidClassifier
from OCP.BRepAlgoAPI import BRepAlgoAPI_Section, BRepAlgoAPI_Common
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeFace
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.gp import gp_Pnt, gp_Dir, gp_Pln
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.TDF import TDF_LabelSequence, TDF_Label
from OCP.TDataStd import TDataStd_Name

src = Path(args.step)
out = Path(__file__).resolve().parent
text = src.read_text()
reader = STEPControl_Reader()
status = reader.ReadFile(str(src))
reader.TransferRoots()
root = reader.OneShape()
solids = []
solid_info = []
exp = TopExp_Explorer(root, TopAbs_SOLID)
while exp.More():
    solid = TopoDS.Solid_s(exp.Current())
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(solid, box)
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(solid, props)
    f = TopExp_Explorer(solid, TopAbs_FACE)
    faces = 0
    while f.More():
        faces += 1
        f.Next()
    solid_info.append(dict(index=len(solids), bbox_mm=box.Get(), faces=faces,
                           volume_mm3=props.Mass(), valid=BRepCheck_Analyzer(solid).IsValid()))
    solids.append(solid)
    exp.Next()

# Inspect the assembly tree to identify components, rather than relying on filenames.
doc = TDocStd_Document(TCollection_ExtendedString('reference-inspection'))
caf = STEPCAFControl_Reader()
caf.SetNameMode(True)
caf.ReadFile(str(src))
caf.Transfer(doc)
shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
free = TDF_LabelSequence()
shape_tool.GetFreeShapes(free)
children = TDF_LabelSequence()
shape_tool.GetComponents_s(free.Value(1), children)
components = []
housing = None
for i in range(1, children.Length() + 1):
    label = children.Value(i)
    ref = TDF_Label()
    shape_tool.GetReferredShape_s(label, ref)
    name = TDataStd_Name()
    ref.FindAttribute(TDataStd_Name.GetID_s(), name)
    component_name = name.Get().ToExtString()
    component_shape = shape_tool.GetShape_s(label)
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(component_shape, box)
    components.append(dict(name=component_name, bbox_mm=box.Get()))
    if component_name.startswith('pump housing'):
        housing_exp = TopExp_Explorer(component_shape, TopAbs_SOLID)
        housing = TopoDS.Solid_s(housing_exp.Current())
if housing is None:
    raise RuntimeError('No pump housing identified; stop rather than guess.')

classifier = BRepClass3d_SolidClassifier(housing)
def inside(x, y, z):
    classifier.Perform(gp_Pnt(float(x), float(y), float(z)), 1e-6)
    return classifier.State() == TopAbs_IN

sample_locations = [(0, 0, z) for z in [-124, -110, -90, -60, -30, 0, 30, 60, 72, 80]]
sample_locations += [(100, 0, 0), (150, 0, 0), (0, 100, 0), (0, 200, 0), (0, 260, 0), (0, 278, 0)]
samples = [dict(point_mm=p, inside_cad_material=inside(*p)) for p in sample_locations]

fig, axes = plt.subplots(1, 2, figsize=(12, 6.5), constrained_layout=True)
fig.suptitle('Pemeriksaan STEP NK 50-350: irisan housing', fontsize=17, weight='bold')
planes = [dict(title='Potongan melintang: Z = 0 mm', labels=('X [mm]', 'Y [mm]'),
               us=np.linspace(-240, 240, 150), vs=np.linspace(-240, 300, 170),
               xyz=lambda u,v:(u,v,0), normal=(0,0,1), projection=lambda p:(p.X(),p.Y())),
          dict(title='Potongan memanjang: X = 0 mm', labels=('Z [mm]', 'Y [mm]'),
               us=np.linspace(-145, 100, 100), vs=np.linspace(-240, 300, 170),
               xyz=lambda u,v:(0,v,u), normal=(1,0,0), projection=lambda p:(p.Z(),p.Y()))]
for ax, plane in zip(axes, planes):
    us, vs = plane['us'], plane['vs']
    cut_plane = gp_Pln(gp_Pnt(0,0,0),gp_Dir(*plane['normal']))
    plane_face = BRepBuilderAPI_MakeFace(cut_plane, -1000, 1000, -1000, 1000).Face()
    common = BRepAlgoAPI_Common(housing, plane_face)
    if not common.IsDone():
        raise RuntimeError('Failed to intersect housing and section plane.')
    cut_face_shape = common.Shape()
    BRepMesh_IncrementalMesh(cut_face_shape, .25, False, .2, True)
    polygons = []
    faces = TopExp_Explorer(cut_face_shape, TopAbs_FACE)
    while faces.More():
        face = TopoDS.Face_s(faces.Current())
        location = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, location)
        if tri is not None:
            projected = [plane['projection'](tri.Node(i).Transformed(location.Transformation())) for i in range(1,tri.NbNodes()+1)]
            for i in range(1,tri.NbTriangles()+1):
                polygons.append([projected[j-1] for j in tri.Triangle(i).Get()])
        faces.Next()
    ax.add_collection(PolyCollection(polygons, facecolors='#9aa8b6',edgecolors='none',antialiaseds=False))
    ax.set_xlim(us[0],us[-1])
    ax.set_ylim(vs[0],vs[-1])
    section = BRepAlgoAPI_Section(housing, cut_plane, False)
    section.Build()
    edges = TopExp_Explorer(section.Shape(), TopAbs_EDGE)
    while edges.More():
        curve = BRepAdaptor_Curve(TopoDS.Edge_s(edges.Current()))
        pts = [plane['projection'](curve.Value(float(t))) for t in np.linspace(curve.FirstParameter(),curve.LastParameter(),60)]
        ax.plot(*zip(*pts), color='#263849', linewidth=.8)
        edges.Next()
    ax.scatter([0], [0], color='#b42318', s=38, zorder=5)
    ax.annotate('Titik pusat: material solid', xy=(0,0), xytext=(0,-175), ha='center', fontsize=10,
                color='#9b251d', arrowprops=dict(arrowstyle='->',color='#9b251d'))
    ax.set(xlabel=plane['labels'][0], ylabel=plane['labels'][1], title=plane['title'])
    ax.set_aspect('equal')
    ax.grid(alpha=.15)
axes[0].legend(handles=[Patch(facecolor='#9aa8b6',label='Material solid menurut CAD')],loc='upper left',fontsize=9)
fig.supxlabel('Warna abu-abu = material CAD; putih = di luar solid. Ini bukan kontur CFD.', fontsize=10)
fig.savefig(out/'housing_sections.png',dpi=180)
plt.close(fig)

dxf_file = src.with_suffix('.dxf')
dxf = ezdxf.readfile(dxf_file)
layouts = []
for name in dxf.layout_names():
    layout = dxf.layouts.get(name)
    box = dxf_bbox.extents(layout)
    layouts.append(dict(name=name, entities=dict(collections.Counter(e.dxftype() for e in layout)),
                        bbox=[list(box.extmin),list(box.extmax)]))
report = dict(source=str(src),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),
              step_read_status=str(status),source_exporter='SolidWorks 2024 / SwSTEP 2.0',units='mm',
              solid_count=len(solids),all_solids_valid=all(s['valid'] for s in solid_info),
              top_level_components=components,solids=solid_info,housing_point_samples=samples,
              dxf=dict(source=str(dxf_file),units_code=dxf.units,layouts=layouts),
              limitation='DWG geometry not independently decoded; diagnosis is based on STEP and DXF. CAD solid validity is not CFD mesh validity.')
(out/'reference_analysis.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(dict(solid_count=len(solids),all_solids_valid=report['all_solids_valid'],
                     components=[c['name'] for c in components],samples=samples,outputs=str(out)),indent=2))
