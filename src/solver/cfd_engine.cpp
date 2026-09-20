#include <emscripten.h>
#include <vector>
#include <cmath>
#include <cstdlib>

// LBM D2Q9 Model Parameters
const int Q = 9;

// Weights for D2Q9
const double w[9] = {4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 
                     1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0};

// Discrete velocities for D2Q9 (cx, cy)
const int cx[9] = {0, 1, 0, -1, 0, 1, -1, -1, 1};
const int cy[9] = {0, 0, 1, 0, -1, 1, 1, -1, -1};

// Global Memory Pointers for WebAssembly Sharing
int grid_size_x = 0;
int grid_size_y = 0;
int total_cells = 0;

// Arrays shared with JavaScript
int* geometry = nullptr; // 0: Fluid, 1: Stator (Volute), 2: Rotor (Impeller)
double* f = nullptr;     // Particle distribution functions
double* f_new = nullptr; // Buffer for streaming
double* rho = nullptr;   // Macroscopic density
double* u = nullptr;     // Macroscopic velocity X
double* v = nullptr;     // Macroscopic velocity Y

// Inverse directions for Bounce-Back
const int inv[9] = {0, 3, 4, 1, 2, 7, 8, 5, 6};

extern "C" {

    // Initialize the Computational Grid (Phase 1)
    EMSCRIPTEN_KEEPALIVE
    void initLBM(int width, int height) {
        grid_size_x = width;
        grid_size_y = height;
        total_cells = width * height;

        if (geometry) free(geometry);
        if (f) free(f);
        if (f_new) free(f_new);
        if (rho) free(rho);
        if (u) free(u);
        if (v) free(v);

        geometry = (int*)malloc(total_cells * sizeof(int));
        f = (double*)malloc(total_cells * Q * sizeof(double));
        f_new = (double*)malloc(total_cells * Q * sizeof(double));
        rho = (double*)malloc(total_cells * sizeof(double));
        u = (double*)malloc(total_cells * sizeof(double));
        v = (double*)malloc(total_cells * sizeof(double));

        for (int i = 0; i < total_cells; ++i) {
            geometry[i] = 0; 
            rho[i] = 1.0;    
            u[i] = 0.0;
            v[i] = 0.0;

            for (int k = 0; k < Q; ++k) {
                f[i * Q + k] = w[k] * rho[i];
                f_new[i * Q + k] = f[i * Q + k];
            }
        }
    }

    EMSCRIPTEN_KEEPALIVE
    int* getGeometryPointer() { return geometry; }

    EMSCRIPTEN_KEEPALIVE
    double* getRhoPointer() { return rho; }

    EMSCRIPTEN_KEEPALIVE
    double* getUPointer() { return u; }

    EMSCRIPTEN_KEEPALIVE
    double* getVPointer() { return v; }

    // --- PHASE 4: CAVITATION (SHAN-CHEN MULTIPHASE) ---
    EMSCRIPTEN_KEEPALIVE
    void stepLBM(double tau, double omega, double G_interaction) {
        
        double center_x = grid_size_x / 2.0;
        double center_y = grid_size_y / 2.0;

        // PASS 1: Macroscopic Variable Calculation
        for (int y = 0; y < grid_size_y; ++y) {
            for (int x = 0; x < grid_size_x; ++x) {
                int idx = y * grid_size_x + x;
                
                if (geometry[idx] == 1) {
                    u[idx] = 0.0; v[idx] = 0.0; rho[idx] = 1.0;
                } else if (geometry[idx] == 2) {
                    double dx = x - center_x; double dy = y - center_y;
                    u[idx] = -omega * dy; v[idx] =  omega * dx;
                    rho[idx] = 1.0; 
                } else {
                    double local_rho = 0.0;
                    double local_u = 0.0;
                    double local_v = 0.0;
                    for (int k = 0; k < Q; ++k) {
                        double fk = f[idx * Q + k];
                        local_rho += fk;
                        local_u += fk * cx[k];
                        local_v += fk * cy[k];
                    }
                    if (local_rho > 0.0) {
                        local_u /= local_rho;
                        local_v /= local_rho;
                    } else {
                        local_rho = 1.0;
                    }
                    rho[idx] = local_rho;
                    u[idx] = local_u;
                    v[idx] = local_v;
                }
            }
        }

        // PASS 2: Shan-Chen Interparticle Force & BGK Collision
        for (int y = 0; y < grid_size_y; ++y) {
            for (int x = 0; x < grid_size_x; ++x) {
                int idx = y * grid_size_x + x;
                if (geometry[idx] != 0) continue; // Only apply to fluid

                double local_rho = rho[idx];
                double local_u = u[idx];
                double local_v = v[idx];

                // Task 4.1: Pseudo-potential Force calculation
                if (G_interaction < 0.0 && local_rho > 0.0) {
                    double Fx = 0.0;
                    double Fy = 0.0;
                    // psi = rho0 * (1 - exp(-rho/rho0))
                    double psi_center = 1.0 - exp(-local_rho); 
                    
                    for (int k = 1; k < Q; ++k) {
                        int nx = x + cx[k];
                        int ny = y + cy[k];
                        if (nx >= 0 && nx < grid_size_x && ny >= 0 && ny < grid_size_y) {
                            int nidx = ny * grid_size_x + nx;
                            if (geometry[nidx] == 0) { // Fluid-Fluid interaction only
                                double psi_neighbor = 1.0 - exp(-rho[nidx]);
                                Fx += w[k] * psi_neighbor * cx[k];
                                Fy += w[k] * psi_neighbor * cy[k];
                            }
                        }
                    }
                    Fx *= -G_interaction * psi_center;
                    Fy *= -G_interaction * psi_center;

                    // Shift equilibrium velocity by force (u_eq = u + F*tau/rho)
                    local_u += Fx * tau / local_rho;
                    local_v += Fy * tau / local_rho;
                }

                double usq = local_u * local_u + local_v * local_v;

                // Collision Step
                for (int k = 0; k < Q; ++k) {
                    double cu = cx[k] * local_u + cy[k] * local_v;
                    double feq = w[k] * local_rho * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * usq);
                    f[idx * Q + k] -= (1.0 / tau) * (f[idx * Q + k] - feq);
                }
            }
        }

        // 2. Streaming with Exact LBM Moving Wall Bounce-Back
        for (int y = 0; y < grid_size_y; ++y) {
            for (int x = 0; x < grid_size_x; ++x) {
                int idx = y * grid_size_x + x;
                
                if (geometry[idx] != 0) continue; // Solids don't stream OUT

                for (int k = 0; k < Q; ++k) {
                    int nx = x + cx[k];
                    int ny = y + cy[k];
                    
                    if (nx >= 0 && nx < grid_size_x && ny >= 0 && ny < grid_size_y) {
                        int nidx = ny * grid_size_x + nx;
                        
                        if (geometry[nidx] == 1) {
                            // Hit Stator: Standard Half-Way Bounce-Back
                            f_new[idx * Q + inv[k]] = f[idx * Q + k];
                        } 
                        else if (geometry[nidx] == 2) {
                            // Hit Rotor: Moving Wall Bounce-Back with Momentum Transfer
                            double dx = nx - center_x;
                            double dy = ny - center_y;
                            double u_w = -omega * dy;
                            double v_w = omega * dx;
                            
                            // Ladd's Momentum Transfer formula: f_inv = f_k - 6 * w_k * rho_w * (e_k . u_w)
                            double cu = cx[k] * u_w + cy[k] * v_w;
                            double momentum_transfer = 6.0 * w[k] * 1.0 * cu; // assuming local wall density ~ 1.0
                            
                            f_new[idx * Q + inv[k]] = f[idx * Q + k] - momentum_transfer;
                        } 
                        else {
                            // Normal fluid streaming
                            f_new[nidx * Q + k] = f[idx * Q + k];
                        }
                    } else {
                        // Domain boundary limits (Bounce Back)
                        f_new[idx * Q + inv[k]] = f[idx * Q + k];
                    }
                }
            }
        }

        // 3. Memory Swap for Next Iteration
        double* temp = f;
        f = f_new;
        f_new = temp;
    }
}
