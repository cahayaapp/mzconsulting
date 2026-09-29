import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseAuthErrorMessage } from '../lib/auth-errors.js';

const staging = { name: 'STAGING', projectId: 'mz-consulting-stg-20260929' };

test('invalid credential identifies the active Firebase environment and error code', () => {
  const message = firebaseAuthErrorMessage({ code: 'auth/invalid-credential' }, staging);
  assert.match(message, /STAGING/);
  assert.match(message, /mz-consulting-stg-20260929/);
  assert.match(message, /auth\/invalid-credential/);
});

test('Firebase login failures retain their specific meaning', () => {
  assert.match(firebaseAuthErrorMessage({ code: 'auth/user-disabled' }, staging), /dinonaktifkan/);
  assert.match(firebaseAuthErrorMessage({ code: 'auth/too-many-requests' }, staging), /Terlalu banyak/);
  assert.match(firebaseAuthErrorMessage({ code: 'auth/unauthorized-domain' }, staging), /belum diizinkan/);
});
