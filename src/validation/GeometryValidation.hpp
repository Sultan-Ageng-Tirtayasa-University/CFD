#pragma once

#include <string>
#include <vector>

struct ValidationIssue {
    std::string message;
    bool isError = false;
};

struct ValidationSummary {
    bool ok = true;
    std::vector<ValidationIssue> issues;
    std::string report() const;
};

struct PumpParameters;

ValidationSummary validatePumpParameters(const PumpParameters& p);
