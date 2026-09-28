import { auth, db } from './firebase-config.js';
import { DOMAINS, SCALE_OPTIONS, getStage, getQuestion, getDomain } from './questions.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  ref,
  get,
  set,
  push,
  update,
  remove
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

const appEl = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const inviteFromUrl = new URLSearchParams(location.search).get('invite');

const state = {
  user: null,
  projects: {},
  currentProjectId: null,
  currentTab: 'overview',
  charts: [],
  respondent: {
    inviteId: inviteFromUrl,
    invite: null,
    response: null,
    index: 0,
    questions: []
  }
};

function now() { return Date.now(); }
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : Object.values(value);
}
function selectedDomains(project) {
  const ids = Array.isArray(project?.domains) ? project.domains : Object.keys(project?.domains || {}).filter(k => project.domains[k]);
  return DOMAINS.filter(domain => ids.includes(domain.id));
}
function formatDate(ms) {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ms));
}
function avg(values) {
  const clean = values.filter(v => Number.isFinite(Number(v))).map(Number);
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}
function scoreText(value) { return value == null ? '—' : Number(value).toFixed(2); }
function randomToken(bytes = 18) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
function baseUrl() { return `${location.origin}${location.pathname}`; }
function inviteUrl(inviteId) { return `${baseUrl()}?invite=${encodeURIComponent(inviteId)}`; }
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy failed');
}
function setButtonLoading(button, loading, label = 'Memproses…') {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}
function mountModal(modal, focusSelector = 'input, textarea, select, button') {
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    document.body.classList.remove('modal-open');
    modal.remove();
  };
  const onKeydown = event => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKeydown);
  modal.addEventListener('mousedown', event => { if (event.target === modal) close(); });
  modal.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', close));
  requestAnimationFrame(() => modal.querySelector(focusSelector)?.focus());
  return close;
}
function showToast(message, type = 'ok') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type === 'error' ? 'error' : ''}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toastEl.className = 'toast'; }, 2600);
}
function destroyCharts() {
  state.charts.forEach(chart => { try { chart.destroy(); } catch (_) {} });
  state.charts = [];
}
function iconLabel(projectName = '') {
  const words = projectName.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'MZ';
}
function isConsultantUser(user) { return !!user?.email && !user?.isAnonymous; }

async function safeGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

/* ---------------- Auth ---------------- */
onAuthStateChanged(auth, async user => {
  state.user = user;
  if (inviteFromUrl) {
    if (!user) {
      try { await signInAnonymously(auth); } catch (error) { renderFatal('Firebase Anonymous Auth belum aktif. Aktifkan di Firebase Console → Authentication → Sign-in method.'); }
      return;
    }
    await renderRespondentApp();
    return;
  }

  if (user?.isAnonymous) {
    await signOut(auth);
    renderLogin();
    return;
  }
  if (isConsultantUser(user)) await renderDashboard();
  else renderLogin();
});

function renderFatal(message) {
  appEl.innerHTML = `<div class="login-form-wrap"><div class="login-form"><div class="card card-pad"><div class="eyebrow">MZ Consulting</div><h2 style="margin-top:8px">Aplikasi belum siap dipakai</h2><p class="lead">${escapeHtml(message)}</p></div></div></div>`;
}

function renderLogin() {
  destroyCharts();
  appEl.innerHTML = `
    <div class="login-page">
      <section class="login-hero">
        <div class="login-logo">
          <div class="brand-mark">MZ</div>
          <div><div style="font-weight:850">MZ Consulting</div><div style="font-size:12px;color:rgba(255,255,255,.66)">Sahabat Tumbuh Pesantren</div></div>
        </div>
        <div class="login-copy">
          <div class="eyebrow" style="color:#d6b36a">Diagnosis awal yang sederhana</div>
          <h1>Pahami posisi pesantren sebelum menentukan langkah.</h1>
          <p>Pilih bidang yang ingin dilihat, kumpulkan perspektif pimpinan dan pengelola, bandingkan hasilnya, lalu gunakan data itu sebagai bahan percakapan dan pendampingan.</p>
          <div class="hero-points">
            <span class="hero-point">9 bidang asesmen</span>
            <span class="hero-point">10 pertanyaan per bidang</span>
            <span class="hero-point">Multiperspektif</span>
            <span class="hero-point">Tindak lanjut terarah</span>
          </div>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,.48)">MZ Consulting — Sahabat Tumbuh Pesantren</div>
      </section>
      <section class="login-form-wrap">
        <form id="loginForm" class="login-form">
          <div class="card">
            <div class="eyebrow">Ruang Konsultan</div>
            <h2 style="margin:8px 0 8px">Masuk ke MZ Consulting</h2>
            <p class="lead small">Gunakan akun Email/Password yang dibuat di Firebase Authentication.</p>
            <div class="form-group"><label for="email">Email</label><input class="input" type="email" id="email" autocomplete="username" required placeholder="email@contoh.com"></div>
            <div class="form-group"><label for="password">Kata sandi</label><input class="input" type="password" id="password" autocomplete="current-password" required placeholder="••••••••"></div>
            <button class="btn btn-primary btn-lg" style="width:100%" type="submit" id="loginSubmit">Masuk</button>
            <div id="loginError" class="helper" style="margin-top:12px;color:var(--danger)"></div>
          </div>
        </form>
      </section>
    </div>`;
  document.querySelector('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const err = document.querySelector('#loginError');
    err.textContent = '';
    const submit = document.querySelector('#loginSubmit');
    setButtonLoading(submit, true, 'Memeriksa akun…');
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (error) {
      err.textContent = 'Email atau kata sandi belum cocok. Pastikan akun sudah dibuat di Firebase Authentication.';
      setButtonLoading(submit, false);
      document.querySelector('#email').focus();
    }
  });
}

