#pragma once

#include "FluidDomain.hpp"
#include <string>

struct MeshQualityReport {
    std::string status;
    std::string limitation;
    int estimatedCells = 0;
    double minimumCellSize_m = 0.0;
    double estimatedAspectRatio = 0.0;
    double estimatedYPlus = 0.0;
};

MeshQualityReport estimateMeshQuality(const PumpParameters& params,
                                      const Geometry3DModel& geometry,
                                      const FluidDomain& domain,
                                      int targetCells = 1000000);
std::string meshQualityJson(const MeshQualityReport& report);
