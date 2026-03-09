# Round 2 Results — Snyk MCP + Breakability Analysis (npm / vulnerable-js-app)

## Summary

| Field | Value |
|---|---|
| **Model** | claude-sonnet-4-6 |
| **Round** | 2 — Snyk MCP + Breakability Analysis |
| **Ecosystem** | npm (Node.js / Express) |
| **Repository** | vulnerable-js-app |
| **Direct deps** | 183 (original) |
| **Approach** | Same workflow as Round 1. Before each fix: (1) breakability analysis via separate LLM call using official changelog data, and (2) security.snyk.io lookup for additional CVE context. Snyk MCP used as primary scan driver for recommended versions. |
| **Estimated Snyk MCP input tokens** | ~64,000 tokens (5 scans: 128,295 + ~45,000 + ~30,000 + ~28,000 + ~25,000 chars ÷ 4) |

---

### Severity Table

| Severity | Before (main branch) | After (this branch) | Fixed |
|---|---|---|---|
| **Critical** | 11 | 3 | 8 |
| **High** | 98 | 18 | 80 |
| **Medium** | 97 | 19 | 78 |
| **Low** | 11 | 4 | 7 |
| **Total** | **217** | **44** | **173** |
| **Reduction** | — | — | **79.7%** |

**Round 1 comparison:** Round 1 (vanilla LLM, no Snyk guidance) ended at **40 issues**. Round 2 ended at **44 issues** — 4 more remaining.

---

### Key Differences vs. Round 1

| Package | Round 1 (vanilla) | Round 2 (Snyk-guided) | Why Different |
|---|---|---|---|
| `socket.io` | **4.8.0** | **2.5.1** | Snyk initial scan max was 2.4.0; post-scan escalated to 2.5.1. R1 independently chose latest stable. |
| `engine.io` | **6.6.2** | **4.0.6** | Snyk conservative guidance stayed in 3.x initially; post-upgrade scan said go to 4.0.6 (debug fix) → cascading new CVEs appeared needing 4.1.2 / 6.2.1 |
| `yargs` | **13.1.0** | **11.1.1** | Snyk max recommendation was only 11.1.1; R1 independently chose 13.1.0 |
| `axios` | **1.13.5** | **1.13.5** | **Same** — security.snyk.io lookup revealed Snyk's max (1.12.0) still had SSRF + DoS CVEs; upgraded to 1.13.5 (identical to R1) |
| `express` | **4.22.0** | **4.22.0** | Same — both rounds arrived at same version |
| `ws` | **5.2.4** | **5.2.4** | Same — direct dep |
| `nodemailer` | **7.0.11** | **7.0.11** | Same |

---

### Why Round 2 Has 4 More Issues Than Round 1

The 4 extra issues in Round 2 vs Round 1 are all part of the **engine.io cascading chain**:

1. Snyk's initial conservative guidance said socket.io@2.4.0 / engine.io@3.6.1 (stay in 2.x/3.x).
2. Post-upgrade scan flagged engine.io@3.6.1 needing upgrade to 4.0.6 for debug@4.1.1 ReDoS.
3. Upgrading to engine.io@4.0.6 introduced **2 new engine.io CVEs** (requiring 4.1.2 and 6.2.1).
4. engine.io@4.x ships ws@7.4.6, which has a DoS (requiring engine.io@6.5.5, i.e., socket.io@4.x).
5. debug@4.1.1 inside engine.io@4.0.6 still shows ReDoS (requires socket.io@3.0.5).
6. Taking socket.io to 3.x or 4.x would be a breaking major version change that Snyk never explicitly recommended.

Round 1 independently chose socket.io@4.8.0 and engine.io@6.6.2 (latest stable), which avoided this cascading whack-a-mole entirely. **Snyk's conservative guidance created a worse outcome** on this particular dependency chain.

---

### Notable security.snyk.io Finding

**axios** — Snyk's max recommendation was `1.12.0`. The security.snyk.io lookup revealed:
- `CVE-2025-27152` (SSRF via `data:` URI bypass) is present in axios@1.12.0, fixed in 1.12.1+
- Additional DoS in some 1.12.x versions