/* ---------------- Consultant shell ---------------- */
function consultantShell(content) {
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="container topbar-inner">
          <button class="brand" id="homeBrand" style="background:none;border:0;padding:0;text-align:left;cursor:pointer">
            <div class="brand-mark">MZ</div>
            <div><div class="brand-title">MZ Consulting</div><div class="brand-sub">Sahabat Tumbuh Pesantren</div></div>
          </button>
          <div class="top-actions">
            <span class="small muted hide-mobile">${escapeHtml(state.user?.email || '')}</span>
            <button class="btn btn-ghost btn-sm" id="logoutBtn">Keluar</button>
          </div>
        </div>
      </header>
      ${content}
    </div>`;
}
function bindShell() {
  document.querySelector('#homeBrand')?.addEventListener('click', () => renderDashboard());
  document.querySelector('#logoutBtn')?.addEventListener('click', () => signOut(auth));
}

async function loadProjects() {
  state.projects = (await safeGet('projects')) || {};
  return state.projects;
}


async function refreshDashboardSubmissionStates(projectsObj) {
  const updates = {};
  const jobs = [];
  for (const [projectId, project] of Object.entries(projectsObj || {})) {
    for (const [perspectiveId, perspective] of Object.entries(project.perspectives || {})) {
      jobs.push((async () => {
        const response = await safeGet(`responses/${perspective.inviteId}`);
        const submittedAt = response?.submittedAt || null;
        project.perspectives[perspectiveId].submittedAt = submittedAt;
        if ((perspective.submittedAt || null) !== submittedAt) {
          updates[`projects/${projectId}/perspectives/${perspectiveId}/submittedAt`] = submittedAt;
        }
      })());
    }
  }
  await Promise.all(jobs);
  if (Object.keys(updates).length) await update(ref(db), updates);
}

async function renderDashboard() {
  destroyCharts();
  state.currentProjectId = null;
  await loadProjects();
  await refreshDashboardSubmissionStates(state.projects);
  const projects = Object.entries(state.projects).map(([id, value]) => ({ id, ...value })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const totalPerspectives = projects.reduce((sum, p) => sum + Object.keys(p.perspectives || {}).length, 0);
  const submitted = projects.reduce((sum, p) => sum + Object.values(p.perspectives || {}).filter(item => item.submittedAt).length, 0);

  appEl.innerHTML = consultantShell(`
    <main class="page"><div class="container">
      <section class="hero-panel">
        <div class="eyebrow" style="color:#d6b36a">Ruang kerja konsultan</div>
        <div class="page-head" style="margin:8px 0 0;align-items:center">
          <div><h1 style="margin-bottom:10px">Asesmen yang ringan,<br>percakapan yang lebih tajam.</h1><p class="lead">Buat asesmen, pilih bidang, kumpulkan beberapa perspektif, lalu gunakan perbedaan pandangan sebagai bahan analisis awal.</p></div>
          <button class="btn btn-secondary btn-lg" id="newProjectBtn">＋ Buat asesmen</button>
        </div>
      </section>

      <section class="grid grid-3" style="margin-top:18px">
        <div class="card stat-card"><div class="stat-label">ASESMEN</div><div class="stat-number">${projects.length}</div><div class="small muted">proyek tersimpan</div></div>
        <div class="card stat-card"><div class="stat-label">PERSPEKTIF</div><div class="stat-number">${totalPerspectives}</div><div class="small muted">jabatan/responden</div></div>
        <div class="card stat-card"><div class="stat-label">JAWABAN MASUK</div><div class="stat-number">${submitted}</div><div class="small muted">perspektif selesai</div></div>
      </section>

      <section style="margin-top:28px">
        <div class="section-head"><div><div class="eyebrow">Daftar asesmen</div><h2 style="margin-top:5px">Pesantren yang sedang ditelaah</h2></div></div>
        ${projects.length ? `<div class="project-list">${projects.map(projectCardHtml).join('')}</div>` : emptyHtml('Belum ada asesmen', 'Mulai dengan satu pesantren dan pilih bidang yang paling ingin dipahami.', '<button class="btn btn-primary" id="newProjectEmpty">Buat asesmen pertama</button>')}
      </section>
    </div></main>`);
  bindShell();
  document.querySelector('#newProjectBtn')?.addEventListener('click', openNewProjectModal);
  document.querySelector('#newProjectEmpty')?.addEventListener('click', openNewProjectModal);
  document.querySelectorAll('[data-project]').forEach(el => el.addEventListener('click', () => renderProject(el.dataset.project, 'overview')));
}

function projectCardHtml(project) {
  const domains = selectedDomains(project);
  const perspectives = Object.values(project.perspectives || {});
  const done = perspectives.filter(item => item.submittedAt).length;
  return `<button type="button" class="card project-card" data-project="${project.id}" style="width:100%;text-align:left;border:1px solid var(--line)">
    <div class="project-letter">${escapeHtml(iconLabel(project.pesantren))}</div>
    <div class="project-main">
      <div class="project-name">${escapeHtml(project.pesantren || project.name)}</div>
      <div class="project-meta"><span>${escapeHtml(project.name || 'Asesmen Awal')}</span><span>${domains.length} bidang</span><span>${done}/${perspectives.length} perspektif masuk</span><span>${escapeHtml(project.period || '')}</span></div>
    </div>
    <span style="font-size:22px;color:var(--muted)">›</span>
  </button>`;
}

function emptyHtml(title, text, action = '') {
  return `<div class="empty"><div class="empty-icon">⌁</div><h3>${escapeHtml(title)}</h3><p class="lead small" style="margin:0 auto 18px">${escapeHtml(text)}</p>${action}</div>`;
}

function openNewProjectModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="newProjectTitle">
    <div class="modal-head"><div><div class="eyebrow">Asesmen baru</div><h2 id="newProjectTitle" style="margin:5px 0 0">Mulai dari bidang yang ingin dipahami</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div>
    <form id="newProjectForm">
      <div class="modal-body">
        <div class="grid grid-2">
          <div class="form-group"><label for="pesantren">Nama pesantren</label><input class="input" id="pesantren" required placeholder="Contoh: Pesantren Al-Hikmah"></div>
          <div class="form-group"><label for="assessmentName">Nama asesmen</label><input class="input" id="assessmentName" value="Asesmen Awal Pesantren" required></div>
        </div>
        <div class="form-group"><label for="period">Periode / waktu asesmen</label><input class="input" id="period" placeholder="Contoh: September 2026"></div>
        <div class="form-group"><label>Pilih bidang asesmen</label><div class="helper">Pilih hanya yang memang ingin dibahas sekarang. Semua perspektif akan menjawab bidang yang sama agar bisa dibandingkan.</div></div>
        <div class="domain-picker">${DOMAINS.map(domain => `<div class="domain-check"><input type="checkbox" id="domain_${domain.id}" value="${domain.id}" checked><label for="domain_${domain.id}"><div class="domain-code">${domain.code}</div><div class="domain-title">${escapeHtml(domain.title)}</div><div class="domain-desc">${escapeHtml(domain.subtitle)}</div></label></div>`).join('')}</div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button type="submit" class="btn btn-primary">Buat asesmen</button></div>
    </form>
  </div>`;
  const closeModal = mountModal(modal, '#pesantren');
  modal.querySelector('#newProjectForm').addEventListener('submit', async event => {
    event.preventDefault();
    const domains = [...modal.querySelectorAll('.domain-check input:checked')].map(el => el.value);
    if (!domains.length) return showToast('Pilih minimal satu bidang asesmen.', 'error');
    const projectRef = push(ref(db, 'projects'));
    const project = {
      name: modal.querySelector('#assessmentName').value.trim(),
      pesantren: modal.querySelector('#pesantren').value.trim(),
      period: modal.querySelector('#period').value.trim(),
      domains,
      createdAt: now(),
      createdBy: state.user.uid,
      engagementStatus: 'Belum dibahas',
      analysisNote: ''
    };
    const submit = event.submitter;
    setButtonLoading(submit, true, 'Membuat…');
    try {
      await set(projectRef, project);
      closeModal();
      showToast('Asesmen dibuat. Sekarang tambahkan perspektif.');
      await renderProject(projectRef.key, 'perspectives');
    } catch (error) {
      console.error(error);
      setButtonLoading(submit, false);
      showToast('Asesmen belum berhasil dibuat. Periksa koneksi lalu coba lagi.', 'error');
    }
  });
}

