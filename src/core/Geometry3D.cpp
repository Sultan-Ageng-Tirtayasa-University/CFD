#include "Geometry3D.hpp"

#include <algorithm>
#include <cmath>

Geometry3DModel buildGeometry3D(const PumpParameters& params) {
    Geometry3DModel model;
    model.bladeProfiles = generateBlade(params, 200);
    model.voluteCenterline = generateVolute(params, 180);
    model.impellerRadius_m = params.D2 * 0.0005;
    model.hubRadius_m = params.Dh * 0.0005;
    model.rotorInterfaceRadius_m = params.rotorInterface * 0.0005;
    model.bladeSpan_m = std::max(0.0, model.impellerRadius_m - params.D1 * 0.0005);
    model.watertight = model.impellerRadius_m > model.hubRadius_m &&
                       model.rotorInterfaceRadius_m > model.impellerRadius_m &&
                       model.bladeProfiles.size() >= 3 &&
                       model.voluteCenterline.size() >= 3;
    return model;
}
