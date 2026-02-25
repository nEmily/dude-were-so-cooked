# AI Digest — Wednesday, February 25, 2026

## What's Happening Right Now

The biggest story today is remote control infrastructure for AI agents becoming real. Claude Code Remote Control (465 HN points) shipped as a prerelease, letting developers direct coding agents from mobile and distributed environments—messy and buggy, but live. This lands in the same week OpenAI announced Frontier Alliance Partners for enterprise agent deployments, and just after Stack Influence released FDM1, a fully general computer action model trained on 11M hours of internet video. The narrative is clear: the industry has moved from "agents can code" to "agents can run production workflows across your infrastructure."

Meanwhile, the measurement game is getting messier. OpenAI published a technical analysis (low-signal on HN: 0 comments) explaining why they stopped evaluating SWE-bench Verified—the canonical software engineering benchmark is now considered "increasingly contaminated" with training leakage and flawed tests. They're recommending SWE-bench Pro instead. This matters because it signals the old benchmarks are breaking under the weight of capable models, and standardized eval is harder than everyone thought.

On the business side, Nvidia posted record earnings and capital expenditures ("the demand for tokens in the world has gone completely exponential," per Jensen Huang), and the U.S. government is quietly fracturing: CISA is reportedly in "dire shape" under budget cuts, while the White House is pushing AI companies to absorb electricity rate hikes (most already said yes). These are structural tensions—who pays for the infrastructure to build safer AI?

## Key Stories

