# GMAT Lab

A GMAT Focus Edition training app: diagnostic blocks at real test pace, timed and learn-mode practice, an error log with spaced retests (1 → 3 → 7 → 21 → 45 days), topic mastery, adaptive mock exams with an estimated score and a full report, a daily plan and a coach.

It is a static site with no build step. Every push to `main` runs the checks (question files, unit tests, JavaScript syntax) and, only if they pass, publishes the site with GitHub Pages.

## Put it online

1. Keep this repository **public** (GitHub Pages is free on public repositories).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`, or run **Actions → Checks and deploy → Run workflow**. The app appears at `https://<user>.github.io/<repo>/`. Add it to your phone's home screen.

To run it on your computer: `python3 -m http.server 8000` in this folder, then open http://localhost:8000. Opening `index.html` directly does not work, because the browser blocks loading the questions from `file://`.

## Every day

The **Today** tab shows a plan for the time you have (15 minutes to 2 hours): unfinished reviews, the next diagnostic block, retests due, practice on your weakest topic and a timed mixed set, each with the reason and a start button.

The **Coach** tab answers "What should I study today?", "What is my main weakness?", "Am I improving?", "Which mistakes do I repeat?", "Am I ready for a mock?", "What is my level?" and "How should I spread this week's hours?" from your own data. It runs in the page (`planner.js`), with no AI and no cost. "What is my level?" gives GMAT Lab's estimate with its range, always labelled as an estimate: only official practice exams give an official score.

**Error diagnosis.** Every wrong option of every question carries a note on the mistake that leads to it. After a miss, the review shows why your answer was tempting and pre-selects the error type for the error log.

The **Learn** tab holds the GMAT knowledge built into the app: a lesson for each of the 40 topics (key ideas, formulas, method, traps, shortcuts and a worked example) and guides on the exam format, pacing, bookmarks and answer changes, reading arguments and passages, and Data Sufficiency. The same theory opens inside every solution and next to weak topics in the plan. No chatbot, no AI calls: it is written into the app (`knowledge/`).

**Coach sets** (from the plan, or "Let the coach pick" in Practice) are adaptive: weak topics come up most and strong ones now and then, and each question is harder after a right answer and easier after a wrong one.

## Mock exams

The **Mocks** tab runs the exam the way the real GMAT Focus does it:

- **Modes:** Full Official Simulation, Section Simulation, Weakness-Based Mock (more questions on your weakest topics), Untimed Mock, and a Final Exam Simulation that opens when the Examiner recommends a full mock. Timed and untimed practice and the diagnostic are one click away.
- **Exam rules:** three 45-minute sections (Quant 21, Verbal 23, Data Insights 20) in the order you choose, one optional 10-minute break, no going back, bookmarks and up to 3 answer changes per section at the end, calculator only in Data Insights, the timer always on screen, no hints, feedback or explanations until the end. Every answer, answer change and second is recorded.
- **Blueprint and adaptive selection:** each section has a blueprint (how many questions of each topic group or type). Within it, each question is chosen with item response theory to measure you best after your last answer, with a random pick among the best few so no two mocks run alike. Reading passages come whole, never two versions of the same problem in one mock, only questions you have never seen.
- **Score, then review:** at the end you see only the estimated score with its range, the section scores and your time. The **Examiner report** follows: accuracy, time per question, difficulty, topics, skills and question types per section; time-management patterns (slow question types, rushing hard questions, overspending early, a weak finish); every miss classified (knowledge gap, conceptual, calculation, careless, misread, timing, guessing, strategy) with what happened, why, the skill to rebuild, whether it repeats, how to fix it and the next exercise. **Review the exam** then shows every question with your answer and the solution, and the guided review makes you retry each miss before you see it.
- **Feedback loop:** the Examiner's focus topics weigh more in Today's plan and coach sets for 9 days, the ability model updates with every answer, and the plan proposes the next full mock only when it would measure real progress.
- **History and readiness:** every mock with its scores, time, accuracy, difficulty, time efficiency and error types, a score trend next to your official practice exams, and a readiness page that shows each check with your value instead of a verdict.

