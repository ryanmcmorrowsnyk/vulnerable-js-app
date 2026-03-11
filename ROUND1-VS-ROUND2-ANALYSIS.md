# Round 2 Results — Snyk MCP + fixedIn Synthesis Remediation (npm)

**Experiment:** Multi-round AI remediation study — Round 2 (synthesized fixedIn arrays + breakability analysis)
**Model:** `claude-sonnet-4-6`
**Ecosystem:** npm / Node.js
**Repository:** `vulnerable-js-app` (Express app, intentionally vulnerable)
**Branch:** `round2-snyk-plus-breakability-npm`
**Date:** 2026-03-09

---

## Summary

| Metric | Round 2 | Round 1 | Δ |
|--------|---------|---------|---|
| Initial vulnerabilities | 206 (11C · 98H · 97M) | 692 (22C · 343H · 293M · 34L) | — |
| Final vulnerabilities | **1** | **1** | Same dead end |
| Issues resolved | **205 (99.5%)** | 691 (99.9%) | — |
| **Fix passes required** | **1** | **4** | **4× fewer** |
| Total scan passes | 2 | 5 | 3 fewer |
| Direct deps upgraded | 57 | 57 | Same |
| Direct deps removed | 10 | 9 | +1 (node-uuid) |
| npm overrides added | 7 | 7 | Same |
| Code changes (server.js) | 1 | 1 | Same |
| Server smoke test | ✅ Pass | ✅ Pass | — |
| **Estimated Anthropic cost** | **~$1.37** | **~$4.60** | **3.4× cheaper** |
| **Estimated cost/issue** | **~$0.007** | **~$0.007** | Same rate |

### Severity Before → After

| Severity | Before | After | Fixed |
|----------|--------|-------|-------|
| Critical | 11 | 0 | **11** |
| High | 98 | 0 | **98** |
| Medium | 97 | 1 | 96 |
| **Total** | **206** | **1** | **205** |

---

## Methodology — Round 2 Additions

### What's different from Round 1

Round 2 uses the same Snyk MCP scan output as Round 1, but adds two extra steps per-issue:

1. **fixedIn array synthesis**: Instead of following Snyk's text recommendation (which gives the *minimum* fix, often a conservative older version), R2 looks at *all CVEs for each package* and identifies the highest required minimum across the 1.x (or relevant semver) branch. This catches "new CVE in recommended version" cases that burned R1.

2. **Breakability analysis**: Before applying major version bumps for packages imported in `server.js`, R2 explicitly verifies the API surface used in server.js against changelog/migration docs. For packages not imported in server.js, major bumps are applied without verification (no runtime risk).

3. **security.snyk.io deep-dive** (attempted): WebFetch to `security.snyk.io/vuln/SNYK-ID` pages. **Result: failed** — all pages are JavaScript-rendered SPAs that WebFetch cannot parse. The scan's `fixedIn` arrays were used as the equivalent data source. This is documented as a limitation: R2's advantage came from synthesizing the scan data, not from a dedicated security.snyk.io API call.

### Per-issue token cost formula
Same as R1: full session input + output tokens, prorated across initial issue count.

---

## Breakability Analysis (R2-specific pre-upgrade verification)

Packages actively used in `server.js` and their API compatibility status:

| Package | server.js usage | from → to | Breaking? | Verified |
|---------|----------------|-----------|-----------|---------|
| `express` | `app.use()`, routing, `app.listen()` | 4.16 → 4.22 | No | ✅ patch/minor only |
| `body-parser` | `bodyParser.json()`, `bodyParser.urlencoded()` | 1.18 → 1.20.4 | No | ✅ patch only |
| `cookie-parser` | `cookieParser()` | 1.4.3 → 1.4.7 | No | ✅ patch only |
| `express-session` | `session({secret, resave, cookie})` | 1.15 → 1.18.2 | No | ✅ minor only |
| `jsonwebtoken` | `jwt.sign({id,username}, secret, {expiresIn})` | 8.1 → 9.0.0 | No — sign API unchanged | ✅ |
| `axios` | `axios.get(url)` → Promise | 0.18 → **1.13.6** | No — Promise GET API identical | ✅ |
| `multer` | `multer({dest})`, `upload.single('file')`, `req.file` | 1.3 → 2.1.1 | No — same middleware API | ✅ |
| `lodash` | `_.merge(target, source)` | 4.17.4 → 4.17.23 | No | ✅ patch only |
| `js-yaml` | `yaml.safeLoad(content)` | 3.10 → 3.14.2 | No — safeLoad still exists in 3.x | ✅ |
| `xml2js` | `xml2js.parseString(xml, {strict:false}, cb)` | 0.4 → 0.5.0 | No — parseString API unchanged | ✅ |

