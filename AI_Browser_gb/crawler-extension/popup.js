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

let lastResult = null;
const status = document.getElementById('status');
const out = document.getElementById('out');

function apiAvailable() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
}

function getActiveTabUrl() {
  return new Promise((resolve) => {
    if (!apiAvailable() || !chrome.tabs || !chrome.tabs.query) { resolve(null); return; }
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (!tabs || !Array.isArray(tabs) || tabs.length === 0) { resolve(null); return; }
      resolve(tabs[0] ? tabs[0].url : null);
    }).catch(() => resolve(null));
  });
}

(async () => {
  const url = await getActiveTabUrl();
  const startUrlInput = document.getElementById('startUrl');
  if (url && startUrlInput && !startUrlInput.value.trim()) {
    startUrlInput.value = url;
  }
})();

document.getElementById('crawl').addEventListener('click', async () => {
  if (!apiAvailable()) { status.textContent = 'Extension API not available. Reload the extension.'; return; }
  status.textContent = 'Crawling...'; out.textContent = '';
  const startUrl = document.getElementById('startUrl').value.trim();
  const params = {
    startUrl: startUrl,
    selector: document.getElementById('selector').value.trim(),
    regex: document.getElementById('regex').value.trim(),
    keywords: document.getElementById('keywords').value.trim(),
    maxPages: parseInt(document.getElementById('maxPages').value) || 10,
    maxDepth: parseInt(document.getElementById('maxDepth').value) || 2
  };
  if (!params.startUrl) { status.textContent = 'Please enter a start URL'; return; }
  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: 'CRAWL', params }).catch(e => ({ ok: false, error: String(e) }));
  } catch (e) { status.textContent = 'Extension error: ' + e; return; }
  if (!resp || !resp.ok) { status.textContent = 'Failed: ' + (resp && resp.error || 'no response'); return; }
  lastResult = resp.data;
  status.textContent = 'Crawled ' + resp.data.count + ' pages.';
  out.textContent = JSON.stringify(resp.data, null, 2);
});

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'CRAWL_PROGRESS') {
      status.textContent = 'Crawling... ' + msg.progress.done + ' pages (current: ' + msg.progress.url + ')';
    }
  });
}

document.getElementById('ai').addEventListener('click', async () => {
  if (!lastResult) { out.textContent = 'Run a crawl first.'; return; }
  if (!apiAvailable()) { status.textContent = 'Extension API not available.'; return; }
  status.textContent = 'Analyzing with Ollama...';
  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: 'AI_ANALYZE', prompt:
      'You are a data extraction assistant. Summarize and analyze this crawl result. Highlight key findings, emails, prices, patterns. Data:\n' + JSON.stringify(lastResult).slice(0, 12000) }).catch(e => ({ ok: false, error: String(e) }));
  } catch (e) { status.textContent = 'Extension error: ' + e; return; }
  if (resp && resp.ok) { out.textContent = resp.text; status.textContent = 'Done.'; }
  else { status.textContent = 'AI failed: ' + (resp && resp.error || 'no response'); }
});

document.getElementById('export').addEventListener('click', () => {
  if (!lastResult) { out.textContent = 'Run a crawl first.'; return; }
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'crawl-results.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
});