### Claude Code Remote Control
- **Source**: [Claude Code Docs](https://code.claude.com/docs/en/remote-control)
- **Why it matters**: Remote control of coding agents is no longer theoretical—it's shipping, even if rough. This unlocks asynchronous workflows and distributed team use.
- **HN sentiment**: Mixed-to-frustrated. Top comment: "extremely clunky and buggy prerelease... you can't interrupt Claude, at best it just keeps spinning." Users comparing it unfavorably to existing SSH/tmux workflows, but acknowledging the convenience play.
- **Keywords**: remote agents, mobile coding, agent infrastructure, out-of-office dev ops

### The First Fully General Computer Action Model
- **Source**: [Stack Influence](https://si.inc/posts/fdm1/)
- **Why it matters**: 11M hours of training data on 11M labeled screens means computer-use models just became much more data-rich. The inverse dynamics approach (using a model to label more data) could be a scaling pattern for agent training.
- **HN sentiment**: Impressed but measured. Author Neel is participating in comments. Main question: are inverse/forward models trained separately? Driving demo criticism ("maybe don't almost-hit pedestrians") suggests real-world safety questions.
- **Keywords**: computer use models, inverse dynamics, vision-action models, scaling to production

### Large-Scale Online Deanonymization with LLMs
- **Source**: [Simon Lermen Substack](https://simonlermen.substack.com/p/large-scale-online-deanonymization)
- **Why it matters**: LLMs can cluster and link pseudonymous identities across platforms at scale. This is not new (2008 Netflix paper cited), but LLMs make it faster and cheaper—privacy assumptions people built products on are breaking.
- **HN sentiment**: Pragmatic and divided. Some argue "HN specifically only tracks people comfortable with linkage." Others raise acute concern: "At first I thought of how this would impact employment. But then I thought about how ICE has been tapping records..."
- **Keywords**: deanonymization, LLM privacy, pseudonymity, surveillance, identity linking

### OpenAI Stops Evaluating SWE-bench Verified
- **Source**: [OpenAI](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified)
- **Why it matters**: The main coding benchmark for frontier models is now considered unreliable. Signals that eval infrastructure is struggling to keep pace with model improvement and that published benchmarks are contaminated faster than they're fixed.
- **HN sentiment**: Minimal engagement (0 comments in feed), but silent acknowledgment that the measurement game is broken.
- **Keywords**: SWE-bench, eval contamination, coding benchmarks, frontier models, benchmark gaming

### OpenAI Frontier Alliance Partners
- **Source**: [OpenAI](https://openai.com/index/frontier-alliance-partners)
- **Why it matters**: Enterprise deployment infrastructure is being formalized—not "let's use ChatGPT API," but "here's how you move from pilots to production with secure, scalable agent deployments."
- **HN sentiment**: Not on HN yet (from OpenAI blog feed).
- **Keywords**: enterprise agents, production deployment, secure scaling, agent ops

### Nvidia Record Earnings & Capex
- **Source**: [TechCrunch](https://techcrunch.com/2026/02/25/nvidia-earnings-record-capex-spend-ai/)
- **Why it matters**: Token demand is "completely exponential" per Jensen Huang. Record capex means the semiconductor-as-bottleneck story continues. Infrastructure investment is frontloading the entire AI stack.
- **HN sentiment**: Not on HN primary feed, but underlying narrative is settled: compute is growth.
- **Keywords**: GPU capex, token demand, semiconductor bottleneck, hyperscaler spending

### Windows 11 Notepad Markdown Support
- **Source**: [Windows Insider Blog](https://blogs.windows.com/windows-insider/2026/01/21/notepad-and-paint-updates-begin-rolling-out-to-windows-insiders/)
- **Why it matters**: Microsoft is adding Markdown + Copilot integration to Notepad. Feature creep on a tool historically designed for simplicity.
- **HN sentiment**: Cynical. Top comment: "step 1: remove wordpad, step 2: omg there's demand for features, step 3: turn notepad into wordpad, step 4: get a raise." Another: "The new workflow will be 'AI, I need to view this text file... Create an app...'"
- **Keywords**: Notepad bloat, Copilot integration, feature creep, Markdown support

### .online Domain Risks
- **Source**: [0xSid Blog](https://www.0xsid.com/blog/online-tld-is-pain)
- **Why it matters**: Regulatory and spam filtering issues with the .online TLD (owned by Radix) make it unviable for serious use. Google Safe Browsing triggers suspension; spam filters flag it; Google Search Console matters more than expected.
- **HN sentiment**: Angry at Google's role. Top: "That should be enough to trigger an antitrust case against Google and a split of its acts." Practical note: .online emails get spam-filtered at scale.
- **Keywords**: TLD risks, Google Safe Browsing, domain reputation, .online problems

## Themes & Tensions

**Agent Infrastructure is Racing Faster Than Safety Measurement**
Remote control for agents, fully general computer action models, and enterprise deployment partnerships are shipping simultaneously. But the canonical coding benchmark (SWE-bench) just got marked unreliable. We're building production infrastructure for capabilities we're not measuring reliably.

**Privacy Assumptions Are Collapsing Under LLM Scale**
Pseudonymity and deanonymization have been a tension for years, but LLMs made it a real-time threat. The defense (don't leave traces) is becoming impossible for ordinary people. Employment, immigration enforcement, and cancellation risks are all real downstream effects.

**Government Decoupling from AI Safety Infrastructure**
CISA budget cuts + OpenAI's Frontier Alliance = the private sector is now the primary institution for deployment safety/ops. The government is explicitly not keeping pace. This matters for what "responsible" even means in practice.

**Measurement Gaming and Frontier Model Reality**
SWE-bench Verified's collapse signals that benchmarks can't keep up with capable models. This makes it harder to assess progress honestly, and easier for companies to claim gains that might not hold up under scrutiny.

## Context for Replies

**If someone tweets about Claude Code Remote Control**, they're likely asking: "Does this mean agents can run unsupervised while I'm offline?" Context: Yes, but it's prerelease and buggy (can't interrupt, UI disconnects). Real-world alternative is still SSH/tmux for most people. The story is "capability," not "reliability."

**If someone tweets about computer action models / "agents can use the internet,"** they're referencing FDM1 or similar. Key context: 11M hours of training data is massive, the inverse dynamics trick is clever (bootstrapping labels), but real-world driving demos nearly hit pedestrians. This is impressive and accident-prone.

**If someone tweets about deanonymization or "my HN posts can be linked to me,"** they're reacting to Simon Lermen's piece. Context: LLMs make it faster/cheaper, but the underlying risk (clustering metadata, public posts) has existed since 2008. The NEW risk is speed and scale—it's now practical for bad actors to do at volume.

**If someone tweets "SWE-bench is broken" or "coding evals are contaminated,"** they're reacting to OpenAI's quiet technical post. Context: Training data leakage into benchmarks is real, flawed tests exist, but the deeper issue is that frontier models improve faster than evals can be patched. This makes real-world metrics (customer code quality, production bugs) matter more than published numbers.

**If someone tweets about enterprise AI deployment / "agents in prod,"** they're referencing Frontier Alliance Partners. Context: OpenAI + partners positioning this as the secure, compliant way to move from pilots to production. This is less "agents are ready" and more "we've built the management layer."

**If someone tweets about infrastructure costs or Nvidia capex,** context is: Jensen Huang explicitly said token demand is "completely exponential." This justifies record spending. The narrative is compute-will-scale-to-match-demand, but electricity and power delivery are now real constraints (hence White House rate hike negotiation).

**If someone tweets ".online domains are bad,"** context: Google Safe Browsing suspension + spam filtering = the TLD is effectively blacklisted by major platforms. Not a technical issue, but a governance/trust one. Radix (the registry) is caught in a vicious cycle where Google's suspension triggers more suspicion.