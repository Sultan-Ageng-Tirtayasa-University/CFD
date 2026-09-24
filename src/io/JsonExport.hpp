#pragma once

#include <string>
#include <vector>

struct Point;
struct PumpParameters;
struct PumpEstimate;

std::string serializePointArray(const std::vector<Point>& points);
std::string serializeBladeArray(const std::vector<std::vector<Point>>& blades);
void writeImpellerJson(const std::string& path,
                      const PumpParameters& params,
                      const PumpEstimate& estimate,
                      const std::vector<std::vector<Point>>& blades,
                      const std::vector<Point>& volute);