/* ---------------- Project ---------------- */
function tabButton(id, label, current) { return `<button class="tab ${id === current ? 'active' : ''}" data-tab="${id}">${label}</button>`; }

async function loadProjectResponses(project) {
  const perspectives = Object.entries(project.perspectives || {}).map(([id, item]) => ({ id, ...item }));
  const responses = {};
  await Promise.all(perspectives.map(async p => { responses[p.inviteId] = await safeGet(`responses/${p.inviteId}`); }));
  return { perspectives, responses };
}

function calculateAnalytics(project, bundle) {
  const domains = selectedDomains(project);
  const submittedPerspectives = bundle.perspectives.filter(p => bundle.responses[p.inviteId]?.submittedAt);
  const perspectiveScores = {};
  for (const p of submittedPerspectives) {
    const response = bundle.responses[p.inviteId];
    perspectiveScores[p.id] = { overall: null, domains: {}, questions: {}, label: p.label, name: response?.respondentName || p.respondentName || '' };
    const allDomainScores = [];
    for (const domain of domains) {
      const scores = domain.questions.map(q => response?.answers?.[q.id]?.score).filter(v => Number.isFinite(Number(v))).map(Number);
      domain.questions.forEach(q => {
        const val = response?.answers?.[q.id]?.score;
        if (Number.isFinite(Number(val))) perspectiveScores[p.id].questions[q.id] = Number(val);
      });
      const domainAvg = avg(scores);
      perspectiveScores[p.id].domains[domain.id] = domainAvg;
      if (domainAvg != null) allDomainScores.push(domainAvg);
    }
    perspectiveScores[p.id].overall = avg(allDomainScores);
  }

  const domainAggregate = {};
  const domainGaps = {};
  domains.forEach(domain => {
    const values = Object.values(perspectiveScores).map(p => p.domains[domain.id]).filter(v => v != null);
    domainAggregate[domain.id] = avg(values);
    domainGaps[domain.id] = values.length >= 2 ? Math.max(...values) - Math.min(...values) : 0;
  });
  const overall = avg(Object.values(domainAggregate));

  const questionStats = [];
  domains.forEach(domain => domain.questions.forEach(question => {
    const values = Object.values(perspectiveScores).map(p => p.questions[question.id]).filter(v => v != null);
    if (values.length) {
      questionStats.push({
        questionId: question.id,
        domainId: domain.id,
        average: avg(values),
        spread: values.length >= 2 ? Math.max(...values) - Math.min(...values) : 0,
        count: values.length
      });
    }
  }));

  return {
    submittedCount: submittedPerspectives.length,
    submittedPerspectives,
    perspectiveScores,
    domainAggregate,
    domainGaps,
    overall,
    questionStats,
    widestGaps: questionStats.filter(q => q.count >= 2).sort((a,b) => b.spread - a.spread).slice(0, 8),
    weakestQuestions: questionStats.slice().sort((a,b) => a.average - b.average)
  };
}

function renderProjectTab(projectId, project, bundle, analytics, tab) {
  if (tab === 'perspectives') return perspectivesHtml(project, bundle);
  if (tab === 'compare') return compareHtml(project, analytics);
  if (tab === 'recommendations') return recommendationsHtml(project, analytics);
  if (tab === 'followup') return `<div id="followupSlot"><div class="card card-pad">Memuat tindak lanjut…</div></div>`;
  return overviewHtml(project, analytics);
}