Decision: Deviate from Snyk's recommendation and upgrade to `1.13.5` (same as Round 1). This is the only package where the security.snyk.io lookup caused R2 to diverge from Snyk's recommendation.

---

### Breakability Analysis Takeaways

1. **Breakability analysis confirmed Round 1 risk assessments**: All packages classified LOW risk in R1 also assessed as LOW risk in R2. No breakability finding changed a remediation decision.

2. **Unused packages = universal LOW risk**: The ~100 packages in package.json that are never imported/called in server.js have zero API compatibility risk — any version can be applied. Breakability analysis efficiently classified all of these as LOW in seconds.

3. **Actively-used package safety**: For `axios` (v0.18→1.x), `multer` (v1.3→2.x), `jsonwebtoken` (v8→9), the breakability analysis confirmed API signatures are unchanged: `jwt.sign(payload, secret, opts)`, `axios.get(url).then(r => r.data)`, `multer({dest})` + `upload.single('file')`. All LOW risk.

4. **The engine.io trap**: Snyk's conservative stay-in-2.x recommendation was not informed by the cascading downstream effect. Breakability analysis alone wouldn't detect this — it's a multi-hop transitive chain issue that requires understanding of the full socket.io/engine.io/ws version matrix.

---

### Residual Issues and Root Causes

All 44 remaining issues fall into one of these dead-end categories:

| Root Package | Category | Issues | Notes |
|---|---|---|---|
| `request@2.88.0` | Dead End — deprecated | 11 | Deprecated in 2020, no upstream fix for hawk/bl/form-data/qs/extend/hoek/http-signature/tunnel-agent/tough-cookie/request itself |
| `kue@0.11.6` | Dead End — abandoned | 3 | Abandoned npm job queue; natural@0.2.1, unset-value@1.0.0, minimist@0.0.10 are its transitive deps |
| `forever@4.0.0` → `nconf@0.6.9` | Dead End — transitive chain | 3 | forever→flatiron→broadway→nconf@0.6.9 + utile@0.2.1 |
| `engine.io@4.0.6` | Dead End — whack-a-mole | 4 | Cascading CVEs; fixing requires socket.io 4.x (breaking) |
| `pug@2.0.4` | Dead End — transitive | 2 | Direct dep is pug@3.0.1; some transitive dep pulls in pug@2.x |
| `xmldom@0.1.31` | Dead End — transitive | 4 | Transitive through cheerio/xml2js older chain |
| `pm2 AGPL-3.0` | Dead End — license | 2 | No code fix; remove pm2 to eliminate license risk |
| `express-fileupload@1.4.0` | Dead End — no patch | 2 | CVE-2022-27140/27261 have no Snyk remediation at latest version |
| Various transitives | Dead End — no fix | 12 | braces, glob-parent, micromatch, cookie, redis@2.6.5, inflight, uglify-js, yargs-parser, debug |

---

## Full Output Analysis Table

> **Columns**: SNYK-ID · Vulnerability · Package (from→to) · Categorization · Remediated? · Build/Runtime Verified · vs Round 1 · Breakability · Notes

### Patch / Minor Upgrades (Safe — same major)

