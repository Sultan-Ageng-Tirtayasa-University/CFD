#pragma once

#include "../core/Types.hpp"
#include <string>
#include <vector>

struct OemPoint {
    double flow_m3_h = 0.0;
    double head_m = 0.0;
};

struct OemValidationPoint {
    double flow_m3_h = 0.0;
    double oemHead_m = 0.0;
    double referenceHead_m = 0.0;
    double absoluteError_m = 0.0;
    double relativeError_percent = 0.0;
};

struct OemValidationReport {
    std::string status;
    std::string limitation;
    std::vector<OemValidationPoint> points;
    double meanAbsoluteError_m = 0.0;
    double maxAbsoluteError_m = 0.0;
};

OemValidationReport validateReferenceEstimate(const PumpParameters& params,
                                               const std::vector<OemPoint>& oemCurve,
                                               double referenceHead_m);
std::string oemValidationCsv(const OemValidationReport& report);
std::string oemValidationJson(const OemValidationReport& report);
