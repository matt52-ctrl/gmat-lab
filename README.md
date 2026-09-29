# GMAT Lab

A GMAT Focus Edition training app: diagnostic blocks at real test pace, timed and learn-mode practice, an error log with spaced retests (1 → 3 → 7 → 21 → 45 days), topic mastery, mock tracking, a daily plan and a coach.

It is a static site with no build step. Every push to `main` runs the checks (question files, unit tests, JavaScript syntax) and, only if they pass, publishes the site with GitHub Pages.

## Put it online

1. Keep this repository **public** (GitHub Pages is free on public repositories).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`, or run **Actions → Checks and deploy → Run workflow**. The app appears at `https://<user>.github.io/<repo>/`. Add it to your phone's home screen.

To run it on your computer: `python3 -m http.server 8000` in this folder, then open http://localhost:8000. Opening `index.html` directly does not work, because the browser blocks loading the questions from `file://`.

## Every day

The **Today** tab shows a plan for the time you have (15 minutes to 2 hours): unfinished reviews, the next diagnostic block, retests due, practice on your weakest topic and a timed mixed set, each with the reason and a start button.

The **Coach** tab answers "What should I study today?", "What is my main weakness?", "Am I improving?", "Which mistakes do I repeat?", "Am I ready for a mock?", "What is my level?" and "How should I spread this week's hours?" from your own data. It runs in the page (`planner.js`), with no AI and no cost. It never turns GMAT Lab's own questions into a GMAT score: only official practice exams give one.

The **Learn** tab holds the GMAT knowledge built into the app: a lesson for each of the 40 topics (key ideas, formulas, method, traps, shortcuts and a worked example) and guides on the exam format, pacing, bookmarks and answer changes, reading arguments and passages, and Data Sufficiency. The same theory opens inside every solution and next to weak topics in the plan. No chatbot, no AI calls: it is written into the app (`knowledge/`).

**Coach sets** (from the plan, or "Let the coach pick" in Practice) are adaptive: weak topics come up most and strong ones now and then, and each question is harder after a right answer and easier after a wrong one.

**GMAT simulation** (Mocks tab) follows the real GMAT Focus format: three 45-minute sections (Quant 21, Verbal 23, Data Insights 20 questions) in the order you choose, one optional 10-minute break after the first or second section, question-by-question adaptive difficulty starting from a middle level, no going back, bookmarks and up to 3 answer changes per section at the end, calculator only in Data Insights, no confidence ratings and no feedback until the end, reading passages with their questions together. It uses only questions you have never seen, so it opens once every section has enough. It does not produce a GMAT score: only official practice exams can.

## Where your progress is saved

- **In the browser.** Nothing is sent anywhere by default.
- **Backups.** Settings → Export backup downloads one JSON file; Import backup merges one back in (for each item, the newer version wins).
- **GitHub sync.** Settings → Sync with GitHub saves your progress to `progress/gmat-lab.json` on branch `gmat-progress` of a **private** repository (by default `<this repo>-progress`), so it follows you across devices and Claude can read it. It needs a fine-grained personal access token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → only the progress repository → permission **Contents: Read and write**. The token stays in that browser. The app warns you before syncing to a public repository.

## Claude

- **Daily review.** Every night Claude reads your synced progress, writes a review with the week's focus (on the Coach tab), and adds new questions on your weak topics and for the GMAT simulation. It uses your Claude subscription, not an API key. The procedure is in [CLAUDE.md](CLAUDE.md).
  - It runs in GitHub Actions (`Daily review` workflow) once two repository secrets exist (**Settings → Secrets and variables → Actions**): `CLAUDE_CODE_OAUTH_TOKEN`, from `claude setup-token` on a computer with Claude Code (Pro or Max plan), and `PROGRESS_REPO_TOKEN`, a fine-grained token with **Contents: Read and write** on the progress repository (the one you use for sync in the app works). Claude only edits files; the workflow checks the questions, publishes them and saves the review. Without the secrets it stops with a notice. **Actions → Daily review → Run workflow** starts it by hand.
  - A Claude Code routine runs the same review at 05:56 as a backup; if the night run already did the work, it stops.
- **Coach chat and question generator (optional).** "Ask the coach" under each question and "Generate a fresh question" in Practice call Claude (`claude-opus-5-5`) from the browser with your own Anthropic API key (Settings → Claude coach), billed by Anthropic separately from a Claude subscription. `vendor/anthropic-sdk.js` is the official `@anthropic-ai/sdk` 0.129.0 (MIT), bundled for the browser. Requests enable Anthropic's server-side refusal fallback (`fallbacks: "default"`).

## Questions

`questions/index.json` lists the question files; each file is a JSON array of questions. The format is in [CLAUDE.md](CLAUDE.md), and `node tools/validate-questions.js` checks it. Practice opens section by section after that section's diagnostic block.

## Files

| File | What it does |
|---|---|
| `index.html` | Page structure and styles |
| `app.js` | Views, test engine, review flow, analytics |
| `planner.js` | Rule-based coach: daily plan, topic weights, coach sets |
| `store.js` | Browser storage, backups, GitHub sync |
| `coach.js` | Optional Claude coach and question generator (loaded only when used) |
| `questions/` | Question bank |
| `knowledge/` | Lessons for every topic and exam guides |
| `tools/validate-questions.js` | Question file checks |
| `tests/` | Unit tests: `node --test tests/*.test.js` |
| `vendor/anthropic-sdk.js` | Anthropic JS SDK, browser bundle |
