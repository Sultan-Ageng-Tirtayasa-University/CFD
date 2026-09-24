#include "../core/Types.hpp"
#include "../validation/GeometryValidation.hpp"
#include "../io/JsonExport.hpp"
#include "../io/CaseExport.hpp"

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

    try {
        writeImpellerJson("impeller_data.json", params, estimate, blades, volute);
        writeCaseManifest("case_manifest.json", params, estimate, "pump_concept_baseline", "OpenFOAM_or_SU2");
    } catch (const std::exception& ex) {
        std::cerr << "Export failed: " << ex.what() << std::endl;
        return 1;
    }

    std::cout << "Generated impeller_data.json" << std::endl;
    std::cout << "Generated case_manifest.json" << std::endl;
    std::cout << "Euler head estimate: " << formatDouble(estimate.eulerHead_m, 3) << " m" << std::endl;
    std::cout << "Pressure rise estimate: " << formatDouble(estimate.pressureRise_bar, 3) << " bar" << std::endl;
    std::cout << "Tip speed: " << formatDouble(estimate.tipSpeed_m_s, 3) << " m/s" << std::endl;
    return 0;
}
