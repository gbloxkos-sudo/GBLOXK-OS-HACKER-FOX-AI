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

const AI_ENDPOINT = 'http://127.0.0.1:11434/api/generate';
const AI_MODEL = 'qwen2.5-coder:0.5b';
const FETCH_TIMEOUT_MS = 15000;
const AI_TIMEOUT_MS = 60000;

function sleepMs(ms) { return new Promise(r => setTimeout(r, ms)); }

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch (e) { return false; }
}
function resolveUrl(base, href) {
  try { return new URL(href, base).href; } catch (e) { return null; }
}
function isValidUrl(url) {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; }
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { credentials: 'omit', signal: ctrl.signal });
    if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
    return await r.text();
  } finally { clearTimeout(timer); }
}

async function crawl(params, sendProgress) {
  const start = params.startUrl;
  if (!isValidUrl(start)) throw new Error('Invalid start URL: ' + String(start));
  const maxPages = Math.min(Math.max(parseInt(params.maxPages) || 10, 1), 100);
  const maxDepth = Math.min(Math.max(parseInt(params.maxDepth) || 2, 1), 5);
  const selector = (params.selector || '').trim();
  const regexStr = (params.regex || '').trim();
  let regex = null;
  let regexError = null;
  if (regexStr) {
    try { regex = new RegExp(regexStr, 'gi'); } catch (e) { regex = null; regexError = String(e); }
  }
  const keywords = (params.keywords || '').split(',').map(s => s.trim()).filter(Boolean);
  const visited = new Set();
  const queue = [{ url: start, depth: 0 }];
  const results = [];
  const errors = [];
  while (queue.length && results.length < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    let html;
    try { html = await fetchText(url); } catch (e) { errors.push({ url, error: String(e) }); results.push({ url, error: String(e) }); continue; }
    let doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (e) { errors.push({ url, error: 'parse: ' + String(e) }); results.push({ url, error: 'parse: ' + String(e) }); continue; }
    const text = doc.body ? (doc.body.textContent || '') : '';
    const pageRes = { url, selectorMatches: [], regexMatches: [], keywordMatches: [], selectorError: null, regexError: null };
    if (selector) {
      try {
        doc.querySelectorAll(selector).forEach(el => {
          const t = (el.textContent || '').trim();
          if (t) pageRes.selectorMatches.push(t.slice(0, 500));
        });
      } catch (e) { pageRes.selectorError = String(e); }
    }
    if (regexError) { pageRes.regexError = regexError; }
    else if (regex) {
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        if (m[0] === '') { regex.lastIndex++; continue; } // guard zero-length match (infinite loop)
        pageRes.regexMatches.push(m[0].slice(0, 300));
        if (pageRes.regexMatches.length > 50) break;
      }
    }
    for (const kw of keywords) {
      const idx = text.toLowerCase().indexOf(kw.toLowerCase());
      if (idx !== -1) {
        const snippet = text.slice(Math.max(0, idx - 80), idx + kw.length + 80).replace(/\s+/g, ' ');
        pageRes.keywordMatches.push({ keyword: kw, snippet });
      }
    }
    results.push(pageRes);
    if (depth < maxDepth) {
      doc.querySelectorAll('a[href]').forEach(a => {
        const u = resolveUrl(url, a.getAttribute('href'));
        if (u && sameOrigin(start, u) && !visited.has(u)) {
          queue.push({ url: u, depth: depth + 1 });
        }
      });
    }
    if (sendProgress) {
      try { sendProgress({ done: results.length, total: Math.min(queue.length + results.length, maxPages), url }); } catch (e) {}
      try {
        await chrome.runtime.sendMessage({ type: 'CRAWL_PROGRESS', progress: { done: results.length, url } }).catch(() => {});
      } catch (e) {}
    }
    await sleepMs(200);
  }
  return { startUrl: start, count: results.length, results, errors };
}

async function analyzeWithAI(prompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const r = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, stream: false, prompt }),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
    const j = await r.json();
    return j.response || JSON.stringify(j);
  } finally { clearTimeout(timer); }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) { sendResponse({ ok: false, error: 'Invalid message' }); return true; }
  if (msg.type === 'CRAWL') {
    crawl(msg.params, (p) => {
      try { chrome.runtime.sendMessage({ type: 'CRAWL_PROGRESS', progress: p }).catch(() => {}); } catch (e) {}
    })
      .then(r => sendResponse({ ok: true, data: r }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'AI_ANALYZE') {
    analyzeWithAI(msg.prompt || '')
      .then(text => sendResponse({ ok: true, text }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  sendResponse({ ok: false, error: 'Unknown message type: ' + msg.type });
  return true;
});
