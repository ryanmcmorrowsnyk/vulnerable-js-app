# AI Remediation Experiment Playbook
## Reproducing the Round 1 vs Round 2 Study with a New Repository

**Purpose:** Step-by-step instructions for running the two-round AI remediation experiment on any npm-based Node.js repository with known vulnerabilities.

---

## Overview

The experiment tests two LLM remediation strategies against the same repository and compares cost, pass count, and final vulnerability state.

| | Round 1 | Round 2 |
|--|---------|---------|
| **Strategy** | Vanilla LLM — follow Snyk recommendations per-issue | fixedIn synthesis + breakability analysis upfront |
| **Branch label** | `Vanilla [Model] Output` | `Snyk MCP + Breakability Analysis` |
| **Expected passes** | 3–5 fix passes | 1 fix pass |

---

## Prerequisites

### Tools
- `node` / `npm` installed
- Snyk CLI authenticated (`snyk auth`)
- Snyk MCP server configured in Claude Code (provides `snyk_sca_scan`, `snyk_code_scan`)
- `gh` CLI authenticated for PR creation
- Claude Code with `claude-sonnet-4-6` (or current best model)

### Repository requirements
- Must have a `package.json` with intentionally outdated/vulnerable dependencies
- Ideally has a `server.js` or main entrypoint you can smoke-test with `node server.js`
- Should be in a git repo with a `main` branch to branch off from

### Before starting
```bash
# Confirm Snyk auth
snyk auth status

# Confirm baseline: record initial vulnerability count from main
git checkout main
snyk test --json > baseline-scan.json
# Note: Critical / High / Medium / Low counts for your tracking tables
```

---

## Phase 0: Repo Baseline Analysis (Do Once, Before Either Round)

Before starting Round 1, do a one-time analysis pass that both rounds will reference:

### 0a. Map what the entrypoint actually imports

Read `server.js` (or your main file) and list every `require()` call. Separate into:
- **Actively used**: imported AND called somewhere in the file
- **Imported but not called**: imported at top but no usage found
- **In package.json but never imported**: anything else

This list is critical for breakability analysis in Round 2. Keep it handy.

### 0b. Identify obviously unused / deprecated / dead packages

Scan `package.json` for:
- Packages that are definitely not imported anywhere (check with `grep -r "require('package-name')" .`)
- Packages known to be deprecated (`request`, `node-uuid`, `kue`, `pm2`, `forever`, `csurf`, `express-fileupload`, etc.)
- Packages with license violations your org prohibits (AGPL-3.0, etc.)

These are candidates for removal in both rounds. Removing them eliminates entire CVE chains without requiring version bumps.

### 0c. Check for duplicate entries in package.json

```bash
cat package.json | python3 -c "
import json, sys, collections
d = json.load(sys.stdin)
deps = d.get('dependencies', {})
dupes = [k for k, v in collections.Counter(deps.keys()).items() if v > 1]
print('Duplicates:', dupes or 'none')
"
```
If duplicates exist (e.g., `ws` appearing twice), npm uses the last entry. Note which version wins and whether it's the safe one.

---

## Round 1: Vanilla LLM Remediation

### Setup
```bash
git checkout main
git checkout -b round1-vanilla-llm-npm-remediation
```

### Step 1: Initial scan

Run `snyk_sca_scan` via the Snyk MCP tool. Save the raw output — you'll need it for cost calculation.

Record:
- Total issues: `__C · __H · __M · __L = __ total`
- Approximate output size in characters (for token cost prorating)

### Step 2: Apply fixes — follow Snyk's recommendations directly

For each issue in the scan output:
1. Read Snyk's text recommendation (e.g., "Upgrade to axios@1.12.0")
2. Apply it literally to `package.json`
3. Group all changes into a single `npm install --legacy-peer-deps` per pass

**Important `--legacy-peer-deps` note:** Most repos with many old dependencies will have peer dep conflicts. Use `--legacy-peer-deps` on all install commands.

