// Intentionally Vulnerable JavaScript/Express Application
// DO NOT USE IN PRODUCTION - FOR SECURITY TESTING ONLY

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const request = require('request');
const ejs = require('ejs');
const multer = require('multer');
const _ = require('lodash');
const moment = require('moment');
const yaml = require('js-yaml');
const xml2js = require('xml2js');
const marked = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// VULNERABILITY: Hardcoded secrets (CWE-798)
const JWT_SECRET = 'super_secret_key_12345';
const ADMIN_PASSWORD = 'admin123';
const DB_PASSWORD = 'password123';

// VULNERABILITY: Debug mode enabled in production
app.set('env', 'development');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// VULNERABILITY: Insecure session configuration (CWE-1004)
app.use(session({
  secret: 'insecure-session-secret',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false, // Should be true in HTTPS
    httpOnly: false, // Vulnerable to XSS
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year - too long
  }
}));

// VULNERABILITY: CORS misconfiguration (CWE-942)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// In-memory user store (simulating database)
const users = [
  { id: 1, username: 'admin', password: '$2b$10$abcdefghijklmnopqrstuvwxyz', email: 'admin@example.com', role: 'admin' },
  { id: 2, username: 'user', password: '$2b$10$1234567890abcdefghijklmno', email: 'user@example.com', role: 'user' }
];

// VULNERABILITY: SQL Injection (CWE-89) - simulated with string concatenation
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Vulnerable: Direct string concatenation simulating SQL injection
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  console.log('Query:', query); // This would be vulnerable in real SQL

  const user = users.find(u => u.username === username);
  if (user) {
    // VULNERABILITY: Weak JWT signing with predictable secret (CWE-327)
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// VULNERABILITY: Command Injection (CWE-78)
app.get('/api/ping', (req, res) => {
  const { host } = req.query;
  // Vulnerable: User input directly in exec command
  exec(`ping -c 3 ${host}`, (error, stdout, stderr) => {
    if (error) {
      res.json({ error: error.message, stdout, stderr });
    } else {
      res.json({ success: true, output: stdout });
    }
  });
});

// VULNERABILITY: Path Traversal (CWE-22)
app.get('/api/files', (req, res) => {
  const { filename } = req.query;
  // Vulnerable: No sanitization of file path
  const filePath = path.join(__dirname, 'uploads', filename);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.send(data);
    }
  });
});

