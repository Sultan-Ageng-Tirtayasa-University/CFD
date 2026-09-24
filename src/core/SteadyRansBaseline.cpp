#include "SteadyRansBaseline.hpp"

#include <iomanip>
#include <sstream>

SteadyRansBaseline createSteadyRansBaseline(const PumpParameters& params,
                                             const PumpEstimate& estimate) {
    SteadyRansBaseline baseline;
    baseline.model = "incompressible_SST_k_omega_MRF_planned";
    baseline.flow_m3_s = params.operatingFlow / 3600.0;
    baseline.referenceHead_m = estimate.eulerHead_m;
    baseline.hydraulicPower_kW = estimate.hydraulicPower_kW;
    baseline.estimatedEfficiency = estimate.shaftPower_kW > 0.0
        ? estimate.hydraulicPower_kW / estimate.shaftPower_kW : 0.0;
    baseline.solverExecuted = false;
    baseline.limitation = "Reference estimate only; no RANS solver was executed.";
    return baseline;
}

std::string steadyRansJson(const SteadyRansBaseline& baseline) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(8)
        << "{\n"
        << "  \"model\": \"" << baseline.model << "\",\n"
        << "  \"flow_m3_s\": " << baseline.flow_m3_s << ",\n"
        << "  \"reference_head_m\": " << baseline.referenceHead_m << ",\n"
        << "  \"hydraulic_power_kW\": " << baseline.hydraulicPower_kW << ",\n"
        << "  \"estimated_efficiency\": " << baseline.estimatedEfficiency << ",\n"
        << "  \"solver_executed\": false,\n"
        << "  \"limitation\": \"" << baseline.limitation << "\"\n"
        << "}\n";
    return out.str();
}
