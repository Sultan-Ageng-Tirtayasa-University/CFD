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
    model.inletPlaneX_m = -(params.suctionL * 0.001);
    model.outletPlaneY_m = params.dischargeL * 0.001;
    model.minimumTipClearance_m = (params.rotorInterface - params.D2) * 0.0005;
    model.bladePassageCount = std::max(0, params.Z);
    model.hasInlet = params.suctionDN > 0.0 && params.suctionL > 0.0;
    model.hasOutlet = params.dischargeDN > 0.0 && params.dischargeL > 0.0;
    model.hasBladePassages = model.bladePassageCount >= 3 && model.bladeSpan_m > 0.0;
    model.watertight = model.impellerRadius_m > model.hubRadius_m &&
                       model.rotorInterfaceRadius_m > model.impellerRadius_m &&
                       model.minimumTipClearance_m > 0.0 &&
                       model.bladeProfiles.size() >= 3 &&
                       model.voluteCenterline.size() >= 3;
    model.limitation = "This model describes a conceptual boundary skeleton; it is not a CAD watertight solid or volume mesh.";
    return model;
}
