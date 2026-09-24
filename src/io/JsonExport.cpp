#include "JsonExport.hpp"

#include "../core/Types.hpp"

#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>

static std::string fmtJson(double value, int precision = 6) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(precision) << value;
    return oss.str();
}

std::string serializePointArray(const std::vector<Point>& points) {
    std::ostringstream out;
    out << "[\n";
    for (size_t i = 0; i < points.size(); ++i) {
        out << "    {\"x\": " << fmtJson(points[i].x, 6)
            << ", \"y\": " << fmtJson(points[i].y, 6) << "}";
        if (i + 1 < points.size()) out << ",";
        out << "\n";
    }
    out << "  ]";
    return out.str();
}

std::string serializeBladeArray(const std::vector<std::vector<Point>>& blades) {
    std::ostringstream out;
    out << "[\n";
    for (size_t i = 0; i < blades.size(); ++i) {
        out << "    " << serializePointArray(blades[i]);
        if (i + 1 < blades.size()) out << ",\n";
        out << "\n";
    }
    out << "  ]";
    return out.str();
}

void writeImpellerJson(const std::string& path,
                      const PumpParameters& params,
                      const PumpEstimate& estimate,
                      const std::vector<std::vector<Point>>& blades,
                      const std::vector<Point>& volute) {
    std::ofstream out(path);
    if (!out.is_open()) {
        throw std::runtime_error("Unable to open output file for JSON export: " + path);
    }

    out << "{\n";
    out << "  \"parameters\": {\n";
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
    out << "    \"dischargeL_mm\": " << params.dischargeL << ",\n";
    out << "    \"rpm\": " << params.rpm << ",\n";
    out << "    \"fluidDensity_kg_m3\": " << params.fluidDensity << ",\n";
    out << "    \"dynamicViscosity_Pa_s\": " << params.dynamicViscosity << "\n";
    out << "  },\n";
    out << "  \"estimates\": {\n";
    out << "    \"tipSpeed_m_s\": " << fmtJson(estimate.tipSpeed_m_s, 6) << ",\n";
    out << "    \"eulerHead_m\": " << fmtJson(estimate.eulerHead_m, 6) << ",\n";
    out << "    \"pressureRise_Pa\": " << fmtJson(estimate.pressureRise_Pa, 6) << ",\n";
    out << "    \"pressureRise_bar\": " << fmtJson(estimate.pressureRise_bar, 6) << ",\n";
    out << "    \"hydraulicPower_kW\": " << fmtJson(estimate.hydraulicPower_kW, 6) << ",\n";
    out << "    \"shaftPower_kW\": " << fmtJson(estimate.shaftPower_kW, 6) << ",\n";
    out << "    \"reynolds\": " << fmtJson(estimate.reynolds, 6) << "\n";
    out << "  },\n";
    out << "  \"blades\": " << serializeBladeArray(blades) << ",\n";
    out << "  \"volute\": " << serializePointArray(volute) << "\n";
    out << "}\n";
}
