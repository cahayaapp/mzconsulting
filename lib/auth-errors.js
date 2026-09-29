const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': 'Format alamat email tidak valid.',
  'auth/missing-password': 'Kata sandi wajib diisi.',
  'auth/user-disabled': 'Akun ini dinonaktifkan di Firebase Authentication.',
  'auth/too-many-requests': 'Terlalu banyak percobaan login. Tunggu beberapa saat, lalu coba kembali.',
  'auth/network-request-failed': 'Koneksi ke Firebase gagal. Periksa jaringan lalu coba kembali.',
  'auth/operation-not-allowed': 'Login Email/Password belum diaktifkan pada Firebase project ini.',
  'auth/unauthorized-domain': 'Domain aplikasi ini belum diizinkan pada Firebase Authentication.',
  'auth/internal-error': 'Firebase Authentication mengalami gangguan internal. Coba kembali beberapa saat lagi.'
};

export function firebaseAuthErrorMessage(error, environment) {
  const code = error?.code || 'auth/unknown';
  const project = environment?.projectId ? ` (${environment.projectId})` : '';

  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) {
    return `Akun tidak ditemukan atau kata sandi tidak sesuai pada Firebase ${environment?.name || 'environment'}${project}. [${code}]`;
  }

  const knownMessage = AUTH_ERROR_MESSAGES[code];
  if (knownMessage) return `${knownMessage} [${code}]`;

  const firebaseMessage = String(error?.message || 'Login gagal karena respons Firebase tidak dikenali.')
    .replace(/^Firebase:\s*/i, '')
    .trim();
  return `${firebaseMessage} [${code}]`;
}
