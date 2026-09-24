# CFD Pump Geometry and Baseline Performance Estimator

This repository is a baseline C++ implementation for a centrifugal pump geometry and performance estimation workflow.

## Current status

This project is intentionally positioned as a starting point for a research-grade pump CFD workflow, not as a validated commercial CFD solver.

At this stage, the project includes:
- parametric impeller geometry generation,
- volute geometry generation,
- baseline pump performance estimate,
- JSON export for geometry and operating data,
- case manifest export for external solver workflows,
- input validation for basic geometric and operating consistency.

## What is not included yet

The following are not yet validated or final:
- 3D fluid volume generation,
- mesh generation,
- steady-state RANS validation,
- transient rotor-stator analysis,
- cavitation modeling,
- commercial equivalence with ANSYS Fluent/CFX.

## Build

```bash
cmake -S . -B build
cmake --build build
./build/impeller_gen
```

## Output files

The program generates:
- `impeller_data.json`
- `case_manifest.json`

## Notes

This repository is the foundation for a more complete research pipeline:
1. Geometry validation
2. 3D fluid domain extraction
3. Mesh generation and quality report
4. Steady RANS baseline
5. Transient rotor-stator study
6. Cavitation and NPSH validation

## Repository scope

The current implementation is suitable as:
- a geometry prototype,
- a performance estimation baseline,
- a case preparation foundation for external CFD solvers.

It is not yet suitable as a final validated pump CFD result.
