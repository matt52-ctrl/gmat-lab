# GMAT Lab – notes for Claude

Static GMAT training app served by GitHub Pages. No build step, no dependencies to install. One student: Italian, studies in English, target 750 on the old scale. Write app text in English.

## Repositories

- `matt52-ctrl/gmat-lab` (public): the app and the question bank. Every push to `main` runs the checks and, if they pass, deploys the site (`.github/workflows/site.yml`).
- `matt52-ctrl/gmat-lab-progress` (private): the student's progress, branch `gmat-progress`, file `progress/gmat-lab.json`, written by the app's GitHub sync. Never copy personal data from it into the public repo.

## Layout

- `index.html` – markup and CSS. `app.js` – UI: views, test engine, debrief, analytics. `store.js` – `window.GMATStore`: localStorage, backup import/export, GitHub sync. `planner.js` – `window.GMATPlanner`: the rule-based coach (today's plan, topic weights, answers on the Coach tab) and the adaptive engine used by coach sets and the GMAT simulation (`levelAfter`, `nextAdaptive`, `examReadiness`); pure functions, no DOM. `generators.js` – `window.GMATGen`: question templates for every Quant topic and every Data Insights type (below). The app contains no AI and makes no AI calls: its knowledge is in `knowledge/`, in the questions, in `generators.js` and in `planner.js`.
- `app.js` talks to storage only through `GMATStore.open()` → `db.doc(path).set|update|delete` and `db.collection(name).onSnapshot`. Collections: `bank`, `sessions`, `errors`, `mocks`, `profile`, `studylog`. The `bank` collection is `questions/*.json` merged with local overrides (`flagged` reports); generated questions are never stored, `app.js` rebuilds them from their id.
- `knowledge/` – the built-in GMAT knowledge: one lesson per SYLLABUS topic (`quant.json`, `di.json`, `verbal.json`: `topic`, `section`, `summary`, `ideas`, `formulas`, `method`, `traps`, `shortcuts`, optional `example {q, a}`) and exam guides (`guides.json`: `id`, `title`, `points`). Shown on the Learn tab, inside every solution (“Theory: …”) and from the plan. Same inline markup as questions. `tests/knowledge.test.js` requires one complete lesson per topic.
- Checks (run them before every commit): `node tools/validate-questions.js` and `node --test tests/*.test.js`. To try the app: `python3 -m http.server`, then a browser.

## Generated questions

Quant and Data Insights practice never runs out: `generators.js` builds questions from templates (`T({ id, topic, type, levels, make(level, R) })`), with new numbers from a seeded random generator. The id `gen-<template>-<level>-<seed>` always rebuilds the same question, so sessions, retests and the error log work like with written questions. Answers are computed, never typed; every wrong option comes from a named mistake (`[value, why, type]`), which is also its diagnosis. The planner mixes them in with a lower weight than written questions (`GEN_WEIGHT` in `planner.js`), so written questions come first when both fit; like written practice, they open after the section's diagnostic block.

- `tests/generators.test.js` builds every template at every level with many seeds, runs the question checks on each, and re-derives the answer key of most templates by brute force from the question text (Data Sufficiency on a domain four times larger than the generator's).
- A reported generated question (`bank/gen-…` with `flagged: true`) names its template in the id. Fix the template and add a test for the case. If the fix changes what existing ids show, copy the template under a new id and mark the old one `retired: true`: old ids keep rebuilding, new sets use the new template.
- Adding a template: pick a topic from `SYLLABUS`, write `make` so that it throws `Retry` (via `need(...)`) instead of producing awkward numbers, give 4+ named mistakes, and add a brute-force check to the tests when the answer can be verified that way.

## Progress file

```json
{ "app": "gmat-lab", "version": 1, "docs": { "sessions": {}, "errors": {}, "mocks": {}, "profile": {}, "studylog": {}, "bank": {} }, "ts": {}, "dead": {} }
```

- `sessions/<id>`: `kind` (diagnostic | practice | retest), `block`, `mode` (test | learn), `status` (active | done | abandoned), `timed`, `limitSec`, `durationSec`, `reviewed`, `attempts[]` with `qid, answer, correct, unanswered, timeSec, expectedSec, confidence (20–100), topic, section, type, difficulty, edited, changedFrom, at`.
- `errors/<qid>`: error log with `errorType`, `why`, `prevention`, `box`, `nextDue`, `status` (active | retired), `history[]`, `retests[]`.
- `profile/interview` (the student's answers), `profile/settings` (`phase` 0–7, shown on Today), `profile/coach` (your review, below).
- `bank/<id>` with `flagged: true` and `flagNote`: a question the student reported. Check it and fix the question file.
- `ts` holds the last-change time (ms since epoch) of each `collection/id`, `dead` the deletions; sync merges per document, newest wins. When you change a document, set its `ts` to the current time, or a device's next sync may overwrite your change. Leave every other document, `ts` and `dead` entry as it is.

## Daily review

Runs every night in GitHub Actions (`.github/workflows/daily-review.yml`, 03:17 Amsterdam time, once its two secrets are set), every morning at 05:56 from a Claude Code routine as a backup, and whenever the student writes "analizza", "analizza il diagnostic" or "analizza il mock". Whichever runs first does the work; the next one finds nothing new and stops. In GitHub Actions, Claude only edits files (steps 1–4) and the workflow commits, checks and publishes.

1. Read the progress file. If it does not exist, tell the student in one line what is missing and stop. If there is no attempt, error, mock or reported question newer than `profile/coach.updatedAt`, stop without changes and without messaging.
2. Analyse: accuracy and time against expected time per topic and section, confidence calibration, error types and prevention rules, reported questions, overdue retests, simulations (sessions with `kind: "exam"`), mocks. Compare with the previous review. Base every claim on the numbers; say when there is too little data.
3. Add questions only where they are missing, at most 15 a day, as `questions/day-YYYY-MM-DD.json` (listed in `questions/index.json`, `"set": "practice"`). Quant and Data Insights have unlimited generated questions, so written questions go mainly to Verbal:
   - the 2–3 weakest Verbal topics need at least 8 unseen questions each, at the student's level and one step above;
   - a GMAT simulation needs 23 unseen Verbal questions (CR, and RC passages of 3–4 questions that share an identical `passage` object); keep at least 30 unseen, with difficulty spread over levels 3–6 so the adaptive test can move up and down;
   - write Quant or Data Insights questions only for a skill the templates do not cover, or to fix a reported template (see “Generated questions”).
   Spread the right answers evenly over A–E. Original only; solve each twice by two methods before keeping it; run the checks.
4. Update `profile/coach` and its `ts` (and `profile/settings.phase` if the student moved on). On Sundays, or when `weekOf` is 7+ days old, write a new week (`weekOf` = next Monday, `focus`, `tasks`); on other days update `summary` and keep `focus` and `tasks` unless the data says otherwise.

   ```json
   { "updatedAt": "2026-10-04T05:56:00Z", "weekOf": "2026-10-05", "summary": "3–6 sentences with specific numbers.",
     "focus": [{ "topic": "exact SYLLABUS name", "why": "one sentence" }], "tasks": ["concrete task with a count"], "newQuestions": 12 }
   ```

   Focus topics get extra weight in the app's plan for 9 days, matched by exact topic name. Commit to `gmat-progress` in the progress repo ("Review YYYY-MM-DD"); if the push is rejected, fetch, re-apply, push again.
5. Commit new questions to a branch of `gmat-lab`, open a pull request to `main`, wait for the Checks job to pass, merge it. The deploy publishes them.
6. Tell the student in a few lines, in Italian: what changed, the focus, what to do today.

When the same kind of error keeps coming back on a topic (3+ times), add it to that topic's `traps` in `knowledge/*.json`, in general terms and without personal data, in the same pull request as the questions. Keep lessons accurate and original; never copy official material, and never use a diagnostic question as an example.

## Question format

One JSON array per file in `questions/`, listed in `questions/index.json`. Ids must be unique across files. `tools/validate-questions.js` enforces all of this.

- `id`, `set` (`diagnostic` | `practice`), `block` (`Q` | `DI` | `V`), `section` (`Quant` | `Data Insights` | `Verbal`), `type` (`PS` `DS` `TPA` `TA` `GI` `MSR` `CR` `RC`), `topic` (a name from `SYLLABUS` in `app.js`), `subtopic`, `skill`, `difficulty` (1–6; 3 = standard, 4 = hard, 5+ = 750-level), `expectedSec`.
- `stem`: plain text; blank line = new paragraph, `**bold**`, `x^{2}`, `x_{1}`.
- `hints`: exactly 4, from a nudge to the first step. `method`, `altMethod`, `trap`, `solution` (why each wrong option fails).
- `diagnosis` (required): one entry per option, in the same order; `null` for the right option, and for every wrong one `{ "why": "the mistake that leads to it, in one or two sentences", "type": "<one of ERROR_TYPES in app.js>" }`. It must not give away the right answer beyond what the solution shows. DS uses the five standard choices; multi-part questions put `diagnosis` inside each part, aligned with that part's options. The app shows it after a miss and pre-selects the error type.
- Diagnostic questions also have `order` within their block.

By type:

- `PS`, `CR`: `choices` (5 strings) + `answer` (index 0–4).
- `RC`: as above plus `passage: { title, text }`.
- `DS`: `statements` (2 strings, no numbering) + `answer` (0 = (1) alone, 1 = (2) alone, 2 = together, 3 = each alone, 4 = not sufficient).
- Multi-part (`TPA`, `TA`, `GI`, `MSR`): no top-level `answer`; `parts: [{ label, options, answer }]` and `partStyle`: `tpa` (two columns sharing one option list), `yesno` (options `["Yes","No"]`), `dropdown`.
  - `TA` adds `table: { columns, rows, numeric }`; `GI` adds `chart: { kind: "bar", title, unit, labels, values, max, step }`; `MSR` adds `tabs: [{ title, body }]`.

Write original questions only, never copied or paraphrased from official material, and check every answer key twice.
