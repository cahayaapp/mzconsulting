const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': 'Format alamat email tidak valid.',
  'auth/missing-password': 'Kata sandi wajib diisi.',
  'auth/user-not-found': 'Akun tidak ditemukan pada Firebase project yang aktif.',
  'auth/wrong-password': 'Kata sandi salah untuk akun ini.',
  'auth/user-disabled': 'Akun ini dinonaktifkan di Firebase Authentication.',
  'auth/too-many-requests': 'Terlalu banyak percobaan login. Tunggu beberapa saat, lalu coba kembali.',
  'auth/network-request-failed': 'Koneksi ke Firebase gagal. Periksa jaringan lalu coba kembali.',
  'auth/timeout': 'Firebase tidak merespons dalam batas waktu. Periksa jaringan lalu coba kembali.',
  'auth/operation-not-allowed': 'Login Email/Password belum diaktifkan pada Firebase project ini.',
  'auth/unauthorized-domain': 'Domain aplikasi ini belum diizinkan pada Firebase Authentication.',
  'auth/invalid-api-key': 'Firebase API key tidak valid. Periksa konfigurasi environment aplikasi.',
  'auth/app-not-authorized': 'Aplikasi ini tidak diizinkan memakai Firebase project yang dikonfigurasi.',
  'auth/project-not-found': 'Firebase project pada konfigurasi aplikasi tidak ditemukan.',
  'auth/internal-error': 'Firebase Authentication mengalami gangguan internal. Coba kembali beberapa saat lagi.'
};

export function firebaseAuthErrorMessage(error, environment) {
  const code = error?.code || 'auth/unknown';
  const project = environment?.projectId ? ` (${environment.projectId})` : '';

  if (code === 'auth/invalid-credential') {
    return `Akun tidak ditemukan atau kata sandi tidak sesuai pada Firebase ${environment?.name || 'environment'}${project}. [${code}]`;
  }

  const knownMessage = AUTH_ERROR_MESSAGES[code];
  if (knownMessage) return `${knownMessage} [${code}]`;

  const firebaseMessage = String(error?.message || 'Login gagal karena respons Firebase tidak dikenali.')
    .replace(/^Firebase:\s*/i, '')
    .trim();
  return `${firebaseMessage} [${code}]`;
}
