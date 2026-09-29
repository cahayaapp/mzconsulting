# Arsitektur MZ Consulting

## Baseline yang diaudit

Aplikasi adalah single-page application tanpa build step. `app.js` merender seluruh UI, Firebase Authentication menangani akun konsultan dan responden anonim, sedangkan Firebase Realtime Database menyimpan `projects`, `invites`, `responses`, dan `followups`. Versi awal menghitung rata-rata skor, gap perspektif, dan rekomendasi sederhana dari pertanyaan bernilai terendah.

Fungsi lama tetap digunakan. Root database lama, format jawaban, login, tautan responden, dashboard, grafik, catatan analisis, dan follow-up lama tidak dihapus.

## Lapisan baru

- `data/knowledge-base.v1.json`: artefak runtime hasil import D01–D10.
- `scripts/import-knowledge-base.mjs`: normalisasi dua variasi schema seed, validasi, dry-run, dan laporan import.
- `lib/solution-engine.js`: findings, confidence, dependency closure, safety override, recommendation ordering, roadmap, version snapshot, dan client-safe projection.
- `lib/access-control.js`: kebijakan role dan tenant yang dapat diuji tanpa Firebase.
- `lib/ai-adapter.js`: batas integrasi AI. Semua output AI berstatus draft; validasi, P0, closure, dan effectiveness tetap keputusan manusia.
- `projectTransformations/{projectId}`: findings, recommendations, snapshot playbook, roadmap, deliverables, dan effectiveness review per project.
- `knowledgeBase/versions/{version}`: publikasi knowledge base ke Firebase.
- `knowledgeBaseImports`: jejak import.
- `clientViews/{projectId}`: projection yang hanya memuat hasil tervalidasi.
- `auditLogs/{projectId}`: jejak validasi, replacement, override, dan effectiveness review.

## Traceability

`response answer` → `indicator` → `finding` → `recommendation` → `validated playbook snapshot` → `roadmap item` → `deliverable` → `effectiveness evidence`.

Snapshot membuat project lama tetap memakai versi playbook yang dipilih saat validasi. Publikasi knowledge base baru tidak mengubah snapshot tersebut.

## Solution engine

Engine memetakan dua indikator untuk setiap playbook, menghitung confidence dari jumlah perspektif dan perception gap, lalu menarik dependency playbook secara transitif. Playbook fondasi dinaikkan ke P1. Flag keselamatan kritis dapat menghasilkan P0 dan mendahului dependency normal. Rekomendasi selalu berstatus `SYSTEM_SUGGESTED` sampai konsultan memvalidasi.

Status delivery dipisahkan menjadi `Planned`, `In Progress`, `Implemented`, `Verification Pending`, `Effective`, `Needs Adjustment`, dan `Reopened`. Status `Effective` memerlukan bukti dan verifikasi konsultan.
