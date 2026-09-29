# GMAT Lab – notes for Claude

Static GMAT training app served by GitHub Pages. No build step, no dependencies to install. One student: Italian, studies in English, target 750 on the old scale. Write app text in English.

## Repositories

- `matt52-ctrl/gmat-lab` (public): the app and the question bank. Every push to `main` runs the checks and, if they pass, deploys the site (`.github/workflows/site.yml`).
- `matt52-ctrl/gmat-lab-progress` (private): the student's progress, branch `gmat-progress`, file `progress/gmat-lab.json`, written by the app's GitHub sync. Never copy personal data from it into the public repo.

## Layout

- `index.html` – markup and CSS. `app.js` – UI: views, test engine, debrief, analytics. `store.js` – `window.GMATStore`: localStorage, backup import/export, GitHub sync. `planner.js` – `window.GMATPlanner`: the rule-based coach (today's plan, topic weights, coach sets, answers on the Coach tab); pure functions, no DOM. `coach.js` – optional Claude calls through `vendor/anthropic-sdk.js` with the student's own API key.
- `app.js` talks to storage only through `GMATStore.open()` → `db.doc(path).set|update|delete` and `db.collection(name).onSnapshot`. Collections: `bank`, `sessions`, `errors`, `mocks`, `profile`, `studylog`. The `bank` collection is `questions/*.json` merged with local overrides (generated questions, `flagged` reports).
- Checks (run them before every commit): `node tools/validate-questions.js` and `node --test tests/*.test.js`. To try the app: `python3 -m http.server`, then a browser.

## Progress file

```json
{ "app": "gmat-lab", "version": 1, "docs": { "sessions": {}, "errors": {}, "mocks": {}, "profile": {}, "studylog": {}, "bank": {} }, "ts": {}, "dead": {} }
```

- `sessions/<id>`: `kind` (diagnostic | practice | retest), `block`, `mode` (test | learn), `status` (active | done | abandoned), `timed`, `limitSec`, `durationSec`, `reviewed`, `attempts[]` with `qid, answer, correct, unanswered, timeSec, expectedSec, confidence (20–100), topic, section, type, difficulty, edited, changedFrom, at`.
- `errors/<qid>`: error log with `errorType`, `why`, `prevention`, `box`, `nextDue`, `status` (active | retired), `history[]`, `retests[]`.
- `profile/interview` (the student's answers), `profile/settings` (`phase` 0–7, shown on Today), `profile/coach` (your weekly review, below).
- `bank/<id>` with `flagged: true` and `flagNote`: a question the student reported. Check it and fix the question file.
- `ts` holds the last-change time (ms since epoch) of each `collection/id`, `dead` the deletions; sync merges per document, newest wins. When you change a document, set its `ts` to the current time, or a device's next sync may overwrite your change. Leave every other document, `ts` and `dead` entry as it is.

## Weekly review

Runs every Sunday evening, and whenever the student writes "analizza", "analizza il diagnostic" or "analizza il mock".

1. Read the progress file. If it does not exist, or there is no attempt, error or mock newer than `profile/coach.updatedAt`, stop: nothing new this week.
2. Analyse: accuracy and time against expected time per topic and section, confidence calibration, error types and prevention rules, reported questions, overdue retests, mocks. Compare with the previous review. Base every claim on the numbers; say when there is too little data.
3. Write 8–15 new practice questions (`"set": "practice"`) on the 2–3 weakest topics, at the student's level and one step above. Original only; solve each twice by two methods before keeping it. Save as `questions/week-YYYY-MM-DD.json`, add it to `questions/index.json`, run the checks.
4. Update `profile/coach` and its `ts` (and `profile/settings.phase` if the student moved on):

   ```json
   { "updatedAt": "2026-10-04T17:55:00Z", "weekOf": "2026-10-05", "summary": "3–6 sentences with specific numbers.",
     "focus": [{ "topic": "exact SYLLABUS name", "why": "one sentence" }], "tasks": ["concrete task with a count"], "newQuestions": 12 }
   ```

   Focus topics get extra weight in the app's plan for 9 days, matched by exact topic name. Commit to `gmat-progress` in the progress repo ("Weekly review YYYY-MM-DD"); if the push is rejected, fetch, re-apply, push again.
5. Commit the questions to a branch of `gmat-lab`, open a pull request to `main`, wait for the Checks job to pass, merge it. The deploy publishes them.
6. Tell the student in a few lines, in Italian: what changed, the focus, what to do this week.

## Question format

One JSON array per file in `questions/`, listed in `questions/index.json`. Ids must be unique across files. `tools/validate-questions.js` enforces all of this.

- `id`, `set` (`diagnostic` | `practice`), `block` (`Q` | `DI` | `V`), `section` (`Quant` | `Data Insights` | `Verbal`), `type` (`PS` `DS` `TPA` `TA` `GI` `MSR` `CR` `RC`), `topic` (a name from `SYLLABUS` in `app.js`), `subtopic`, `skill`, `difficulty` (1–6; 3 = standard, 4 = hard, 5+ = 750-level), `expectedSec`.
- `stem`: plain text; blank line = new paragraph, `**bold**`, `x^{2}`, `x_{1}`.
- `hints`: exactly 4, from a nudge to the first step. `method`, `altMethod`, `trap`, `solution` (why each wrong option fails).
- Diagnostic questions also have `order` within their block.

By type:

- `PS`, `CR`: `choices` (5 strings) + `answer` (index 0–4).
- `RC`: as above plus `passage: { title, text }`.
- `DS`: `statements` (2 strings, no numbering) + `answer` (0 = (1) alone, 1 = (2) alone, 2 = together, 3 = each alone, 4 = not sufficient).
- Multi-part (`TPA`, `TA`, `GI`, `MSR`): no top-level `answer`; `parts: [{ label, options, answer }]` and `partStyle`: `tpa` (two columns sharing one option list), `yesno` (options `["Yes","No"]`), `dropdown`.
  - `TA` adds `table: { columns, rows, numeric }`; `GI` adds `chart: { kind: "bar", title, unit, labels, values, max, step }`; `MSR` adds `tabs: [{ title, body }]`.

Write original questions only, never copied or paraphrased from official material, and check every answer key twice.
