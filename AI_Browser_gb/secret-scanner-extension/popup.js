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

let lastData = null;

function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function apiAvailable() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && chrome.tabs && chrome.tabs.sendMessage;
}

function getActiveTab() {
  return new Promise((resolve) => {
    if (!apiAvailable()) { resolve(null); return; }
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (!tabs || !Array.isArray(tabs) || tabs.length === 0) { resolve(null); return; }
      resolve(tabs[0]);
    }).catch(() => resolve(null));
  });
}

function renderFindings(findings) {
  const results = document.getElementById('results');
  results.textContent = '';
  if (!findings || findings.length === 0) { results.appendChild(document.createTextNode('No secrets detected.')); return; }
  const frag = document.createDocumentFragment();
  findings.forEach(f => {
    const div = document.createElement('div');
    div.className = 'finding';
    const type = document.createElement('span');
    type.className = 'type'; type.textContent = esc(f.type);
    const src = document.createElement('span');
    src.className = 'src'; src.textContent = '[' + esc(f.source) + ']';
    const val = document.createElement('div');
    val.className = 'val'; val.textContent = esc(f.value);
    div.appendChild(type); div.appendChild(document.createTextNode(' ')); div.appendChild(src);
    div.appendChild(val);
    frag.appendChild(div);
  });
  results.appendChild(frag);
}

document.getElementById('scan').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  status.textContent = 'Scanning...';
  results.textContent = '';
  let tab;
  try {
    tab = await getActiveTab();
  } catch (e) { status.textContent = 'Cannot access tabs: ' + e; return; }
  if (!tab) { status.textContent = 'Cannot access tabs API. Reload extension.'; return; }
  if (!apiAvailable()) { status.textContent = 'Extension API not available.'; return; }
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_SECRETS' }).catch(e => ({ ok: false, error: String(e) }));
  } catch (e) {
    status.textContent = 'Cannot scan this page (content script not injected). Try refreshing.';
    return;
  }
  if (!resp || !resp.ok) { status.textContent = 'Scan failed: ' + (resp && resp.error || 'no response'); return; }
  lastData = resp.data;
  status.textContent = 'Found ' + resp.data.count + ' potential secret(s) on ' + esc(resp.data.title);
  renderFindings(resp.data.findings);
});

document.getElementById('deep').addEventListener('click', async () => {
  const ai = document.getElementById('ai');
  if (!lastData || !lastData.findings || lastData.findings.length === 0) { ai.textContent = 'Run a scan first.'; return; }
  ai.textContent = 'Analyzing with Ollama...';
  if (!apiAvailable()) { ai.textContent = 'Extension API not available.'; return; }
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'AI_ANALYZE_SECRETS', findings: lastData.findings }).catch(e => ({ ok: false, error: String(e) }));
    if (resp && resp.ok) { ai.textContent = resp.text; }
    else { ai.textContent = 'Ollama error: ' + (resp && resp.error || 'no response'); }
  } catch (e) {
    ai.textContent = 'Extension error: ' + e;
  }
});