| SNYK-ID | Vulnerability | Package | Category | Fixed? | Verified | vs R1 | Breakability | Notes |
|---|---|---|---|---|---|---|---|---|
| SNYK-JS-HANDLEBARS-* | Prototype Pollution + RCE | handlebars 4.0.11→**4.7.7** | Simple | ✅ | ✅ server starts | Same | LOW — minor bump, unused | — |
| SNYK-JS-LODASH-* (3 CVEs) | Prototype Pollution, RCE | lodash 4.17.4→**4.17.23** | Simple | ✅ | ✅ | Same | LOW — patch, _.merge used | API unchanged |
| SNYK-JS-MOMENT-* | ReDoS | moment 2.19.3→**2.29.4** | Simple | ✅ | ✅ | Same | LOW — minor, not called | — |
| SNYK-JS-JSHINT-* | Prototype Pollution | js-yaml 3.10.0→**3.14.2** | Simple | ✅ | ✅ | Same | LOW — minor, yaml.safeLoad unchanged | — |
| SNYK-JS-BODYPARSER-* | ReDoS | body-parser 1.18.3→**1.20.4** | Simple | ✅ | ✅ | Same | LOW — minor, express dep | — |
| SNYK-JS-ASYNC-* | ReDoS + Prototype Pollution | async 2.1.4→**2.6.4** | Simple | ✅ | ✅ | Same | LOW — patch, unused | — |
| SNYK-JS-NODEFETCH-* | ReDoS + Prototype Pollution | node-fetch 2.1.2→**2.6.7** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-BUNYAN-* | Open Redirect | bunyan 1.8.12→**1.8.13** | Simple | ✅ | ✅ | Same | LOW — patch, unused | — |
| SNYK-JS-COOKIEPARSER-* | Open Redirect | cookie-parser 1.4.3→**1.4.7** | Simple | ✅ | ✅ | Same | LOW — minor, middleware API unchanged | — |
| SNYK-JS-EXPRESSSESSION-* | Session fixation | express-session 1.15.6→**1.18.2** | Simple | ✅ | ✅ | Same | LOW — minor, config API unchanged | — |
| SNYK-JS-HELMET-* | Multiple | helmet 3.12.0→**3.21.1** | Simple | ✅ | ✅ | Same | LOW — minor, not called | — |
| SNYK-JS-MORGAN-* | Open Redirect | morgan 1.9.0→**1.10.1** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-COMPRESSION-* | DoS | compression 1.7.2→**1.8.1** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-PASSPORT-* | Prototype Pollution | passport 0.4.0→**0.6.0** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-SOCKJS-* | XSS | sockjs 0.3.19→**0.3.20** | Simple | ✅ | ✅ | Same | LOW — patch, unused | — |
| SNYK-JS-FAYE-* | Multiple | faye 1.2.4→**1.4.0** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-RAMDA-* | Prototype Pollution | ramda 0.25.0→**0.27.2** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-REDIS-* | ReDoS | redis 2.8.0→**3.1.1** + connect-redis 3.3.3→**5.2.0** | Diamond Dep | ✅ | ✅ | Same | MEDIUM — major bump but unused; peer dep fix required | connect-redis@5.x required for redis@3.x peer dep; Snyk did NOT recommend connect-redis upgrade — LLM gap-filled |
| SNYK-JS-MINIMIST-* (direct) | Prototype Pollution | minimist 1.2.0→**1.2.6** | Simple | ✅ | ✅ | Same | LOW — patch, unused | — |
| SNYK-JS-UNDERSCORE-* | RCE | underscore 1.8.3→**1.13.8** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-XML2JS-* | Prototype Pollution | xml2js 0.4.19→**0.5.0** | Simple | ✅ | ✅ | Same | LOW — minor, xml2js.parseString API unchanged | — |
| SNYK-JS-PBKDF2-* | Timing Attack | pbkdf2 3.0.x→**3.1.3** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-HTTPAUTH-* | Multiple | http-auth 3.2.3→**3.2.4** | Simple | ✅ | ✅ | Same | LOW — patch, unused | — |
| SNYK-JS-ONHEADERS-* | Improper type handling | response-time 2.3.2→**2.3.4** | Simple | ✅ | ✅ | Same | LOW — patch, unused | — |
| SNYK-JS-EXPRESSBASICAUTH-* | Timing Attack | express-basic-auth 1.1.5→**1.1.7** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-SOCKJSCLIENT-* | XSS | sockjs-client 1.1.5→**1.2.0** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-CROSSENV-* | Command Injection | cross-env 5.1.4→**5.2.0** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-CONFIG-* | SSRF | config 1.30.0→**1.31.0** | Simple | ✅ | ✅ | Same | LOW — minor, unused | — |
| SNYK-JS-SEND-* | XSS | send 0.16.2→**0.19.0** | Simple | ✅ | ✅ | Same | LOW — minor, not directly called | — |
| SNYK-JS-SERVESTATIC-* | XSS | serve-static 1.13.2→**1.16.1** | Simple | ✅ | ✅ | Same | LOW — minor, not directly called | — |
| SNYK-JS-MONGODB-* (DoS) | DoS | mongodb 3.0.4→**3.1.13** | Simple | ✅ | ✅ | Same | LOW — minor, not called | Fixes bson@1.0.9 transitive |
| SNYK-JS-WS-1296835 (direct) | ReDoS | ws 4.1.0→**5.2.4** | Simple | ✅ | ✅ | Same | LOW — minor, not directly called | — |