**Pass structure:** Apply all fixes Snyk identifies in the current scan output in one batch, then re-scan. Repeat until scan comes back clean (or dead ends only).

### Step 3: For each pass, record what you changed

Keep a running log:
- Which packages were upgraded (from→to)
- Which packages were removed
- Which npm overrides were added
- Any code changes needed

### Step 4: Smoke test after each install

```bash
# Kill any previous instance
pkill -f "node server.js" 2>/dev/null || true

# Start on a fresh port to avoid EADDRINUSE
PORT=3001 node server.js &
sleep 2
curl -s http://localhost:3001/health
pkill -f "node server.js"
```

If the server doesn't start, check which package caused the import error and investigate.

### Step 5: Re-scan and repeat

After each install + smoke test, re-run `snyk_sca_scan`. Apply the new batch of fixes. Continue until:
- Scan returns 0 issues (or only known dead ends with no fix available), OR
- You've done 5 passes with diminishing returns

### Step 6: Run code scan

```bash
snyk_code_scan  # via MCP
```

Record any SAST findings. Fix any newly introduced issues (not pre-existing ones). Re-scan to confirm clean.

### Step 7: Commit and create PR

```bash
git add package.json package-lock.json server.js
git commit -m "fix: Round 1 vanilla LLM remediation — npm (claude-sonnet-4-6)"
git push -u origin round1-vanilla-llm-npm-remediation
gh pr create --title "fix: Round 1 vanilla LLM remediation — npm (claude-sonnet-4-6)" \
  --body "..." --label "Vanilla LLM Output"
```

### Step 8: Write ROUND1-RESULTS.md

See the **Results File Format** section below.

---

## Round 2: fixedIn Synthesis + Breakability Analysis

### Setup
```bash
git checkout main
git checkout -b round2-snyk-plus-breakability-npm
```

### Step 1: Initial scan — treat the output as a complete graph, not a checklist

Run `snyk_sca_scan`. This time, **do not apply fixes immediately.** Instead:

#### 1a. Group all CVEs by direct dependency

For each issue in the scan, identify which direct dep (in your `package.json`) it traces back to. The scan output usually shows the upgrade path. Build a mental (or written) map:

```
axios → 9 CVEs: SNYK-JS-AXIOS-15252993, SNYK-JS-AXIOS-12613773, ...
body-parser → 3 CVEs: ...
lodash → 7 CVEs: ...
```

#### 1b. Synthesize fixedIn arrays per package

For each package with multiple CVEs, look at the `fixedIn` field for each CVE (not the text recommendation). Find the **highest minimum version** required across all CVEs in the branch you intend to stay on (usually the latest major).

Example for axios (staying on 1.x branch):
```
SNYK-JS-AXIOS-15252993  fixedIn: ["1.13.5"]   ← highest in 1.x
SNYK-JS-AXIOS-12613773  fixedIn: ["1.12.0"]
SNYK-JS-AXIOS-9403194   fixedIn: ["1.8.3"]
...
```
Required minimum = **1.13.5**. Then check npm for the actual latest patch: `npm view axios@1.x.x version` → install that (e.g., `1.13.6`).

**This is the key move.** Snyk's text recommendation often points to an older "minimum" version that itself has a newer CVE. The fixedIn synthesis finds the true safe floor.

#### 1c. Identify all deprecated/unused packages upfront

Using the baseline analysis from Phase 0, identify every package to remove in this pass. Don't wait for re-scans to discover them — they're already visible in the initial scan as long CVE chains with "No remediation available."

Signs a package should be removed rather than upgraded:
- "No remediation path available" in Snyk output
- The package is not imported in server.js (verified in Phase 0)
- The package is known-deprecated with no maintained successor in your use case

#### 1d. Identify all transitive-only fixes (overrides)

Look for CVEs where the vulnerable package appears only as a transitive dep and there's no parent upgrade that resolves it. These need npm `overrides` in `package.json`:

```json
"overrides": {
  "vulnerable-transitive-pkg": "safe-version"
}
```