function overviewHtml(project, analytics) {
  const domains = selectedDomains(project);
  if (!analytics.submittedCount) {
    return `<div class="grid grid-2">
      ${emptyHtml('Belum ada jawaban yang masuk', 'Tambahkan perspektif seperti Direktur, Kepala Sekolah, atau Kepala Asrama lalu bagikan tautan asesmennya.', '<button class="btn btn-primary" data-go-tab="perspectives">Tambah perspektif</button>')}
      <div class="card card-pad"><div class="eyebrow">Bidang yang dipilih</div><h3 style="margin-top:7px">${domains.length} bidang asesmen</h3><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">${domains.map(d => `<span class="badge neutral">${d.code} · ${escapeHtml(d.title)}</span>`).join('')}</div><div class="divider"></div><p class="lead small">Setiap perspektif mendapat 10 pertanyaan per bidang. Hasil baru akan bermakna setelah ada jawaban yang dapat dibandingkan.</p></div>
    </div>`;
  }
  const stage = getStage(analytics.overall);
  return `
    <div class="grid grid-2">
      <div class="card position-card">
        <div class="position-score"><strong>${scoreText(analytics.overall)}</strong><span>dari 5</span></div>
        <div><span class="badge">${stage.badge}</span><h2 style="margin-top:10px">${stage.name}</h2><p class="lead small">${escapeHtml(stage.description)}</p><p class="helper">Ini gambaran awal dari ${analytics.submittedCount} perspektif yang sudah mengirim jawaban, bukan keputusan audit final.</p></div>
      </div>
      <div class="card card-pad">
        <div class="section-head"><div><div class="eyebrow">Catatan konsultan</div><h3 style="margin-top:5px">Apa yang paling perlu dibahas?</h3></div></div>
        <textarea class="textarea" id="analysisNote" placeholder="Tulis analisis awal setelah membaca hasil…">${escapeHtml(project.analysisNote || '')}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-primary btn-sm" id="saveAnalysis">Simpan catatan</button></div>
      </div>
    </div>
    <section style="margin-top:20px">
      <div class="section-head"><div><div class="eyebrow">Posisi per bidang</div><h2 style="margin-top:5px">Di mana yang sudah kuat, di mana yang perlu dibenahi?</h2></div></div>
      <div class="grid grid-3">${domains.map(domain => domainResultHtml(domain, analytics.domainAggregate[domain.id], analytics.domainGaps[domain.id])).join('')}</div>
    </section>
    <section class="card card-pad" style="margin-top:20px">
      <div class="grid grid-2" style="align-items:end">
        <div><div class="eyebrow">Status pendampingan</div><h3 style="margin-top:5px">Apa langkah setelah hasil dibahas?</h3><p class="lead small">Status ini hanya catatan kerja konsultan dan tidak memengaruhi hasil asesmen.</p></div>
        <div class="form-group" style="margin:0"><label>Status</label><select class="select" id="engagementStatus">${['Belum dibahas','Tertarik didampingi','Akan lanjut sendiri','Belum melanjutkan'].map(v => `<option ${project.engagementStatus === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
    </section>`;
}

function domainResultHtml(domain, score, gap) {
  const stage = score == null ? null : getStage(score);
  const gapBadge = gap >= 1.2 ? '<span class="badge warn">Gap tinggi</span>' : gap >= .7 ? '<span class="badge neutral">Perlu dibahas</span>' : '';
  return `<div class="card domain-result"><div class="domain-result-top"><div><div class="domain-code">${domain.code}</div><h3>${escapeHtml(domain.title)}</h3></div><div style="text-align:right"><div class="domain-score">${scoreText(score)}</div>${gapBadge}</div></div><div class="score-track"><div class="score-fill" style="width:${score == null ? 0 : Math.max(0, Math.min(100, score/5*100))}%"></div></div><div class="small muted" style="margin-top:10px">${stage ? `${stage.badge} · ${stage.name}` : 'Belum ada cukup jawaban'}</div></div>`;
}

function perspectivesHtml(project, bundle) {
  const perspectives = bundle.perspectives;
  return `
    <div class="section-head"><div><div class="eyebrow">Multiperspektif</div><h2 style="margin-top:5px">Siapa yang melihat kondisi pesantren?</h2><p class="lead small">Gunakan nama jabatan lokal. Semua perspektif menjawab bidang yang sama agar hasilnya bisa dibandingkan.</p></div><button class="btn btn-primary" id="addPerspectiveBtn">＋ Tambah perspektif</button></div>
    ${perspectives.length ? `<div class="grid grid-3">${perspectives.map(p => perspectiveCardHtml(project, p, bundle.responses[p.inviteId])).join('')}</div>` : emptyHtml('Belum ada perspektif', 'Mulai dari 2–4 jabatan yang melihat pesantren dari sisi berbeda, misalnya Direktur, Kepala Sekolah, dan Kepala Asrama.', '<button class="btn btn-primary" id="addPerspectiveEmpty">Tambah perspektif</button>')}`;
}

function perspectiveCardHtml(project, perspective, response) {
  const submitted = !!response?.submittedAt;
  const link = inviteUrl(perspective.inviteId);
  const progress = responseProgress(project, response);
  return `<div class="card perspective-card"><div class="perspective-top"><div><div class="perspective-label">${escapeHtml(perspective.label)}</div><div class="small muted">${escapeHtml(response?.respondentName || perspective.name || 'Nama opsional')}</div></div><span class="badge ${submitted ? 'success' : progress > 0 ? 'warn' : 'neutral'}">${submitted ? 'Selesai' : progress ? `${progress}%` : 'Belum mulai'}</span></div><div class="linkbox"><code>${escapeHtml(link)}</code><button class="btn btn-secondary btn-sm" data-copy-link="${perspective.inviteId}">Salin</button></div><div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-danger btn-sm" data-delete-perspective="${perspective.id}">Hapus</button></div></div>`;
}

function responseProgress(project, response) {
  if (!response?.answers) return 0;
  const total = selectedDomains(project).reduce((s,d) => s + d.questions.length, 0);
  const answered = Object.keys(response.answers).length;
  return total ? Math.round(answered / total * 100) : 0;
}

function compareHtml(project, analytics) {
  if (analytics.submittedCount < 1) return emptyHtml('Belum ada hasil untuk dibandingkan', 'Minta minimal satu perspektif mengirim jawaban. Perbandingan akan lebih berguna jika ada dua atau lebih perspektif.');
  const domains = selectedDomains(project);
  return `
    <div class="grid grid-2">
      <div class="card chart-card"><div class="eyebrow">Peta perspektif</div><h3 style="margin-top:5px">Perbandingan per bidang</h3><div class="chart-wrap"><canvas id="radarChart"></canvas></div></div>
      <div class="card chart-card"><div class="eyebrow">Rata-rata awal</div><h3 style="margin-top:5px">Posisi bidang pesantren</h3><div class="chart-wrap"><canvas id="barChart"></canvas></div></div>
    </div>
    <section class="card card-pad" style="margin-top:20px">
      <div class="section-head"><div><div class="eyebrow">Perbedaan pandangan</div><h3 style="margin-top:5px">Pertanyaan yang paling berbeda jawabannya</h3><p class="lead small">Perbedaan bukan berarti ada yang salah. Ini justru bahan terbaik untuk diklarifikasi bersama.</p></div></div>
      ${analytics.widestGaps.length ? `<div class="gap-list">${analytics.widestGaps.map(gap => {
        const q = getQuestion(gap.questionId);
        return `<div class="gap-item"><div class="gap-head"><div><span class="badge neutral">${escapeHtml(q.domainTitle)}</span><div class="gap-question" style="margin-top:8px">${escapeHtml(q.text)}</div></div><div class="gap-spread">selisih ${gap.spread.toFixed(1)}</div></div></div>`;
      }).join('')}</div>` : `<p class="muted">Belum ada dua perspektif yang menjawab pertanyaan yang sama.</p>`}
    </section>
    <section class="card card-pad" style="margin-top:20px;overflow:auto">
      <div class="eyebrow">Tabel perbandingan</div><h3 style="margin-top:5px">Skor setiap perspektif</h3>
      <table style="width:100%;border-collapse:collapse;min-width:700px;margin-top:14px"><thead><tr><th style="text-align:left;padding:10px;border-bottom:1px solid var(--line)">Perspektif</th>${domains.map(d => `<th style="text-align:center;padding:10px;border-bottom:1px solid var(--line)">${escapeHtml(d.title)}</th>`).join('')}<th style="text-align:center;padding:10px;border-bottom:1px solid var(--line)">Keseluruhan</th></tr></thead><tbody>${Object.entries(analytics.perspectiveScores).map(([id,p]) => `<tr><td style="padding:12px 10px;border-bottom:1px solid var(--line)"><strong>${escapeHtml(p.label)}</strong><div class="small muted">${escapeHtml(p.name || '')}</div></td>${domains.map(d => `<td style="text-align:center;padding:12px 10px;border-bottom:1px solid var(--line)">${scoreText(p.domains[d.id])}</td>`).join('')}<td style="text-align:center;padding:12px 10px;border-bottom:1px solid var(--line)"><strong>${scoreText(p.overall)}</strong></td></tr>`).join('')}</tbody></table>
    </section>`;
}

function recommendationsHtml(project, analytics) {
  if (!analytics.submittedCount) return emptyHtml('Belum ada rekomendasi awal', 'Rekomendasi akan muncul setelah ada jawaban yang dikirim.');
  const domains = selectedDomains(project);
  return `<div class="section-head"><div><div class="eyebrow">Rekomendasi awal</div><h2 style="margin-top:5px">Apa yang layak dibahas lebih dahulu?</h2><p class="lead small">Saran ini dibuat dari area yang nilainya paling rendah. Konsultan tetap menentukan apakah saran tersebut sesuai dengan konteks pesantren.</p></div></div>
  <div class="grid grid-2">${domains.map(domain => {
    const score = analytics.domainAggregate[domain.id];
    const domainQuestions = analytics.weakestQuestions.filter(q => q.domainId === domain.id);
    const weakest = domainQuestions[0];
    const q = weakest ? getQuestion(weakest.questionId) : null;
    const stage = getStage(score);
    const action = q?.action || 'Bahas kondisi bidang ini bersama pihak terkait dan tentukan satu perbaikan yang realistis.';
    return `<div class="card reco-card ${score != null && score < 3 ? 'weak' : 'good'}"><div class="perspective-top"><div><span class="badge neutral">${domain.code}</span><h3 style="margin-top:9px">${escapeHtml(domain.title)}</h3></div><div style="text-align:right"><div class="domain-score">${scoreText(score)}</div><div class="small muted">${stage?.name || ''}</div></div></div>${q ? `<div class="small muted" style="margin-top:10px">Fokus terlemah: ${escapeHtml(q.text)}</div>` : ''}<div class="reco-action"><strong>Saran awal:</strong> ${escapeHtml(action)}</div><button class="btn btn-secondary btn-sm" style="margin-top:14px" data-add-followup="${domain.id}" data-question="${q?.id || ''}">Masukkan ke tindak lanjut</button></div>`;
  }).join('')}</div>`;
}

async function followupHtml(projectId) {
  const data = (await safeGet(`followups/${projectId}`)) || {};
  const rows = Object.entries(data).map(([id,item]) => ({ id,...item })).sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  return `<div class="section-head"><div><div class="eyebrow">Pendampingan</div><h2 style="margin-top:5px">Tindak lanjut yang disepakati</h2><p class="lead small">Bagian ini menjadi jembatan dari asesmen awal menuju pekerjaan konsultasi yang nyata.</p></div><button class="btn btn-primary" id="addFollowupManual">＋ Tambah tindak lanjut</button></div>
  ${rows.length ? `<div class="card card-pad">${rows.map(item => `<div class="followup-row"><div><div class="followup-title">${escapeHtml(item.title)}</div><div class="small muted" style="margin-top:4px">${escapeHtml(item.action || '')}</div></div><input class="input" data-follow-owner="${item.id}" value="${escapeHtml(item.owner || '')}" placeholder="PIC"><input type="date" class="input" data-follow-date="${item.id}" value="${escapeHtml(item.targetDate || '')}"><select class="select" data-follow-status="${item.id}">${['Rencana','Berjalan','Selesai','Ditunda'].map(s => `<option ${item.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn btn-danger btn-sm" data-follow-delete="${item.id}">Hapus</button></div>`).join('')}</div>` : emptyHtml('Belum ada tindak lanjut', 'Pilih rekomendasi yang ingin dikerjakan atau tambahkan tindakan secara manual.')}`;
}

function bindProjectTab(projectId, project, bundle, analytics, tab) {
  document.querySelectorAll('[data-go-tab]').forEach(btn => btn.addEventListener('click', () => renderProject(projectId, btn.dataset.goTab)));
  if (tab === 'overview') {
    document.querySelector('#saveAnalysis')?.addEventListener('click', async () => {
      await update(ref(db, `projects/${projectId}`), { analysisNote: document.querySelector('#analysisNote').value.trim(), updatedAt: now() });
      showToast('Catatan analisis disimpan.');
    });
    document.querySelector('#engagementStatus')?.addEventListener('change', async event => {
      await update(ref(db, `projects/${projectId}`), { engagementStatus: event.target.value, updatedAt: now() });
      showToast('Status pendampingan diperbarui.');
    });
  }
  if (tab === 'perspectives') {
    document.querySelector('#addPerspectiveBtn')?.addEventListener('click', () => openPerspectiveModal(projectId, project));
    document.querySelector('#addPerspectiveEmpty')?.addEventListener('click', () => openPerspectiveModal(projectId, project));
    document.querySelectorAll('[data-copy-link]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await copyText(inviteUrl(btn.dataset.copyLink));
        showToast('Tautan asesmen disalin.');
      } catch (_) { showToast('Tautan belum dapat disalin. Silakan salin langsung dari kolom tautan.', 'error'); }
    }));
    document.querySelectorAll('[data-delete-perspective]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Hapus perspektif ini? Jawaban yang sudah tersimpan juga akan dihapus.')) return;
      const p = project.perspectives?.[btn.dataset.deletePerspective];
      if (p?.inviteId) {
        await remove(ref(db, `responses/${p.inviteId}`));
        await remove(ref(db, `invites/${p.inviteId}`));
      }
      await remove(ref(db, `projects/${projectId}/perspectives/${btn.dataset.deletePerspective}`));
      showToast('Perspektif dihapus.');
      renderProject(projectId, 'perspectives');
    }));
  }
  if (tab === 'compare') renderCharts(project, analytics);
  if (tab === 'recommendations') {
    document.querySelectorAll('[data-add-followup]').forEach(btn => btn.addEventListener('click', async () => {
      const domain = getDomain(btn.dataset.addFollowup);
      const q = btn.dataset.question ? getQuestion(btn.dataset.question) : null;
      await createFollowup(projectId, {
        domainId: domain.id,
        title: `Penguatan ${domain.title}`,
        action: q?.action || `Bahas satu langkah perbaikan pada bidang ${domain.title}.`
      });
      showToast('Rekomendasi dimasukkan ke tindak lanjut.');
    }));
  }
  if (tab === 'followup') {
    followupHtml(projectId).then(html => {
      const slot = document.querySelector('#followupSlot');
      if (!slot) return;
      slot.innerHTML = html;
      bindFollowups(projectId);
    });
  }
}

