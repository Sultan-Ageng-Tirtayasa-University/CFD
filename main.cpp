#include <iostream>
#include <fstream>
#include <vector>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Struct to hold a point
struct Point {
    double x, y;
};

// Convert degrees to radians
double deg2rad(double deg) {
    return deg * M_PI / 180.0;
}

// Generate blade profile 
std::vector<Point> generateBlade(double r1, double r2, double beta1_deg, double beta2_deg, int num_points) {
    std::vector<Point> blade;
    double beta1 = deg2rad(beta1_deg);
    double beta2 = deg2rad(beta2_deg);
    
    double r = r1;
    double dr = (r2 - r1) / (num_points - 1);
    double theta = 0.0;
    
    for (int i = 0; i < num_points; ++i) {
        r = r1 + i * dr;
        
        // Add point
        blade.push_back({r * std::cos(theta), r * std::sin(theta)});
        
        // Calculate next theta
        // dr/dtheta = r * tan(beta) -> dtheta = dr / (r * tan(beta))
        if (i < num_points - 1) {
            // Interpolate beta linearly based on radius
            double t = (r - r1) / (r2 - r1);
            double beta = beta1 + t * (beta2 - beta1);
            double dtheta = dr / (r * std::tan(beta));
            theta -= dtheta; // Mirrored curvature (backward curved blades)
        }
    }
    return blade;
}

int main() {
    // Input parameters from User
    double Ds = 190.0;
    double Dh = 60.0;
    double D2 = 324.0;
    double beta1 = 20.0; // Middle value
    double beta2 = 34.0;
    int Z = 7;
    double voluteD = 150.0;
    
    double r1 = Ds / 2.0; 
    double r2 = D2 / 2.0;
    double r3 = r2 * 1.05; // Volute base radius

    
    int num_points = 100;
    
    std::vector<Point> single_blade = generateBlade(r1, r2, beta1, beta2, num_points);
    
    // Output JSON
    std::ofstream out("impeller_data.json");
    out << "{\n";
    out << "  \"parameters\": {\n";
    out << "    \"Ds\": " << Ds << ",\n";
    out << "    \"Dh\": " << Dh << ",\n";
    out << "    \"D2\": " << D2 << ",\n";
    out << "    \"beta1\": " << beta1 << ",\n";
    out << "    \"beta2\": " << beta2 << ",\n";
    out << "    \"Z\": " << Z << "\n";
    out << "  },\n";
    out << "  \"blades\": [\n";
    
    for (int k = 0; k < Z; ++k) {
        double angle_offset = k * (2.0 * M_PI / Z);
        out << "    [\n";
        for (size_t i = 0; i < single_blade.size(); ++i) {
            // Rotate point
            double x = single_blade[i].x * std::cos(angle_offset) - single_blade[i].y * std::sin(angle_offset);
            double y = single_blade[i].x * std::sin(angle_offset) + single_blade[i].y * std::cos(angle_offset);
            out << "      {\"x\": " << x << ", \"y\": " << y << "}";
            if (i < single_blade.size() - 1) out << ",";
            out << "\n";
        }
        out << "    ]";
        if (k < Z - 1) out << ",";
        out << "\n";
    }
    
    out << "  ],\n";
    
    // Volute
    out << "  \"volute\": [\n";
    int num_volute_points = 150;
    for (int i = 0; i <= num_volute_points; ++i) {
        double theta = i * (2.0 * M_PI / num_volute_points);
        double r_volute = r3 + (theta / (2.0 * M_PI)) * voluteD;
        double x = r_volute * std::cos(theta);
        double y = r_volute * std::sin(theta);
        out << "      {\"x\": " << x << ", \"y\": " << y << "}";
        if (i < num_volute_points) out << ",";
        out << "\n";
    }
    out << "  ]\n";

    out << "}\n";
    out.close();
    
    std::cout << "Generated impeller_data.json" << std::endl;
    return 0;
}
