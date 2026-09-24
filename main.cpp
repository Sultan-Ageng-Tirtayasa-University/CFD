#include "core/Types.hpp"
#include "core/Geometry3D.hpp"
#include "core/FluidDomain.hpp"
#include "core/MeshQuality.hpp"
#include "core/SteadyRansBaseline.hpp"
#include "validation/GeometryValidation.hpp"
#include "io/JsonExport.hpp"
#include "io/CaseExport.hpp"
#include "io/OpenFoamExport.hpp"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>

int main() {
    PumpParameters params;
    const auto validation = validatePumpParameters(params);
    if (!validation.ok) {
        std::cerr << validation.report() << std::endl;
        return 1;
    }

    const auto blades = generateImpeller(params, 200);
    const auto volute = generateVolute(params, 180);
    const auto estimate = evaluatePump(params);
    const auto geometry = buildGeometry3D(params);
    const auto domain = buildFluidDomain(params, geometry);
    const auto mesh = estimateMeshQuality(params, geometry, domain, 1000000);
    const auto rans = createSteadyRansBaseline(params, estimate);

    try {
        writeImpellerJson("impeller_data.json", params, estimate, blades, volute);
        writeCaseManifest("case_manifest.json", params, estimate, "pump_concept_baseline", "OpenFOAM_or_SU2");
        std::ofstream("mesh_quality.json") << meshQualityJson(mesh);
        std::ofstream("steady_rans_baseline.json") << steadyRansJson(rans);
        writeOpenFoamCase("openfoam_case", params, geometry, domain, mesh);
    } catch (const std::exception& ex) {
        std::cerr << "Export failed: " << ex.what() << std::endl;
        return 1;
    }

    std::cout << "Generated impeller_data.json" << std::endl;
    std::cout << "Generated case_manifest.json" << std::endl;
    std::cout << "Generated mesh_quality.json" << std::endl;
    std::cout << "Generated steady_rans_baseline.json" << std::endl;
    std::cout << "Generated openfoam_case/ scaffold" << std::endl;
    std::cout << "Euler head estimate: " << formatDouble(estimate.eulerHead_m, 3) << " m" << std::endl;
    std::cout << "Pressure rise estimate: " << formatDouble(estimate.pressureRise_bar, 3) << " bar" << std::endl;
    return 0;
}
