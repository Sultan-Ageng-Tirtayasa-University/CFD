#include "GeometryValidation.hpp"

#include "../core/Types.hpp"

#include <sstream>

ValidationSummary validatePumpParameters(const PumpParameters& p) {
    ValidationSummary summary;

    auto addIssue = [&](const std::string& msg, bool isError = true) {
        summary.issues.push_back({msg, isError});
        if (isError) summary.ok = false;
    };

    if (p.D1 <= 0.0 || p.D2 <= 0.0) addIssue("D1 and D2 must be positive.");
    if (p.Dh <= 0.0) addIssue("Hub diameter Dh must be positive.");
    if (p.Dh >= p.suctionDN) addIssue("Hub diameter Dh must be less than suction diameter.");
    if (p.D1 >= p.D2) addIssue("Inlet blade diameter D1 must be less than impeller D2.");
    if (p.rotorInterface <= p.D2) addIssue("Rotor interface must be larger than impeller tip diameter.");
    if (p.b2 <= 2.0 * p.bladeThickness) addIssue("Channel width b2 should be greater than 2x blade thickness.");
    if (p.suctionL < 5.0 * p.suctionDN) addIssue("Suction length should be at least 5x suction diameter.");
    if (p.dischargeL < 5.0 * p.dischargeDN) addIssue("Discharge length should be at least 5x discharge diameter.");
    if (p.Z <= 0) addIssue("Blade count Z must be positive.");
    if (p.rpm <= 0.0) addIssue("RPM must be positive.");
    if (p.fluidDensity <= 0.0) addIssue("Fluid density must be positive.");
    if (p.dynamicViscosity <= 0.0) addIssue("Dynamic viscosity must be positive.");

    if (p.dischargeDN <= 0.0) addIssue("Discharge diameter must be positive.");
    if (p.suctionDN <= 0.0) addIssue("Suction diameter must be positive.");
    if (p.voluteEndWidth <= p.voluteStartWidth) addIssue("Volute end width should be greater than the start width.");

    return summary;
}

std::string ValidationSummary::report() const {
    if (issues.empty()) {
        return "Validation passed: geometric and operating inputs are consistent.";
    }

    std::ostringstream out;
    out << "Validation issues:\n";
    for (const auto& issue : issues) {
        out << "- " << issue.message << "\n";
    }
    return out.str();
}