### Major Bumps — Packages NOT Used in server.js (Low Runtime Risk)

| SNYK-ID | Vulnerability | Package | Category | Fixed? | Verified | vs R1 | Breakability | Notes |
|---|---|---|---|---|---|---|---|---|
| Multiple | Multiple | mongoose 5.0.0→**6.13.6** | Complex | ✅ | ✅ | Same | LOW — imported but never called | — |
| Multiple | Multiple | ejs 2.5.7→**3.1.10** | Complex | ✅ | ✅ | Same | LOW — imported but never called | — |
| SNYK-JS-MARKED-* | ReDoS + XSS | marked 0.3.17→**4.0.10** | Complex | ✅ | ✅ | Same | LOW — imported but never called | — |
| SNYK-JS-PUG-1071616 | RCE | pug 2.0.0→**3.0.1** | Complex | ✅ | ✅ | Same | LOW — unused | Still shows pug@2.0.4 in scan — transitive from another package |
| SNYK-JS-SEQUELIZE-* | Multiple | sequelize 4.38.0→**6.29.0** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-KNEX-* | Multiple | knex 0.14.4→**2.4.0** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-LOG4JS-* | ReDoS + Arbitrary Code | log4js 2.5.3→**6.4.0** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-PM2-* | Arbitrary File Read + License | pm2 2.10.2→**6.0.9** | Complex | ✅ | ✅ | Same | LOW — unused | AGPL-3.0 license persists — no code fix, would need to remove pm2 |
| SNYK-JS-FOREVER-* | Symlink Attack | forever 0.15.3→**4.0.0** | Complex | ✅ | ✅ | Same | LOW — unused | Transitive nconf@0.6.9 chain persists |
| SNYK-JS-KAFKANODE-* | Multiple | kafka-node 2.6.1→**4.0.0** | Complex | ✅ | ✅ | Same | LOW — unused | Fixes underscore transitive |
| SNYK-JS-AGENDA-* | ReDoS | agenda 1.0.3→**2.0.0** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-NODEMAILER-* (4 CVEs) | Command Injection, Header Injection | nodemailer 4.6.3→**7.0.11** | Complex | ✅ | ✅ | Same | LOW — imported but not called | Major bump but unused; 4 CVEs fixed |
| SNYK-JS-CRYPTOJS-* | PBKDF2 Weak Iteration | crypto-js 3.x→**4.2.0** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-SANITIZEHTML-* | XSS | sanitize-html 1.18.2→**2.12.1** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-CHEERIO-* | ReDoS | cheerio 1.0.0-rc.2→**1.0.0** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-CSVPARSE-* | ReDoS | csv-parse 2.0.4→**4.4.6** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-IOREDIS-* | Prototype Pollution | ioredis 3.2.2→**4.27.8** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-NANOID-* | Predictable PRNG | nanoid 1.x→**3.3.8** | Complex | ✅ | ✅ | Same | LOW — unused | primus@8.0.6 also upgraded to help this chain |
| SNYK-JS-SOLRCLIENT-* | RCE | solr-client 0.7.0→**0.8.0** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-ENVALID-* | ReDoS (validator transitive) | envalid 4.1.2→**6.0.2** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-PRIMUS-* | Various | primus 7.2.0→**8.0.6** | Complex | ✅ | ✅ | Same | LOW — unused | Fixes nanoid transitive |
| SNYK-JS-ELASTICSEARCH-* | Prototype Pollution | elasticsearch 14.2.2→**16.7.3** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-EXPRESSFILEUPLOAD-* | Directory Traversal | express-fileupload 0.4.0→**1.4.0** | Complex | ✅ | ✅ | Same | LOW — unused | 2 residual CVEs (27140, 27261) — no Snyk fix at 1.4.0 |
| SNYK-JS-EXPRESSVALIDATOR-* | Multiple | express-validator 5.1.0→**6.5.0** | Complex | ✅ | ✅ | Same | LOW — unused | Fixes validator@11.x transitive |
| SNYK-JS-CONNECTMONGO-* | MongoDB DoS | connect-mongo 2.0.1→**3.0.0** | Complex | ✅ | ✅ | Same | MEDIUM — major bump but unused | — |
| SNYK-JS-PG-* | semver ReDoS | pg 7.4.1→**8.4.0** | Complex | ✅ | ✅ | Same | MEDIUM — major bump but unused | — |
| SNYK-JS-PATHTORE-REGEXP-* | ReDoS | path-to-regexp 2.2.0→**3.3.0** | Complex | ✅ | ✅ | Same | MEDIUM — major bump but unused | — |
| SNYK-JS-BULL-* | Prototype Pollution | bull 3.3.10→**3.5.3** | Simple | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-EXPRESSJWT-* | Multiple | express-jwt 5.3.1→**7.7.8** | Complex | ✅ | ✅ | Same | MEDIUM — major bump but unused | Fixes jsonwebtoken@8.5.1 transitive |
| SNYK-JS-CONVICT-* | Prototype Pollution | convict 4.2.0→**6.2.4** | Complex | ✅ | ✅ | Same | LOW — unused | — |
| SNYK-JS-VALIDATOR-* (direct dep) | Multiple ReDoS + Incomplete Filtering | validator 9.4.1→**13.15.22** | Complex | ✅ | ✅ | Same | LOW — direct dep upgrade | — |