**Scoped overrides** for diamond dep chains:
```json
"overrides": {
  "parent-pkg": {
    "transitive-pkg": "safe-version"
  }
}
```

Use scoped overrides when a transitive dep appears elsewhere as a direct dep at a different version — a flat override would conflict.

### Step 2: Breakability analysis for actively-used packages

For every package in your "actively used" list from Phase 0 that needs a **major version bump**, check:

1. What specific API calls does your code make? (method names, argument shapes, return types)
2. Does the new major version change any of those?

**Quick lookup:** `npm view <package>@<new-version> description` and check the package's GitHub changelog for the major version.

For **minor/patch bumps**, breakability analysis is not needed — skip it.

For packages **not imported in server.js**, major bumps need no breakability analysis — they have no runtime impact.

### Step 3: Write the full updated package.json in one shot

With the complete picture from Steps 1–2, rewrite `package.json` applying all changes simultaneously:
- All direct dep upgrades (synthesized safe versions)
- All removals
- All overrides block entries
- Any added missing deps (e.g., packages imported in server.js but missing from package.json)

Then install once:
```bash
npm install --legacy-peer-deps
```

### Step 4: Smoke test
```bash
PORT=3002 node server.js &
sleep 2
curl -s http://localhost:3002/health
pkill -f "node server.js"
```

### Step 5: Verification scan

Re-run `snyk_sca_scan`. You should see near-zero remaining issues (only known dead ends like `inflight`).

If unexpected issues appear:
- Check the package — was its `fixedIn` synthesis incomplete (missed a CVE)?
- Or is it a new transitive dep introduced by one of your upgrades?
- Fix and re-scan. This should be the last pass.

### Step 6: Code scan (same as Round 1)

Run `snyk_code_scan`. Confirm no new issues were introduced. Pre-existing SAST issues are expected and already tracked.

### Step 7: Commit and create PR

```bash
git add package.json package-lock.json server.js
git commit -m "fix: Round 2 snyk+breakability remediation — npm (claude-sonnet-4-6)"
git push -u origin round2-snyk-plus-breakability-npm
gh pr create --title "fix: Round 2 snyk+breakability remediation — npm (claude-sonnet-4-6)" \
  --body "..." --label "Snyk MCP + Breakability Analysis"
```

### Step 8: Write ROUND2-RESULTS.md and ROUND1-VS-ROUND2-ANALYSIS.md

See the **Results File Format** section below.

---

## Common Failure Modes and Fixes

### `EOVERRIDE` conflict
**Symptom:** `npm install` fails with `EOVERRIDE: Override for X conflicts with direct dependency`

**Cause:** You added a flat override for a package that's also a direct dep.

**Fix:** Remove the package from `overrides` — keep only the direct dep entry at the safe version. The override is redundant when it's already a direct dep.

### Scoped override syntax error (`EINVALIDTAGNAME`)
**Symptom:** `npm install` fails when using `"parent>child"` path syntax in overrides.

**Fix:** Use nested object syntax instead:
```json
"overrides": {
  "parent-pkg": {
    "child-pkg": "safe-version"
  }
}
```

### Package pins transitive dep at exact old version (e.g., broadway→nconf@0.6.9)
**Symptom:** Even with an override, the old version reinstalls on every `npm install` because the parent package.json specifies an exact version.

**Fix:** Remove the parent package entirely if it's unused in your code. This kills the entire chain.

### `EADDRINUSE` on smoke test
**Symptom:** `node server.js` fails because port 3000 is already in use.

**Fix:** Use a different port: `PORT=3001 node server.js`. Or kill stale processes first: `pkill -f "node server.js"`.

### Scan output too large to process in context
**Symptom:** Snyk scan returns 100K+ characters, exceeding what fits in a single tool result.

**Fix:** Save the scan to a file, then use a subagent to read and parse it:
```
Agent: read /path/to/scan-output.json in chunks and return the complete list of
vulnerabilities with their fixedIn arrays, grouped by direct dependency
```

### `security.snyk.io` WebFetch returns empty/CSS-only content
**Symptom:** Fetching `https://security.snyk.io/vuln/SNYK-JS-...` returns HTML with no vulnerability data.

