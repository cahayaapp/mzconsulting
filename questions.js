export const SCALE_OPTIONS = [
  { value: 1, label: 'Belum ada / belum berjalan', short: 'Belum berjalan' },
  { value: 2, label: 'Sudah mulai, tapi masih belum konsisten', short: 'Mulai berjalan' },
  { value: 3, label: 'Sudah berjalan cukup baik', short: 'Cukup baik' },
  { value: 4, label: 'Sudah berjalan baik dan rutin dicek', short: 'Baik & terpantau' },
  { value: 5, label: 'Sudah sangat baik dan terus diperbaiki', short: 'Sangat kuat' },
  { value: null, label: 'Belum tahu / belum bisa menilai', short: 'Belum tahu' }
];

export const STAGES = [
  { max: 1.79, name: 'Perlu Dibangun', badge: 'Tahap 1', description: 'Fondasi sistem masih perlu dibentuk. Banyak hal masih berjalan berdasarkan kebiasaan atau orang tertentu.' },
  { max: 2.59, name: 'Mulai Tertata', badge: 'Tahap 2', description: 'Dasar sistem sudah mulai ada, tetapi belum konsisten di semua bagian.' },
  { max: 3.39, name: 'Cukup Terstruktur', badge: 'Tahap 3', description: 'Sistem utama sudah berjalan dan cukup dipahami, tetapi masih perlu penguatan konsistensi.' },
  { max: 4.19, name: 'Sudah Kuat', badge: 'Tahap 4', description: 'Sistem berjalan baik, cukup terkontrol, dan mulai memakai data untuk perbaikan.' },
  { max: 5, name: 'Berkembang Berkelanjutan', badge: 'Tahap 5', description: 'Sistem sudah kuat dan lembaga terbiasa mengecek, belajar, dan memperbaiki diri.' }
];

