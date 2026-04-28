# Кора — The AI-CEO that says NO

**One-line promise:** *AI-CEO, который берёт идею с нуля и ведёт её до первых шагов: структурирует видение, строит бизнес-модель и помогает запустить MVP.*

A disciplined co-founder for solo builders. Turns a raw idea into a focused vision, a tested business model, and a shipped MVP — by saying NO to everything else.

---

## 1. Why this exists

Solo founders don't fail because they lack ideas. They fail because they have too many. They chase every customer request, every market signal, every shiny tactic — and ship a fractured product that solves nothing well.

The bottleneck is not creativity. It is **focus**. The job that's missing on a 1-person team is the CEO: the one who picks the wedge, defends it from every "good idea," and forces the team to ship something narrow before something broad.

Existing tools don't fill this gap:

- ChatGPT will validate any idea you bring it. It is a yes-machine.
- Lean Canvas templates are static. They don't push back.
- Accelerator content is general; it doesn't see your specific idea.
- Co-founders are rare and slow to find.

What's needed is an opinionated operator that lives with the founder day-to-day, holds them to a single thesis, and ships them past the first 100 users.

## 2. The thesis

**Focus is a process, not a personality trait.** It can be operationalized.

Every early-stage company that ships comes from the same loop:

1. A specific user with a specific problem.
2. A narrow wedge that solves it 10× better than alternatives.
3. A business model with believable unit economics.
4. An MVP that tests the riskiest assumption first.
5. A launch that gets to 100 users who pull the product.

An AI-CEO that runs this loop — and refuses to let the founder skip steps or expand scope — is the product.

## 3. The product, in one paragraph

Кора is an AI-CEO that ingests your raw idea (a paragraph, a Loom, a napkin sketch) and walks you through five stage-gates: **Vision → Customer → Model → MVP → Launch**. At each gate, a specialized agent interrogates you, drafts the artifact, and scores readiness. The system has one prime directive: protect the wedge. It will reject feature ideas, market expansions, and "what if we also..." impulses that reduce focus. You get a tight one-page vision, a Lean Canvas with falsifiable assumptions, an MVP spec scoped to one user job, and a 30-day launch plan — not a 60-page strategy doc.

## 4. The prime directive: say NO

Every other AI assistant defaults to YES. Кора defaults to NO. This is the product.

When the founder pitches a new feature, segment, or channel, Кора runs a **Focus Filter**:

1. Does this serve the chosen user's chosen problem?
2. Does it test the riskiest unvalidated assumption?
3. Can it ship in the current MVP cycle?
4. Would removing a current priority be worth this trade?

If any answer is no, the response is: **"Not yet. Park it."** Ideas go to a `parking_lot.md` — never lost, never built today. The founder watches the parked count grow; that's a feature, not a bug. A long parking lot is proof of discipline.

This is not contrarianism for its own sake. Кора will say YES — once — to the wedge. After that, the bar is brutal.

## 5. The five gates

Each gate has an agent, a set of artifacts, and an exit criterion. You cannot proceed until you pass.

### Gate 1 — Vision Architect

- **Input:** raw idea.
- **Job:** distill to a one-page vision — who, what pain, what change, why now, why you.
- **Artifact:** `vision.md` (≤ 1 page; must read aloud in 90 seconds).
- **Exit:** founder can recite the wedge sentence from memory.

### Gate 2 — Customer Inquisitor

- **Input:** vision.
- **Job:** force the founder to name *one* persona — not a market, a person. Generates 10 discovery questions and 20 places that exact person hangs out (subreddits, Slacks, Discords, conferences). Rejects vague answers — "SMBs", "developers", "marketers" all fail.
- **Artifact:** `icp.md`, `interview_script.md`, `outreach_list.md`.
- **Exit:** 5 booked interviews with the named persona.

### Gate 3 — Business Model Engineer

- **Input:** vision + interview transcripts.
- **Job:** build a Lean Canvas with **falsifiable** assumptions. Forces unit economics on day one — pricing, CAC ceiling, LTV floor. Picks one channel, kills the rest.
- **Artifact:** `lean_canvas.md`, `unit_economics.md`, `riskiest_assumption.md`.
- **Exit:** the riskiest assumption is named and a $0–$100 test is designed to falsify it.

### Gate 4 — MVP Scoper

