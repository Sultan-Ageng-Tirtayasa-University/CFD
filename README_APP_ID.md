# Pump CFD Studio

Aplikasi lokal ini menggabungkan fungsi yang diperlukan untuk menyiapkan model pompa sentrifugal tanpa SolidWorks atau ANSYS:

- preset produk dan pelacakan sumber dimensi;
- editor geometri impeller, volute, suction, dan discharge;
- tampilan berdimensi 2D dan pemeriksaan 3D;
- kurva Q-H, daya, efisiensi, dan NPSHr dari data OEM;
- affinity-law untuk perubahan putaran dan diameter;
- validasi awal domain CFD;
- ekspor parameter JSON, kurva CSV, profil volute CSV, dan paket CAD STEP/DXF;
- visualisasi aliran LBM 2D untuk pemeriksaan kualitatif.

Klik dua kali `start_app.bat`. Aplikasi akan memilih port lokal kosong mulai dari `http://127.0.0.1:8127/` dan membukanya di browser. Terminal kecil yang terbuka adalah server lokal; tutup terminal tersebut setelah selesai.

Visualisasi LBM 2D tidak menggantikan solver RANS 3D seperti ANSYS Fluent/CFX. Untuk hasil kuantitatif, ekspor domain STEP lalu gunakan solver CFD 3D seperti OpenFOAM atau SU2, dengan mesh, model turbulensi, dan studi independensi mesh yang sesuai.
