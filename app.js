import { auth, db } from './firebase-config.js';
import { DOMAINS, SCALE_OPTIONS, getStage, getQuestion, getDomain } from './questions.js';
import {
  buildFindings,
  buildRoadmap,
  clientProjection,
  nextJourneyStep,
  questionIndicatorMap,
  recommendPlaybooks,
  snapshotValidatedRecommendation
} from './lib/solution-engine.js';
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
  userProfile: null,
  projects: {},
  currentProjectId: null,
  currentTab: 'overview',
  knowledgeBase: null,
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

async function loadKnowledgeBase() {
  if (state.knowledgeBase) return state.knowledgeBase;
  const response = await fetch('./data/knowledge-base.v1.json');
  if (!response.ok) throw new Error('Knowledge base tidak dapat dimuat.');
  state.knowledgeBase = await response.json();
  return state.knowledgeBase;
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
            <span class="hero-point">10 bidang asesmen</span>
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
            <button class="btn btn-ghost btn-sm hide-mobile" id="toolkitLibraryBtn">Toolkit</button>
            <button class="btn btn-ghost btn-sm hide-mobile" id="knowledgeBaseBtn">Knowledge Base</button>
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
  document.querySelector('#toolkitLibraryBtn')?.addEventListener('click', renderToolkitLibrary);
  document.querySelector('#knowledgeBaseBtn')?.addEventListener('click', renderKnowledgeBaseAdmin);
  document.querySelector('#logoutBtn')?.addEventListener('click', () => signOut(auth));
}

