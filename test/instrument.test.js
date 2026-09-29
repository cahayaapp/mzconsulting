import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAINS } from '../questions.js';
import {
  ACTIVE_INSTRUMENT_VERSION,
  LEGACY_INSTRUMENT_VERSION,
  answerFromOption,
  answerSignal,
  createVersionedProject,
  effectiveInstrumentVersion,
  getAllQuestionDefinitions,
  getQuestionDefinition,
  renderAnswerOptions
} from '../lib/instrument.js';
import { buildInstrument } from '../scripts/build-instrument.mjs';
import { buildInstrumentMigration } from '../scripts/migrate-instrument-v03.mjs';

const questions = DOMAINS.flatMap(domain => domain.questions);
const definitions = getAllQuestionDefinitions();

test('every active D01-D10 question has its own V0.3 answer set', () => {
  assert.equal(questions.length, 100);
  assert.equal(definitions.length, questions.length);
  assert.deepEqual(new Set(definitions.map(item => item.question_id)), new Set(questions.map(item => item.id)));
  definitions.forEach(item => assert.equal(item.answer_options.length, 9));
});

test('answer option ids are globally unique and internal mappings are valid', () => {
  const options = definitions.flatMap(item => item.answer_options);
  assert.equal(new Set(options.map(item => item.answer_option_id)).size, options.length);
  definitions.forEach(item => {
    const normal = item.answer_options.filter(option => !option.excluded_from_score);
    assert.equal(normal.length, 5);
    normal.forEach((option, index) => {
      assert.equal(option.internal_value, index + 1);
      assert.equal(option.gate_signal ?? option.diagnostic_signal, index + 1);
      assert.equal(option.instrument_version, ACTIVE_INSTRUMENT_VERSION);
    });
  });
});

test('active questions never use legacy generic answer wording', () => {
  const forbidden = new Set(['Belum ada / belum berjalan','Mulai ada, belum konsisten','Berjalan cukup konsisten','Terkelola dan ditinjau','Matang dan terus diperbaiki']);
  definitions.flatMap(item => item.answer_options).forEach(option => assert.equal(forbidden.has(option.label), false));
});

test('old completed response keeps legacy version while old active link upgrades to V0.3', () => {
  assert.equal(effectiveInstrumentVersion({ invite: {}, response: { submittedAt: 123 } }), LEGACY_INSTRUMENT_VERSION);
  assert.equal(effectiveInstrumentVersion({ invite: {}, response: { answers: { vision_01: { score: 2 } } } }), ACTIVE_INSTRUMENT_VERSION);
  assert.equal(createVersionedProject({ id: 'new' }).instrumentVersion, ACTIVE_INSTRUMENT_VERSION);
});

test('construct remains stable for perception-gap comparison', () => {
  const definition = getQuestionDefinition('governance_03');
  assert.equal(definition.construct, 'decision_authority_clarity');
  definition.answer_options.filter(item => !item.excluded_from_score).forEach(option => assert.equal(answerFromOption('governance_03', option.answer_option_id).construct, definition.construct));
});

test('TT BM LW and UTB are excluded signals and never become zero', () => {
  const definition = getQuestionDefinition('vision_01');
  const special = definition.answer_options.filter(item => item.excluded_from_score);
  assert.deepEqual(special.map(item => item.code), ['TT','BM','LW','UTB']);
  special.forEach(option => {
    const answer = answerFromOption(definition.question_id, option.answer_option_id);
    assert.equal(answerSignal(answer), null);
    assert.notEqual(answer.score, 0);
  });
});

test('respondent markup contains no internal numeric maturity or gate value', () => {
  const definition = getQuestionDefinition('governance_03');
  const html = renderAnswerOptions(definition, null, value => String(value));
  assert.doesNotMatch(html, /gate_signal|internal_value|answer-num|Level [1-5]|gate [1-5]/);
  assert.match(html, /Batas wewenang ditetapkan/);
});

test('publishable instrument artifact contains all versioned records', () => {
  const artifact = buildInstrument();
  assert.equal(artifact.instrument_version, ACTIVE_INSTRUMENT_VERSION);
  assert.equal(artifact.counts.questions, 100);
  assert.equal(artifact.counts.answer_options, 900);
  assert.equal(Object.keys(artifact.questions).length, 100);
});

test('migration upgrades old active links but preserves completed response version and answers', () => {
  const oldAnswers = { governance_03: { score: 2, note: 'tetap' } };
  const database = {
    projects: { p1: { perspectives: { a: { inviteId: 'open' }, b: { inviteId: 'done' } } } },
    invites: { open: { projectId: 'p1', perspectiveId: 'a', active: true }, done: { projectId: 'p1', perspectiveId: 'b', active: true } },
    responses: { open: { answers: oldAnswers }, done: { answers: oldAnswers, submittedAt: 1 } }
  };
  const { patch, report } = buildInstrumentMigration(database, 99);
  assert.equal(patch['invites/open/instrumentVersion'], ACTIVE_INSTRUMENT_VERSION);
  assert.equal(patch['responses/open/instrumentVersion'], ACTIVE_INSTRUMENT_VERSION);
  assert.equal(patch['invites/done/instrumentVersion'], LEGACY_INSTRUMENT_VERSION);
  assert.equal(patch['responses/done/instrumentVersion'], LEGACY_INSTRUMENT_VERSION);
  assert.equal(patch['projects/p1/instrumentVersion'], ACTIVE_INSTRUMENT_VERSION);
  assert.equal(report.answersChanged, 0);
  assert.deepEqual(database.responses.open.answers, oldAnswers);
});