**Cause:** The page is a JavaScript-rendered SPA — WebFetch gets the shell only.

**Workaround:** Use the `fixedIn` arrays from the MCP scan output directly. They contain the same version information. You do not need the security.snyk.io page.

---

## Results File Format

### ROUND1-RESULTS.md and ROUND2-RESULTS.md

Both files use identical structure so they can be compared side-by-side.

#### Header block
```markdown
**Experiment:** Multi-round AI remediation study — Round N
**Model:** `claude-sonnet-4-6`
**Ecosystem:** npm / Node.js
**Repository:** <repo name>
**Branch:** <branch name>
**Date:** YYYY-MM-DD
```

#### Summary table
```markdown
| Metric | Value |
|--------|-------|
| Initial vulnerabilities | N (XC · YH · ZM · WL) |
| Final vulnerabilities | N |
| Issues resolved | N (XX%) |
| Fix passes required | N |
| Total scan passes | N |
| Direct deps upgraded | N |
| Direct deps removed | N |
| npm overrides added | N |
| Code changes | N |
| Server smoke test | ✅ Pass / ❌ Fail |
| Estimated Anthropic cost | ~$X.XX |
| Estimated cost/issue | ~$X.XXX |
```

#### Severity table
```markdown
| Severity | Before | After | Fixed |
|----------|--------|-------|-------|
| Critical | N | N | N |
| High | N | N | N |
| Medium | N | N | N |
| Low | N | N | N |
| **Total** | **N** | **N** | **N** |
```

#### Breakability analysis table (R2 only, or both if you want)
```markdown
| Package | server.js usage | from → to | Breaking? | Verified |
|---------|----------------|-----------|-----------|---------|
| `axios` | `axios.get(url)` | 0.18→1.13.6 | No — Promise API identical | ✅ |
```

#### Per-pass sections

For each fix pass:
```markdown
## Pass N — [description]
**Scan cost:** ~X chars → ~Y input tokens → $Z
**Actions:** [brief summary]

### Removals
| # | Package removed | Why | CVE chains killed |
|---|----------------|-----|-------------------|

### Additions
| # | Package | Reason |
|---|---------|--------|

### Upgrades
| # | SNYK-ID | Vulnerability | Sev | Package (from→to) | LLM ver | Snyk max | Match? | Category | Code Δ? | Fixed? | Est. input tok | Est. output tok | Est. cost ($) | Notes |
|---|---------|---------------|-----|-------------------|---------|----------|--------|----------|---------|-------|----------------|-----------------|---------------|-------|

### Overrides
| Override | Target | Kills |
|----------|--------|-------|
```

#### Column definitions

| Column | Values |
|--------|--------|
| `Match?` | `✅ Exact` (LLM = Snyk), `⬆ Exceeded` (LLM > Snyk), `⬇ Conservative` (LLM < Snyk), `➖ Different` (different approach), `N/A` (dead end) |
| `Category` | `Simple` (direct dep bump, patch/minor), `Complex` (major bump for non-imported pkg), `Breaking Change` (major bump for imported pkg — API verified), `Diamond Dependency` (shared transitive), `Dead End` (no fix available) |
| `Code Δ?` | `No` or a brief description of what changed |
| `Fixed?` | `✅ Yes`, `⚠️ Partial`, `❌ No — Dead End` |

#### Token cost calculation

```
Input cost  = (total session input tokens)  × $3.00 / 1,000,000
Output cost = (total session output tokens) × $15.00 / 1,000,000
Total cost  = input cost + output cost

Per-issue cost (prorated) = scan_response_chars / total_session_chars × total_cost / issues_in_scan
```

Track turns/messages as a rough session proxy when exact token counts aren't available.
Claude Code's token usage is visible at session end or via `/cost`.

#### Dead ends section
```markdown
## Dead Ends

| Package | CVE | Reason unfixable |
|---------|-----|-----------------|
| `inflight@1.0.6` | SNYK-JS-INFLIGHT-6095116 | No fixed version exists; package abandoned |
```