export const DOMAINS = [
  {
    id: 'vision',
    code: 'A',
    title: 'Visi & Arah',
    subtitle: 'Seberapa jelas pesantren tahu arah yang ingin dituju?',
    questions: [
      { id: 'vision_01', text: 'Apakah pesantren punya gambaran yang jelas tentang santri seperti apa yang ingin dibentuk?', action: 'Rumusan profil santri ideal dalam bahasa sederhana dan gunakan sebagai arah bersama.' },
      { id: 'vision_02', text: 'Apakah pimpinan punya prioritas utama yang jelas untuk tahun atau semester ini?', action: 'Tetapkan 3–5 prioritas utama periode berjalan agar energi lembaga tidak terpecah.' },
      { id: 'vision_03', text: 'Apakah guru, pengasuh, dan staf memahami arah besar pesantren?', action: 'Sosialisasikan arah pesantren secara ringkas dan kaitkan dengan tugas tiap bagian.' },
      { id: 'vision_04', text: 'Apakah program yang dijalankan benar-benar mendukung visi pesantren, bukan sekadar rutinitas?', action: 'Tinjau program rutin dan hentikan atau ubah program yang tidak lagi mendukung tujuan utama.' },
      { id: 'vision_05', text: 'Apakah target pesantren dibuat cukup konkret sehingga bisa dilihat kemajuannya?', action: 'Ubah target umum menjadi hasil yang jelas, punya ukuran, penanggung jawab, dan waktu.' },
      { id: 'vision_06', text: 'Apakah pimpinan rutin mengecek apakah target yang dibuat benar-benar bergerak?', action: 'Buat review singkat berkala untuk melihat target, hambatan, dan keputusan berikutnya.' },
      { id: 'vision_07', text: 'Apakah keputusan penting dibuat dengan melihat data dan kondisi nyata?', action: 'Biasakan keputusan penting memakai data sederhana, bukan hanya kesan atau asumsi.' },
      { id: 'vision_08', text: 'Jika ada perubahan kebijakan, apakah alasan dan tujuannya dijelaskan kepada tim?', action: 'Setiap perubahan penting perlu disertai alasan, tujuan, dan dampak bagi pelaksana.' },
      { id: 'vision_09', text: 'Apakah jelas keputusan mana yang harus diambil pimpinan dan mana yang boleh diputuskan unit?', action: 'Buat batas kewenangan sederhana agar keputusan operasional tidak selalu naik ke pimpinan.' },
      { id: 'vision_10', text: 'Apakah pesantren tetap bisa berjalan baik ketika pimpinan utama sedang tidak ada?', action: 'Siapkan delegasi, penanggung jawab pengganti, dan informasi penting yang mudah diteruskan.' }
    ]
  },
  {
    id: 'governance',
    code: 'B',
    title: 'Struktur & Tata Kelola',
    subtitle: 'Apakah orang tahu siapa mengerjakan apa dan bagaimana masalah diselesaikan?',
    questions: [
      { id: 'governance_01', text: 'Apakah struktur organisasi sesuai dengan pekerjaan yang benar-benar terjadi sehari-hari?', action: 'Sesuaikan struktur dengan fungsi nyata, bukan hanya nama jabatan di atas kertas.' },
      { id: 'governance_02', text: 'Apakah setiap orang tahu tugas utamanya dengan jelas?', action: 'Ringkas jobdesk setiap peran menjadi tugas utama, hasil yang diharapkan, dan batas kerja.' },
      { id: 'governance_03', text: 'Apakah batas kewenangan tiap jabatan cukup jelas?', action: 'Tentukan keputusan yang boleh diambil sendiri dan keputusan yang harus dieskalasikan.' },
      { id: 'governance_04', text: 'Jika seseorang memegang beberapa peran, apakah prioritas kerjanya sudah diatur?', action: 'Petakan rangkap peran dan sepakati mana tugas utama, pendukung, serta penggantinya.' },
      { id: 'governance_05', text: 'Apakah pekerjaan penting punya cara kerja atau standar yang mudah dipahami?', action: 'Buat SOP atau checklist sederhana untuk pekerjaan yang paling sering menimbulkan masalah.' },
      { id: 'governance_06', text: 'Apakah standar kerja itu benar-benar dipakai, bukan hanya disimpan?', action: 'Uji pemakaian SOP melalui contoh pekerjaan nyata dan perbaiki bagian yang sulit digunakan.' },
      { id: 'governance_07', text: 'Apakah rapat menghasilkan keputusan yang jelas: siapa melakukan apa dan kapan selesai?', action: 'Gunakan format keputusan rapat yang selalu mencatat tindakan, PIC, dan tenggat.' },
      { id: 'governance_08', text: 'Jika ada masalah, apakah orang tahu harus menyelesaikannya di level mana?', action: 'Buat jalur eskalasi sederhana: selesaikan di level terdekat, naikkan bila melewati batas kewenangan.' },
      { id: 'governance_09', text: 'Apakah dokumen kerja terbaru mudah ditemukan oleh orang yang membutuhkannya?', action: 'Tetapkan satu lokasi dokumen resmi dan tandai versi yang sedang berlaku.' },
      { id: 'governance_10', text: 'Jika aturan berubah, apakah perubahan itu sampai dan dipahami oleh pelaksana?', action: 'Gunakan satu mekanisme pengumuman perubahan dan pastikan versi lama tidak terus dipakai.' }
    ]
  },
  {
    id: 'people',
    code: 'C',
    title: 'SDM & Pengembangan Personil',
    subtitle: 'Apakah orang ditempatkan, dibimbing, dan dievaluasi dengan baik?',
    questions: [
      { id: 'people_01', text: 'Apakah jumlah dan jenis personil disesuaikan dengan pekerjaan yang memang harus ditangani?', action: 'Petakan beban kerja utama sebelum memutuskan kebutuhan tambahan personil.' },
      { id: 'people_02', text: 'Apakah rekrutmen dan penempatan memakai kriteria yang sesuai dengan tugas?', action: 'Tetapkan kriteria minimal untuk setiap fungsi sebelum memilih atau memindahkan personil.' },
      { id: 'people_03', text: 'Apakah personil baru mendapat penjelasan tugas, standar kerja, dan aturan penting?', action: 'Buat orientasi singkat untuk 7–30 hari pertama dan tunjuk pendamping awal.' },
      { id: 'people_04', text: 'Apakah kebutuhan peningkatan kemampuan personil diketahui dan ditindaklanjuti?', action: 'Catat 1–2 kebutuhan pengembangan tiap personil dan tindak lanjuti lewat coaching atau pelatihan.' },
      { id: 'people_05', text: 'Apakah beban kerja tiap orang cukup masuk akal dan tidak terlalu timpang?', action: 'Bandingkan waktu, tanggung jawab, dan rangkap peran sebelum membagi beban kerja.' },
      { id: 'people_06', text: 'Apakah ada pengaturan istirahat, pengganti, dan bantuan ketika beban meningkat?', action: 'Tentukan waktu istirahat, petugas pengganti, dan jalur meminta bantuan pada tugas kritis.' },
      { id: 'people_07', text: 'Apakah setiap personil tahu hasil kerja apa yang diharapkan darinya?', action: 'Tetapkan 3–5 hasil kerja utama atau KPI sederhana yang benar-benar dipahami personil.' },
      { id: 'people_08', text: 'Apakah kinerja personil dievaluasi secara rutin dan dengan ukuran yang jelas?', action: 'Jadwalkan evaluasi berkala dengan indikator yang sama-sama diketahui sejak awal.' },
      { id: 'people_09', text: 'Setelah evaluasi, apakah personil mendapat umpan balik dan bantuan untuk memperbaiki diri?', action: 'Ubah evaluasi menjadi percakapan pembinaan dengan satu fokus perbaikan yang ditindaklanjuti.' },
      { id: 'people_10', text: 'Apakah penghargaan, kompensasi, dan serah terima tugas dikelola dengan cukup jelas?', action: 'Jelaskan dasar penghargaan dan siapkan serah terima sederhana saat orang berpindah peran.' }
    ]
  },
  {
    id: 'education',
    code: 'D',
    title: 'Pendidikan & Pembelajaran',
    subtitle: 'Apakah proses belajar punya tujuan, pelaksanaan, dan tindak lanjut yang jelas?',
    questions: [
      { id: 'education_01', text: 'Apakah setiap program belajar punya tujuan yang jelas?', action: 'Rumusan tujuan belajar dibuat sederhana dan spesifik untuk setiap program.' },
      { id: 'education_02', text: 'Apakah urutan materi atau level pembelajaran disusun dengan jelas?', action: 'Susun peta materi/level agar guru dan santri tahu jalur belajar dari awal sampai target.' },
      { id: 'education_03', text: 'Apakah jadwal, guru, dan sumber belajar sudah disiapkan sesuai kebutuhan program?', action: 'Tinjau jadwal dan penugasan berdasarkan kebutuhan program, bukan hanya ketersediaan orang.' },
      { id: 'education_04', text: 'Apakah guru menyiapkan pembelajaran sesuai kemampuan santri dan tujuan belajar?', action: 'Gunakan persiapan mengajar sederhana yang memuat tujuan, kemampuan awal, kegiatan, dan cek pemahaman.' },
      { id: 'education_05', text: 'Apakah pembelajaran membuat santri aktif memahami, bukan hanya mendengar?', action: 'Tambahkan aktivitas bertanya, mencoba, menjelaskan kembali, atau praktik dalam pembelajaran.' },
      { id: 'education_06', text: 'Apakah ketidakhadiran dan hambatan belajar santri ditindaklanjuti?', action: 'Tentukan cara mendeteksi santri tertinggal dan siapa yang bertanggung jawab menindaklanjuti.' },
      { id: 'education_07', text: 'Apakah penilaian memakai kriteria yang jelas dan hasilnya mudah ditelusuri?', action: 'Gunakan kriteria penilaian yang konsisten serta penyimpanan nilai yang rapi.' },
      { id: 'education_08', text: 'Apakah hasil penilaian diikuti remedial, pengayaan, atau bantuan belajar?', action: 'Hubungkan nilai dengan tindakan berikutnya, bukan berhenti pada angka rapor.' },
      { id: 'education_09', text: 'Apakah mutu program belajar dievaluasi, bukan hanya jumlah kegiatan?', action: 'Review program dengan melihat perkembangan santri, hambatan, dan kualitas pelaksanaan.' },
      { id: 'education_10', text: 'Apakah kenaikan kelas, level, atau kelompok memakai kriteria yang jelas?', action: 'Tetapkan kriteria transisi yang bisa dijelaskan kepada guru, santri, dan wali.' }
    ]
  },
  {
    id: 'care',
    code: 'E',
    title: 'Pengasuhan & Kehidupan Santri',
    subtitle: 'Apakah kehidupan harian santri didampingi, dibina, dan ditangani dengan jelas?',
    questions: [
      { id: 'care_01', text: 'Apakah program harian santri punya tujuan dan penanggung jawab yang jelas?', action: 'Petakan program 24 jam, tujuan singkat, PIC, dan standar pelaksanaannya.' },
      { id: 'care_02', text: 'Apakah kehadiran dan pelaksanaan program penting dicatat dengan rapi?', action: 'Gunakan pencatatan yang sederhana untuk kehadiran, pelaksanaan, dan kejadian penting.' },
      { id: 'care_03', text: 'Apakah setiap santri tahu siapa pendamping yang bisa ia hubungi?', action: 'Tetapkan pendamping yang jelas untuk kelompok santri dan cara menghubunginya.' },
      { id: 'care_04', text: 'Apakah ada pembinaan rutin yang membantu perkembangan karakter santri?', action: 'Buat ritme pembinaan rutin dengan fokus perkembangan yang sederhana dan terukur.' },
      { id: 'care_05', text: 'Apakah tugas pendamping harian dibedakan dari penanganan kasus khusus?', action: 'Bedakan fungsi pendampingan, pelaporan masalah, konseling, dan keputusan kasus.' },
      { id: 'care_06', text: 'Apakah aturan disiplin diterapkan dengan cukup konsisten dan mendidik?', action: 'Tinjau aturan disiplin agar jelas, konsisten, proporsional, dan berorientasi pembinaan.' },
      { id: 'care_07', text: 'Jika ada pelanggaran atau masalah, apakah jalur pelaporannya jelas?', action: 'Tetapkan siapa menerima laporan, siapa melakukan klarifikasi, dan siapa memberi tindak lanjut.' },
      { id: 'care_08', text: 'Apakah santri punya cara yang aman untuk meminta bantuan atau menyampaikan masalah?', action: 'Sediakan kanal bantuan yang mudah diketahui, aman, dan punya jalur alternatif.' },
      { id: 'care_09', text: 'Apakah perkembangan karakter dan kebiasaan santri dipantau secara berkala?', action: 'Gunakan indikator perkembangan yang sederhana dan bahas perubahan secara berkala.' },
      { id: 'care_10', text: 'Jika santri membutuhkan dukungan khusus, apakah koordinasinya berjalan jelas?', action: 'Tentukan siapa mengoordinasikan dukungan dan kapan perlu melibatkan wali atau tenaga lain.' }
    ]
  },
  {
    id: 'operations',
    code: 'F',
    title: 'Operasional & Fasilitas',
    subtitle: 'Apakah layanan dasar pesantren berjalan aman dan dapat diandalkan?',
    questions: [
      { id: 'operations_01', text: 'Apakah layanan makan punya perencanaan, penanggung jawab, dan standar yang jelas?', action: 'Tentukan menu, porsi, PIC, jadwal, dan standar sederhana layanan makan.' },
      { id: 'operations_02', text: 'Apakah bahan makanan diterima, disimpan, dan dijaga kebersihannya dengan baik?', action: 'Gunakan checklist ringkas untuk penerimaan, penyimpanan, kebersihan, dan bahan bermasalah.' },
      { id: 'operations_03', text: 'Apakah santri mudah mendapat pertolongan kesehatan dan rujukan ketika diperlukan?', action: 'Buat jalur pertolongan dan rujukan yang diketahui petugas, termasuk pengganti saat PIC tidak ada.' },
      { id: 'operations_04', text: 'Apakah obat, perlengkapan kesehatan, dan catatan layanan dikelola dengan rapi?', action: 'Tetapkan stok minimum, pemeriksaan berkala, dan pencatatan layanan tanpa membuka data sensitif.' },
      { id: 'operations_05', text: 'Apakah kebersihan, air, toilet, dan sanitasi punya pembagian tanggung jawab yang jelas?', action: 'Bagi area, PIC, standar kebersihan, dan jadwal pemeriksaan layanan dasar.' },
      { id: 'operations_06', text: 'Jika air, listrik, atau layanan dasar terganggu, apakah ada cara penanganan yang jelas?', action: 'Catat gangguan, solusi sementara, PIC, dan verifikasi bahwa layanan sudah pulih.' },
      { id: 'operations_07', text: 'Apakah aset penting dicatat beserta kondisi dan penanggung jawabnya?', action: 'Mulai inventaris dari aset kritis dan catat kondisi serta pemilik tanggung jawabnya.' },
      { id: 'operations_08', text: 'Apakah permintaan perbaikan dan pemeliharaan benar-benar ditindaklanjuti sampai selesai?', action: 'Gunakan log perbaikan dari permintaan, tindakan, sampai pengecekan fungsi kembali.' },
      { id: 'operations_09', text: 'Apakah akses area, kunjungan, dan risiko keamanan fisik cukup dikendalikan?', action: 'Petakan area terbatas, aturan kunjungan, titik risiko, dan petugas yang berwenang.' },
      { id: 'operations_10', text: 'Apakah pesantren punya kesiapan menghadapi keadaan darurat?', action: 'Tetapkan prosedur sederhana, peran petugas, titik kumpul, kontak penting, dan latihan berkala.' }
    ]
  },
  {
    id: 'finance',
    code: 'G',
    title: 'Administrasi & Keuangan',
    subtitle: 'Apakah dokumen dan keuangan dikelola rapi, jelas, dan dapat ditelusuri?',
    questions: [
      { id: 'finance_01', text: 'Apakah dokumen penting lembaga tersimpan rapi dan jelas siapa yang menjaganya?', action: 'Buat daftar dokumen penting, lokasi penyimpanan, PIC, dan siapa yang boleh mengakses.' },
      { id: 'finance_02', text: 'Apakah masa berlaku dan pembaruan dokumen penting dipantau?', action: 'Buat kalender pengingat untuk dokumen yang perlu diperpanjang atau diperbarui.' },
      { id: 'finance_03', text: 'Apakah anggaran dibuat sesuai prioritas program pesantren?', action: 'Hubungkan pos anggaran dengan program dan prioritas yang telah disepakati.' },
      { id: 'finance_04', text: 'Jika anggaran berubah, apakah alasan dan persetujuannya tercatat?', action: 'Catat perubahan anggaran, alasan, jumlah, dan pihak yang menyetujui.' },
      { id: 'finance_05', text: 'Apakah setiap penerimaan dan pengeluaran punya catatan dan bukti yang mudah ditelusuri?', action: 'Gunakan pencatatan transaksi yang konsisten dan simpan bukti dengan kode yang mudah dicari.' },
      { id: 'finance_06', text: 'Apakah transaksi penting diperiksa oleh pihak lain atau memakai kontrol pengganti?', action: 'Tambahkan pemeriksaan pihak kedua untuk transaksi penting bila pemisahan tugas terbatas.' },
      { id: 'finance_07', text: 'Apakah saldo dan catatan keuangan dicocokkan secara rutin?', action: 'Jadwalkan rekonsiliasi dan catat selisih sampai penyebabnya jelas.' },
      { id: 'finance_08', text: 'Apakah laporan keuangan ditelaah dan dipakai untuk mengambil keputusan?', action: 'Buat laporan ringkas berkala dan bahas selisih, tren, serta kebutuhan keputusan.' },
      { id: 'finance_09', text: 'Apakah pembelian dan penerimaan barang punya alur yang jelas?', action: 'Pisahkan permintaan, persetujuan, pembelian, dan konfirmasi barang diterima bila memungkinkan.' },
      { id: 'finance_10', text: 'Apakah pertanggungjawaban dana dan potensi konflik kepentingan ditangani dengan jelas?', action: 'Tetapkan aturan pertanggungjawaban dan cara menangani transaksi yang melibatkan pihak terkait.' }
    ]
  },
  {
    id: 'parents',
    code: 'H',
    title: 'Pelayanan Wali Santri',
    subtitle: 'Apakah wali mendapat informasi, layanan, dan komunikasi yang jelas?',
    questions: [
      { id: 'parents_01', text: 'Apakah informasi program, biaya, dan aturan disampaikan dengan jelas kepada wali?', action: 'Satukan informasi penting dalam panduan singkat yang mudah ditemukan wali.' },
      { id: 'parents_02', text: 'Apakah wali baru mendapat orientasi tentang hak, kewajiban, dan cara menghubungi pesantren?', action: 'Buat orientasi wali baru yang ringkas dengan kanal layanan dan aturan utama.' },
      { id: 'parents_03', text: 'Apakah jelas kanal komunikasi untuk pertanyaan yang berbeda?', action: 'Petakan kanal: akademik, pengasuhan, izin, kesehatan, administrasi, dan keadaan penting.' },
      { id: 'parents_04', text: 'Apakah pertanyaan atau permintaan wali diteruskan ke orang yang tepat dan mendapat jawaban?', action: 'Gunakan alur penerimaan–penerusan–jawaban agar pesan tidak berhenti di satu orang.' },
      { id: 'parents_05', text: 'Apakah perkembangan santri dilaporkan kepada wali secara teratur?', action: 'Tetapkan periode dan isi minimal laporan perkembangan yang benar-benar berguna bagi wali.' },
      { id: 'parents_06', text: 'Apakah wali punya ruang untuk bertanya dan mendapatkan klarifikasi atas laporan santri?', action: 'Sediakan mekanisme klarifikasi yang jelas setelah laporan perkembangan diterima.' },
      { id: 'parents_07', text: 'Apakah izin, kunjungan, titipan, dan kebutuhan layanan lain punya alur yang mudah dipahami?', action: 'Sederhanakan alur layanan wali dan tampilkan status proses bila memungkinkan.' },
      { id: 'parents_08', text: 'Apakah keluhan wali dicatat, ditindaklanjuti, dan dikonfirmasi penyelesaiannya?', action: 'Gunakan log keluhan sederhana dengan PIC, tindakan, status, dan konfirmasi akhir.' },
      { id: 'parents_09', text: 'Apakah wali dilibatkan dalam mendukung pendidikan santri secara tepat?', action: 'Rancang parenting atau komunikasi yang fokus pada peran wali dalam mendukung perkembangan santri.' },
      { id: 'parents_10', text: 'Apakah masukan dari wali benar-benar dipakai untuk memperbaiki layanan?', action: 'Kelompokkan masukan wali, pilih prioritas, dan komunikasikan perbaikan yang dilakukan.' }
    ]
  },
  {
    id: 'digital',
    code: 'I',
    title: 'Data & Digitalisasi',
    subtitle: 'Apakah data rapi, aman, dan benar-benar membantu pekerjaan?',
    questions: [
      { id: 'digital_01', text: 'Apakah data penting santri, SDM, dan program punya sumber utama yang jelas?', action: 'Tentukan sumber utama untuk setiap jenis data agar tidak ada banyak versi yang saling berbeda.' },
      { id: 'digital_02', text: 'Apakah perubahan data diperbarui dengan cepat dan tidak menimbulkan banyak data ganda?', action: 'Tetapkan siapa yang boleh memperbarui data dan bagaimana perubahan dicatat.' },
      { id: 'digital_03', text: 'Apakah kelengkapan dan ketepatan data rutin diperiksa?', action: 'Buat pemeriksaan sederhana untuk data penting: lengkap, benar, terbaru, dan konsisten.' },
      { id: 'digital_04', text: 'Jika ada kesalahan data, apakah cara memperbaikinya jelas dan dapat ditelusuri?', action: 'Tentukan jalur koreksi data dan simpan catatan perubahan untuk informasi penting.' },
      { id: 'digital_05', text: 'Apakah akses data dibatasi sesuai kebutuhan tugas masing-masing orang?', action: 'Buat daftar siapa boleh melihat, mengubah, dan mengunduh setiap kelompok data.' },
      { id: 'digital_06', text: 'Apakah data pribadi santri dan keluarga dijaga dan tidak dibagikan sembarangan?', action: 'Batasi pengumpulan dan pembagian data sensitif hanya untuk kebutuhan yang jelas.' },
      { id: 'digital_07', text: 'Apakah data penting dicadangkan secara rutin?', action: 'Tetapkan jadwal backup, cakupan data, lokasi cadangan, dan penanggung jawab.' },
      { id: 'digital_08', text: 'Apakah pesantren pernah memastikan bahwa data cadangan benar-benar bisa dipulihkan?', action: 'Lakukan uji pemulihan pada lingkungan aman dan catat hasilnya.' },
      { id: 'digital_09', text: 'Apakah aplikasi atau alat digital dipilih karena memang membantu proses kerja?', action: 'Mulai dari masalah proses, lalu pilih alat yang paling sederhana untuk menyelesaikannya.' },
      { id: 'digital_10', text: 'Apakah data yang dikumpulkan benar-benar dipakai untuk mengambil keputusan?', action: 'Tentukan 3–5 data utama yang rutin dibaca dalam rapat atau review manajemen.' }
    ]
  },
  {
    id: 'quality',
    code: 'J',
    title: 'Budaya Organisasi & Perbaikan Mutu',
    subtitle: 'Apakah nilai lembaga hidup dalam perilaku dan mendorong perbaikan yang nyata?',
    questions: [
      { id: 'quality_01', text: 'Apakah nilai utama pesantren diterjemahkan menjadi perilaku yang jelas dalam pekerjaan sehari-hari?', action: 'Terjemahkan nilai menjadi contoh perilaku yang dapat dilihat, dipraktikkan, dan dikoreksi.' },
      { id: 'quality_02', text: 'Apakah pimpinan dan penanggung jawab memberi teladan serta koreksi yang konsisten?', action: 'Sepakati standar keteladanan dan cara memberi koreksi yang konsisten lintas unit.' },
      { id: 'quality_03', text: 'Apakah staf merasa aman menyampaikan masalah, kesalahan, atau risiko tanpa takut dipersalahkan?', action: 'Bangun jalur speak-up yang aman, jelas, dan memiliki perlindungan serta tindak lanjut.' },
      { id: 'quality_04', text: 'Apakah masukan dan laporan ditanggapi secara adil serta dapat ditelusuri penyelesaiannya?', action: 'Catat penerimaan, penelaahan, keputusan, dan penutupan setiap masukan penting.' },
      { id: 'quality_05', text: 'Apakah pimpinan rutin meninjau mutu layanan dan keputusan menggunakan bukti lintas unit?', action: 'Buat management review berkala dengan data minimum, keputusan, PIC, dan tenggat.' },
      { id: 'quality_06', text: 'Apakah informasi dari unit lain diverifikasi sebelum menjadi dasar keputusan penting?', action: 'Tetapkan cara verifikasi silang untuk data dan temuan yang berdampak besar.' },
      { id: 'quality_07', text: 'Apakah akar masalah dicari sebelum tindakan perbaikan ditetapkan?', action: 'Gunakan analisis akar masalah sederhana sebelum memilih tindakan korektif.' },
      { id: 'quality_08', text: 'Apakah tindakan perbaikan diperiksa kembali untuk memastikan masalah benar-benar tidak berulang?', action: 'Pisahkan status selesai dikerjakan dari verifikasi efektivitas setelah periode yang relevan.' },
      { id: 'quality_09', text: 'Apakah pelajaran dari masalah dan perbaikan dibagikan serta dimasukkan ke standar kerja?', action: 'Dokumentasikan pelajaran penting dan perbarui standar, briefing, atau pelatihan terkait.' },
      { id: 'quality_10', text: 'Apakah pesantren memiliki kebiasaan mencoba, mengevaluasi, dan memperbaiki sistem secara bertahap?', action: 'Bangun siklus perbaikan kecil dengan tujuan, ukuran, review, dan keputusan tindak lanjut.' }
    ]
  }
];

export function getStage(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  return STAGES.find(stage => Number(score) <= stage.max) || STAGES[STAGES.length - 1];
}

export function getDomain(domainId) {
  return DOMAINS.find(domain => domain.id === domainId);
}

export function getQuestion(questionId) {
  for (const domain of DOMAINS) {
    const question = domain.questions.find(item => item.id === questionId);
    if (question) return { ...question, domainId: domain.id, domainTitle: domain.title };
  }
  return null;
}
