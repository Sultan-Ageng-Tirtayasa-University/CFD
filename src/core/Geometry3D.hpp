#pragma once

#include "Types.hpp"
#include <string>
#include <vector>

struct Geometry3DModel {
    std::vector<Point> bladeProfiles;
    std::vector<Point> voluteCenterline;
    double impellerRadius_m = 0.0;
    double hubRadius_m = 0.0;
    double rotorInterfaceRadius_m = 0.0;
    double bladeSpan_m = 0.0;
    bool watertight = false;
};

Geometry3DModel buildGeometry3D(const PumpParameters& params);
