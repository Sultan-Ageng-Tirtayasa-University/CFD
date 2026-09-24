#pragma once

#include "../core/Types.hpp"
#include <string>

struct SteadyRansBaseline {
    std::string model;
    double flow_m3_s = 0.0;
    double referenceHead_m = 0.0;
    double hydraulicPower_kW = 0.0;
    double estimatedEfficiency = 0.0;
    bool solverExecuted = false;
    std::string limitation;
};

SteadyRansBaseline createSteadyRansBaseline(const PumpParameters& params,
                                             const PumpEstimate& estimate);
std::string steadyRansJson(const SteadyRansBaseline& baseline);