// VULNERABILITY: Unrestricted File Upload (CWE-434)
const upload = multer({ dest: 'uploads/' });
app.post('/api/upload', upload.single('file'), (req, res) => {
  // Vulnerable: No file type validation, no size limits
  if (req.file) {
    res.json({ success: true, filename: req.file.filename, path: req.file.path });
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
});

// VULNERABILITY: Cross-Site Scripting (XSS) (CWE-79)
app.get('/api/search', (req, res) => {
  const { query } = req.query;
  // Vulnerable: Reflects user input without sanitization
  res.send(`<h1>Search Results for: ${query}</h1>`);
});

// VULNERABILITY: Server-Side Request Forgery (SSRF) (CWE-918)
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  // Vulnerable: No URL validation, allows internal network access
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// VULNERABILITY: Remote Code Execution via eval() (CWE-94)
app.post('/api/calculate', (req, res) => {
  const { expression } = req.body;
  try {
    // Vulnerable: Direct eval of user input
    const result = eval(expression);
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// VULNERABILITY: Missing Authentication (CWE-862)
app.delete('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;
  // Vulnerable: No authentication or authorization check!
  const index = users.findIndex(u => u.id === parseInt(id));
  if (index !== -1) {
    users.splice(index, 1);
    res.json({ success: true, message: 'User deleted' });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// VULNERABILITY: Insecure Direct Object Reference (IDOR) (CWE-639)
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  // Vulnerable: No authorization check - any user can view any user's data
  const user = users.find(u => u.id === parseInt(id));
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// VULNERABILITY: XML External Entity (XXE) Injection (CWE-611)
app.post('/api/parse-xml', (req, res) => {
  const { xml } = req.body;
  // Vulnerable: XML parser without XXE protection
  xml2js.parseString(xml, { strict: false }, (err, result) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json(result);
    }
  });
});

// VULNERABILITY: YAML Deserialization (CWE-502)
app.post('/api/parse-yaml', (req, res) => {
  const { yamlContent } = req.body;
  try {
    // Vulnerable: YAML parsing can execute arbitrary code
    const parsed = yaml.safeLoad(yamlContent);
    res.json(parsed);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// VULNERABILITY: Mass Assignment (CWE-915)
app.post('/api/register', (req, res) => {
  // Vulnerable: Directly assigning all properties from user input
  const newUser = {
    id: users.length + 1,
    ...req.body, // Attacker could set role: 'admin'
    createdAt: new Date()
  };
  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// VULNERABILITY: Sensitive Data Exposure (CWE-200)
app.get('/api/debug', (req, res) => {
  // Vulnerable: Exposes sensitive environment variables
  res.json({
    environment: process.env,
    secret: JWT_SECRET,
    adminPassword: ADMIN_PASSWORD,
    users: users,
    config: {
      dbPassword: DB_PASSWORD
    }
  });
});

// VULNERABILITY: Regex Denial of Service (ReDoS) (CWE-1333)
app.post('/api/validate-email', (req, res) => {
  const { email } = req.body;
  // Vulnerable: Complex regex that can cause ReDoS
  const emailRegex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  const isValid = emailRegex.test(email);
  res.json({ valid: isValid });
});

// VULNERABILITY: Insufficient Logging & Monitoring (CWE-778)
app.post('/api/critical-operation', (req, res) => {
  // Vulnerable: No logging of security-relevant events
  // No audit trail for critical operations
  res.json({ success: true });
});

// VULNERABILITY: Insecure Randomness (CWE-330)
app.get('/api/token', (req, res) => {
  // Vulnerable: Math.random() is not cryptographically secure
  const token = Math.random().toString(36).substring(7);
  res.json({ token });
});

// VULNERABILITY: Open Redirect (CWE-601)
app.get('/redirect', (req, res) => {
  const { url } = req.query;
  // Vulnerable: No validation of redirect URL
  res.redirect(url);
});

// VULNERABILITY: Prototype Pollution (CWE-1321)
app.post('/api/merge', (req, res) => {
  const { target, source } = req.body;
  // Vulnerable: Using lodash merge without proper sanitization
  const merged = _.merge(target, source);
  res.json({ result: merged });
});

// VULNERABILITY: Unvalidated Redirects (CWE-601)
app.get('/goto', (req, res) => {
  const { target } = req.query;
  // Vulnerable: Direct redirect without validation
  res.redirect(target);
});

// VULNERABILITY: Information Disclosure through Error Messages (CWE-209)
app.get('/api/error-test', (req, res) => {
  try {
    throw new Error('Database connection failed: mysql://admin:password@localhost:3306/mydb');
  } catch (error) {
    // Vulnerable: Exposes sensitive information in error message
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'running', vulnerabilities: 'many' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Vulnerable JS App</title></head>
      <body>
        <h1>Intentionally Vulnerable JavaScript Application</h1>
        <p>This application contains numerous security vulnerabilities for testing purposes.</p>
        <h2>Available Endpoints:</h2>
        <ul>
          <li>POST /api/login - SQL Injection</li>
          <li>GET /api/ping?host=example.com - Command Injection</li>
          <li>GET /api/files?filename=test.txt - Path Traversal</li>
          <li>POST /api/upload - Unrestricted File Upload</li>
          <li>GET /api/search?query=test - XSS</li>
          <li>GET /api/proxy?url=http://example.com - SSRF</li>
          <li>POST /api/calculate - RCE via eval</li>
          <li>DELETE /api/admin/users/1 - Missing Authentication</li>
          <li>GET /api/users/1 - IDOR</li>
          <li>POST /api/parse-xml - XXE Injection</li>
          <li>POST /api/parse-yaml - YAML Deserialization</li>
          <li>POST /api/register - Mass Assignment</li>
          <li>GET /api/debug - Sensitive Data Exposure</li>
          <li>POST /api/validate-email - ReDoS</li>
          <li>GET /api/token - Insecure Randomness</li>
          <li>GET /redirect?url= - Open Redirect</li>
          <li>POST /api/merge - Prototype Pollution</li>
        </ul>
      </body>
    </html>
  `);
});

// Error handler that exposes stack traces
app.use((err, req, res, next) => {
  console.error(err.stack);
  // VULNERABILITY: Stack trace exposure (CWE-209)
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    details: err
  });
});

app.listen(PORT, () => {
  console.log(`Vulnerable JS app listening on port ${PORT}`);
  console.log(`WARNING: This application is intentionally vulnerable!`);
  console.log(`DO NOT deploy to production!`);
});

module.exports = app;