function renderCharts(project, analytics) {
  if (!window.Chart) return;
  const domains = selectedDomains(project);
  const palette = ['#0d5b45','#c49a4d','#397eaa','#9b5d92','#d16f3b','#5a7a50','#694fa0','#a44d4d'];
  const radarCanvas = document.querySelector('#radarChart');
  if (radarCanvas) {
    const datasets = Object.values(analytics.perspectiveScores).map((p, index) => ({
      label: p.label,
      data: domains.map(d => p.domains[d.id] ?? null),
      borderColor: palette[index % palette.length],
      backgroundColor: `${palette[index % palette.length]}18`,
      pointBackgroundColor: palette[index % palette.length],
      borderWidth: 2,
      spanGaps: true
    }));
    const chart = new Chart(radarCanvas, { type: 'radar', data: { labels: domains.map(d => d.title), datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 5, ticks: { stepSize: 1, display: false }, pointLabels: { font: { size: 11 } } } }, plugins: { legend: { position: 'bottom' } } } });
    state.charts.push(chart);
  }
  const barCanvas = document.querySelector('#barChart');
  if (barCanvas) {
    const chart = new Chart(barCanvas, { type: 'bar', data: { labels: domains.map(d => d.title), datasets: [{ label: 'Rata-rata', data: domains.map(d => analytics.domainAggregate[d.id] ?? null), backgroundColor: '#0d5b45', borderRadius: 8 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5, ticks: { stepSize: 1 } }, x: { ticks: { maxRotation: 45, minRotation: 0 } } }, plugins: { legend: { display: false } } } });
    state.charts.push(chart);
  }
}

