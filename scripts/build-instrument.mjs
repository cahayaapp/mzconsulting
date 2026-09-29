import fs from 'node:fs';
import { ACTIVE_INSTRUMENT_VERSION, getAllQuestionDefinitions } from '../lib/instrument.js';

export function buildInstrument() {
  const questions = getAllQuestionDefinitions();
  const optionIds = questions.flatMap(question => question.answer_options.map(option => option.answer_option_id));
  if (questions.length !== 100) throw new Error(`Expected 100 questions, received ${questions.length}`);
  if (new Set(optionIds).size !== optionIds.length) throw new Error('Duplicate answer option id detected');
  return {
    instrument_version: ACTIVE_INSTRUMENT_VERSION,
    status: 'PUBLISHED',
    default_for_new_projects: true,
    compatibility: { completed_without_version: 'V0.2', active_without_version: ACTIVE_INSTRUMENT_VERSION },
    counts: { domains: 10, questions: questions.length, answer_options: optionIds.length },
    questions: Object.fromEntries(questions.map(question => [question.question_id, question]))
  };
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) {
  const target = new URL('../data/instrument.v0.3.json', import.meta.url);
  fs.writeFileSync(target, `${JSON.stringify(buildInstrument(), null, 2)}\n`);
  console.log(`Wrote ${target.pathname}`);
}