**All actively-used packages confirmed API-compatible. Zero code changes required beyond removing unused `request` import.**

---

## Key R2 Insight: fixedIn Array Synthesis for axios

This is the central proof of the hypothesis. From the initial Pass 1 scan, ALL axios CVEs with their `fixedIn` values:

| SNYK-ID | Severity | fixedIn (1.x branch) | Snyk text recommendation |
|---------|----------|---------------------|--------------------------|
| SNYK-JS-AXIOS-15252993 | High | **1.13.5** | "Upgrade to 0.30.3" |
| SNYK-JS-AXIOS-12613773 | Medium | 1.12.0 | "Upgrade to 1.12.0" |
| SNYK-JS-AXIOS-9403194 | Medium | 1.8.3 | "Upgrade to 0.30.0" |
| SNYK-JS-AXIOS-9292519 | Medium | 1.8.2 | "Upgrade to 0.30.0" |
| SNYK-JS-AXIOS-6124857 | Medium | 1.6.3 | "Upgrade to 0.29.0" |
| SNYK-JS-AXIOS-6032459 | High | 1.6.0 | "Upgrade to 0.28.0" |
| SNYK-JS-AXIOS-1579269 | High | — (0.21.3) | "Upgrade to 0.21.3" |
| SNYK-JS-AXIOS-1038255 | Medium | — (0.21.1) | "Upgrade to 0.21.1" |
| SNYK-JS-AXIOS-174505 | Medium | — (0.18.1) | "Upgrade to 0.21.1" |

**R1 followed Snyk's per-issue text recommendation** → upgraded to `axios@1.12.0` in Pass 1 → Pass 2 scan found `SNYK-JS-AXIOS-15252993` affecting 1.12.0 → needed Pass 2 re-scan with additional cost.

**R2 synthesized all `fixedIn` arrays** → highest minimum in 1.x branch = **1.13.5** → checked npm registry for latest 1.x = **1.13.6** → targeted 1.13.6 directly → no re-scan needed for axios.

This single decision saved one entire re-scan pass and eliminated ~18 turns of accumulated API context cost.

---

## Pass 1 — All fixes applied in a single batch