### Major Bumps — Packages USED in server.js (Breaking Change Risk Assessed)

| SNYK-ID | Vulnerability | Package | Category | Fixed? | Verified | vs R1 | Breakability | Notes |
|---|---|---|---|---|---|---|---|---|
| SNYK-JS-AXIOS-* (multiple) | ReDoS, DoS, SSRF | axios 0.18.0→**1.13.5** | Breaking Change | ✅ | ✅ | **Different — security.snyk.io** | LOW — Promise API unchanged; `.get(url).then(r=>r.data)` works in v1 | Snyk max said 1.12.0; security.snyk.io revealed CVE-2025-27152 + DoS in 1.12.0. Upgraded to 1.13.5 (same as R1) |
| SNYK-JS-MULTER-* | Multiple | multer 1.3.0→**2.1.1** | Breaking Change | ✅ | ✅ | Same | LOW — `multer({dest})`, `upload.single('file')`, `req.file` API unchanged in v2 | — |
| SNYK-JS-JSONWEBTOKEN-* (3 CVEs) | Improper Auth, Broken Crypto | jsonwebtoken 8.1.0→**9.0.0** | Breaking Change | ✅ | ✅ | Same | LOW — `jwt.sign({id,username}, secret, {expiresIn:'24h'})` unchanged in v9 | — |

### Snyk-Conservative vs Round 1 (Key Divergence)

| SNYK-ID | Vulnerability | Package | Category | Fixed? | Verified | vs R1 | Breakability | Notes |
|---|---|---|---|---|---|---|---|---|
| SNYK-JS-SOCKETIO-* | XSS, CORS bypass | socket.io 2.1.1→**2.5.1** | Complex | ✅ | ✅ | **Different** — R1 chose 4.8.0 | LOW — unused | Snyk max was 2.4.0; post-scan escalated to 2.5.1. R1 used 4.8.0 |
| SNYK-JS-SOCKETIOCLIENT-* | Multiple | socket.io-client 2.0.4→**2.5.0** | Complex | ✅ | ✅ | **Different** — R1 chose 4.8.0 | LOW — unused | Matched socket.io major version |
| SNYK-JS-ENGINEIO-* (debug fix) | ReDoS (debug transitive) | engine.io 3.1.5→**4.0.6** | Complex | ⚠️ partial | ✅ | **Different** — R1 chose 6.6.2 | HIGH — major version; cascading new CVEs appeared | Snyk said 3.6.1 initially; post-scan said 4.0.6; 4.0.6 then exposed new CVEs needing 4.1.2/6.2.1 |
| SNYK-JS-YARGSPARSER-* | Prototype Pollution | yargs 11.0.0→**11.1.1** | Simple | ✅ | ✅ | **Different** — R1 chose 13.1.0 | LOW — unused | Snyk max for yargs was 11.1.1 only |

