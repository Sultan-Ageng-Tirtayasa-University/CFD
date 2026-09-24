#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct Point {
    double x = 0.0;
    double y = 0.0;
};

struct PumpParameters {
    double suctionDN = 80.0;
    double dischargeDN = 65.0;
    double D1 = 100.0;
    double Dh = 48.0;
    double D2 = 172.0;
    double b2 = 20.0;
    double bladeThickness = 4.0;
    double beta1_deg = 22.0;
    double beta2_deg = 30.0;
    int Z = 7;
    double rotorInterface = 184.0;
    double voluteStartWidth = 8.0;
    double voluteEndWidth = 48.0;
    double suctionL = 400.0;
    double dischargeL = 325.0;
    double rpm = 2930.0;
    double ratedFlow = 88.61;
    double ratedHead = 34.93;
    double operatingFlow = 88.61;
    double fluidTemperature = 50.0;
    double fluidDensity = 988.0;
    double dynamicViscosity = 0.000547;
};

struct PumpEstimate {
    double tipSpeed_m_s = 0.0;
    double eulerHead_m = 0.0;
    double pressureRise_Pa = 0.0;
    double pressureRise_bar = 0.0;
    double hydraulicPower_kW = 0.0;
    double shaftPower_kW = 0.0;
    double reynolds = 0.0;
};

static double degToRad(double deg) {
    return deg * M_PI / 180.0;
}

static std::string fmt(double value, int precision = 6) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(precision) << value;
    return oss.str();
}

static std::vector<Point> generateBlade(const PumpParameters& p, int numPoints = 200) {
    std::vector<Point> blade;
    blade.reserve(static_cast<size_t>(numPoints));

    const double r1 = (p.D1 / 2.0) / 1000.0;
    const double r2 = (p.D2 / 2.0) / 1000.0;
    const double beta1 = degToRad(p.beta1_deg);
    const double beta2 = degToRad(p.beta2_deg);

    double theta = 0.0;
    const double dr = (r2 - r1) / static_cast<double>(numPoints - 1);

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

static std::vector<std::vector<Point>> generateImpeller(const PumpParameters& p) {
    const std::vector<Point> baseBlade = generateBlade(p, 200);
    std::vector<std::vector<Point>> blades;
    blades.reserve(static_cast<size_t>(p.Z));

    const double pitch = 2.0 * M_PI / static_cast<double>(p.Z);
    for (int i = 0; i < p.Z; ++i) {
        blades.push_back(rotatePoints(baseBlade, i * pitch));
    }
    return blades;
}

static std::vector<Point> generateVolute(const PumpParameters& p, int numPoints = 180) {
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

static PumpEstimate evaluatePump(const PumpParameters& p) {
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
    const double vDischarge = (flow_m3_s / dischargeArea);
    const double reynolds = (p.fluidDensity * vDischarge * (p.dischargeDN / 1000.0)) / p.dynamicViscosity;

    return PumpEstimate{u2, eulerHead, pressureRisePa, pressureRiseBar, hydraulicPowerkW, shaftPowerkW, reynolds};
}

static std::string serializePointArray(const std::vector<Point>& points) {
    std::ostringstream out;
    out << "[\n";
    for (size_t i = 0; i < points.size(); ++i) {
        out << "    {\"x\": " << fmt(points[i].x, 6)
            << ", \"y\": " << fmt(points[i].y, 6) << "}";
        if (i + 1 < points.size()) {
            out << ",";
        }
        out << "\n";
    }
    out << "  ]";
    return out.str();
}

static std::string serializeBladeArray(const std::vector<std::vector<Point>>& blades) {
    std::ostringstream out;
    out << "[\n";
    for (size_t b = 0; b < blades.size(); ++b) {
        out << "    " << serializePointArray(blades[b]);
        if (b + 1 < blades.size()) {
            out << ",\n";
        }
        out << "\n";
    }
    out << "  ]";
    return out.str();
}

int main() {
    PumpParameters params;
    const auto blades = generateImpeller(params);
    const auto volute = generateVolute(params);
    const auto estimate = evaluatePump(params);

    std::ofstream out("impeller_data.json");
    if (!out.is_open()) {
        std::cerr << "Unable to write impeller_data.json" << std::endl;
        return 1;
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
    out << "    \"tipSpeed_m_s\": " << fmt(estimate.tipSpeed_m_s, 6) << ",\n";
    out << "    \"eulerHead_m\": " << fmt(estimate.eulerHead_m, 6) << ",\n";
    out << "    \"pressureRise_Pa\": " << fmt(estimate.pressureRise_Pa, 6) << ",\n";
    out << "    \"pressureRise_bar\": " << fmt(estimate.pressureRise_bar, 6) << ",\n";
    out << "    \"hydraulicPower_kW\": " << fmt(estimate.hydraulicPower_kW, 6) << ",\n";
    out << "    \"shaftPower_kW\": " << fmt(estimate.shaftPower_kW, 6) << ",\n";
    out << "    \"reynolds\": " << fmt(estimate.reynolds, 6) << "\n";
    out << "  },\n";
    out << "  \"blades\": " << serializeBladeArray(blades) << ",\n";
    out << "  \"volute\": " << serializePointArray(volute) << "\n";
    out << "}\n";

    out.close();

    std::cout << "Generated impeller_data.json" << std::endl;
    std::cout << "Euler head estimate: " << fmt(estimate.eulerHead_m, 3) << " m" << std::endl;
    std::cout << "Pressure rise estimate: " << fmt(estimate.pressureRise_bar, 3) << " bar" << std::endl;
    std::cout << "Tip speed: " << fmt(estimate.tipSpeed_m_s, 3) << " m/s" << std::endl;
    return 0;
}





































































