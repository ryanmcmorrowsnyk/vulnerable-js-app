# Vulnerable JavaScript Application

**⚠️ WARNING: This application is intentionally vulnerable and should NEVER be deployed to production!**

This is an intentionally vulnerable JavaScript/Express.js application designed for testing security remediation tools and learning about common web application vulnerabilities.

## Purpose

This application is designed to:
- Test automated security scanning and remediation tools
- Demonstrate common OWASP Top 10 vulnerabilities
- Provide a realistic codebase with 200+ dependency vulnerabilities
- Showcase different vulnerability remediation scenarios

## Features

- User authentication (with vulnerabilities)
- File upload/download
- Database operations (simulated)
- External API integration
- Search functionality
- Admin operations
- Multiple data parsers (XML, YAML, JSON)

## Vulnerabilities

### Code Vulnerabilities (SAST)

| Vulnerability | CWE | Line | Severity |
|--------------|-----|------|----------|
| Hardcoded Secrets | CWE-798 | 26-28 | HIGH |
| SQL Injection | CWE-89 | 60-65 | CRITICAL |
| Command Injection | CWE-78 | 76-83 | CRITICAL |
| Path Traversal | CWE-22 | 87-96 | HIGH |
| Unrestricted File Upload | CWE-434 | 100-108 | HIGH |
| Cross-Site Scripting (XSS) | CWE-79 | 112-116 | HIGH |
| Server-Side Request Forgery (SSRF) | CWE-918 | 120-129 | HIGH |
| Remote Code Execution (eval) | CWE-94 | 133-141 | CRITICAL |
| Missing Authentication | CWE-862 | 145-154 | CRITICAL |
| Insecure Direct Object Reference | CWE-639 | 158-166 | MEDIUM |
| XML External Entity (XXE) | CWE-611 | 170-179 | HIGH |
| YAML Deserialization | CWE-502 | 183-191 | HIGH |
| Mass Assignment | CWE-915 | 195-204 | MEDIUM |
| Sensitive Data Exposure | CWE-200 | 208-218 | HIGH |
| Regex Denial of Service (ReDoS) | CWE-1333 | 222-228 | MEDIUM |
| Insufficient Logging | CWE-778 | 232-236 | LOW |
| Insecure Randomness | CWE-330 | 240-245 | MEDIUM |
| Open Redirect | CWE-601 | 249-253 | MEDIUM |
| Prototype Pollution | CWE-1321 | 257-262 | HIGH |
| Information Disclosure | CWE-209 | 272-279 | MEDIUM |
| Insecure Session Config | CWE-1004 | 41-49 | MEDIUM |
| CORS Misconfiguration | CWE-942 | 52-57 | MEDIUM |

### Dependency Vulnerabilities (SCA)

This application uses **60+ outdated packages from 2017-2018**, each with multiple known CVEs:

**High-CVE Packages:**
- `lodash@4.17.4` - Prototype pollution, ReDoS (10+ CVEs)
- `moment@2.19.3` - ReDoS, inefficient regex (5+ CVEs)
- `axios@0.18.0` - SSRF, request smuggling (3+ CVEs)
- `express@4.16.0` - Various security issues (5+ CVEs)
- `ejs@2.5.7` - RCE vulnerabilities (2+ CVEs)
- `jsonwebtoken@8.1.0` - Algorithm confusion (2+ CVEs)
- `mongoose@5.0.0` - Prototype pollution, query injection (5+ CVEs)
- `request@2.88.0` - DEPRECATED - SSRF, various issues (10+ CVEs)
- `marked@0.3.17` - XSS, RCE (5+ CVEs)
- `handlebars@4.0.11` - Prototype pollution, RCE (3+ CVEs)

**Expected Total:** 200-250 vulnerabilities from dependencies alone

## Remediation Scenarios

This application includes various remediation scenarios:

### 1. Simple Direct Version Bumps (~30 packages)
- `lodash 4.17.4 → 4.17.21`
- `moment 2.19.3 → 2.29.4`
- `axios 0.18.0 → 1.6.0`

