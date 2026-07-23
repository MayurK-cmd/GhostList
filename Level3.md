You are helping me complete Level 3 of the Midnight Builder Challenge on Rise In.
Project: Ghostlist — private allowlist mint gate
My repo from Level 2 is at: [PASTE REPO PATH]
My deployed contract address (Preview network): 0x953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632

NOTE ON NETWORK: We are staying on Preview, not Preprod. Preprod has been
confirmed unstable by other devs in the program. Do not attempt a Preprod
redeploy at any point in this session. Everywhere the original Level 3 spec
says "Preprod," treat it as "Preview" instead, and note this explicitly and
transparently in the README (see Step 6) so reviewers understand the choice
was deliberate, not an oversight.

════════════════════════════════════════
COMMIT RULE — READ THIS FIRST
════════════════════════════════════════
Do NOT run `git add`, `git commit`, or `git push` at any point in this session.
I am tracking commits manually for Rise In submission (minimum 10 meaningful
commits required for this level). After each step marked "🛑 PAUSE FOR COMMIT,"
stop completely, summarize what was built/changed in 1-2 sentences, suggest a
commit message, and wait for me to say "committed, continue" before proceeding.

════════════════════════════════════════
MIDNIGHT DOCS MCP — ADD THIS FIRST
════════════════════════════════════════
Before starting, make sure the Midnight documentation MCP is connected.
Run this command in your terminal:
 claude mcp add --transport http midnight-docs https://midnight.mcp.kapa.ai
Or access the docs directly at: https://midnight.mcp.kapa.ai
Use it to verify current CI-relevant CLI commands (compact compile flags,
test runner invocation) before writing the workflow file.

Do the following steps in order. Do not skip any step.

════════════════════════════════════════
STEP 1 — FILE STRUCTURE CHECK
════════════════════════════════════════
Verify and enforce this structure. Create any missing files/folders:
 ghostlist/
 ├── contracts/
 │ └── allowlist_stub.compact
 ├── managed/
 ├── frontend/
 │ ├── src/
 │ └── public/tree.json
 ├── tests/
 │ └── allowlist_stub.test.ts
 ├── .github/
 │ └── workflows/
 │   └── ci.yml           ← create this in Step 2
 ├── PROPOSAL.md            ← create this in Step 4
 ├── README.md
 └── package.json

🛑 PAUSE FOR COMMIT — "chore: verify Level 3 file structure"

════════════════════════════════════════
STEP 2 — CI/CD PIPELINE
════════════════════════════════════════
- Create .github/workflows/ci.yml
- Triggers on: push to main and pull_request
- Steps:
 1. Checkout code
 2. Install Node.js v22
 3. npm install (root and frontend/ if it has a separate package.json)
 4. compact compile
 5. Run test suite (npm test)
- Confirm the workflow is valid YAML and push-testable.
- Add the CI status badge to the top of README.md, immediately below the title.
- Tell me exactly how to verify the workflow actually runs and passes on GitHub
  once I push (what to look for in the Actions tab).

🛑 PAUSE FOR COMMIT — "ci: add GitHub Actions pipeline for compile + tests"

════════════════════════════════════════
STEP 3 — FIX THE SILENT MOCK-PROOF FALLBACK (IMPORTANT)
════════════════════════════════════════
Currently useMint.ts falls back to a demo mock (random hash) if the proof
server is unreachable, with no visible error — this undermines the "meaningfully
uses Midnight's privacy model" requirement for this level, since a reviewer
testing the live demo without a running proof server would see a fake success
with no real ZK proof generated.

Fix this:
 a) If the proof server is unreachable, the UI must show a clear, visible
    state — e.g. "Proof server unavailable — cannot generate a real ZK proof
    right now" — and NOT silently proceed with a mock hash.
 b) If I want to keep a mock/demo mode for offline presentations, it must be
    an explicit opt-in toggle in the UI, clearly labeled "DEMO MODE — not a
    real proof," never a silent automatic fallback.
 c) Update the "Known Issues" section of the README to reflect the new,
    honest behavior instead of describing the old silent fallback.

Ask me which of the two options (a) or (b) I want before implementing, unless
it's obvious from context.

🛑 PAUSE FOR COMMIT — "fix: remove silent mock-proof fallback, add explicit demo mode"

════════════════════════════════════════
STEP 4 — PROPOSAL.md
════════════════════════════════════════
Create PROPOSAL.md in the root with this exact structure:
 # Product Proposal
 ## What is the product, and who uses it?
 [I WILL FILL THIS IN]
 ## Why Midnight specifically?
 [I WILL FILL THIS IN — what does Midnight do that a transparent
 chain could not do well for this product?]
 ## Data Model
 | Data Point | Type | Disclosed To |
 |------------------|----------------|--------------|
 | [example] | Public ledger | Everyone |
 | [example] | Private witness| No one |
 [I WILL FILL IN THE ROWS]
 ## Mainnet Feasibility
 [I WILL FILL THIS IN — is this realistic to reach Mainnet by Level 6?]
