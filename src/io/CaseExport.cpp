#include "CaseExport.hpp"

#include "../core/Types.hpp"
#include "../core/Geometry.cpp"

#include <fstream>
#include <sstream>

void writeCaseManifest(const std::string& path,
                      const PumpParameters& params,
                      const PumpEstimate& estimate,
                      const std::string& geometryTag,
                      const std::string& solverName) {
    std::ofstream out(path);
    if (!out.is_open()) {
        throw std::runtime_error("Unable to open case manifest: " + path);
    }

    out << "{\n";
    out << "  \"case_name\": \"" << geometryTag << "\",\n";
    out << "  \"solver\": \"" << solverName << "\",\n";
    out << "  \"geometry\": {\n";
    out << "    \"suctionDN_mm\": " << params.suctionDN << ",\n";
    out << "    \"dischargeDN_mm\": " << params.dischargeDN << ",\n";
    out << "    \"D1_mm\": " << params.D1 << ",\n";
    out << "    \"Dh_mm\": " << params.Dh << ",\n";
    out << "    \"D2_mm\": " << params.D2 << ",\n";
    out << "    \"b2_mm\": " << params.b2 << ",\n";
    out << "    \"bladeThickness_mm\": " << params.bladeThickness << ",\n";
    out << "    \"beta1_deg\": " << params.beta1_deg << ",\n";
    out << "    \"beta2_deg\": " << params.beta2_deg << ",\n";
    out << "    \"Z\": " << params.Z << ",\n";
    out << "    \"rotorInterface_mm\": " << params.rotorInterface << ",\n";
    out << "    \"voluteStartWidth_mm\": " << params.voluteStartWidth << ",\n";
    out << "    \"voluteEndWidth_mm\": " << params.voluteEndWidth << ",\n";
    out << "    \"suctionL_mm\": " << params.suctionL << ",\n";
    out << "    \"dischargeL_mm\": " << params.dischargeL << "\n";
    out << "  },\n";
    out << "  \"fluid\": {\n";
    out << "    \"density_kg_m3\": " << params.fluidDensity << ",\n";
    out << "    \"viscosity_Pa_s\": " << params.dynamicViscosity << ",\n";
    out << "    \"temperature_C\": " << params.fluidTemperature << "\n";
    out << "  },\n";
    out << "  \"operation\": {\n";
    out << "    \"rpm\": " << params.rpm << ",\n";
    out << "    \"operatingFlow_m3_h\": " << params.operatingFlow << "\n";
    out << "  },\n";
    out << "  \"estimates\": {\n";
    out << "    \"tipSpeed_m_s\": " << formatDouble(estimate.tipSpeed_m_s, 6) << ",\n";
    out << "    \"eulerHead_m\": " << formatDouble(estimate.eulerHead_m, 6) << ",\n";
    out << "    \"pressureRise_bar\": " << formatDouble(estimate.pressureRise_bar, 6) << ",\n";
    out << "    \"hydraulicPower_kW\": " << formatDouble(estimate.hydraulicPower_kW, 6) << \"\n\";
    out << "  },\n";
    out << "  \"notes\": [\n";
    out << "    \"This is a baseline geometry and engineering estimate, not a validated 3D CFD solution.\",\n";
    out << "    \"Use this manifest as the basis for OpenFOAM or SU2 steady-state RANS validation.\"\n";
    out << "  ]\n";
    out << "}\n";
    out.close();
}
