/*
 * GBLOXK OS HACKER-FOX AI
 * Copyright (C) 2026  GBLOXK
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

(function () {
  const PATTERNS = [
    { type: "AWS Access Key", re: /AKIA[0-9A-Z]{16}/g },
    { type: "AWS Secret Key", re: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g },
    { type: "Google API Key", re: /AIza[0-9A-Za-z_-]{35}/g },
    { type: "GitHub Token", re: /gh[pousr]_[A-Za-z0-9]{36,}/g },
    { type: "GitLab Token", re: /glpat-[A-Za-z0-9_-]{20,}/g },
    { type: "Slack Token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
    { type: "Slack Webhook", re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g },
    { type: "Stripe Secret Key", re: /sk_live_[0-9a-zA-Z]{24,}/g },
    { type: "Stripe Restricted Key", re: /rk_live_[0-9a-zA-Z]{24,}/g },
    { type: "JWT", re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
    { type: "Private Key", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
    { type: "Password in URL", re: /[?&](?:password|passwd|pwd|secret|token|api_?key|access_?token)=([^&#\s]+)/gi },
    { type: "Basic Auth in URL", re: /https?:\/\/[^\/\s:@]+:[^\/\s:@]+@/g },
    { type: "Credit Card (Visa)", re: /\b4[0-9]{12}(?:[0-9]{3})?\b/g },
    { type: "Credit Card (Mastercard)", re: /\b5[1-5][0-9]{14}\b/g },
    { type: "Credit Card (Amex)", re: /\b3[47][0-9]{13}\b/g },
    { type: "Credit Card (Discover)", re: /\b6(?:011|5[0-9]{2})[0-9]{12}\b/g },
    { type: "CVV", re: /\b(?:cvv|cvc|cvv2|cid)\s*[:=]\s*['"]?[0-9]{3,4}['"]?/gi },
    { type: "SSN (US)", re: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g },
    { type: "IBAN", re: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/g },
    { type: "Bank Routing (US)", re: /\b[0-9]{9}\b/g },
    { type: "Crypto Seed Phrase", re: /\b[a-z]{3,12}(?:\s+[a-z]{3,12}){11,23}\b/gi },
    { type: "Ethereum Private Key", re: /\b0x[a-fA-F0-9]{64}\b/g },
    { type: "Bitcoin WIF", re: /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g },
    { type: "Generic Secret Assignment", re: /(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
    { type: "Email Address", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g }
  ];

  function scanText(text, source) {
    const findings = [];
    if (!text) return findings;
    const seen = new Set();
    for (const p of PATTERNS) {
      let m;
      p.re.lastIndex = 0;
      while ((m = p.re.exec(text)) !== null) {
        const val = m[0].length > 120 ? m[0].slice(0, 120) + "…" : m[0];
        const key = p.type + "|" + val;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ type: p.type, value: val, source });
      }
    }
    return findings;
  }

  function collect() {
    const findings = [];
    findings.push(...scanText(location.href, "URL"));
    findings.push(...scanText(document.title, "title"));
    const html = document.documentElement ? document.documentElement.outerHTML : "";
    findings.push(...scanText(html.slice(0, 200000), "HTML"));
    document.querySelectorAll("script").forEach((s, i) => {
      const t = s.textContent || "";
      if (t.trim()) findings.push(...scanText(t.slice(0, 50000), "script[" + i + "]"));
      if (s.src) findings.push(...scanText(s.src, "script src"));
    });
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || "";
        findings.push(...scanText(k + "=" + v, "localStorage"));
      }
    } catch (e) {}
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        const v = sessionStorage.getItem(k) || "";
        findings.push(...scanText(k + "=" + v, "sessionStorage"));
      }
    } catch (e) {}
    try {
      findings.push(...scanText(document.cookie, "cookies"));
    } catch (e) {}
    document.querySelectorAll("meta").forEach((m) => {
      findings.push(...scanText(m.outerHTML, "meta"));
    });
    const seen = new Set();
    const unique = [];
    for (const f of findings) {
      const key = f.type + "|" + f.value + "|" + f.source;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(f);
    }
    return { url: location.href, title: document.title, findings: unique, count: unique.length };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) { sendResponse({ ok: false, error: 'Invalid message' }); return true; }
    if (msg && msg.type === "SCAN_SECRETS") {
      try {
        sendResponse({ ok: true, data: collect() });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    }
    return true;
  });
})();