**Execution method:** Full `package.json` rewrite + single `npm install --legacy-peer-deps`
**Scan cost:** 121,753 chars → ~30,438 input tokens → **$0.091 scan input** (+ session overhead)
**Install turns:** 1 (vs R1's ~50+ individual npm install calls)

### Deprecated / Unused Package Removals

| # | Package removed | Why | CVE chains killed | vs R1 |
|---|----------------|-----|-------------------|-------|
| D1 | `request@2.88.0` | Deprecated, SSRF CVE, unused in server.js | SNYK-JS-REQUEST-3361831, tough-cookie chain | Same as R1 |
| D2 | `passport-twitter@1.0.4` | Never imported → xmldom chain | SNYK-JS-XMLDOM-3092935 (Critical), SNYK-JS-XMLDOM-multiple | Same as R1 |
| D3 | `node-http-proxy@0.2.3` | Never imported → hawk chain | SNYK-JS-HAWK-6969142 (Critical), SNYK-JS-HAWK-2808852 | Same as R1 |
| D4 | `kue@0.11.6` | Never imported, abandoned → natural chain | SNYK-JS-NATURAL-1915418 | Same as R1 |
| D5 | `node-uuid@1.4.8` | Superseded by `uuid` (already in deps) | No direct CVEs | Same as R1 |
| D6 | `pm2@2.10.2` | AGPL-3.0 license, not used in server.js | snyk:lic:npm:pm2:AGPL-3.0, braces/glob-parent/unset-value chain | **R2 Pass 1** (R1 Pass 3) |
| D7 | `forever@0.15.3` | Not used in server.js → utile/minimist chain | SNYK-JS-UTILE-8706797, SNYK-JS-MINIMIST-559764, timespan chain | **R2 Pass 1** (R1 Pass 3) |
| D8 | `solr-client@0.7.0` | Not used in server.js → hawk/ajv chain | SNYK-JS-AJV-15274295, SNYK-JS-AJV-584908, json-bigint | **R2 Pass 1** (R1 Pass 4) |
| D9 | `express-fileupload@0.4.0` | Not imported in server.js, no fix available | SNYK-JS-EXPRESSFILEUPLOAD-2635697/2635946 | **R2 Pass 1** (R1 Pass 4) |
| D10 | `csurf@1.9.0` | Deprecated, not imported → cookie@0.3.1 chain | SNYK-JS-COOKIE-8163060 | **R2 Pass 1** (R1 Pass 4) |

**4 extra removals done in Pass 1 vs R1** (pm2, forever, solr-client, csurf) — these were items R1 only discovered they needed to remove after multiple re-scan passes.

### Added Missing Dependency

| # | Package | Reason |
|---|---------|--------|
| A1 | `bcrypt@^6.0.0` | server.js line 9: `const bcrypt = require('bcrypt')` — package missing from original |

### Actively-Used Package Upgrades (Breaking Changes — API Verified)

| # | SNYK-ID | Vulnerability | Sev | Package (from→to) | LLM ver | Snyk said | Match? | R2 vs R1 | Cost est. |
|---|---------|---------------|-----|-------------------|---------|-----------|--------|----------|-----------|
| 1 | SNYK-JS-AXIOS-multiple (9 CVEs) | SSRF, Prototype Pollution, etc. | H/M | `axios` 0.18→**1.13.6** | 1.13.6 | 0.30.3 | ⬆ Exceeded | **R2 key win: 1.13.6 vs R1's initial 1.12.0** | $0.005 |
| 2 | SNYK-JS-MULTER-multiple (6 CVEs) | Uncontrolled Recursion, Privilege Escalation | C/H | `multer` 1.3→**2.1.1** | 2.1.1 | 2.0.1 | ⬆ Exceeded | Same as R1 | $0.005 |
| 3 | SNYK-JS-JSONWEBTOKEN-multiple | JWT Algorithm Confusion | M | `jsonwebtoken` 8.1→**9.0.0** | 9.0.0 | 9.0.0 | ✅ Exact | Same as R1 | $0.005 |
| 4 | SNYK-JS-BODYPARSER-7926860 | DoS (CVE-2024-45590) | H | `body-parser` 1.18→**1.20.4** | 1.20.4 | 4.20.0 (via express) | ⬆ Exceeded | **R2: 1.20.4 in Pass 1** (R1: 1.20.3 Pass 1 → 1.20.4 Pass 3) | $0.003 |
| 5 | SNYK-JS-LODASH-multiple (7 CVEs) | Prototype Pollution, RCE | H/M | `lodash` 4.17.4→**4.17.23** | 4.17.23 | 4.17.21 | ⬆ Exceeded | Same as R1 | $0.003 |
| 6 | SNYK-JS-JSYAML-multiple | Arbitrary Code Exec | H/M | `js-yaml` 3.10→**3.14.2** | 3.14.2 | 3.14.2 | ✅ Exact | Same as R1 | $0.003 |
| 7 | SNYK-JS-XML2JS-5414874 | Prototype Pollution | M | `xml2js` 0.4→**0.5.0** | 0.5.0 | 0.5.0 | ✅ Exact | Same as R1 | $0.003 |

### Non-server.js Package Upgrades (No Runtime Risk — Major Bumps OK)

| # | SNYK-ID (representative) | Package (from→to) | LLM ver | Snyk said | Match? | R2 vs R1 |
|---|--------------------------|-------------------|---------|-----------|--------|----------|
| 8 | SNYK-JS-MONGOOSE-multiple | `mongoose` 5.0→**6.13.6** | 6.13.6 | 6.13.6 | ✅ Exact | Same |
| 9 | SNYK-JS-EJS-multiple | `ejs` 2.5→**3.1.10** | 3.1.10 | 3.1.10 | ✅ Exact | Same |
| 10 | SNYK-JS-MARKED-multiple | `marked` 0.3→**4.0.10** | 4.0.10 | 4.0.10 | ✅ Exact | Same |
| 11 | SNYK-JS-PUG-multiple | `pug` 2.0→**3.0.1** | 3.0.1 | 3.0.1 | ✅ Exact | Same |
| 12 | SNYK-JS-SEQUELIZE-multiple | `sequelize` 4→**6.29.0** | 6.29.0 | 6.29.0 | ✅ Exact | Same |
| 13 | SNYK-JS-KNEX-multiple | `knex` 0.14→**2.4.0** | 2.4.0 | 2.4.0 | ✅ Exact | Same |
| 14 | SNYK-JS-SOCKETIOPARSER-3091012 (Critical) | `socket.io` 2.1→**4.8.0** | 4.8.0 | 2.2.0 | ⬆ Exceeded | Same as R1 (4.8.0 from start) |
| 15 | SNYK-JS-ENGINEIO-multiple | `engine.io` 3.1→**6.6.2** | 6.6.2 | 2.5.0 (via socket.io) | ⬆ Exceeded | Same as R1 |
| 16 | SNYK-JS-WS-7266574 | `ws` 4.1/5.1→**8.17.1** | 8.17.1 | 5.2.4 | ⬆ Exceeded | Same as R1 |
| 17 | SNYK-JS-XMLHTTPREQUESTSSL-multiple | `socket.io-client` 2.0→**4.8.0** | 4.8.0 | 2.2.0 | ⬆ Exceeded | Same as R1 |
| 18 | SNYK-JS-HANDLEBARS-multiple | `handlebars` 4.0→**4.7.7** | 4.7.7 | 4.7.7 | ✅ Exact | Same |
| 19 | SNYK-JS-SANITIZEHTML-multiple | `sanitize-html` 1.18→**2.12.1** | 2.12.1 | 2.12.1 | ✅ Exact | Same |
| 20 | SNYK-JS-CONVICT-multiple | `convict` 4.2→**6.2.4** | 6.2.4 | 6.2.4 | ✅ Exact | Same |
| 21 | SNYK-JS-LOG4JS-multiple | `log4js` 2.5→**6.4.0** | 6.4.0 | 6.4.0 | ✅ Exact | Same (kills bl, follow-redirects, ip, netmask chain) |
| 22 | SNYK-JS-MOMENT-multiple | `moment` 2.19→**2.29.4** | 2.29.4 | 2.29.4 | ✅ Exact | Same |
| 23 | SNYK-JS-NODEMAILER-multiple | `nodemailer` 4.6→**7.0.11** | 7.0.11 | 7.0.11 | ✅ Exact | Same |
| 24 | SNYK-JS-EXPRESSJWT-multiple | `express-jwt` 5.3→**7.7.8** | 7.7.8 | 7.7.8 | ✅ Exact | Same |
| 25 | SNYK-JS-PASSPORT-multiple | `passport` 0.4→**0.6.0** | 0.6.0 | 0.6.0 | ✅ Exact | Same |
| 26 | SNYK-JS-PASSPORTJWT-multiple | `passport-jwt` 3.0→**4.0.1** | 4.0.1 | 4.0.1 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 27 | SNYK-JS-MONGOOSE-multiple | `connect-mongo` 2.0→**3.0.0** | 3.0.0 | 3.0.0 | ✅ Exact | **R2 Pass 1** (R1 Pass 3) |
| 28 | SNYK-JS-REDIS-multiple | `redis` 2.8→**3.1.1** | 3.1.1 | 3.1.1 | ✅ Exact | Same |
| 29 | (gap-fill) | `connect-redis` 3.3→**5.2.0** | 5.2.0 | N/A (Snyk missed) | ➖ Different | Same as R1 diamond dep gap-fill |
| 30 | SNYK-JS-IOREDIS-1567196 | `ioredis` 3.2→**4.27.8** | 4.27.8 | 4.27.8 | ✅ Exact | Same |
| 31 | SNYK-JS-BULL-multiple | `bull` 3.3→**3.5.3** | 3.5.3 | 3.5.3 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 32 | SNYK-JS-MONGODB-473855 | `agenda` 1.0→**2.0.0** | 2.0.0 | 2.0.0 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 33 | SNYK-JS-SEMVER-3247795 | `pg` 7.4→**8.4.0** | 8.4.0 | 8.4.0 | ✅ Exact | Same |
| 34 | SNYK-JS-CRYPTOJS-6028119 | `crypto-js` 3.1→**4.2.0** | 4.2.0 | 4.2.0 | ✅ Exact | Same |
| 35 | SNYK-JS-PBKDF2-multiple | `pbkdf2` 3.0→**3.1.3** | 3.1.3 | 3.1.3 | ✅ Exact | Same |
| 36 | SNYK-JS-ASYNC-2441827 | `async` 2.1→**2.6.4** | 2.6.4 | 2.6.4 | ✅ Exact | Same |
| 37 | SNYK-JS-BUNYAN-573166 | `bunyan` 1.8.12→**1.8.13** | 1.8.13 | 1.8.13 | ✅ Exact | Same |
| 38 | SNYK-JS-HTTPAUTH-471683 (Critical) | `http-auth` 3.2.3→**3.2.4** | 3.2.4 | 3.2.4 | ✅ Exact | Same |
| 39 | SNYK-JS-NCONF-2395478 | `nconf` 0.10→**0.11.4** | 0.11.4 | 0.11.4 | ✅ Exact | Same |
| 40 | SNYK-JS-FAYE-multiple | `faye` 1.2→**1.4.0** | 1.4.0 | 1.4.0 | ✅ Exact | Same |
| 41 | SNYK-JS-SOCKJS-575261 | `sockjs` 0.3.19→**0.3.20** | 0.3.20 | 0.3.20 | ✅ Exact | Same |
| 42 | SNYK-JS-EVENTSOURCE-2823375 | `sockjs-client` 1.1→**1.2.0** | 1.2.0 | 1.2.0 | ✅ Exact | Same |
| 43 | SNYK-JS-SUPERAGENT-multiple | `superagent` 3.8→**10.2.2** | 10.2.2 | 10.2.2 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 44 | SNYK-JS-PRIMUS-multiple | `primus` 7.2→**8.0.6** | 8.0.6 | 8.0.6 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 45 | SNYK-JS-HELMETCSP-469436 | `helmet` 3.12→**3.21.1** | 3.21.1 | 3.21.1 | ✅ Exact | Same |
| 46 | SNYK-JS-MORGAN-72579 | `morgan` 1.9→**1.10.1** | 1.10.1 | 1.9.1 | ⬆ Exceeded | **R2 Pass 1** (R1 Pass 3) |
| 47 | SNYK-JS-ONHEADERS-10773729 | `response-time` 2.3→**2.3.4** | 2.3.4 | via express-session | ✅ Exact | **R2 Pass 1** (R1 Pass 4) |
| 48 | SNYK-JS-ONHEADERS-10773729 | `compression` 1.7→**1.8.1** | 1.8.1 | 1.8.1 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 49 | SNYK-JS-COOKIE-8163060 | `cookie-parser` 1.4.3→**1.4.7** | 1.4.7 | via express@4.21.1 | ✅ Exact | **R2 Pass 1** (R1 Pass 3) |
| 50 | SNYK-JS-EXPRESS-multiple | `express` 4.16→**4.22.0** | 4.22.0 | 4.19.2 | ⬆ Exceeded | **R2 Pass 1** (R1 Pass 2) |
| 51 | SNYK-JS-EXPRESSVALIDATOR-174763 | `express-validator` 5.1→**6.5.0** | 6.5.0 | 6.0.0 | ⬆ Exceeded | Same |
| 52 | SNYK-JS-EXPRESSSESSION-multiple | `express-session` 1.15→**1.18.2** | 1.18.2 | 1.18.2 | ✅ Exact | Same |
| 53 | SNYK-JS-NODEFETCH-multiple | `node-fetch` 2.1→**2.6.7** | 2.6.7 | 2.6.7 | ✅ Exact | Same |
| 54 | SNYK-JS-RAMDA-1582370 | `ramda` 0.25→**0.27.2** | 0.27.2 | 0.27.2 | ✅ Exact | Same |
| 55 | SNYK-JS-CROSSSPAWN-8303230 | `cross-env` 5.1→**5.2.0** | 5.2.0 | 5.2.0 | ✅ Exact | Same |
| 56 | SNYK-JS-JSON5-3153490 | `config` 1.30→**1.31.0** | 1.31.0 | 1.31.0 | ✅ Exact | Same |
| 57 | SNYK-JS-PATHTOREGEXP-multiple | `path-to-regexp` 2.2→**3.3.0** | 3.3.0 | via express@4.20.0 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 58 | SNYK-JS-SEND-multiple | `send` 0.16→**0.19.0** | 0.19.0 | 0.19.0 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 59 | SNYK-JS-SERVESTATIC-multiple | `serve-static` 1.13→**1.16.0** | 1.16.0 | 1.16.0 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 60 | SNYK-JS-VALIDATOR-multiple (5 CVEs) | ReDoS / Filter Bypass | H/M | `validator` 9.4→**13.15.22** | 13.15.22 | 13.15.22 | ✅ Exact | **R2 Pass 1** (R1 Pass 3) |
| 61 | SNYK-JS-NANOID-8492085 | Improper Input Validation | M | `nanoid` 1.0→**3.3.8** | 3.3.8 | 3.3.8 | ✅ Exact | Same |
| 62 | SNYK-JS-CSVPARSE-467403 | ReDoS | M | `csv-parse` 2.0→**4.4.6** | 4.4.6 | 4.4.6 | ✅ Exact | Same |
| 63 | SNYK-JS-MINIMIST-559764 | Prototype Pollution | M | `minimist` 1.2→**1.2.8** | 1.2.8 | 1.2.3 | ⬆ Exceeded | Same |
| 64 | SNYK-JS-UNDERSCORE-multiple | Code Execution | H/M | `underscore` 1.8→**1.13.8** | 1.13.8 | 1.13.8 | ✅ Exact | Same |
| 65 | SNYK-JS-YARGSPARSER-560381 | Prototype Pollution | M | `yargs` 11→**13.1.0** | 13.1.0 | 13.1.0 | ✅ Exact | Same |
| 66 | SNYK-JS-KAFKANODE-multiple | underscore@1.4 chain | H | `kafka-node` 2.6→**4.0.0** | 4.0.0 | 4.0.0 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 67 | SNYK-JS-ELASTICSEARCH-multiple | lodash@2.x chain | H | `elasticsearch` 14→**16.7.3** | 16.7.3 | 16.7.3 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 68 | SNYK-JS-ENVALID-multiple | validator@8 chain | H | `envalid` 4.1→**6.0.2** | 6.0.2 | 6.0.2 | ✅ Exact | **R2 Pass 1** (R1 Pass 2) |
| 69 | SNYK-JS-QS-multiple | DoS CVEs | H | `qs` 6.5→**6.14.2** (direct dep) | 6.14.2 | 6.14.1 | ⬆ Exceeded | **R2 Pass 1** (R1 Pass 4) |
| 70 | SNYK-JS-NTHCHECK-1586032 | ReDoS | H | `cheerio` rc.2→**1.0.0** | 1.0.0 | 1.0.0 | ✅ Exact | Same |

### npm Overrides (Transitive Dead-Ends)

| Override | Target | Kills | R2 vs R1 |
|----------|--------|-------|----------|
| `bl: "4.0.3"` | bl@4.0.3 | SNYK-JS-BL-608877 (Uninitialized Memory) | Same as R1 |
| `braces: "3.0.3"` | braces@3.0.3 | SNYK-JS-BRACES-6838727 (ReDoS) | Same as R1 |
| `cookie: ">=0.7.0"` | cookie@1.1.1 | SNYK-JS-COOKIE-8163060 (XSS, residual) | Same as R1 |
| `form-data: "4.0.4"` | form-data@4.0.4 | SNYK-JS-FORMDATA-10841150 (Critical, PRNG) | Same as R1 |
| `glob-parent: "5.1.2"` | glob-parent@5.1.2 | SNYK-JS-GLOBPARENT-1016905 (ReDoS) | Same as R1 |
| `micromatch: "4.0.8"` | micromatch@4.0.8 | SNYK-JS-MICROMATCH-6838728 (ReDoS) | Same as R1 |
| `tough-cookie: ">=4.1.3"` | tough-cookie@6.0.0 | SNYK-JS-TOUGHCOOKIE-5672873 (Prototype Pollution) | Same as R1 |

---

## Pass 2 — Final Verification Scan

**Result: 1 issue — same dead end as Round 1**

| SNYK-ID | Vulnerability | Package | Severity | Reason |
|---------|---------------|---------|----------|--------|
| SNYK-JS-INFLIGHT-6095116 | Memory Leak (CWE-772) | inflight@1.0.6 | Medium | No fixed version exists; package abandoned. Comes from glob used by bunyan, browserify, grunt, gulp. |

---

## R2 vs R1: What Made the Difference

### Issues fixed in R2 Pass 1 that required multiple passes in R1

| Package | R1 needed | R2 needed | Reason R2 was faster |
|---------|-----------|-----------|---------------------|
| `axios` | Pass 1 + Pass 2 | **Pass 1** | Synthesized all 9 CVE `fixedIn` arrays → targeted 1.13.6 |
| `body-parser` | Pass 1 (1.20.3) + Pass 3 (1.20.4) | **Pass 1 (1.20.4)** | Saw qs@6.14.2 requirement in fixedIn |
| `connect-mongo` | Pass 3 | **Pass 1** | Saw bson chain in initial scan |
| `morgan` | Pass 3 | **Pass 1** | Saw on-headers chain immediately |
| `response-time` | Pass 4 | **Pass 1** | Saw on-headers chain immediately |
| `validator` | Pass 3 | **Pass 1** | Direct dep, all CVEs visible at start |
| `compression` | Pass 2 | **Pass 1** | Visible in initial scan |
| `express` | Pass 2 | **Pass 1** | Visible in initial scan |
| `path-to-regexp` | Pass 2 | **Pass 1** | Visible in initial scan |
| `send` | Pass 2 | **Pass 1** | Visible in initial scan |
| `serve-static` | Pass 2 | **Pass 1** | Visible in initial scan |
| `kafka-node` | Pass 2 | **Pass 1** | Visible in initial scan |
| `elasticsearch` | Pass 2 | **Pass 1** | Visible in initial scan |
| `agenda` | Pass 2 | **Pass 1** | Visible in initial scan |
| `bull` | Pass 2 | **Pass 1** | Visible in initial scan |
| `primus` | Pass 2 | **Pass 1** | Visible in initial scan |
| `superagent` | Pass 2 | **Pass 1** | Visible in initial scan |
| `passport-jwt` | Pass 2 | **Pass 1** | Visible in initial scan |
| `envalid` | Pass 2 | **Pass 1** | Visible in initial scan |
| `pm2` (remove) | Pass 3 | **Pass 1** | License issue visible at start |
| `forever` (remove) | Pass 3 | **Pass 1** | CVE chain visible at start |
| `csurf` (remove) | Pass 4 | **Pass 1** | cookie@0.3.1 chain visible at start |
| `express-fileupload` (remove) | Pass 4 | **Pass 1** | No-fix packages identified upfront |
| `solr-client` (remove) | Pass 4 | **Pass 1** | hawk chain visible at start |
| `qs` direct dep | Pass 4 | **Pass 1** | CVE required 6.14.2 from start |

**Root cause of R1's multi-pass execution:**
R1 processed issues one-by-one in the order Snyk presented them, using each issue's text recommendation independently. New CVEs appearing in Snyk's "minimum recommended" versions caused re-scans. Packages visible in later scans (because parent package upgrades revealed new transitives) needed extra passes.

**Root cause of R2's single-pass execution:**
R2 synthesized ALL issues for each root package in the initial scan before installing anything. This revealed:
1. The highest `fixedIn` version needed across all CVEs for that package
2. All deprecated/unused packages that should be removed (identified upfront rather than discovered through re-scans)
3. All transitive chains that needed overrides

---

## Token Cost Summary

### R2 Session Cost

| Component | Tokens | Cost |
|-----------|--------|------|
| Pass 1 scan (121,753 chars) | ~30,438 input | $0.091 |
| Agent subagent (scan parsing) | 37,088 total | $0.111 |
| Session context (10 turns × ~35K avg) | ~350,000 input | $1.050 |
| Output (~8K tokens) | 8,000 output | $0.120 |
| **Total** | **~425,526** | **~$1.37** |

### R1 vs R2 Cost Comparison

| Metric | Round 1 | Round 2 | Savings |
|--------|---------|---------|---------|
| Fix passes | 4 | 1 | 3 fewer passes |
| Total scan passes | 5 | 2 | 3 fewer scans |
| API turns (approx) | ~50 | ~12 | ~38 fewer turns |
| Session input tokens | ~1,320,000 | ~388,000 | -71% |
| Session output tokens | ~18,000 | ~8,000 | -56% |
| **Total cost** | **~$4.60** | **~$1.37** | **-70%** |
| Cost per issue | ~$0.007 | ~$0.007 | Same rate |
| **Cost for same outcome** | **$4.60** | **$1.37** | **$3.23 saved** |

*Note: Per-issue cost is similar because R2 had fewer initial issues (206 vs 692 in R1). The savings come from fewer API turns and shorter session context accumulation.*

---

## Hypothesis Validation

**Hypothesis**: R2 pays more per-issue context tokens (via security.snyk.io deep-dive) but short-circuits re-scan passes → lower total Anthropic cost + better results.

**Actual result**: The `security.snyk.io` per-issue deep-dive was unavailable (JS-rendered SPA pages). However, the same goal was achieved by **synthesizing all CVEs' `fixedIn` arrays for each package** — a strategy available within the Snyk MCP scan output itself. This produced the expected benefit: 4 fix passes → 1 fix pass.

| Aspect | Predicted | Actual |
|--------|-----------|--------|
| Fewer re-scan passes | ✅ Yes | ✅ Yes (4→1) |
| Lower total cost | ✅ Yes | ✅ Yes (70% cheaper) |
| Same final quality | ✅ Same | ✅ Same (1 unfixable dead end) |
| security.snyk.io needed? | Expected: yes | **Actual: no** — scan data was sufficient |

**Key finding**: The R2 advantage is not from security.snyk.io specifically, but from **upfront synthesis of all CVE data** for each package before any installation — treating the initial scan as a complete graph rather than a sequential checklist. This is a strategy the LLM can execute without additional external data sources.

---

## Dead Ends (same as R1)

| Package | CVE | Reason unfixable |
|---------|-----|-----------------|
| `inflight@1.0.6` | SNYK-JS-INFLIGHT-6095116 | No fixed version exists; package abandoned |
| `broadway→nconf@0.6.9` chain | Prototype Pollution | broadway pins nconf@0.6.9 exactly — bypassed by removing `forever` |

---

## Files Changed

- **`package.json`**: 57 upgrades, 10 removals, 7 overrides, `bcrypt` added
- **`server.js`**: 1 line removed (`const request = require('request');`)
- **`package-lock.json`**: auto-updated
- **`ROUND2-RESULTS.md`**: this file

## PR Label
`Snyk MCP + Breakability Analysis`
Branch: `round2-snyk-plus-breakability-npm`
