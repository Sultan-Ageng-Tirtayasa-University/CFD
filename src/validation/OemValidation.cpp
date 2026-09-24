#include "OemValidation.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>

OemValidationReport validateReferenceEstimate(const PumpParameters& params,
                                               const std::vector<OemPoint>& oemCurve,
                                               double referenceHead_m) {
    OemValidationReport report;
    report.status = oemCurve.empty() ? "NO_OEM_DATA" : "REFERENCE_ONLY";
    report.limitation = "The reference head is an analytical estimate, not a CFD result; use this report only as a baseline comparison.";

    double sumError = 0.0;
    for (const auto& point : oemCurve) {
        const double scale = params.ratedFlow > 0.0 ? point.flow_m3_h / params.ratedFlow : 1.0;
        const double estimatedHead = referenceHead_m * scale * scale;
        const double absoluteError = estimatedHead - point.head_m;
        const double relativeError = point.head_m != 0.0 ? 100.0 * absoluteError / point.head_m : 0.0;
        report.points.push_back({point.flow_m3_h, point.head_m, estimatedHead, absoluteError, relativeError});
        sumError += std::abs(absoluteError);
        report.maxAbsoluteError_m = std::max(report.maxAbsoluteError_m, std::abs(absoluteError));
    }

    if (!report.points.empty()) {
        report.meanAbsoluteError_m = sumError / static_cast<double>(report.points.size());
    }
    return report;
}

std::string oemValidationCsv(const OemValidationReport& report) {
    std::ostringstream out;
    out << "flow_m3_h,oem_head_m,reference_head_m,absolute_error_m,relative_error_percent\n";
    for (const auto& point : report.points) {
        out << std::fixed << std::setprecision(8)
            << point.flow_m3_h << ',' << point.oemHead_m << ',' << point.referenceHead_m << ','
            << point.absoluteError_m << ',' << point.relativeError_percent << '\n';
    }
    return out.str();
}

std::string oemValidationJson(const OemValidationReport& report) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(8)
        << "{\n"
        << "  \"status\": \"" << report.status << "\",\n"
        << "  \"mean_absolute_error_m\": " << report.meanAbsoluteError_m << ",\n"
        << "  \"max_absolute_error_m\": " << report.maxAbsoluteError_m << ",\n"
        << "  \"limitation\": \"" << report.limitation << "\",\n"
        << "  \"points\": [\n";
    for (size_t i = 0; i < report.points.size(); ++i) {
        const auto& point = report.points[i];
        out << "    {\"flow_m3_h\": " << point.flow_m3_h
            << ", \"oem_head_m\": " << point.oemHead_m
            << ", \"reference_head_m\": " << point.referenceHead_m
            << ", \"absolute_error_m\": " << point.absoluteError_m
            << ", \"relative_error_percent\": " << point.relativeError_percent << "}";
        if (i + 1 < report.points.size()) out << ',';
        out << '\n';
    }
    out << "  ]\n}\n";
    return out.str();
}