Leave all placeholders — I will fill in my answers manually. Pre-fill the
Data Model table's example rows using Ghostlist's actual fields (merkleRoot,
usedNullifiers, secret, merklePath, nullifier) as a starting reference for me
to edit, since those are already known from the contract.

🛑 PAUSE FOR COMMIT — "docs: add PROPOSAL.md for Level 3 idea approval"

════════════════════════════════════════
STEP 5 — POLISH THE DAPP
════════════════════════════════════════
Review the frontend and fix:
 - All error states handled with clear user messages (including the proof
   server unavailability case from Step 3)
 - Loading state clearly shown during proof generation
 - Privacy behavior clearly labeled in the UI (ProofPanel should already do
   this — verify it's still accurate after Step 3's changes)
 - Mobile-responsive layout
 - No console errors in production build
Run: npm run build — confirm zero errors.

🛑 PAUSE FOR COMMIT — "polish: error states, mobile responsiveness, build cleanup"

════════════════════════════════════════
STEP 6 — README.md (MANDATORY — DO NOT SKIP)
════════════════════════════════════════
Update README.md to include ALL of these sections in this order:
 # Ghostlist
 ![CI](badge-url)
 > A private allowlist mint gate — prove you belong on the list, without
 > ever revealing the list or which entry is yours.

 ## Live Demo
 https://ghostlist-rho.vercel.app

 ## Contract Address ← MANDATORY
 | Network | Address |
 |----------|----------------------------------|
 | Preview | 0x953eae12528f06fcda523264f0e426501f91fa9245e76dee8a6fe66f885b1632 |

 ## A Note on Network Choice
 This project is deployed to Preview rather than Preprod. Preprod has been
 confirmed unstable by multiple developers in this program at time of
 building; Preview is used as the stable equivalent testnet for this
 submission.

 ## What This Does

 ## Privacy Model
 Frame this explicitly as "what an observer can and cannot learn":
 - An on-chain observer CAN see: [list, e.g. that a mint occurred, the
   nullifier value, the total mint count]
 - An on-chain observer CANNOT learn: [list, e.g. which allowlist entry
   minted, the user's secret, the allowlist itself]

 ## Privacy Claim
 One clear sentence restating the above as a claim.

 ## Tech Stack
 Midnight network, Compact, Midnight.js SDK, TanStack Start (React 19 +
 Vite 8 + TanStack Router + Nitro SSR), Lace wallet, GSAP, Anime.js, shadcn/ui

 ## Prerequisites

 ## Setup & Run Locally
 (step-by-step commands, including how to run the proof server locally via
 docker pull midnightnetwork/proof-server && docker run -p 6300:6300
 midnightnetwork/proof-server)

 ## Run Tests
 npm test
 ## CI/CD
 Explain what the pipeline does.

 ## Known Issues
 Updated per Step 3 — no more silent mock fallback.

 ## Product Proposal
 See PROPOSAL.md

🛑 PAUSE FOR COMMIT — "docs: complete Level 3 README with privacy model and CI badge"

════════════════════════════════════════
STEP 7 — TEST OUTPUT SCREENSHOT REMINDER
════════════════════════════════════════
Tell me the exact command to run to produce a clean terminal output showing
all tests passing, suitable for a screenshot for submission.

════════════════════════════════════════
STEP 8 — DEMO VIDEO CHECKLIST
════════════════════════════════════════
Tell me what to show in the 1-minute demo video:
 1. Full dApp flow: wallet connect → circuit call → result
 2. Terminal showing test output (3+ passing)
 3. README showing CI badge as green
 4. The ProofPanel privacy disclosure clearly visible

════════════════════════════════════════
STEP 9 — FINAL CHECKLIST
════════════════════════════════════════
Print ✓ or ✗ for each requirement:
 [ ] 3+ tests passing
 [ ] CI/CD pipeline running on push, with a passing run visible
 [ ] CI badge in README.md
 [ ] Contract address in README.md (MANDATORY)
 [ ] Privacy Model section in README.md, framed as "what an observer can/
     cannot learn"
 [ ] Network-choice note (Preview vs Preprod) documented in README
 [ ] Silent mock-proof fallback fixed or explicitly labeled
 [ ] PROPOSAL.md created with correct structure
 [ ] dApp builds with zero errors
 [ ] File structure matches spec

Remind me to: fill in PROPOSAL.md fully, take the test-output screenshot,
record the demo video, confirm I've made 10+ commits at the pause points
above, then submit PROPOSAL.md on Rise In and wait for idea approval before
starting Level 4.