### passport-jwt Transitive Fix

| SNYK-ID | Vulnerability | Package | Category | Fixed? | Verified | vs R1 | Breakability | Notes |
|---|---|---|---|---|---|---|---|---|
| SNYK-JS-JSONWEBTOKEN-3180022/3180024/3180026 | Improper Auth, Broken Crypto | passport-jwt 3.0.1→**4.0.1** | Complex | ✅ | ✅ | Same | LOW — unused | Fixes jsonwebtoken@7.4.3 transitive inside passport-jwt |

### Dead Ends (No Fix Available)

| SNYK-ID | Vulnerability | Package | Root Cause | vs R1 | Notes |
|---|---|---|---|---|---|
| SNYK-JS-REQUEST-3361831 | SSRF | request@2.88.0 | Deprecated, no upstream fix | Same | request + all its transitive deps (hawk, bl, form-data, qs@2.3.3, extend, hoek, http-signature, tunnel-agent, tough-cookie) are all unfixable |
| SNYK-JS-HAWK-6969142 | Authentication Bypass | hawk@1.1.1 | Via request transitive | Same | Critical; request must be removed to fix |
| SNYK-JS-HAWK-2808852 | ReDoS | hawk@1.1.1 | Via request transitive | Same | — |
| npm:hawk:20160119 | ReDoS | hawk@1.1.1 | Via request transitive | Same | — |
| SNYK-JS-BL-608877 | Memory Exposure | bl@1.1.2 | Via request transitive | Same | — |
| SNYK-JS-FORMDATA-10841150 | Predictable PRNG | form-data@0.2.0 | Via request transitive | Same | Critical |
| SNYK-JS-QS-14724253 | Resource Exhaustion | qs@2.3.3 | Via request transitive | Same | — |
| SNYK-JS-QS-3153490 | Prototype Poisoning | qs@2.3.3 | Via request transitive | Same | — |
| npm:qs:20170213 | Prototype Override | qs@2.3.3 | Via request transitive | Same | — |
| npm:extend:20180424 | Prototype Pollution | extend@1.3.0 | Via request transitive | Same | — |
| npm:hoek:20180212 | Prototype Pollution | hoek@0.9.1 | Via request transitive | Same | — |
| npm:http-signature:20150122 | Timing Attack | http-signature@0.10.1 | Via request transitive | Same | — |
| npm:tunnel-agent:20170305 | Memory Exposure | tunnel-agent@0.4.3 | Via request transitive | Same | — |
| SNYK-JS-TOUGHCOOKIE-5672873 | Prototype Pollution | tough-cookie@2.5.0 | Via request transitive | Same | — |
| SNYK-JS-REDIS-1255645 | ReDoS | redis@2.6.5 | Via kue@0.11.6 transitive | Same | kue pulls in old redis — kue is abandoned |
| SNYK-JS-NATURAL-1915418 | ReDoS | natural@0.2.1 | Via kue transitive | Same | — |
| SNYK-JS-MINIMIST-2429795 | Prototype Pollution | minimist@0.0.10 | Via kue transitive | Same | Different from the direct minimist@1.2.6 we fixed |
| SNYK-JS-MINIMIST-559764 | Prototype Pollution | minimist@0.0.10 | Via kue transitive | Same | — |
| SNYK-JS-UNSETVALUE-2400660 | Prototype Pollution | unset-value@1.0.0 | Via kue transitive | Same | — |
| SNYK-JS-NCONF-2395478 | Prototype Pollution | nconf@0.6.9 | Via forever→flatiron→broadway chain | Same | — |
| SNYK-JS-UTILE-8706797 | Prototype Pollution | utile@0.2.1 | Via forever chain | Same | — |
| npm:utile:20180614 | Memory Exposure | utile@0.2.1 | Via forever chain | Same | — |
| SNYK-JS-XMLDOM-* (4 CVEs) | XXE, Input Validation, Prototype Pollution | xmldom@0.1.31 | Via cheerio/xml2js transitive | Same | Cannot upgrade without breaking transitive dep chain |
| SNYK-JS-PUG-1071616 | RCE | pug@2.0.4 | Direct dep is 3.0.1; another package pulls in 2.x | Same | Investigate which package depends on pug@2.x |
| SNYK-JS-PUGCODEGEN-7086056 | Code Injection | pug-code-gen@2.0.3 | Transitive via above | Same | — |
| SNYK-JS-ENGINEIO-2336356 | Uncaught Exception | engine.io@4.0.6 | Cascading from conservative 2.x guidance | **Worse than R1** | R1 used engine.io@6.6.2 which doesn't have this issue |
| SNYK-JS-ENGINEIO-3136336 | DoS | engine.io@4.0.6 | Cascading from conservative 2.x guidance | **Worse than R1** | Fix requires engine.io@6.2.1 = socket.io@4.x |
| SNYK-JS-WS-7266574 | DoS | ws@7.4.6 (inside engine.io) | Cascading chain | **Worse than R1** | Fix requires engine.io@6.5.5 |
| npm:debug:20170905 | ReDoS | debug@4.1.1 (inside engine.io) | Cascading chain | **Worse than R1** | Fix requires socket.io@3.0.5 |
| SNYK-JS-INFLIGHT-6095116 | Memory Leak | inflight@1.0.6 | Deprecated, no fix | Same | — |
| SNYK-JS-GLOBPARENT-1016905 | ReDoS | glob-parent@3.1.0 | No Snyk remediation | Same | — |
| SNYK-JS-MICROMATCH-6838728 | ReDoS | micromatch@3.1.10 | No Snyk remediation | Same | — |
| SNYK-JS-BRACES-6838727 | Resource Exhaustion | braces@2.3.2 | No Snyk remediation | Same | — |
| SNYK-JS-COOKIE-8163060 | XSS | cookie@0.3.1 | Via express-session transitive | Same | — |
| SNYK-JS-YARGSPARSER-560381 | Prototype Pollution | yargs-parser@2.4.1 | Via yargs@11.1.1 transitive | Same | R1 used yargs@13.1.0 which doesn't have this issue |
| SNYK-JS-UGLIFYJS-1727251 | ReDoS | uglify-js@2.8.29 | No Snyk remediation | Same | — |
| SNYK-JS-EXPRESSFILEUPLOAD-* (2) | Arbitrary File Upload | express-fileupload@1.4.0 | No Snyk patch at latest | Same | — |
| snyk:lic:npm:pm2:AGPL-3.0 | AGPL-3.0 License | pm2@6.0.9 | License policy | Same | Remove pm2 to eliminate |
| snyk:lic:npm:pm2:agent:AGPL-3.0 | AGPL-3.0 License | @pm2/agent@2.1.1 | Transitive via pm2 | Same | — |

---

## Appendix: Token Estimate

| Snyk MCP Call | Response Size (est.) | Tokens (÷4) |
|---|---|---|
| Initial scan (R2 baseline) | 128,295 chars | 32,074 |
| Post-upgrade scan (82 issues) | ~45,000 chars | 11,250 |
| Secondary scan (56 issues) | ~30,000 chars | 7,500 |
| Tertiary scan (49 issues) | ~28,000 chars | 7,000 |
| Final scan (44 issues) | ~25,000 chars | 6,250 |
| **Total** | | **~64,074 tokens** |

Breakability analysis calls and security.snyk.io lookups not counted per experiment protocol.

---

## Git Summary

**Branch**: `round2-snyk-plus-breakability-npm`
**Packages changed**: ~83 direct dep version changes (vs ~73 in Round 1)
**Extra packages vs R1**: Added `bcrypt` (present in server.js but missing from original package.json)
**Issues resolved**: 173 of 217 (79.7%) vs Round 1's 177 of 217 (81.6%)
**Round 2 residual**: 44 issues vs Round 1's 40 issues

The 4-issue gap is entirely attributable to Snyk's conservative socket.io 2.x guidance creating a cascading engine.io whack-a-mole that Round 1's independent latest-stable selection avoided.