- **Input:** lean canvas + riskiest assumption.
- **Job:** define the smallest possible thing that tests the assumption. Strips features. Refuses scope > 2 weeks of build time. Writes a one-page spec with a single user flow.
- **Artifact:** `mvp_spec.md`, `cut_list.md` (everything that's NOT in v1).
- **Exit:** spec fits on one page; cut list is longer than the build list.

### Gate 5 — Launch Operator

- **Input:** shipped MVP.
- **Job:** 30-day plan to 100 real users through the *one* channel chosen in Gate 3. Daily checklist. Weekly review where Кора measures pull (retention, referrals) vs. push (paid, cold).
- **Artifact:** `launch_plan.md`, `daily_log.md`, `week_review.md`.
- **Exit:** 100 users, ≥ 20% week-2 retention, OR a documented pivot.

## 6. What Кора produces

Not a plan deck. A working set of files, versioned, that travel with the founder:

- `vision.md` — the wedge
- `icp.md` — the one persona
- `lean_canvas.md` — the model
- `mvp_spec.md` — the build
- `launch_plan.md` — the first 30 days
- `parking_lot.md` — everything we said NO to, with date and reason
- `decision_log.md` — every gate decision and the evidence behind it

Markdown, in a Git repo. The founder owns it. Кора edits it.

## 7. What Кора will NEVER do

This list is the product as much as the feature list is.

- **No "let me brainstorm 20 ideas."** The founder brought the idea. Кора narrows, never expands.
- **No multi-product portfolios.** One idea per project. Want a second? Open a second project.
- **No market research theatre.** TAM/SAM/SOM is banned. One persona, real interviews, real money.
- **No 60-slide pitch decks.** A one-page vision converts more investors than a deck does.
- **No "AI does it all" mode.** The founder talks to customers. Кора does not. Outsourcing customer discovery kills the company.
- **No feature factories.** Кора will not generate a backlog. It generates a cut list.
- **No vanity metrics.** Followers, signups, waitlist counts are not progress.
- **No replacement for shipping.** Кора does not write your code. It does not run your ads. It is a CEO, not a contractor.

## 8. Who this is for

**Yes:**

- Solo technical founders with an idea and 90 days of runway.
- Indie hackers tired of building without users.
- Designers and PMs leaving big tech to start something.
- Second-time founders who lost their first company to scope creep.

**No** — we say NO here too:

- Funded teams with > 3 people. They already have a CEO.
- Agencies looking to package "AI strategy" for clients.
- Ideators with no intent to build.
- Anyone wanting validation instead of feedback.

If you want a yes-machine, use ChatGPT. Кора is built to hurt your feelings on purpose.

## 9. Business model

Mirror Okara's instinct: replace an expensive, often-mediocre human service with a focused agent at a fraction of the price.

- **$49 / month** — solo founder, one project, all five gates, parking lot, decision log.
- **$199 / month** — adds a weekly 15-minute live "board meeting" where Кора challenges the week's decisions and resets focus.
- **No free tier.** Free founders don't ship. A $49 commitment is the first focus test.
- **No enterprise tier at launch.** Says NO to the obvious revenue temptation; we build for solo founders, not HR departments.

12-week "ship cycle" cohorts create natural urgency and a community of peers passing through gates together.

## 10. The wedge — what we ship first

We eat our own dog food. The MVP of Кора is **Gate 1 only** — the Vision Architect.

A founder pastes their idea. Within 30 minutes of dialogue, they get a one-page `vision.md` and a parking lot of every shiny thing they tried to add. We charge $49 for that single artifact.

Why this wedge:

- Smallest unit of value any founder will pay for.
- The hardest thing to do alone — you can't see your own idea clearly.
- If we can't make Gate 1 magical, the rest of the system doesn't matter.
- Gives us 100 paying founders to interview before building Gates 2–5.

**Riskiest assumption:** founders will pay $49 for a one-page vision if it's genuinely clarifying. We test it with 20 hand-recruited founders in week 1.

## 11. Roadmap (90 days)

- **Days 1–14.** Gate 1 only. Manual back-end (a human operator + Claude). 20 founders, $0.
- **Days 15–30.** Productize Gate 1. Launch at $49. Target: 50 paying users.
- **Days 31–60.** Add Gate 2 (Customer Inquisitor) for paying users only. Target: 100 paying users.
- **Days 61–90.** Add Gate 3 (Business Model Engineer). Charge $99 for the three-gate pipeline. Decide from retention whether to build Gates 4–5 or double down on Gates 1–3.

Notably absent from the roadmap: integrations, a mobile app, a community feature, a marketplace, a CRM. All parked.

## 12. How Кора behaves

The product personality is the product.

- **Direct.** No "great question!" No emoji. No hedging.
- **Specific.** "Your ICP is too broad" becomes "You said 'small businesses.' Pick one: dental clinics in Texas, or freelance illustrators on Instagram. Choose now."
- **Memory-loaded.** Remembers every prior decision, every parked idea, every interview quote — and surfaces them when the founder contradicts themselves.
- **Asymmetric.** Asks more than it answers. The founder's job is to think; Кора's job is to make them think harder.
- **Allergic to abstraction.** Demands names, numbers, dates.

## 13. Differentiation

| Tool | What it does | What Кора does differently |
|---|---|---|
| ChatGPT | Validates anything | Refuses to validate vague ideas |
| Lean Canvas templates | Static fields | Stage-gated, with exit criteria |
| Accelerator content | One-size advice | Per-founder, per-idea coaching |
| Notion AI / Linear | Productivity | Focus discipline, not productivity |
| Okara (AI CMO) | Executes marketing | Decides *whether* to build, not just how to market |

Кора sits upstream of Okara. You should be a Кора graduate before you become an Okara customer.

## 14. Risks — and how we'll know we're wrong

- **"Founders won't pay for advice."** Counter-evidence: coaches, accelerators, and YC equity sell exactly this. Tested with Gate 1 pricing in week 2.
- **"The tone feels harsh, not helpful."** Ship a tone dial only if ≥ 30% of week-1 users complain. Default stays sharp.
- **"Founders ignore the NO and build anyway."** Feature, not bug — but track parking-lot-to-build leakage. If > 50% of parked items get built within 30 days, our filter is wrong.
- **"Gate 1 isn't enough to retain."** If month-2 churn > 40%, we built the wrong wedge. Pivot to Gate 3 (business model) as the wedge.

## 15. Success metrics — year 1

- **North star:** founders who reach Gate 5 (100 users, ≥ 20% week-2 retention) with Кора. Target: 100.
- **Leading:** % of users who complete Gate 1 within 7 days of signup. Target: 60%.
- **Health:** parking-lot-to-build ratio. Higher is better. Target: 5:1.
- **Revenue:** not the goal. $200K ARR is the ceiling we allow ourselves before raising.

We will say NO to a $1M ARR offer that requires building an enterprise tier in year 1.

## 16. The bet

The market will be flooded with AI agents that do more, faster, broader. Кора bets the opposite: the agent that does **less, slower, narrower** is what a founder needs to actually ship.

The first version of every great company is small enough to fit on one page. Our job is to keep it there.
