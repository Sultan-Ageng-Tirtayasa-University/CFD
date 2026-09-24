#include "Types.hpp"

#include <cmath>
#include <sstream>
#include <iomanip>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

std::string formatDouble(double value, int precision) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(precision) << value;
    return oss.str();
}

static double degToRad(double deg) {
    return deg * M_PI / 180.0;
}

static std::vector<Point> rotatePoints(const std::vector<Point>& points, double angleRad) {
    std::vector<Point> rotated;
    rotated.reserve(points.size());
    for (const auto& p : points) {
        const double x = p.x * std::cos(angleRad) - p.y * std::sin(angleRad);
        const double y = p.x * std::sin(angleRad) + p.y * std::cos(angleRad);
        rotated.push_back({x, y});
    }
    return rotated;
}

std::vector<Point> generateBlade(const PumpParameters& p, int numPoints) {
    std::vector<Point> blade;
    blade.reserve(static_cast<size_t>(numPoints));

    const double r1 = (p.D1 / 2.0) / 1000.0;
    const double r2 = (p.D2 / 2.0) / 1000.0;
    const double beta1 = degToRad(p.beta1_deg);
    const double beta2 = degToRad(p.beta2_deg);

    const double dr = (r2 - r1) / static_cast<double>(numPoints - 1);
    double theta = 0.0;

    for (int i = 0; i < numPoints; ++i) {
        const double r = r1 + static_cast<double>(i) * dr;
        blade.push_back({r * std::cos(theta), r * std::sin(theta)});

        if (i < numPoints - 1) {
            const double t = (r - r1) / (r2 - r1);
            const double beta = beta1 + t * (beta2 - beta1);
            const double dTheta = dr / (r * std::tan(beta));
            theta -= dTheta;
        }
    }

    return blade;
}

std::vector<std::vector<Point>> generateImpeller(const PumpParameters& p, int numPoints) {
    const std::vector<Point> baseBlade = generateBlade(p, numPoints);
    std::vector<std::vector<Point>> blades;
    blades.reserve(static_cast<size_t>(p.Z));

    const double pitch = 2.0 * M_PI / static_cast<double>(p.Z);
    for (int i = 0; i < p.Z; ++i) {
        blades.push_back(rotatePoints(baseBlade, i * pitch));
    }
    return blades;
}

std::vector<Point> generateVolute(const PumpParameters& p, int numPoints) {
    std::vector<Point> volute;
    volute.reserve(static_cast<size_t>(numPoints + 1 + 60));

    const double rotorRadius = (p.rotorInterface / 2.0) / 1000.0;
    const double voluteSpan = (p.voluteEndWidth / 1000.0);

    for (int i = 0; i <= numPoints; ++i) {
        const double theta = (2.0 * M_PI * static_cast<double>(i)) / static_cast<double>(numPoints);
        const double progress = static_cast<double>(i) / static_cast<double>(numPoints);
        const double radius = rotorRadius + progress * voluteSpan;
        volute.push_back({radius * std::cos(theta), radius * std::sin(theta)});
    }

    const double dischargeRadius = (p.dischargeDN / 2.0) / 1000.0;
    const double outletCenterX = rotorRadius + voluteSpan * 0.55;
    for (int i = 0; i <= 60; ++i) {
        const double y = (static_cast<double>(i) / 60.0) * (p.dischargeL / 1000.0);
        volute.push_back({outletCenterX + dischargeRadius * 0.5, y});
    }

    return volute;
}

PumpEstimate evaluatePump(const PumpParameters& p) {
    const double g = 9.80665;
    const double flow_m3_s = p.operatingFlow / 3600.0;
    const double omega = (p.rpm * 2.0 * M_PI) / 60.0;
    const double rTip = (p.D2 / 2.0) / 1000.0;
    const double u2 = omega * rTip;

    const double eulerHead = (u2 * u2) / g;
    const double pressureRisePa = p.fluidDensity * g * eulerHead;
    const double pressureRiseBar = pressureRisePa / 100000.0;
    const double hydraulicPowerW = p.fluidDensity * g * flow_m3_s * eulerHead;
    const double hydraulicPowerkW = hydraulicPowerW / 1000.0;
    const double shaftPowerkW = hydraulicPowerkW / 0.75;

    const double dischargeArea = (M_PI * std::pow((p.dischargeDN / 1000.0), 2.0)) / 4.0;
    const double vDischarge = flow_m3_s / dischargeArea;
    const double reynolds = (p.fluidDensity * vDischarge * (p.dischargeDN / 1000.0)) / p.dynamicViscosity;

    return PumpEstimate{u2, eulerHead, pressureRisePa, pressureRiseBar, hydraulicPowerkW, shaftPowerkW, reynolds};
}
