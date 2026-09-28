# MZ Consulting — Asesmen Awal Pesantren

Versi sederhana untuk asesmen multiperspektif berbasis GitHub Pages + Firebase Realtime Database.

## Konsep

1. Konsultan membuat asesmen dan memilih bidang.
2. Konsultan menambahkan perspektif, misalnya Direktur, Kepala Sekolah, Kepala Asrama.
3. Setiap perspektif mendapat tautan pribadi dan menjawab 10 pertanyaan per bidang.
4. Hasil dibandingkan dalam dashboard.
5. Konsultan menulis analisis awal, memilih rekomendasi, dan membuat tindak lanjut.

Data asesmen disimpan di Firebase Realtime Database. Kode GitHub hanya berisi aplikasi statis.

## Bidang asesmen

- Visi & Arah
- Struktur & Tata Kelola
- SDM & Pengembangan Personil
- Pendidikan & Pembelajaran
- Pengasuhan & Kehidupan Santri
- Operasional & Fasilitas
- Administrasi & Keuangan
- Pelayanan Wali Santri
- Data & Digitalisasi

Masing-masing bidang berisi 10 pertanyaan dengan bahasa sederhana.

## 1. Siapkan Firebase Authentication

Firebase Console → Authentication → Sign-in method:

- Aktifkan **Email/Password** untuk akun konsultan.
- Aktifkan **Anonymous** agar responden dapat mengisi lewat tautan tanpa membuat akun manual.

Lalu buka Authentication → Users dan buat akun Email/Password untuk konsultan. Aplikasi ini sengaja tidak menyediakan pendaftaran akun konsultan dari halaman publik.

## 2. Pasang Realtime Database Rules

Firebase Console → Realtime Database → Rules.

Salin isi file `firebase-rtdb-rules.json`, lalu Publish.

Aturan yang disertakan membuat:

- akun Email/Password dapat mengelola proyek konsultan;
- responden anonim hanya dapat membaca tautan undangan yang ia miliki dan menulis jawaban pada path tautan tersebut;
- setelah jawaban dikirim (`submittedAt` sudah ada), responden tidak dapat mengubah jawaban lagi;
- data proyek, analisis, dan tindak lanjut tidak dibuka untuk responden.

Tautan undangan berfungsi seperti tautan rahasia. Jangan membagikannya ke tempat publik.

## 3. Tambahkan domain GitHub Pages ke Firebase Auth

Firebase Console → Authentication → Settings → Authorized domains.

Tambahkan domain GitHub Pages Anda, misalnya:

`username.github.io`

Jika memakai custom domain, tambahkan custom domain tersebut juga.

## 4. Upload ke GitHub

Upload semua file dalam folder ini ke root repository:

- `index.html`
- `styles.css`
- `app.js`
- `questions.js`
- `firebase-config.js`
- `firebase-rtdb-rules.json`
- `favicon.svg`
- `.nojekyll`
- `404.html`
- `README.md`

Lalu GitHub → Repository → Settings → Pages:

- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/ (root)`
- Save

GitHub akan memberi alamat seperti:

`https://username.github.io/nama-repository/`

## 5. Tes lokal di VS Code

Jangan membuka `index.html` langsung dengan `file://` karena aplikasi memakai JavaScript module.

Pilihan termudah:

- gunakan extension **Live Server** di VS Code; atau
- dari terminal folder proyek jalankan `python3 -m http.server 5500`, lalu buka `http://localhost:5500`.

Tambahkan `localhost` ke Authorized domains Firebase bila diperlukan pada project Anda.

## Firebase SDK

Aplikasi menggunakan Firebase browser modules versi `12.19.0` dari `gstatic`, sehingga tidak perlu `npm install` atau build step untuk GitHub Pages.

## Catatan keamanan

Firebase web config memang berada di source code browser. Keamanan data tidak bergantung pada menyembunyikan API key, melainkan pada Firebase Authentication, Realtime Database Security Rules, pembatasan API key yang tepat, dan untuk produksi sebaiknya Firebase App Check.

Jangan pernah memasukkan service-account private key, FCM server key, password konsultan, atau secret non-Firebase ke repository GitHub.

## Struktur data utama

- `projects/{projectId}` — asesmen, pilihan bidang, perspektif, catatan konsultan.
- `invites/{inviteId}` — data minimum untuk tautan responden.
- `responses/{inviteId}` — jawaban responden dan status terkirim.
- `followups/{projectId}` — tindak lanjut hasil pembahasan.

## Status produk

Ini adalah asesmen diagnostik awal, bukan audit formal, akreditasi, sertifikasi, atau penilaian pribadi terhadap responden. Skor berfungsi sebagai alat bantu percakapan. Konsultan tetap membaca konteks dan menentukan tindak lanjut bersama klien.
