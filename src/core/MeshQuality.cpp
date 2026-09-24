#include "MeshQuality.hpp"

#include <algorithm>
#include <cmath>
#include <sstream>
#include <iomanip>

MeshQualityReport estimateMeshQuality(const PumpParameters& params,
                                      const Geometry3DModel& geometry,
                                      const FluidDomain& domain,
                                      int targetCells) {
    MeshQualityReport report;
    report.estimatedCells = std::max(1000, targetCells);
    report.minimumCellSize_m = geometry.rotorInterfaceRadius_m /
                               std::cbrt(static_cast<double>(report.estimatedCells));
    report.estimatedAspectRatio = domain.connected ? 2.0 : 0.0;
    const double velocity = params.operatingFlow / 3600.0 /
                            std::max(domain.outletArea_m2, 1e-12);
    report.estimatedYPlus = velocity * report.minimumCellSize_m /
                           std::max(params.dynamicViscosity / params.fluidDensity, 1e-12);
    report.status = domain.connected ? "CONCEPTUAL_ESTIMATE" : "INVALID_DOMAIN";
    report.limitation = "No volume mesh exists yet; values are planning estimates, not mesh statistics.";
    return report;
}

std::string meshQualityJson(const MeshQualityReport& report) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(8);
    out << "{\n"
        << "  \"status\": \"" << report.status << "\",\n"
        << "  \"estimated_cells\": " << report.estimatedCells << ",\n"
        << "  \"minimum_cell_size_m\": " << report.minimumCellSize_m << ",\n"
        << "  \"estimated_aspect_ratio\": " << report.estimatedAspectRatio << ",\n"
        << "  \"estimated_y_plus\": " << report.estimatedYPlus << ",\n"
        << "  \"limitation\": \"" << report.limitation << "\"\n"
        << "}\n";
    return out.str();
}
