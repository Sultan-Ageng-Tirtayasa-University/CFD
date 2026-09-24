# CFD implementation roadmap

## Phase 1: Baseline geometry and estimation
- parametric blade geometry
- volute geometry generation
- basic pump estimate calculation
- output JSON and case manifest
- input validation

## Phase 2: Geometry validation and fluid domain preparation
- check geometric consistency
- ensure D1 < D2 and rotor interface is valid
- define inlet/outlet flow passages
- prepare for 3D fluid domain extraction

## Phase 3: Mesh and quality control
- coarse / medium / fine mesh study
- y+ and wall refinement
- skewness and orthogonality checks
- mass imbalance monitoring

## Phase 4: Steady RANS baseline
- single-phase incompressible flow
- SST k-omega or equivalent turbulence model
- frozen rotor / MRF baseline
- head, flow rate, efficiency, torque output

## Phase 5: Transient rotor-stator
- sliding mesh or overset approach
- pressure pulsation monitoring
- blade-passing analysis
- time-averaged transient evaluation

## Phase 6: Cavitation and NPSH
- absolute pressure reference
- vapor pressure and temperature coupling
- cavitation onset and vapor volume fraction
- comparison against experimental data

## Phase 7: Validation and publication
- comparison with pump curves and OEM data
- mesh and timestep independence studies
- uncertainty reporting
- reproducible case package

## Principle

Do not claim final CFD equivalence before steady validation and benchmark comparison are complete.
