#pragma once

#include <string>
#include <vector>

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

std::vector<Point> generateBlade(const PumpParameters& p, int numPoints = 200);
std::vector<std::vector<Point>> generateImpeller(const PumpParameters& p, int numPoints = 200);
std::vector<Point> generateVolute(const PumpParameters& p, int numPoints = 180);
PumpEstimate evaluatePump(const PumpParameters& p);
std::string formatDouble(double value, int precision = 6);