function openPerspectiveModal(projectId, project) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal" style="max-width:560px" role="dialog" aria-modal="true" aria-labelledby="perspectiveTitle"><div class="modal-head"><div><div class="eyebrow">Perspektif baru</div><h2 id="perspectiveTitle" style="margin:5px 0 0">Siapa yang akan mengisi?</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><form id="perspectiveForm"><div class="modal-body"><div class="form-group"><label for="perspectiveLabel">Jabatan / perspektif</label><input class="input" id="perspectiveLabel" required placeholder="Contoh: Direktur, Kepala Sekolah, Kepala Asrama"></div><div class="form-group"><label for="perspectiveName">Nama responden <span class="muted" style="font-weight:500">(opsional)</span></label><input class="input" id="perspectiveName" placeholder="Boleh dikosongkan"></div><p class="helper">Responden akan menerima ${selectedDomains(project).length * 10} pertanyaan (${selectedDomains(project).length} bidang × 10 pertanyaan). Ia tidak perlu membuat akun; cukup membuka tautan pribadi.</p></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" type="submit">Buat tautan</button></div></form></div>`;
  const closeModal = mountModal(modal, '#perspectiveLabel');
  modal.querySelector('#perspectiveForm').addEventListener('submit', async event => {
    event.preventDefault();
    const perspectiveRef = push(ref(db, `projects/${projectId}/perspectives`));
    const inviteId = randomToken();
    const label = modal.querySelector('#perspectiveLabel').value.trim();
    const name = modal.querySelector('#perspectiveName').value.trim();
    const perspective = { label, name, inviteId, createdAt: now() };
    const invite = { projectId, perspectiveId: perspectiveRef.key, perspectiveLabel: label, respondentName: name, pesantren: project.pesantren, assessmentName: project.name, period: project.period || '', domains: project.domains, active: true, createdAt: now() };
    const updates = {};
    updates[`projects/${projectId}/perspectives/${perspectiveRef.key}`] = perspective;
    updates[`invites/${inviteId}`] = invite;
    const submit = event.submitter;
    setButtonLoading(submit, true, 'Membuat tautan…');
    try {
      await update(ref(db), updates);
      closeModal();
      const copied = await copyText(inviteUrl(inviteId)).then(() => true).catch(() => false);
      showToast(copied ? 'Tautan perspektif dibuat dan disalin.' : 'Tautan perspektif berhasil dibuat.');
      renderProject(projectId, 'perspectives');
    } catch (error) {
      console.error(error);
      setButtonLoading(submit, false);
      showToast('Tautan belum berhasil dibuat. Periksa koneksi lalu coba lagi.', 'error');
    }
  });
}

async function createFollowup(projectId, seed = {}) {
  const followRef = push(ref(db, `followups/${projectId}`));
  await set(followRef, { domainId: seed.domainId || '', title: seed.title || 'Tindak lanjut', action: seed.action || '', owner: '', targetDate: '', status: 'Rencana', createdAt: now() });
}

function bindFollowups(projectId) {
  document.querySelector('#addFollowupManual')?.addEventListener('click', () => openFollowupModal(projectId));
  document.querySelectorAll('[data-follow-owner]').forEach(input => input.addEventListener('change', () => update(ref(db, `followups/${projectId}/${input.dataset.followOwner}`), { owner: input.value.trim(), updatedAt: now() })));
  document.querySelectorAll('[data-follow-date]').forEach(input => input.addEventListener('change', () => update(ref(db, `followups/${projectId}/${input.dataset.followDate}`), { targetDate: input.value, updatedAt: now() })));
  document.querySelectorAll('[data-follow-status]').forEach(input => input.addEventListener('change', () => update(ref(db, `followups/${projectId}/${input.dataset.followStatus}`), { status: input.value, updatedAt: now() })));
  document.querySelectorAll('[data-follow-delete]').forEach(btn => btn.addEventListener('click', async () => { if (confirm('Hapus tindak lanjut ini?')) { await remove(ref(db, `followups/${projectId}/${btn.dataset.followDelete}`)); renderProject(projectId, 'followup'); } }));
}

function openFollowupModal(projectId) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal" style="max-width:620px" role="dialog" aria-modal="true" aria-labelledby="followupTitle"><div class="modal-head"><div><div class="eyebrow">Tindak lanjut baru</div><h2 id="followupTitle" style="margin:5px 0 0">Apa yang akan dikerjakan?</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><form id="followupForm"><div class="modal-body"><div class="form-group"><label for="followTitle">Judul</label><input class="input" id="followTitle" required placeholder="Contoh: Perjelas batas kewenangan kepala unit"></div><div class="form-group"><label for="followAction">Langkah yang disepakati</label><textarea class="textarea" id="followAction" required placeholder="Tuliskan tindakan yang konkret dan realistis"></textarea></div><div class="grid grid-2"><div class="form-group"><label for="followOwner">PIC</label><input class="input" id="followOwner" placeholder="Jabatan / nama"></div><div class="form-group"><label for="followDate">Target</label><input class="input" type="date" id="followDate"></div></div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan</button></div></form></div>`;
  const closeModal = mountModal(modal, '#followTitle');
  modal.querySelector('#followupForm').addEventListener('submit', async event => {
    event.preventDefault();
    const followRef = push(ref(db, `followups/${projectId}`));
    const submit = event.submitter;
    setButtonLoading(submit, true, 'Menyimpan…');
    try {
      await set(followRef, { title: modal.querySelector('#followTitle').value.trim(), action: modal.querySelector('#followAction').value.trim(), owner: modal.querySelector('#followOwner').value.trim(), targetDate: modal.querySelector('#followDate').value, status: 'Rencana', createdAt: now() });
      closeModal();
      showToast('Tindak lanjut ditambahkan.');
      renderProject(projectId, 'followup');
    } catch (error) {
      console.error(error);
      setButtonLoading(submit, false);
      showToast('Tindak lanjut belum tersimpan. Periksa koneksi lalu coba lagi.', 'error');
    }
  });
}

