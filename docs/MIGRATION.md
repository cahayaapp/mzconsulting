# Migration Plan

## Prinsip

Migrasi bersifat additive. Tidak ada root lama yang dihapus atau diubah bentuknya. Project lama tetap dapat dibuka karena UI lama membaca `projects`, `responses`, dan `followups` seperti sebelumnya. `projectTransformations` dibuat secara lazy ketika tab Transformation Plan pertama kali dibuka.

## Urutan produksi

1. Export Realtime Database dari Firebase Console sebagai JSON dan simpan di lokasi aman.
2. Jalankan dry-run lokal:

   `node scripts/migrate-database.mjs firebase-export.json`

3. Tinjau jumlah project, analisis lama, follow-up lama, root tambahan, dan pastikan `destructiveChanges` bernilai `0`.
4. Buat backup dan artefak migrasi:

   `node scripts/migrate-database.mjs firebase-export.json --write`

5. Terapkan `firebase-rtdb-rules.json` yang baru.
6. Login sebagai admin, buka Knowledge Base, lalu publikasikan versi 1.0 ke database.
7. Uji satu project lama sebelum membuka akses lebih luas.

Script `--write` tidak menimpa export sumber. Script membuat file backup bertimestamp dan file `.migrated.json` baru.

## Rollback

Karena root lama tidak dimutasi, rollback aplikasi cukup mengembalikan source sebelumnya. Jika root baru perlu dibatalkan, pulihkan export backup melalui prosedur Firebase yang disetujui organisasi. Jangan menghapus root baru sebelum memeriksa apakah project sudah memiliki roadmap aktif.

## Compatibility

- Project lama tanpa `tenantId` tetap dapat dibuka oleh akun email lama.
- Script membuat indeks `userProjects` dari `createdBy` sebelum rules baru diterapkan. Jangan membalik urutan migrasi dan deployment rules.
- Project baru menyimpan `tenantId`, `createdBy`, dan membership konsultan.
- Catatan `analysisNote` dan rekomendasi/follow-up lama tidak dipindahkan atau dihapus.
- Knowledge base baru tidak dibaca oleh responden anonim.
