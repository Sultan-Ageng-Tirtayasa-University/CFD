#include "core/Types.hpp"
#include "core/Geometry3D.hpp"
#include "core/FluidDomain.hpp"
#include "core/MeshQuality.hpp"
#include "core/SteadyRansBaseline.hpp"
#include "validation/GeometryValidation.hpp"
#include "validation/OemValidation.hpp"
#include "io/JsonExport.hpp"
#include "io/CaseExport.hpp"
#include "io/OpenFoamExport.hpp"

#include <fstream>
#include <iostream>
#include <stdexcept>
#include <vector>

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

    const std::vector<OemPoint> oemCurve = {
        {0.0, 44.50}, {32.80, 43.90}, {65.59, 40.06},
        {88.61, 34.93}, {114.80, 28.55}
    };
    const auto oemReport = validateReferenceEstimate(params, oemCurve, estimate.eulerHead_m);

    try {
        writeImpellerJson("impeller_data.json", params, estimate, blades, volute);
        writeCaseManifest("case_manifest.json", params, estimate, "pump_concept_baseline", "OpenFOAM_or_SU2");
        std::ofstream("mesh_quality.json") << meshQualityJson(mesh);
        std::ofstream("steady_rans_baseline.json") << steadyRansJson(rans);
        std::ofstream("oem_validation.csv") << oemValidationCsv(oemReport);
        std::ofstream("oem_validation.json") << oemValidationJson(oemReport);
        writeOpenFoamCase("openfoam_case", params, geometry, domain, mesh);
    } catch (const std::exception& ex) {
        std::cerr << "Export failed: " << ex.what() << std::endl;
        return 1;
    }

    std::cout << "Generated geometry, domain, mesh, RANS scaffold, and OEM reference validation files." << std::endl;
    std::cout << "Euler head estimate: " << formatDouble(estimate.eulerHead_m, 3) << " m" << std::endl;
    std::cout << "Reference MAE against OEM points: " << formatDouble(oemReport.meanAbsoluteError_m, 3) << " m" << std::endl;
    std::cout << "Warning: no 3D mesh or CFD solver was executed." << std::endl;
    return 0;
}