### 2. Transitive Dependency Upgrades (~30 packages)
- Fix `minimist` by upgrading `yargs`
- Fix `mem` by upgrading `yargs`
- Many transitive vulnerabilities through Express/Mongoose

### 3. Diamond Dependencies (~20 packages)
- Multiple packages depend on vulnerable `minimist`
- Multiple packages depend on vulnerable `lodash`

### 4. Ecosystem-Specific Maneuvers (~30 packages)
- Use `resolutions` in package.json for transitive deps
- Require `npm audit fix --force` for some issues
- Need to relock with `npm install` after changes

### 5. Breaking Changes (~30 packages)
- `request` is deprecated → migrate to `axios` or `got`
- Major version jumps require code changes
- API signature changes in several packages

### 6. Unhealthy/Unsupported Packages (~20 packages)
- `request` - deprecated, no longer maintained
- Several packages with archived GitHub repos

### 7. Unfixable Issues (~10-15 packages)
- Deep transitive chains requiring upstream fixes
- Packages with no available patches
- Vulnerabilities in end-of-life packages

## Setup

```bash
# Install dependencies (will show many vulnerabilities)
npm install

# Run the vulnerable application
npm start

# Application will run on http://localhost:3000
```

## Security Testing

```bash
# Run Snyk test
snyk test

# Expected output: 200+ vulnerabilities

# View dependency tree
snyk test --print-deps

# Generate JSON report
snyk test --json > snyk-report.json
```

## API Endpoints

All endpoints are intentionally vulnerable:

- `POST /api/login` - SQL Injection
- `GET /api/ping?host=example.com` - Command Injection
- `GET /api/files?filename=test.txt` - Path Traversal
- `POST /api/upload` - Unrestricted File Upload
- `GET /api/search?query=<script>` - XSS
- `GET /api/proxy?url=http://internal` - SSRF
- `POST /api/calculate` - RCE via eval
- `DELETE /api/admin/users/1` - Missing Auth
- `GET /api/users/1` - IDOR
- `POST /api/parse-xml` - XXE
- `POST /api/parse-yaml` - YAML Deserialization
- `POST /api/register` - Mass Assignment
- `GET /api/debug` - Data Exposure
- `POST /api/validate-email` - ReDoS
- `GET /api/token` - Weak Randomness
- `GET /redirect?url=` - Open Redirect
- `POST /api/merge` - Prototype Pollution

## Environment Variables

The `.env` file contains exposed secrets (intentionally committed):
- Database credentials
- API keys (AWS, Stripe, GitHub, Google, SendGrid, Twilio)
- JWT secrets
- Private keys

## OWASP Top 10 Coverage

- ✅ A01:2021 - Broken Access Control
- ✅ A02:2021 - Cryptographic Failures
- ✅ A03:2021 - Injection
- ✅ A04:2021 - Insecure Design
- ✅ A05:2021 - Security Misconfiguration
- ✅ A06:2021 - Vulnerable and Outdated Components
- ✅ A07:2021 - Identification and Authentication Failures
- ✅ A08:2021 - Software and Data Integrity Failures
- ✅ A09:2021 - Security Logging and Monitoring Failures
- ✅ A10:2021 - Server-Side Request Forgery

## Exploit Examples

### SQL Injection
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin'\''--","password":"anything"}'
```

### Command Injection
```bash
curl "http://localhost:3000/api/ping?host=127.0.0.1;ls -la"
```

### Path Traversal
```bash
curl "http://localhost:3000/api/files?filename=../../etc/passwd"
```

### RCE via eval
```bash
curl -X POST http://localhost:3000/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"expression":"require('\''child_process'\'').exec('\''ls'\'')"}
```

## Remediation Guide

See [REMEDIATION.md](REMEDIATION.md) for detailed remediation steps for each vulnerability type.

## License

MIT License - Use for educational and testing purposes only.

## Disclaimer

**DO NOT use this application in production environments. It contains intentional security vulnerabilities and should only be used in isolated, controlled environments for security testing and education.**