async function loadProjects() {
  state.userProfile = await safeGet(`users/${state.user.uid}`).catch(() => null);
  if (state.userProfile?.role === 'admin') {
    state.projects = (await safeGet('projects')) || {};
  } else {
    const ownIndex = (await safeGet(`userProjects/${state.user.uid}`)) || {};
    const tenantIndex = state.userProfile?.tenantId ? (await safeGet(`tenantProjects/${state.userProfile.tenantId}`)) || {} : {};
    const index = { ...ownIndex, ...tenantIndex };
    const entries = await Promise.all(Object.keys(index).map(async id => [id, await safeGet(`projects/${id}`)]));
    state.projects = Object.fromEntries(entries.filter(([, project]) => project));
  }
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
    const tenantId = state.userProfile?.tenantId || state.user.uid;
    const project = {
      name: modal.querySelector('#assessmentName').value.trim(),
      pesantren: modal.querySelector('#pesantren').value.trim(),
      period: modal.querySelector('#period').value.trim(),
      domains,
      createdAt: now(),
      createdBy: state.user.uid,
      tenantId,
      members: { [state.user.uid]: { role: 'consultant', addedAt: now() } },
      engagementStatus: 'Belum dibahas',
      analysisNote: ''
    };
    const submit = event.submitter;
    setButtonLoading(submit, true, 'Membuat…');
    try {
      const createUpdates = {};
      createUpdates[`projects/${projectRef.key}`] = project;
      createUpdates[`userProjects/${state.user.uid}/${projectRef.key}`] = true;
      createUpdates[`tenantProjects/${tenantId}/${projectRef.key}`] = true;
      await update(ref(db), createUpdates);
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
  if (tab === 'transformation') return `<div id="transformationSlot"><div class="card card-pad"><span class="spinner spinner-dark" aria-hidden="true"></span> Menyusun rekomendasi berbasis playbook…</div></div>`;
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
  if (tab === 'transformation') renderTransformationPlan(projectId, project, analytics);
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

/* ---------------- Transformation knowledge base ---------------- */
async function getTransformationContext(projectId, analytics) {
  const knowledgeBase = await loadKnowledgeBase();
  const stored = (await safeGet(`projectTransformations/${projectId}`)) || {};
  const indicatorMap = questionIndicatorMap(DOMAINS);
  const findings = buildFindings(analytics.questionStats, indicatorMap);
  const statusByCode = Object.fromEntries(Object.entries(stored.recommendations || {}).map(([code, item]) => [code, item.status]));
  const generated = recommendPlaybooks({ knowledgeBase, findings, existingStatuses: statusByCode });
  const recommendations = generated.map(item => ({ ...item, ...(stored.recommendations?.[item.playbook_code] || {}) }));
  const updates = {};
  if (!stored.schemaVersion) {
    updates[`projectTransformations/${projectId}/schemaVersion`] = '1.0';
    updates[`projectTransformations/${projectId}/knowledgeBaseVersion`] = knowledgeBase.knowledge_base_version;
    updates[`projectTransformations/${projectId}/createdAt`] = now();
  }
  findings.forEach(item => {
    if (!stored.findings?.[item.id]) updates[`projectTransformations/${projectId}/findings/${item.id}`] = item;
  });
  generated.forEach(item => {
    if (!stored.recommendations?.[item.playbook_code]) updates[`projectTransformations/${projectId}/recommendations/${item.playbook_code}`] = item;
  });
  if (Object.keys(updates).length) await update(ref(db), updates);
  return { knowledgeBase, stored: { ...stored, findings: stored.findings || Object.fromEntries(findings.map(item => [item.id, item])) }, findings, recommendations };
}

function priorityBadge(priority) {
  const labels = { P0: 'P0 · Respons sekarang', P1: 'P1 · Fondasi', P2: 'P2 · Penguatan', P3: 'P3 · Optimasi' };
  return `<span class="priority-badge ${priority.toLowerCase()}">${labels[priority] || priority}</span>`;
}

function recommendationCardHtml(item) {
  const statusLabel = (item.validation_status || item.status || 'SYSTEM_SUGGESTED').replaceAll('_', ' ');
  return `<article class="card solution-card" data-recommendation-card="${escapeHtml(item.playbook_code)}">
    <div class="solution-top"><div><div class="eyebrow">${escapeHtml(item.playbook_code)} · v${escapeHtml(item.playbook_version)}</div><h3>${escapeHtml(item.title)}</h3></div>${priorityBadge(item.priority)}</div>
    <p class="reco-action">${escapeHtml(item.reason)}</p>
    <div class="solution-signals"><span class="badge neutral">Confidence ${escapeHtml(item.confidence)}</span><span class="badge ${item.validation_status === 'VALIDATED' ? 'success' : 'neutral'}">${escapeHtml(statusLabel)}</span>${item.evidence_warning ? '<span class="badge warn">Bukti perlu diperkuat</span>' : ''}</div>
    ${item.missing_dependencies?.length ? `<div class="dependency-note"><strong>Prasyarat:</strong> ${item.missing_dependencies.map(escapeHtml).join(', ')}</div>` : ''}
    <div class="solution-actions"><button class="btn btn-ghost btn-sm" data-open-playbook="${item.playbook_code}">Buka playbook</button>${item.validation_status === 'VALIDATED' ? `<button class="btn btn-primary btn-sm" data-add-roadmap="${item.playbook_code}">Tambah ke roadmap</button>` : `<button class="btn btn-primary btn-sm" data-validate-playbook="${item.playbook_code}">Validasi</button><button class="btn btn-ghost btn-sm" data-defer-playbook="${item.playbook_code}">Tunda</button><button class="btn btn-danger btn-sm" data-reject-playbook="${item.playbook_code}">Tolak</button>`}</div>
  </article>`;
}

function roadmapCardHtml(item) {
  const workDone = ['Implemented','Verification Pending','Effective','Needs Adjustment','Reopened'].includes(item.status);
  const effective = item.status === 'Effective';
  return `<article class="card roadmap-card">
    <div class="solution-top"><div><div class="eyebrow">${escapeHtml(item.phase || 'FOUNDATION')} · ${escapeHtml(item.target_window || '')}</div><h3>${escapeHtml(item.playbook_code)} — ${escapeHtml(item.title)}</h3></div>${priorityBadge(item.priority || 'P2')}</div>
    <p class="reco-action">${escapeHtml(item.recommended_action || '')}</p>
    <div class="roadmap-progress"><span class="milestone ${workDone ? 'done' : ''}">✓ Pekerjaan selesai</span><span class="milestone ${effective ? 'done' : ''}">✓ Efektivitas terverifikasi</span></div>
    <div class="grid grid-3 roadmap-fields"><div><div class="helper">PIC</div><strong>${escapeHtml(item.owner || 'Belum ditetapkan')}</strong></div><div><div class="helper">Target</div><strong>${escapeHtml(item.due_date || item.target_window || '—')}</strong></div><div class="form-group" style="margin:0"><label>Status</label><select class="select" data-roadmap-status="${escapeHtml(item.id)}">${['Planned','In Progress','Implemented','Verification Pending','Effective','Needs Adjustment','Reopened'].map(value => `<option ${item.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div>
    <details class="disclosure"><summary>Kriteria dan deliverables</summary><div class="disclosure-body"><p><strong>Completion:</strong> ${escapeHtml(item.completion_criteria || '')}</p><p><strong>Effectiveness:</strong> ${escapeHtml(item.effectiveness_criteria || '')}</p>${item.deliverables?.length ? `<ul>${item.deliverables.map(deliverable => `<li>${escapeHtml(deliverable.name || deliverable)}${deliverable.status ? ` · ${escapeHtml(deliverable.status)}` : ''}</li>`).join('')}</ul><button class="btn btn-ghost btn-sm" data-manage-deliverables="${escapeHtml(item.id)}">Kelola output</button>` : ''}</div></details>
  </article>`;
}

async function renderTransformationPlan(projectId, project, analytics) {
  const slot = document.querySelector('#transformationSlot');
  if (!slot) return;
  try {
    const context = await getTransformationContext(projectId, analytics);
    const stored = (await safeGet(`projectTransformations/${projectId}`)) || context.stored;
    const recommendations = context.recommendations.map(item => ({ ...item, ...(stored.recommendations?.[item.playbook_code] || {}) }));
    const roadmapSource = Object.values(stored.roadmap || {});
    const roadmap = buildRoadmap(roadmapSource).map(computed => {
      const saved = roadmapSource.find(item => item.id === computed.id) || {};
      return { ...computed, phase: saved.phase || computed.phase, target_window: saved.target_window || computed.target_window };
    });
    const counts = ['P0','P1','P2','P3'].map(priority => recommendations.filter(item => item.priority === priority).length);
    const validated = recommendations.filter(item => item.validation_status === 'VALIDATED').length;
    const active = roadmap.filter(item => item.status === 'In Progress').length;
    const complete = roadmap.filter(item => ['Implemented','Verification Pending','Effective'].includes(item.status)).length;
    const pending = roadmap.filter(item => item.status === 'Verification Pending').length;
    const next = nextJourneyStep(project, { ...stored, findings: stored.findings || {} });
    slot.innerHTML = `
      <section class="journey-card card"><div><div class="eyebrow">Project Journey · Tahap ${next.step}/10</div><h3>${escapeHtml(next.label)}</h3><p class="small muted">Persiapan → Responden → Pengumpulan → Bukti → Diagnosis → Validasi → Transformation Plan → Implementasi → Effectiveness Review → Report</p></div><button class="btn btn-primary btn-sm" data-go-tab="${next.tab}">Langkah berikutnya →</button></section>
      <div class="section-head transformation-head"><div><div class="eyebrow">Consulting Intelligence System</div><h2 style="margin-top:5px">Transformation Plan</h2><p class="lead small">Diagnosis menemukan pola. Playbook memberi jalan. Konsultan memvalidasi keputusan dan bukti efektivitas.</p></div><button class="btn btn-ghost" id="clientPreviewBtn">Tampilan klien</button></div>
      <div class="metric-strip">${[['Finding',context.findings.length],['P0',counts[0]],['P1',counts[1]],['P2',counts[2]],['P3',counts[3]],['Validated',validated],['Aktif',active],['Selesai',complete],['Verifikasi',pending]].map(([label,value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
      <details class="card findings-panel"><summary>Temuan diagnosis (${context.findings.length})</summary><div class="finding-grid">${context.findings.map(item => `<div><span class="badge neutral">${escapeHtml(item.indicator_id)}</span><strong>Skor ${scoreText(item.score)}</strong><span>Gap ${item.perception_gap.toFixed(1)} · Confidence ${escapeHtml(item.confidence)}${item.evidence_gap ? ' · bukti terbatas' : ''}</span></div>`).join('')}</div></details>
      <section style="margin-top:24px"><div class="section-head"><div><div class="eyebrow">Recommended Playbooks</div><h2 style="margin-top:5px">Prioritas berbasis akar masalah</h2></div></div>${recommendations.length ? `<div class="grid grid-2">${recommendations.map(recommendationCardHtml).join('')}</div>` : emptyHtml('Belum ada playbook yang direkomendasikan', 'Rekomendasi akan muncul setelah jawaban asesmen menghasilkan finding yang cukup.')}</section>
      <section style="margin-top:30px"><div class="section-head"><div><div class="eyebrow">Delivery Roadmap</div><h2 style="margin-top:5px">Dari fondasi sampai efektivitas</h2></div></div>${roadmap.length ? `<div class="roadmap-list">${roadmap.map(roadmapCardHtml).join('')}</div>` : emptyHtml('Roadmap masih kosong', 'Validasi playbook yang relevan, lalu tambahkan ke roadmap untuk menyusun intervensi.')}</section>`;
    bindTransformationPlan(projectId, project, analytics, context, recommendations, roadmap);
  } catch (error) {
    console.error(error);
    slot.innerHTML = emptyHtml('Transformation Plan belum dapat dimuat', 'Periksa koneksi dan artefak knowledge base, lalu coba lagi.', '<button class="btn btn-primary" id="retryTransformation">Coba lagi</button>');
    document.querySelector('#retryTransformation')?.addEventListener('click', () => renderTransformationPlan(projectId, project, analytics));
  }
}

function bindTransformationPlan(projectId, project, analytics, context, recommendations, roadmap) {
  document.querySelectorAll('[data-go-tab]').forEach(btn => btn.addEventListener('click', () => renderProject(projectId, btn.dataset.goTab)));
  document.querySelectorAll('[data-open-playbook]').forEach(btn => btn.addEventListener('click', () => openPlaybookDetail(btn.dataset.openPlaybook, context.knowledgeBase, recommendations.find(item => item.playbook_code === btn.dataset.openPlaybook), context.findings)));
  document.querySelectorAll('[data-validate-playbook]').forEach(btn => btn.addEventListener('click', () => {
    const item = recommendations.find(row => row.playbook_code === btn.dataset.validatePlaybook);
    const playbook = context.knowledgeBase.playbooks.find(row => row.id === item.playbook_id);
    openValidationModal(projectId, project, analytics, item, playbook, context.knowledgeBase);
  }));
  for (const action of ['defer','reject']) document.querySelectorAll(`[data-${action}-playbook]`).forEach(btn => btn.addEventListener('click', async () => {
    const code = btn.dataset[`${action}Playbook`];
    const status = action === 'defer' ? 'DEFERRED' : 'REJECTED';
    await update(ref(db, `projectTransformations/${projectId}/recommendations/${code}`), { validation_status: status, status, reviewedBy: state.user.uid, reviewedAt: now() });
    showToast(`${code} ditandai ${status.toLowerCase()}.`);
    renderTransformationPlan(projectId, project, analytics);
  }));
  document.querySelectorAll('[data-add-roadmap]').forEach(btn => btn.addEventListener('click', () => {
    const item = recommendations.find(row => row.playbook_code === btn.dataset.addRoadmap);
    const playbook = context.knowledgeBase.playbooks.find(row => row.id === item.playbook_id);
    openRoadmapModal(projectId, project, analytics, item, playbook);
  }));
  document.querySelectorAll('[data-roadmap-status]').forEach(select => select.addEventListener('change', async () => {
    const roadmapItem = roadmap.find(item => item.id === select.dataset.roadmapStatus);
    if (select.value === 'Effective') {
      select.value = roadmapItem.status;
      return openEffectivenessModal(projectId, project, analytics, roadmapItem);
    }
    await update(ref(db, `projectTransformations/${projectId}/roadmap/${select.dataset.roadmapStatus}`), { status: select.value, updatedAt: now(), updatedBy: state.user.uid });
    showToast('Status implementasi diperbarui.');
    renderTransformationPlan(projectId, project, analytics);
  }));
  document.querySelectorAll('[data-manage-deliverables]').forEach(btn => btn.addEventListener('click', () => {
    const item = roadmap.find(row => row.id === btn.dataset.manageDeliverables);
    openDeliverablesModal(projectId, project, analytics, item);
  }));
  document.querySelector('#clientPreviewBtn')?.addEventListener('click', async () => openClientPreview(projectId, project));
}

function openDeliverablesModal(projectId, project, analytics, item) {
  const deliverables = toArray(item.deliverables);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal playbook-modal" role="dialog" aria-modal="true" aria-labelledby="deliverablesTitle"><div class="modal-head"><div><div class="eyebrow">Playbook Outputs · ${escapeHtml(item.playbook_code)}</div><h2 id="deliverablesTitle" style="margin:5px 0 0">Deliverables intervensi</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><form id="deliverablesForm"><div class="modal-body"><div class="deliverable-editor">${deliverables.map((deliverable, index) => `<section class="deliverable-row" data-deliverable-row><input type="hidden" data-field="id" value="${escapeHtml(deliverable.id || `${item.id}-d${index + 1}`)}"><div class="form-group"><label>Deliverable</label><input class="input" data-field="name" value="${escapeHtml(deliverable.name || deliverable)}" required></div><div class="grid grid-3"><div class="form-group"><label>Owner</label><input class="input" data-field="owner" value="${escapeHtml(deliverable.owner || '')}" placeholder="PIC"></div><div class="form-group"><label>Status</label><select class="select" data-field="status">${['Planned','In Progress','Completed','Verified'].map(value => `<option ${deliverable.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="form-group"><label>Completion date</label><input type="date" class="input" data-field="completion_date" value="${escapeHtml(deliverable.completion_date || '')}"></div></div><div class="form-group"><label>Evidence / output reference</label><input class="input" data-field="evidence" value="${escapeHtml(deliverable.evidence || '')}" placeholder="Tautan, nama dokumen, atau referensi bukti"></div><label class="check-line"><input type="checkbox" data-field="consultant_verification" ${deliverable.consultant_verification ? 'checked' : ''}> Diverifikasi konsultan</label></section>`).join('')}</div></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan output</button></div></form></div>`;
  const closeModal = mountModal(modal, '[data-field="owner"]');
  modal.querySelector('#deliverablesForm').addEventListener('submit', async event => {
    event.preventDefault();
    const values = [...modal.querySelectorAll('[data-deliverable-row]')].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(field => [field.dataset.field, field.type === 'checkbox' ? field.checked : field.value.trim()])));
    await update(ref(db, `projectTransformations/${projectId}/roadmap/${item.id}`), { deliverables: values, updatedAt: now(), updatedBy: state.user.uid });
    closeModal();
    showToast('Deliverables dan bukti diperbarui.');
    renderTransformationPlan(projectId, project, analytics);
  });
}

function openEffectivenessModal(projectId, project, analytics, item) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="effectivenessTitle"><div class="modal-head"><div><div class="eyebrow">Effectiveness Review · ${escapeHtml(item.playbook_code)}</div><h2 id="effectivenessTitle" style="margin:5px 0 0">Buktikan perubahan menghasilkan manfaat</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><form id="effectivenessForm"><div class="modal-body"><p class="lead small">Pekerjaan selesai belum berarti intervensi efektif. Catat bukti hasil setelah periode observasi yang relevan.</p><div class="form-group"><label for="effectivenessEvidence">Bukti efektivitas</label><textarea class="textarea" id="effectivenessEvidence" required placeholder="Contoh: jumlah eskalasi salah turun dari 14 menjadi 4 dalam 60 hari…"></textarea></div><div class="form-group"><label for="effectivenessDate">Tanggal verifikasi</label><input class="input" type="date" id="effectivenessDate" required value="${new Date().toISOString().slice(0,10)}"></div><div class="form-group"><label for="effectivenessDecision">Keputusan</label><select class="select" id="effectivenessDecision"><option value="Effective">Efektif</option><option value="Needs Adjustment">Perlu penyesuaian</option><option value="Reopened">Buka kembali</option></select></div><p class="helper">Kriteria: ${escapeHtml(item.effectiveness_criteria || '')}</p></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan verifikasi</button></div></form></div>`;
  const closeModal = mountModal(modal, '#effectivenessEvidence');
  modal.querySelector('#effectivenessForm').addEventListener('submit', async event => {
    event.preventDefault();
    const decision = modal.querySelector('#effectivenessDecision').value;
    const evidence = modal.querySelector('#effectivenessEvidence').value.trim();
    const verifiedAt = new Date(`${modal.querySelector('#effectivenessDate').value}T00:00:00`).getTime();
    const updates = {};
    updates[`projectTransformations/${projectId}/roadmap/${item.id}/status`] = decision;
    updates[`projectTransformations/${projectId}/roadmap/${item.id}/effectivenessEvidence`] = evidence;
    updates[`projectTransformations/${projectId}/roadmap/${item.id}/effectivenessVerifiedAt`] = verifiedAt;
    updates[`projectTransformations/${projectId}/roadmap/${item.id}/effectivenessVerifiedBy`] = state.user.uid;
    updates[`auditLogs/${projectId}/${Date.now()}`] = { action: 'EFFECTIVENESS_REVIEW', playbookCode: item.playbook_code, decision, evidence, actor: state.user.uid, at: now() };
    await update(ref(db), updates);
    closeModal();
    showToast(decision === 'Effective' ? 'Efektivitas berhasil diverifikasi.' : 'Hasil review efektivitas disimpan.');
    renderTransformationPlan(projectId, project, analytics);
  });
}

function openValidationModal(projectId, project, analytics, recommendation, playbook, knowledgeBase) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="validationTitle"><div class="modal-head"><div><div class="eyebrow">Consultant Review · ${escapeHtml(recommendation.playbook_code)}</div><h2 id="validationTitle" style="margin:5px 0 0">Validasi rekomendasi</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><form id="validationForm"><div class="modal-body">
    <div class="grid grid-2"><div class="form-group"><label for="validationPriority">Prioritas</label><select class="select" id="validationPriority">${['P0','P1','P2','P3'].map(value => `<option ${recommendation.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="form-group"><label for="replacementPlaybook">Playbook pengganti <span class="muted" style="font-weight:500">(opsional)</span></label><select class="select" id="replacementPlaybook"><option value="">Tetap ${escapeHtml(playbook.code)}</option>${knowledgeBase.playbooks.filter(item => item.code !== playbook.code).map(item => `<option value="${item.code}">${item.code} · ${escapeHtml(item.title)}</option>`).join('')}</select></div></div>
    <div class="form-group"><label for="validationReason">Alasan konsultan</label><textarea class="textarea" id="validationReason" required>${escapeHtml(recommendation.reason)}</textarea></div>
    <div class="form-group"><label for="validationDependencies">Dependency <span class="muted" style="font-weight:500">(pisahkan dengan koma)</span></label><input class="input" id="validationDependencies" value="${escapeHtml((recommendation.dependencies || []).join(', '))}"></div>
    <div class="form-group"><label for="combinedPlaybooks">Gabungkan dengan playbook lain <span class="muted" style="font-weight:500">(opsional)</span></label><input class="input" id="combinedPlaybooks" placeholder="Contoh: HR-03, QLT-03"></div>
    <p class="helper">Validasi menyimpan snapshot versi playbook. Perubahan knowledge base berikutnya tidak akan mengubah keputusan project ini secara diam-diam.</p>
  </div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button type="submit" class="btn btn-primary">Validasi rekomendasi</button></div></form></div>`;
  const closeModal = mountModal(modal, '#validationPriority');
  modal.querySelector('#validationForm').addEventListener('submit', async event => {
    event.preventDefault();
    const replacementCode = modal.querySelector('#replacementPlaybook').value;
    const selectedPlaybook = replacementCode ? knowledgeBase.playbooks.find(item => item.code === replacementCode) : playbook;
    const reason = modal.querySelector('#validationReason').value.trim();
    const dependencies = modal.querySelector('#validationDependencies').value.split(',').map(item => item.trim()).filter(Boolean);
    const combined = modal.querySelector('#combinedPlaybooks').value.split(',').map(item => item.trim()).filter(Boolean);
    const seed = { ...recommendation, playbook_id: selectedPlaybook.id, playbook_code: selectedPlaybook.code, playbook_version: selectedPlaybook.version, title: selectedPlaybook.title, priority: modal.querySelector('#validationPriority').value, reason, dependencies, missing_dependencies: dependencies, combined_playbooks: combined };
    const validated = snapshotValidatedRecommendation(seed, selectedPlaybook, state.user.uid);
    validated.audit[0].reason = reason;
    validated.audit[0].replaced = replacementCode ? recommendation.playbook_code : null;
    const updates = {};
    updates[`projectTransformations/${projectId}/recommendations/${selectedPlaybook.code}`] = validated;
    if (replacementCode) updates[`projectTransformations/${projectId}/recommendations/${recommendation.playbook_code}`] = { ...recommendation, status: 'REJECTED', validation_status: 'REJECTED', replacedBy: replacementCode, reviewedBy: state.user.uid, reviewedAt: now(), consultantReason: reason };
    updates[`auditLogs/${projectId}/${Date.now()}`] = { action: replacementCode ? 'REPLACED_RECOMMENDATION' : 'VALIDATED_RECOMMENDATION', playbookCode: selectedPlaybook.code, previousPlaybookCode: replacementCode ? recommendation.playbook_code : null, priority: validated.priority, reason, dependencies, combinedPlaybooks: combined, actor: state.user.uid, at: now() };
    await update(ref(db), updates);
    closeModal();
    showToast(`${selectedPlaybook.code} divalidasi dan versinya dikunci.`);
    renderTransformationPlan(projectId, project, analytics);
  });
}

function openPlaybookDetail(code, knowledgeBase, recommendation, findings = []) {
  const playbook = knowledgeBase.playbooks.find(item => item.code === code);
  if (!playbook) return;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal playbook-modal" role="dialog" aria-modal="true" aria-labelledby="playbookTitle"><div class="modal-head"><div><div class="eyebrow">Transformation Playbook · ${escapeHtml(playbook.code)} · v${escapeHtml(playbook.version)}</div><h2 id="playbookTitle" style="margin:5px 0 0">${escapeHtml(playbook.title)}</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><div class="modal-body">
    ${recommendation ? `<section class="detail-section highlight"><h3>Mengapa direkomendasikan</h3><p>${escapeHtml(recommendation.reason)}</p><div class="solution-signals">${priorityBadge(recommendation.priority)}<span class="badge neutral">Confidence ${escapeHtml(recommendation.confidence)}</span>${recommendation.evidence_warning ? '<span class="badge warn">Bukti rendah</span>' : ''}</div><p class="helper">Indikator pemicu: ${recommendation.trigger_indicators.map(escapeHtml).join(', ') || 'Prasyarat lintas domain'}</p></section>` : ''}
    <section class="detail-section"><h3>Kondisi ideal</h3><p>${escapeHtml(playbook.ideal_condition)}</p></section>
    ${recommendation ? `<section class="detail-section"><h3>Kondisi saat ini</h3>${findings.filter(item => recommendation.finding_ids.includes(item.id)).length ? `<ul>${findings.filter(item => recommendation.finding_ids.includes(item.id)).map(item => `<li>${escapeHtml(item.indicator_id)} · skor ${scoreText(item.score)} · gap ${item.perception_gap.toFixed(1)} · confidence ${escapeHtml(item.confidence)}</li>`).join('')}</ul>` : '<p>Playbook ini muncul sebagai prasyarat lintas domain. Kondisi perlu dikonfirmasi konsultan sebelum implementasi.</p>'}</section>` : ''}
    <section class="detail-section"><h3>Tahapan intervensi</h3><ol class="step-list">${playbook.intervention_steps.map(step => `<li><strong>${escapeHtml(step.step || step.stage)}</strong><span>${escapeHtml(step.activity)}</span><small>Output: ${escapeHtml(step.output || '—')}</small></li>`).join('')}</ol></section>
    <section class="detail-section"><h3>Toolkit</h3><div class="toolkit-mini-grid">${playbook.toolkits.map(toolkit => `<div><strong>${escapeHtml(toolkit.code)} · ${escapeHtml(toolkit.name)}</strong><span>${escapeHtml(toolkit.purpose)}</span></div>`).join('')}</div></section>
    <div class="grid grid-2"><section class="detail-section"><h3>Kompetensi konsultan</h3><ul>${playbook.consultant_competencies.map(item => `<li><strong>${escapeHtml(item.competency)}</strong> — ${escapeHtml(item.class)}</li>`).join('')}</ul></section><section class="detail-section"><h3>Batas kompetensi</h3><ul>${playbook.specialist_boundaries.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section></div>
    <section class="detail-section criteria"><h3>Completion Criteria</h3><p>${escapeHtml(playbook.completion_criteria)}</p><h3>Effectiveness Criteria</h3><p>${escapeHtml(playbook.effectiveness_criteria)}</p></section>
    <section class="detail-section"><h3>Dependency</h3><p>${escapeHtml(playbook.dependency_note || 'Tidak ada dependency khusus.')}</p></section>
  </div></div>`;
  mountModal(modal, '[data-close]');
}

function openRoadmapModal(projectId, project, analytics, recommendation, playbook) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  const roadmap = buildRoadmap([{ ...recommendation, dependencies: recommendation.dependencies }])[0];
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="roadmapTitle"><div class="modal-head"><div><div class="eyebrow">Add to Roadmap · ${escapeHtml(playbook.code)}</div><h2 id="roadmapTitle" style="margin:5px 0 0">Susun draft intervensi</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><form id="roadmapForm"><div class="modal-body">
    <div class="grid grid-2"><div class="form-group"><label for="roadPriority">Prioritas</label><select class="select" id="roadPriority">${['P0','P1','P2','P3'].map(value => `<option ${recommendation.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="form-group"><label for="roadPhase">Fase</label><select class="select" id="roadPhase">${['RESPONSE NOW','FOUNDATION','IMPLEMENT','CONTROL','IMPROVE'].map(value => `<option ${roadmap.phase === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div>
    <div class="form-group"><label for="roadAction">Recommended action</label><textarea class="textarea" id="roadAction" required>${escapeHtml(playbook.purpose)}</textarea></div>
    <div class="grid grid-2"><div class="form-group"><label for="roadOwner">PIC function</label><input class="input" id="roadOwner" placeholder="Contoh: Kepala unit"></div><div class="form-group"><label for="roadDue">Target time</label><input class="input" id="roadDue" placeholder="Contoh: 31–60 hari" value="${escapeHtml(roadmap.target_window)}"></div></div>
    <div class="form-group"><label for="roadCompletion">Completion criteria</label><textarea class="textarea" id="roadCompletion">${escapeHtml(playbook.completion_criteria)}</textarea></div><div class="form-group"><label for="roadEffectiveness">Effectiveness check</label><textarea class="textarea" id="roadEffectiveness">${escapeHtml(playbook.effectiveness_criteria)}</textarea></div>
    <p class="helper">Dependency: ${escapeHtml(playbook.dependencies.join(', ') || 'Tidak ada')} · Project menyimpan snapshot playbook v${escapeHtml(playbook.version)}.</p>
  </div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan ke roadmap</button></div></form></div>`;
  const closeModal = mountModal(modal, '#roadPriority');
  modal.querySelector('#roadmapForm').addEventListener('submit', async event => {
    event.preventDefault();
    const id = `${playbook.code}-${Date.now()}`;
    const item = {
      id, project_id: projectId, playbook_id: playbook.id, playbook_code: playbook.code, playbook_version: playbook.version, title: playbook.title,
      finding_ids: recommendation.finding_ids, priority: modal.querySelector('#roadPriority').value, phase: modal.querySelector('#roadPhase').value,
      recommended_action: modal.querySelector('#roadAction').value.trim(), owner: modal.querySelector('#roadOwner').value.trim(), due_date: modal.querySelector('#roadDue').value.trim(), target_window: modal.querySelector('#roadDue').value.trim(),
      completion_criteria: modal.querySelector('#roadCompletion').value.trim(), effectiveness_criteria: modal.querySelector('#roadEffectiveness').value.trim(), dependencies: recommendation.dependencies || playbook.dependencies,
      status: 'Planned', validation_status: 'VALIDATED', createdBy: state.user.uid, createdAt: now(), playbook_snapshot: playbook,
      deliverables: playbook.deliverables.map((name, index) => ({ id: `${id}-d${index + 1}`, name, owner: '', status: 'Planned', evidence: '', completion_date: '', consultant_verification: false }))
    };
    await set(ref(db, `projectTransformations/${projectId}/roadmap/${id}`), item);
    closeModal();
    showToast(`${playbook.code} ditambahkan ke roadmap.`);
    renderTransformationPlan(projectId, project, analytics);
  });
}

async function openClientPreview(projectId, project) {
  const stored = await safeGet(`projectTransformations/${projectId}`);
  const view = clientProjection(stored || {});
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="clientViewTitle"><div class="modal-head"><div><div class="eyebrow">Tampilan klien · hanya hasil tervalidasi</div><h2 id="clientViewTitle" style="margin:5px 0 0">Prioritas Transformasi</h2></div><button type="button" class="icon-btn" data-close aria-label="Tutup dialog">×</button></div><div class="modal-body"><p class="lead">${escapeHtml(project.pesantren)}</p>${view.priorities.length ? view.priorities.map((item, index) => `<article class="client-priority"><div class="eyebrow">Prioritas ${index + 1}</div><h3>${escapeHtml(item.title)}</h3><p><strong>Mengapa:</strong> ${escapeHtml(item.reason)}</p><p><strong>Target awal:</strong> ${escapeHtml(item.target_window || 'Disepakati bersama')}</p><span class="badge neutral">${escapeHtml(item.status || 'Belum dimulai')}</span></article>`).join('') : emptyHtml('Belum ada prioritas tervalidasi', 'Klien hanya melihat playbook yang sudah divalidasi konsultan.')}</div>${view.priorities.length ? '<div class="modal-foot"><button class="btn btn-primary" id="publishClientView">Publikasikan tampilan klien</button></div>' : ''}</div>`;
  mountModal(modal, '[data-close]');
  document.querySelector('#publishClientView')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    setButtonLoading(button, true, 'Memublikasikan…');
    try {
      await set(ref(db, `clientViews/${projectId}`), JSON.parse(JSON.stringify({ ...view, project: { name: project.name, pesantren: project.pesantren, period: project.period || '' }, publishedAt: now(), publishedBy: state.user.uid })));
      showToast('Prioritas tervalidasi dipublikasikan ke tampilan klien.');
    } catch (error) { console.error(error); showToast('Tampilan klien belum berhasil dipublikasikan.', 'error'); }
    finally { setButtonLoading(button, false); }
  });
}

async function renderKnowledgeBaseAdmin() {
  destroyCharts();
  const kb = await loadKnowledgeBase();
  appEl.innerHTML = consultantShell(`<main class="page"><div class="container"><button class="breadcrumb" id="backDashboard" style="border:0;background:none;padding:0">← Kembali ke dashboard</button><div class="page-head"><div><div class="eyebrow">Internal · Knowledge Base v${escapeHtml(kb.knowledge_base_version)}</div><h1>Transformation Playbooks</h1><p class="lead">${kb.playbooks.length} playbook, ${kb.toolkits.length} toolkit, dan ${kb.indicator_map.length} mapping indikator. Seed aktif dibaca dari artefak tervalidasi.</p></div><button class="btn btn-primary" id="publishKbBtn">Publikasikan v${escapeHtml(kb.knowledge_base_version)} ke database</button></div><div class="filter-bar"><select class="select" id="kbDomainFilter"><option value="">Semua domain</option>${kb.domains.map(domain => `<option value="${domain.code}">${domain.code} · ${escapeHtml(domain.name)}</option>`).join('')}</select><input class="input" id="kbSearch" placeholder="Cari kode atau judul playbook…"></div><div class="grid grid-3" id="kbGrid">${kb.playbooks.map(kbCardHtml).join('')}</div></div></main>`);
  bindShell();
  document.querySelector('#backDashboard').addEventListener('click', renderDashboard);
  const filter = () => {
    const domain = document.querySelector('#kbDomainFilter').value;
    const query = document.querySelector('#kbSearch').value.toLowerCase();
    document.querySelectorAll('[data-kb-card]').forEach(card => card.classList.toggle('hidden', Boolean(domain && card.dataset.domain !== domain || query && !card.textContent.toLowerCase().includes(query))));
  };
  document.querySelector('#kbDomainFilter').addEventListener('change', filter);
  document.querySelector('#kbSearch').addEventListener('input', filter);
  document.querySelectorAll('[data-open-kb]').forEach(btn => btn.addEventListener('click', () => openPlaybookDetail(btn.dataset.openKb, kb)));
  document.querySelector('#publishKbBtn').addEventListener('click', async event => {
    const button = event.currentTarget;
    setButtonLoading(button, true, 'Memublikasikan…');
    try {
      await set(ref(db, `knowledgeBase/versions/${kb.knowledge_base_version.replaceAll('.', '_')}`), { schema_version: kb.schema_version, knowledge_base_version: kb.knowledge_base_version, source: kb.source, domains: kb.domains, playbooks: Object.fromEntries(kb.playbooks.map(item => [item.code, item])), toolkits: Object.fromEntries(kb.toolkits.map(item => [item.code, item])), indicator_map: kb.indicator_map, importedAt: now(), importedBy: state.user.uid, active: true });
      await set(ref(db, `knowledgeBaseImports/${Date.now()}`), { version: kb.knowledge_base_version, counts: { domains: kb.domains.length, playbooks: kb.playbooks.length, toolkits: kb.toolkits.length, indicatorLinks: kb.indicator_map.length }, status: 'SUCCESS', importedBy: state.user.uid, importedAt: now() });
      showToast('Knowledge base berhasil dipublikasikan ke database.');
    } catch (error) { console.error(error); showToast('Knowledge base belum berhasil dipublikasikan.', 'error'); }
    finally { setButtonLoading(button, false); }
  });
}

function kbCardHtml(playbook) {
  return `<article class="card kb-card" data-kb-card data-domain="${playbook.domain_code}"><div class="solution-top"><span class="badge">${playbook.code}</span><span class="small muted">v${escapeHtml(playbook.version)}</span></div><h3>${escapeHtml(playbook.title)}</h3><p class="small muted">${escapeHtml(playbook.description)}</p><div class="project-meta"><span>${playbook.linked_indicators.length} indikator</span><span>${playbook.toolkits.length} toolkit</span><span>${playbook.active ? 'Aktif' : 'Nonaktif'}</span></div><button class="btn btn-ghost btn-sm" data-open-kb="${playbook.code}">Lihat detail</button></article>`;
}

async function renderToolkitLibrary() {
  destroyCharts();
  const kb = await loadKnowledgeBase();
  appEl.innerHTML = consultantShell(`<main class="page"><div class="container"><button class="breadcrumb" id="backDashboard" style="border:0;background:none;padding:0">← Kembali ke dashboard</button><div class="page-head"><div><div class="eyebrow">Transformation resources</div><h1>Toolkit Library</h1><p class="lead">${kb.toolkits.length} alat kerja untuk membantu konsultan mengubah rekomendasi menjadi output yang dapat diperiksa.</p></div></div><div class="filter-bar"><select class="select" id="toolkitDomainFilter"><option value="">Semua domain</option>${kb.domains.map(domain => `<option value="${domain.code}">${domain.code} · ${escapeHtml(domain.name)}</option>`).join('')}</select><select class="select" id="toolkitPlaybookFilter"><option value="">Semua playbook</option>${kb.playbooks.map(item => `<option value="${item.code}">${item.code}</option>`).join('')}</select><input class="input" id="toolkitSearch" placeholder="Cari toolkit…"></div><div class="toolkit-library" id="toolkitGrid">${kb.toolkits.map(item => `<article class="card toolkit-card" data-toolkit-card data-domain="${kb.playbooks.find(p => p.code === item.playbook_code)?.domain_code}" data-playbook="${item.playbook_code}"><div><span class="badge neutral">${item.playbook_code}</span><h3>${escapeHtml(item.name)}</h3><p class="small muted">${escapeHtml(item.purpose)}</p></div><div class="small"><strong>Output:</strong> ${escapeHtml(item.expected_output)}</div></article>`).join('')}</div></div></main>`);
  bindShell();
  document.querySelector('#backDashboard').addEventListener('click', renderDashboard);
  const filter = () => {
    const domain = document.querySelector('#toolkitDomainFilter').value;
    const playbook = document.querySelector('#toolkitPlaybookFilter').value;
    const query = document.querySelector('#toolkitSearch').value.toLowerCase();
    document.querySelectorAll('[data-toolkit-card]').forEach(card => card.classList.toggle('hidden', Boolean(domain && card.dataset.domain !== domain || playbook && card.dataset.playbook !== playbook || query && !card.textContent.toLowerCase().includes(query))));
  };
  ['#toolkitDomainFilter','#toolkitPlaybookFilter'].forEach(selector => document.querySelector(selector).addEventListener('change', filter));
  document.querySelector('#toolkitSearch').addEventListener('input', filter);
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
      <div class="tabs">${tabButton('overview','Gambaran Awal',tab)}${tabButton('perspectives','Perspektif',tab)}${tabButton('compare','Bandingkan',tab)}${tabButton('recommendations','Rekomendasi Awal',tab)}${tabButton('transformation','Transformation Plan',tab)}${tabButton('followup','Tindak Lanjut Lama',tab)}</div>
      <div id="projectContent">${renderProjectTab(projectId, project, bundle, analytics, tab)}</div>
    </div></main>`);
  bindShell();
  document.querySelector('#backDashboard').addEventListener('click', renderDashboard);
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => renderProject(projectId, btn.dataset.tab)));
  bindProjectTab(projectId, project, bundle, analytics, tab);
}
