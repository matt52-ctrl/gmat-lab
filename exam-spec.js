/* GMAT Lab exam specification: everything that describes the exam being simulated lives here, and only here.
   The engine (exam-engine.js) and the app read it; to follow a change in the official exam, edit this file.
   Facts marked `official` come from the public description of the GMAT Focus Edition (mba.com). Everything GMAC does
   not publish — the question mix inside a section, how difficulty is calibrated, how answers become scores — is marked
   `estimate`: GMAT Lab's own approximation, stated openly in the app. Loaded as window.GMATSpec; module.exports in Node. */
(function (root){
'use strict';

const QUANT_GROUPS = {
  'Number properties': ['Integers & divisibility', 'Primes & factors', 'Remainders', 'Odd/even & signs', 'Fractions & decimals', 'Exponents & roots'],
  'Algebra': ['Linear equations', 'Quadratics & functions', 'Inequalities & absolute value', 'Sequences'],
  'Word problems': ['Percents', 'Ratios & proportions', 'Rates & work', 'Mixtures', 'Interest', 'Word problems'],
  'Statistics & counting': ['Statistics', 'Overlapping sets', 'Counting', 'Probability'],
};

const GMAT_FOCUS = {
  examName: 'GMAT Focus Edition',
  version: '2026-09',
  sources: {
    official: 'Structure, timing, navigation, question types and score scales as published by GMAC on mba.com.',
    estimate: 'Question mix inside each section, difficulty calibration and the conversion of answers into scores are GMAT Lab estimates: GMAC does not publish them.',
  },
  totalDuration: 135 * 60,                                   // official: three 45-minute sections, breaks not included

  /* ---------------------------------------------------------------- sections */
  sections: [
    { id: 'Q', name: 'Quantitative Reasoning', section: 'Quant', short: 'Q', duration: 45 * 60, questionCount: 21,   // official
      questionTypes: ['PS'], calculator: false,                                                                        // official
      categoryOf: 'topicGroup',                                                                                         // how the blueprint balances content
      categories: { 'Number properties': [5, 8], 'Algebra': [4, 7], 'Word problems': [5, 8], 'Statistics & counting': [2, 5] },   // estimate
      topicCap: 2, difficultyDistribution: 'adaptive' },
    { id: 'V', name: 'Verbal Reasoning', section: 'Verbal', short: 'V', duration: 45 * 60, questionCount: 23,          // official
      questionTypes: ['CR', 'RC'], calculator: false,                                                                  // official
      categoryOf: 'type', categories: { CR: [9, 11], RC: [12, 14] },                                                     // estimate
      topicCap: 2, passageSize: [3, 4], difficultyDistribution: 'adaptive' },                                            // estimate: 3–4 questions per passage
    { id: 'DI', name: 'Data Insights', section: 'Data Insights', short: 'DI', duration: 45 * 60, questionCount: 20,     // official
      questionTypes: ['DS', 'TPA', 'TA', 'GI', 'MSR'], calculator: true,                                               // official
      categoryOf: 'type', categories: { DS: [7, 10], TPA: [2, 3], TA: [3, 4], GI: [2, 4], MSR: [2, 3] },                 // estimate
      topicCap: 99, difficultyDistribution: 'adaptive' },
  ],
  topicGroups: QUANT_GROUPS,

  /* ---------------------------------------------------------------- question types (IRT defaults when a question has no calibrated `irt`) */
  questionTypes: {
    PS: { section: 'Quant', discrimination: 1.0, guessing: 0.2 },
    CR: { section: 'Verbal', discrimination: 0.9, guessing: 0.2 },
    RC: { section: 'Verbal', discrimination: 0.8, guessing: 0.2 },
    DS: { section: 'Data Insights', discrimination: 1.0, guessing: 0.2 },
    TPA: { section: 'Data Insights', discrimination: 1.1, guessing: 0.03 },    // two columns of about six options: ~1/36
    TA: { section: 'Data Insights', discrimination: 1.1, guessing: 0.125 },    // three Yes/No statements, all must be right
    GI: { section: 'Data Insights', discrimination: 1.1, guessing: 0.06 },     // two drop-downs of four options
    MSR: { section: 'Data Insights', discrimination: 1.1, guessing: 0.125 },
  },
  /* A question's difficulty is a number from 0 (easiest) to 1 (hardest). Questions labelled only with a level 1–6 get
     (level − 1) / 5. The item model places difficulty s at b = −2.5 + 5s on the ability scale (estimate). */
  difficultyScale: { min: 0, max: 1, fromLevel: level => (level - 1) / 5, toTheta: s => -2.5 + 5 * s, toLevel: s => Math.round(1 + 5 * s) },

  /* ---------------------------------------------------------------- rules */
  timingRules: {
    sectionTimed: true, timeUpEndsSection: true, unanswered: 'incorrect',       // official: unanswered questions lower the score
    lowTimeWarningSec: 5 * 60, timerAlwaysVisible: true,
    analysis: { slowTypeRatio: 1.3, rushRatio: 0.6, earlyShare: 0.45, earlyPart: 1 / 3, endgamePart: 0.25, endgameDrop: 0.25, stuckRatio: 2.5, lowEfficiency: 0.85, guessRatio: 0.35, overtimeRatio: 1.6 },
  },
  navigationRules: {
    backtracking: false,                                          // official: no going back to earlier questions
    bookmarks: true, reviewAndEdit: { enabled: true, maxChanges: 3, when: 'end of section, while time remains' },   // official
    sectionOrder: 'chosen by the test taker',                     // official: any of the six orders
    breaks: { count: 1, minutes: 10, afterSection: [1, 2] },      // official: one optional break
    confidenceRatings: false, feedback: 'none until the end',
  },
  scoringRules: {
    model: 'IRT 3PL', estimator: 'EAP', prior: { mean: 0, sd: 1 }, grid: { from: -4, to: 4, step: 0.05 },
    unanswered: 'incorrect',
    // estimate: ability → section score. Anchors put an average test taker near 79 per section (about 555 in total)
    // and a 705 near 85; replace them if GMAC publishes a conversion.
    sectionScale: { min: 60, max: 90, anchors: [[-3, 60], [-2, 68], [-1, 75], [0, 79], [1, 83], [2, 87], [3, 90]] },
    totalScale: { min: 205, max: 805, step: 10, sectionSumMin: 180, sectionSumMax: 270 },   // official scales; the formula linking them is an estimate
    percentiles: null,                                            // GMAC's table changes every year: not reproduced here
    rangeZ: 1,                                                    // score range shown = estimate ± 1 standard error
  },
  adaptiveRules: {
    unit: 'question', passageAsUnit: true,
    start: { from: 'ability model', shrink: 0.5, clamp: [-1, 1.5] },   // start near, not at, the estimated level
    selection: 'maximum information', randomesque: 5,                 // pick among the 5 most informative, so sequences are not predictable
    selectionPrior: { sd: 1 },
    maxSameAnswerRun: 3,                                              // no more than 3 right answers in a row with the same letter
    similarity: 0.6,                                                  // share of features (statement kinds, word triples) above which two questions never share a mock
  },

  /* ---------------------------------------------------------------- modes */
  modes: [
    { id: 'official', name: 'Full Official Simulation', sections: 'all', timed: true, adaptive: true, blueprint: 'official', comparable: true,
      text: 'The whole exam: three 45-minute sections in the order you choose, one optional 10-minute break, questions adapting to your answers, no going back, up to 3 answer changes per section, an estimated score at the end.' },
    { id: 'section', name: 'Section Simulation', sections: 'one', timed: true, adaptive: true, blueprint: 'official', comparable: true,
      text: 'One section under exam conditions, with an estimated section score.' },
    { id: 'weakness', name: 'Weakness-Based Mock', sections: 'one', timed: true, adaptive: true, blueprint: 'weakness', comparable: false,
      text: 'One section under exam conditions, with more questions on your weakest topics. Scored, but kept out of the score trend.' },
    { id: 'untimed', name: 'Untimed Mock', sections: 'one', timed: false, adaptive: true, blueprint: 'official', comparable: false,
      text: 'One section with the exam’s rules but no clock. Time is still recorded. Scored, but kept out of the score trend.' },
    { id: 'final', name: 'Final Exam Simulation', sections: 'all', timed: true, adaptive: true, blueprint: 'official', comparable: true, requiresReadiness: true,
      text: 'The full exam as a dress rehearsal, in the section order you plan for test day. Opens when the Examiner says you are ready for a full mock.' },
  ],
  links: [
    { name: 'Timed practice', tab: 'practice', text: 'Sets at real pace, on the topics you choose.' },
    { name: 'Untimed practice', tab: 'practice', text: 'Learn mode: feedback, hints and review after each question.' },
    { name: 'Diagnostic', tab: 'diagnostic', text: 'The fixed diagnostic blocks that set your starting point.' },
  ],

  /* ---------------------------------------------------------------- analysis */
  errorCategories: {
    'Knowledge Gap': { from: ['Procedural'], fix: 'Study the lesson on {topic}, then solve {n} questions at level {level} in learn mode.' },
    'Conceptual Error': { from: ['Conceptual', 'Logic', 'Trap'], fix: 'Reread the key ideas and traps for {topic}; before answering, name the concept the question tests.' },
    'Calculation Error': { from: ['Calculation'], fix: 'Write every step on the noteboard and check the last step against the question; practise {n} timed questions on {topic}.' },
    'Careless Error': { from: ['Careless'], fix: 'Before confirming, reread what the question asks for and check that your answer is that quantity.' },
    'Misread Question': { from: ['Reading', 'Interpretation'], fix: 'Underline the question stem’s exact ask and every condition; restate it in your own words before solving.' },
    'Timing Error': { from: ['Timing'], fix: 'Set a two-minute checkpoint: if you have no clear path by then, guess, bookmark and move on.' },
    'Guessing': { from: ['Guessing'], fix: 'A fast guess on {topic} means the method is not automatic yet: {n} learn-mode questions at level {level}.' },
    'Strategy Error': { from: ['Strategy', 'Overthinking'], fix: 'Look for the shortest route (testing values, estimation, eliminating options) on {n} questions on {topic}.' },
  },
  readinessRules: {
    simulationsIn30Days: 2, targetMargin: 20, totalSd: 25, sectionSd: 3, timeEfficiency: 0.9, hardAccuracy: 0.5, hardMin: 15, officialWithin: 30, officialDays: 21,
    nextMock: { minDays: 7, maxDays: 21, practiceSince: 30, perFocusTopic: 5, focusAccuracy: 0.6 },
  },
};

root.GMATSpec = GMAT_FOCUS;
if (typeof module === 'object' && module.exports) module.exports = GMAT_FOCUS;
})(typeof window !== 'undefined' ? window : globalThis);