The exam is described in one file, `exam-spec.js`: sections, timing, rules, blueprint ranges, scoring and readiness thresholds. The structure and rules are GMAC's; the question mix inside a section and the scoring are GMAT Lab's estimates, because GMAC does not publish them. So the score is an **estimate**, shown with its range: an official practice exam stays the reference. Verbal mocks need unseen questions (about 11 Critical Reasoning and 3 passages per section); the daily review keeps enough of them.

## Where your progress is saved

- **In the browser.** Nothing is sent anywhere by default.
- **Backups.** Settings → Export backup downloads one JSON file; Import backup merges one back in (for each item, the newer version wins).
- **GitHub sync.** Settings → Sync with GitHub saves your progress to `progress/gmat-lab.json` on branch `gmat-progress` of a **private** repository (by default `<this repo>-progress`), so it follows you across devices and Claude can read it. It needs a fine-grained personal access token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → only the progress repository → permission **Contents: Read and write**. The token stays in that browser. The app warns you before syncing to a public repository.

## Claude

- **Daily review.** Every night Claude reads your synced progress, writes a review with the week's focus (on the Coach tab), and adds new questions on your weak topics and for the Verbal mocks. It uses your Claude subscription, not an API key. The procedure is in [CLAUDE.md](CLAUDE.md).
  - It runs in GitHub Actions (`Daily review` workflow) once two repository secrets exist (**Settings → Secrets and variables → Actions**): `CLAUDE_CODE_OAUTH_TOKEN`, from `claude setup-token` on a computer with Claude Code (Pro or Max plan), and `PROGRESS_REPO_TOKEN`, a fine-grained token with **Contents: Read and write** on the progress repository (the one you use for sync in the app works). Claude only edits files; the workflow checks the questions, publishes them and saves the review. Without the secrets it stops with a notice. **Actions → Daily review → Run workflow** starts it by hand.
  - A Claude Code routine runs the same review at 05:56 as a backup; if the night run already did the work, it stops.

## Questions

- **Quant and Data Insights: unlimited.** `generators.js` builds new questions from 69 templates covering all 20 Quant topics and every Data Insights type (Data Sufficiency, Two-Part Analysis, Table Analysis, Graphics Interpretation, Multi-Source Reasoning), at levels 2–6. The numbers change every time, the answer is computed, and every wrong option comes from a typical mistake, with its diagnosis. Written questions come first when both fit.
- **Verbal: written by hand.** 65 so far: the diagnostic (5 Critical Reasoning, 1 passage with 4 questions) and a practice set of 40 Critical Reasoning questions (all nine types) and 4 Reading Comprehension passages with 4 questions each. The daily review adds more on your weak topics.

`questions/index.json` lists the question files; each file is a JSON array of questions. The format is in [CLAUDE.md](CLAUDE.md), and `node tools/validate-questions.js` checks it. `tests/generators.test.js` builds every template thousands of times and re-derives most answer keys by brute force. Practice opens section by section after that section's diagnostic block.

## Files

| File | What it does |
|---|---|
| `index.html` | Page structure and styles |
| `app.js` | Views, test engine, review flow, analytics |
| `planner.js` | Rule-based coach: daily plan, topic weights, coach sets |
| `exam-spec.js` | The exam being simulated: sections, timing, rules, blueprint, scoring, modes |
| `exam-engine.js` | Mock engine: blueprint, adaptive selection, scoring, analysis, ability model, examiner, readiness |
| `generators.js` | Question templates: unlimited Quant and Data Insights practice |
| `store.js` | Browser storage, backups, GitHub sync |
| `questions/` | Question bank |
| `knowledge/` | Lessons for every topic and exam guides |
| `tools/validate-questions.js` | Question file checks |
| `tests/` | Unit tests: `node --test tests/*.test.js` |
