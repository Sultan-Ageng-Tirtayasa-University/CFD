#include "FluidDomain.hpp"

#include <cmath>

FluidDomain buildFluidDomain(const PumpParameters& params, const Geometry3DModel& geometry) {
    constexpr double pi = 3.14159265358979323846;
    const double suctionDiameter_m = params.suctionDN * 0.001;
    const double dischargeDiameter_m = params.dischargeDN * 0.001;
    const double rotorRadius = geometry.rotorInterfaceRadius_m;
    const double rotorLength = std::max(params.b2 * 0.001, 1e-6);

    FluidDomain domain;
    domain.inletArea_m2 = pi * suctionDiameter_m * suctionDiameter_m / 4.0;
    domain.outletArea_m2 = pi * dischargeDiameter_m * dischargeDiameter_m / 4.0;
    domain.rotorVolumeEstimate_m3 = pi * rotorRadius * rotorRadius * rotorLength;
    domain.statorVolumeEstimate_m3 = domain.rotorVolumeEstimate_m3 * 2.0;
    domain.connected = geometry.watertight && domain.inletArea_m2 > 0.0 && domain.outletArea_m2 > 0.0;
    domain.description = domain.connected
        ? "Conceptual inlet-eye-rotor-volute-outlet connected fluid domain"
        : "Fluid-domain connectivity requires geometry correction";
    return domain;
}