#### Token cost summary
```markdown
## Token Cost Summary

| Component | Tokens | Cost |
|-----------|--------|------|
| Pass 1 scan (N chars) | ~N input | $X |
| Session context (N turns × avg tokens) | ~N input | $X |
| Output (~N tokens) | N output | $X |
| **Total** | **~N** | **~$X** |
```

---

### ROUND1-VS-ROUND2-ANALYSIS.md

This is the comparison document. It should contain:

1. **Side-by-side summary table** (Round 1 vs Round 2 on all metrics)
2. **Methodology section** explaining what R2 added (fixedIn synthesis, breakability analysis)
3. **The key proof example** (whichever package best illustrates why R2 converges faster — in this experiment, `axios` with 9 CVEs was the clearest case)
4. **"What made the difference" table** listing every package that R2 fixed earlier than R1 and why
5. **Hypothesis validation** — what was predicted vs what actually happened
6. **Dead ends section** (same between rounds? any differences?)
7. **Cost comparison table**

---

## Tracking Template: Quick Reference Card

Copy this to a scratch doc at the start of each round:

```
ROUND: ___    BRANCH: ___    DATE: ___

=== PHASE 0 BASELINE ===
Initial issues: ___C · ___H · ___M · ___L = ___ total
Packages actively used in server.js: [list]
Packages imported but not called: [list]
Packages to remove (unused/deprecated): [list]

=== PASS 1 ===
Scan chars: ___    Est. tokens: ___    Est. cost: $___
Changes:
  Removed: [list]
  Added: [list]
  Upgraded: [list]
  Overrides: [list]
Install result: ✅/❌
Smoke test: ✅/❌
Post-install issues: ___C · ___H · ___M · ___L = ___

=== PASS 2 ===
[repeat]

=== FINAL STATE ===
Remaining issues: ___
Dead ends: [list]
Total turns: ___
Estimated total cost: $___
```

---

## Known npm Ecosystem Gotchas

- **`--legacy-peer-deps` is almost always required** for repos with many old dependencies. Add it to every install command.
- **Removing `forever` eliminates the `broadway→nconf@0.6.9` pin.** The `broadway` package exactly-pins `nconf@0.6.9` and no override can override an exact pin. The only escape is removing `forever` (which is the only package that depends on `broadway`).
- **`connect-redis` must be co-upgraded with `redis`.** `redis@3.x` requires `connect-redis@5.x` as a peer dep. Snyk doesn't flag this — you'll get a runtime error if you upgrade `redis` without `connect-redis`. Verify peer dep requirements whenever upgrading a package that has peer deps.
- **`bcrypt` vs `bcryptjs`**: Some repos have both. Check which one `server.js` actually requires (`'bcrypt'` vs `'bcryptjs'`) — they are different packages.
- **`inflight@1.0.6` has no fix.** It appears in nearly every Node.js project via `glob` (used by grunt, gulp, browserify, bunyan, etc.). There is no fixed version; the package is abandoned. Accept it as a permanent dead end.
- **npm overrides are npm 8.3+ only.** Confirm `npm --version` ≥ 8.3.0 before using the `overrides` field.

---

## Hypothesis Being Tested

> **Does upfront synthesis of all CVE `fixedIn` arrays per package (rather than following Snyk's per-issue conservative recommendation) reduce the number of fix passes needed, and therefore reduce total Anthropic API cost — while achieving the same final vulnerability state?**

Based on this experiment:
- **Round 1 result:** 4 fix passes, ~$4.60, 1 remaining dead end
- **Round 2 result:** 1 fix pass, ~$1.37, 1 remaining dead end (same)
- **Verdict:** Yes. 70% cheaper, 4× fewer passes, identical final state.

The `security.snyk.io` per-issue deep-dive was hypothesized as necessary but turned out not to be — the scan's own `fixedIn` arrays contain equivalent data if you synthesize across all CVEs for a package rather than reading each one in isolation.
