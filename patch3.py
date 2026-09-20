import sys

with open('app.js', 'r') as f:
    content = f.read()

old_suction = '''        if (domain === 'suction') {
            t = basePressure; 
        } else if (domain === 'impeller') {'''

new_suction = '''        if (domain === 'suction') {
            // Translating transient flow entering the pump (moving along -Z axis)
            const suctionPulse = 0.08 * Math.sin(z * 0.05 + currentRotation * Z_blades * 2.0);
            t = basePressure + suctionPulse * rpmFactor; 
        } else if (domain === 'impeller') {'''

content = content.replace(old_suction, new_suction)

old_volute = '''            const r_norm_vol = Math.max(0, (r - r2) / (r2 * 0.8));
            if (r_norm_vol < 1.0) {
                const decay = Math.pow(1.0 - r_norm_vol, 2.0);
                const wake = 0.3 * decay * Math.sin(f * 2.0 * PI);
                t += wake * rpmFactor;
            }
        }'''

new_volute = '''            const r_norm_vol = Math.max(0, (r - r2) / (r2 * 0.8));
            if (r_norm_vol < 1.0) {
                const decay = Math.pow(1.0 - r_norm_vol, 2.0);
                const wake = 0.3 * decay * Math.sin(f * 2.0 * PI);
                t += wake * rpmFactor;
            }
            
            // Academic Transient Feature: Bulk Flow Pulsation in Discharge
            // Create visible pressure waves traveling outwards along the discharge pipe (+Y direction)
            if (normY > 0.05) {
                // Wave formula: sin( spatial_freq * distance - temporal_freq * time )
                const flowPulse = 0.15 * Math.sin(normY * 20.0 - currentRotation * Z_blades * 1.5);
                const pipeFactor = Math.min(1.0, (normY - 0.05) * 4.0); // Smooth fade-in from volute to pipe
                t += flowPulse * pipeFactor * rpmFactor;
            }
        }'''

content = content.replace(old_volute, new_volute)

with open('app.js', 'w') as f:
    f.write(content)

print('Added directional flow waves to suction and discharge.')