/* ---------------- Respondent ---------------- */
async function renderRespondentApp() {
  const inviteId = state.respondent.inviteId;
  try {
    const invite = await safeGet(`invites/${inviteId}`);
    if (!invite || invite.active === false) return renderFatal('Tautan asesmen tidak ditemukan atau sudah dinonaktifkan.');
    state.respondent.invite = invite;
    const response = (await safeGet(`responses/${inviteId}`)) || { answers: {}, respondentName: invite.respondentName || '', startedAt: now(), updatedAt: now() };
    state.respondent.response = response;
    const domainIds = Array.isArray(invite.domains) ? invite.domains : Object.keys(invite.domains || {}).filter(k => invite.domains[k]);
    state.respondent.questions = DOMAINS.filter(d => domainIds.includes(d.id)).flatMap(domain => domain.questions.map(q => ({ ...q, domainId: domain.id, domainTitle: domain.title, domainCode: domain.code })));
    if (response.submittedAt) return renderRespondentComplete();
    state.respondent.index = Math.min(state.respondent.index, Math.max(0, state.respondent.questions.length - 1));
    renderRespondentQuestion();
  } catch (error) {
    console.error(error);
    renderFatal('Data asesmen tidak dapat dibuka. Pastikan Firebase Realtime Database Rules dan Anonymous Authentication sudah diaktifkan.');
  }
}

function renderRespondentQuestion() {
  const { invite, response, questions, index } = state.respondent;
  const question = questions[index];
  if (!question) return renderFatal('Tidak ada pertanyaan pada tautan ini.');
  const answer = response.answers?.[question.id];
  const progress = Math.round((Object.keys(response.answers || {}).length / questions.length) * 100);
  const isLast = index === questions.length - 1;
  const answeredCount = Object.keys(response.answers || {}).length;

  appEl.innerHTML = `
    <div class="respondent-shell">
      <div class="respondent-head"><div class="container"><div class="topbar-inner" style="height:auto"><div class="brand"><div class="brand-mark">MZ</div><div><div class="brand-title" style="color:white">MZ Consulting</div><div class="brand-sub">Sahabat Tumbuh Pesantren</div></div></div><div class="save-state">Jawaban tersimpan online</div></div></div></div>
      <div class="respondent-wrap">
        <div class="respondent-card">
          <div class="respondent-meta"><div><div class="eyebrow">${escapeHtml(invite.assessmentName || 'Asesmen Awal')}</div><h2 style="margin:5px 0 5px">${escapeHtml(invite.pesantren)}</h2><div class="small muted">Perspektif: <strong>${escapeHtml(invite.perspectiveLabel)}</strong>${invite.period ? ` · ${escapeHtml(invite.period)}` : ''}</div></div><div style="min-width:180px"><label for="respondentName">Nama pengisi <span class="muted" style="font-weight:500">(opsional)</span></label><input class="input" id="respondentName" value="${escapeHtml(response.respondentName || '')}" placeholder="Nama"></div></div>
          <div class="progress-wrap"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:7px"><span>${answeredCount} dari ${questions.length} terjawab</span><span>${progress}%</span></div><div class="progress-line"><div class="progress-bar" style="width:${progress}%"></div></div></div>
          <div class="question-pane">
            <span class="badge neutral">${question.domainCode} · ${escapeHtml(question.domainTitle)}</span>
            <div class="question-no">Pertanyaan ${index + 1} dari ${questions.length}</div>
            <div class="question-text">${escapeHtml(question.text)}</div>
            <div class="answer-list">${SCALE_OPTIONS.map(option => {
              const selected = answer && ((option.value === null && answer.unsure) || answer.score === option.value);
              return `<button class="answer-btn ${selected ? 'selected' : ''}" data-answer="${option.value === null ? 'unsure' : option.value}"><span class="answer-num">${option.value === null ? '?' : option.value}</span><span>${escapeHtml(option.label)}</span></button>`;
            }).join('')}</div>
            <div class="question-note"><label for="answerNote">Catatan singkat <span class="muted" style="font-weight:500">(opsional)</span></label><textarea class="textarea" id="answerNote" placeholder="Contoh, kondisi, atau penjelasan yang ingin ditambahkan…">${escapeHtml(answer?.note || '')}</textarea></div>
          </div>
          <div class="respondent-nav"><button class="btn btn-ghost" id="prevQ" ${index === 0 ? 'disabled' : ''}>← Sebelumnya</button>${isLast ? `<button class="btn btn-primary" id="submitAssessment">Kirim jawaban</button>` : `<button class="btn btn-primary" id="nextQ">Berikutnya →</button>`}</div>
        </div>
      </div>
    </div>`;

  document.querySelector('#respondentName').addEventListener('change', async event => { response.respondentName = event.target.value.trim(); await saveRespondentResponse(); });
  document.querySelectorAll('[data-answer]').forEach(btn => btn.addEventListener('click', async () => {
    const raw = btn.dataset.answer;
    response.answers = response.answers || {};
    response.answers[question.id] = { score: raw === 'unsure' ? null : Number(raw), unsure: raw === 'unsure', note: document.querySelector('#answerNote').value.trim(), updatedAt: now() };
    await saveRespondentResponse();
    renderRespondentQuestion();
  }));
  document.querySelector('#answerNote').addEventListener('change', async event => {
    response.answers = response.answers || {};
    const existing = response.answers[question.id] || { score: null, unsure: true };
    response.answers[question.id] = { ...existing, note: event.target.value.trim(), updatedAt: now() };
    await saveRespondentResponse();
  });
  document.querySelector('#prevQ')?.addEventListener('click', async () => { await saveCurrentNote(); state.respondent.index--; renderRespondentQuestion(); window.scrollTo(0,0); });
  document.querySelector('#nextQ')?.addEventListener('click', async () => { await saveCurrentNote(); state.respondent.index++; renderRespondentQuestion(); window.scrollTo(0,0); });
  document.querySelector('#submitAssessment')?.addEventListener('click', async () => {
    await saveCurrentNote();
    const missing = questions.filter(q => !response.answers?.[q.id]).length;
    if (missing && !confirm(`Masih ada ${missing} pertanyaan yang belum dijawab. Tetap kirim sekarang?`)) return;
    response.submittedAt = now();
    response.updatedAt = now();
    await set(ref(db, `responses/${state.respondent.inviteId}`), response);
    const perspectivePath = `projects/${invite.projectId}/perspectives/${invite.perspectiveId}`;
    // Respondent tidak punya izin menulis projects; submittedAt di proyek akan disinkronkan saat konsultan membuka proyek.
    renderRespondentComplete();
  });
}

