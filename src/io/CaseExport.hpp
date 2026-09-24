#pragma once

#include <string>

struct PumpParameters;
struct PumpEstimate;

void writeCaseManifest(const std::string& path,
                      const PumpParameters& params,
                      const PumpEstimate& estimate,
                      const std::string& geometryTag,
                      const std::string& solverName);
