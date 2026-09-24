#pragma once

#include "Geometry3D.hpp"
#include <string>

struct FluidDomain {
    double inletArea_m2 = 0.0;
    double outletArea_m2 = 0.0;
    double rotorVolumeEstimate_m3 = 0.0;
    double statorVolumeEstimate_m3 = 0.0;
    bool connected = false;
    std::string description;
};

FluidDomain buildFluidDomain(const PumpParameters& params, const Geometry3DModel& geometry);