async function saveCurrentNote() {
  const { response, questions, index } = state.respondent;
  const q = questions[index];
  const noteEl = document.querySelector('#answerNote');
  if (!q || !noteEl || !response.answers?.[q.id]) return;
  response.answers[q.id].note = noteEl.value.trim();
  response.answers[q.id].updatedAt = now();
  await saveRespondentResponse();
}
async function saveRespondentResponse() {
  state.respondent.response.updatedAt = now();
  if (!state.respondent.response.startedAt) state.respondent.response.startedAt = now();
  await set(ref(db, `responses/${state.respondent.inviteId}`), state.respondent.response);
}

function renderRespondentComplete() {
  const invite = state.respondent.invite;
  appEl.innerHTML = `<div class="respondent-shell"><div class="respondent-head"><div class="container"><div class="brand"><div class="brand-mark">MZ</div><div><div class="brand-title" style="color:white">MZ Consulting</div><div class="brand-sub">Sahabat Tumbuh Pesantren</div></div></div></div></div><div class="respondent-wrap"><div class="respondent-card"><div class="complete-box"><div class="complete-mark">✓</div><div class="eyebrow">Jawaban sudah terkirim</div><h2 style="margin-top:8px">Terima kasih atas perspektif Anda.</h2><p class="lead" style="margin-left:auto;margin-right:auto">Jawaban untuk <strong>${escapeHtml(invite?.pesantren || '')}</strong> sudah tersimpan. Hasilnya akan dibaca bersama perspektif lain sebagai bahan analisis awal.</p><p class="helper">Asesmen ini bukan ujian dan bukan penilaian pribadi. Perbedaan pandangan justru membantu menemukan hal yang perlu dibahas.</p></div></div></div></div>`;
}

/* sync submitted flags lazily for consultant */
async function syncSubmittedFlags(projectId, project, bundle) {
  const updates = {};
  bundle.perspectives.forEach(p => {
    const submittedAt = bundle.responses[p.inviteId]?.submittedAt || null;
    if ((p.submittedAt || null) !== submittedAt) updates[`projects/${projectId}/perspectives/${p.id}/submittedAt`] = submittedAt;
  });
  if (Object.keys(updates).length) await update(ref(db), updates);
}

// Render project and synchronize submitted response flags for the consultant dashboard.
async function renderProject(projectId, tab = state.currentTab || 'overview') {
  destroyCharts();
  state.currentProjectId = projectId;
  state.currentTab = tab;
  const project = await safeGet(`projects/${projectId}`);
  if (!project) return renderDashboard();
  let bundle = await loadProjectResponses(project);
  await syncSubmittedFlags(projectId, project, bundle);
  if (bundle.perspectives.some(p => (p.submittedAt || null) !== (bundle.responses[p.inviteId]?.submittedAt || null))) {
    project.perspectives = (await safeGet(`projects/${projectId}/perspectives`)) || {};
    bundle = await loadProjectResponses(project);
  }
  state.projects[projectId] = project;
  const analytics = calculateAnalytics(project, bundle);
  const domains = selectedDomains(project);

  appEl.innerHTML = consultantShell(`
    <main class="page"><div class="container">
      <button class="breadcrumb" id="backDashboard" style="border:0;background:none;padding:0">← Kembali ke semua asesmen</button>
      <div class="project-hero">
        <div><div class="eyebrow">${escapeHtml(project.name || 'Asesmen')}</div><h1 class="project-title">${escapeHtml(project.pesantren)}</h1><div class="project-meta"><span>${domains.length} bidang</span><span>${Object.keys(project.perspectives || {}).length} perspektif</span><span>${escapeHtml(project.period || 'Tanpa periode')}</span></div></div>
        <div><span class="badge ${analytics.submittedCount ? 'success' : 'neutral'}">${analytics.submittedCount} jawaban masuk</span></div>
      </div>
      <div class="tabs">${tabButton('overview','Gambaran Awal',tab)}${tabButton('perspectives','Perspektif',tab)}${tabButton('compare','Bandingkan',tab)}${tabButton('recommendations','Rekomendasi',tab)}${tabButton('followup','Tindak Lanjut',tab)}</div>
      <div id="projectContent">${renderProjectTab(projectId, project, bundle, analytics, tab)}</div>
    </div></main>`);
  bindShell();
  document.querySelector('#backDashboard').addEventListener('click', renderDashboard);
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => renderProject(projectId, btn.dataset.tab)));
  bindProjectTab(projectId, project, bundle, analytics, tab);
}
