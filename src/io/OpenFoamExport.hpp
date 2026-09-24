#pragma once

#include "../core/FluidDomain.hpp"
#include "../core/MeshQuality.hpp"
#include <string>

void writeOpenFoamCase(const std::string& directory,
                       const PumpParameters& params,
                       const Geometry3DModel& geometry,
                       const FluidDomain& domain,
                       const MeshQualityReport& mesh);
