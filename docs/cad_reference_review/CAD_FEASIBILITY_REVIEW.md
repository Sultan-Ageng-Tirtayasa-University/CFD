**Kelayakan lampiran CAD untuk perbaikan CFD — 31 Agustus 2026**

Data ini dapat dipakai untuk memperbaiki referensi geometri, ukuran luar, orientasi, dan posisi sambungan pompa. Namun STEP yang diperiksa belum menyediakan geometri hidrolik lengkap untuk menghitung performa impeller/pompa. Mengimpor assembly ini ke ANSYS tidak otomatis menghasilkan domain fluida yang benar.

**Bukti dari berkas**

| Berkas | Pemeriksaan | Hasil dan kegunaan |
|---|---|---|
| [STEP](<C:/Users/Zfaryana/AppData/Local/Temp/NK 50-350_CI_F_FWOSPACER_GF MMG-W_50HZ_4P_11KW.step>) | Diimpor dengan kernel Open CASCADE; diperiksa struktur assembly, solid, dan potongan housing. | STEP AP214, metadata ekspor SolidWorks 2024/SwSTEP 2.0, satuan mm. Ada 7 komponen tingkat atas dan 30 solid. Seluruh solid lolos pemeriksaan BRep; ini hanya validitas topologi CAD, bukan kesiapan CFD. |
| [DXF](<C:/Users/Zfaryana/AppData/Local/Temp/NK 50-350_CI_F_FWOSPACER_GF MMG-W_50HZ_4P_11KW.dxf>) | Seluruh layout dibaca; tampilan depan, isometrik, dan samping dirender. | Satuan insertion mm; 7 layout/proyeksi berisi garis, polyline, arc, dan ellipse. Tidak ditemukan entitas DIMENSION, TEXT, atau MTEXT. Berguna untuk referensi bentuk luar dan koordinat; bukan drawing detail sudu. |
| DWG 2D dan DWG 3D | Kehadiran berkas, ukuran, serta header diperiksa. | Geometri kedua DWG belum didekode secara independen. Kesimpulan tentang detail internal berlaku untuk STEP/DXF yang berhasil diperiksa, bukan klaim bahwa DWG pasti memiliki isi yang identik. |

Komponen tingkat atas dalam STEP adalah `pump housing 50-350 mach 16bar`, `cover_l`, `96039637`, `96039673`, `c2_262`, `coupling_c`, dan `mmg-w_160m`. Tidak ada komponen impeller atau pola sudu terpisah dalam assembly yang ditransfer. Mayoritas solid tambahan berasal dari plate/channel baseframe. Ukuran keseluruhan assembly dalam sumbu global CAD sekitar X=445,47 mm, Y=597,03 mm, dan Z=1219,00 mm; ukuran ini adalah envelope pemasangan, bukan diameter impeller.

Pemeriksaan material housing memberikan bukti yang lebih kuat daripada nama komponen: titik-titik sepanjang sumbu pusat dari Z=-124 sampai Z=72 mm berada **di dalam material solid CAD**. Titik (0,260,0) dan (0,278,0) mm pada arah nozzle atas juga berada di dalam material. Potongan melintang dan memanjang memperlihatkan badan yang terisi pada jalur yang dibutuhkan untuk aliran. Jadi, model housing ini tidak menyediakan rongga hidrolik suction–impeller–volute–discharge yang siap diekstraksi langsung.

![Potongan housing dari STEP; abu-abu menunjukkan material CAD](C:/Users/Zfaryana/Desktop/Pump_CFD/docs/cad_reference_review/housing_sections.png)

Garis dan isian potongan dihitung dari perpotongan BRep dengan bidang. Permukaan potongan ditriangulasi untuk tampilan saja; ini bukan mesh volume simulasi. Status titik pemeriksaan juga dikonfirmasi melalui klasifikasi titik terhadap solid. Gambar ini bukan kontur CFD.

**Yang bisa dikerjakan dengan data sekarang**

1. Mengganti ilustrasi bentuk luar dengan referensi CAD yang dapat diukur, menetapkan satuan dan sumbu, serta memisahkan housing, motor, coupling, dan baseframe dalam tampilan.
2. Membuat referensi posisi inlet/outlet dan envelope untuk persiapan model. Diameter luar flange tidak boleh dianggap sama dengan diameter saluran fluida.
3. Memperbaiki bug aplikasi dari review sebelumnya: input duplikat, timestep yang bergantung FPS, viskositas yang tidak terhubung, perubahan resolusi tanpa alokasi ulang, perbedaan arah rotasi, dan label kontur. Perbaikan ini tidak bergantung pada kelengkapan CAD internal.
4. Menyiapkan workflow impor geometri, konfigurasi kasus, dan visualisasi hasil numerik yang terpisah dari ilustrasi. Belum dapat menghasilkan head, efisiensi, atau cavitation yang tervalidasi hanya dengan lampiran ini.

**Data tambahan yang diperlukan untuk model pompa sebenarnya**

| Kebutuhan | Data yang diminta |
|---|---|
| Impeller | STEP/Parasolid/native CAD impeller atau drawing internal lengkap: diameter aktual, jumlah sudu, kurva/sudut sudu, ketebalan, hub/shroud, dan lebar saluran. |
| Volute dan suction | CAD rongga internal atau drawing penampang/profil hidrolik, termasuk tongue, saluran suction, dan celah yang relevan. |
| Kondisi operasi | Debit desain/rentang debit, RPM aktual, arah putar, jenis fluida, suhu, dan kondisi tekanan inlet/outlet. |
| Validasi | Kurva H–Q, efisiensi–Q, daya–Q, dan bila tersedia NPSH serta toleransi/data pengukuran. Case/data ANSYS pembanding juga berguna. |

Nama berkas yang memuat `50HZ_4P_11KW` belum menggantikan data titik kerja atau RPM aktual. Parameter aplikasi sebelumnya seperti D2=324 mm, tujuh sudu, dan sudut 20°/34° belum terbukti sesuai dengan pompa NK 50-350 ini. Parameter tersebut tidak boleh diwariskan sebagai ukuran asli tanpa sumber.

Jika CAD internal tidak dapat diperoleh, alternatifnya adalah rekonstruksi model hidrolik menggunakan drawing/ukuran yang tersedia dan asumsi yang terdokumentasi. Model tersebut harus dilabeli **model pendekatan**, lalu dikalibrasi dan diuji terhadap kurva pompa; tidak boleh diklaim sebagai replika geometri asli dari STEP pemasangan ini.

Urutan yang disarankan: benahi keandalan aplikasi dan referensi CAD terlebih dahulu, lengkapi atau rekonstruksi domain hidrolik, lalu lakukan baseline 3D satu fase, studi mesh, pengukuran H–Q/torsi/efisiensi, dan validasi sebelum menambah cavitation. Tahapan numerik rinci tetap mengikuti [review CFD sebelumnya](C:/Users/Zfaryana/Desktop/Pump_CFD/docs/CFD_REVIEW_ANSYS_2026-08-31.md).

Data pemeriksaan tersedia di [reference_analysis.json](C:/Users/Zfaryana/Desktop/Pump_CFD/docs/cad_reference_review/reference_analysis.json), dengan script [inspect_reference.py](C:/Users/Zfaryana/Desktop/Pump_CFD/docs/cad_reference_review/inspect_reference.py). File asli dan kode aplikasi tidak diubah. Pemeriksaan ini belum menjalankan ANSYS atau membuat mesh CFD.
