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
function shellQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

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

function section(h3, lines) {
  const sec = document.createElement('div');
  sec.className = 'section';
  const h = document.createElement('h3'); h.textContent = h3;
  sec.appendChild(h);
  if (!lines || lines.length === 0) { sec.appendChild(document.createTextNode('None')); return sec; }
  lines.forEach(t => {
    const div = document.createElement('div');
    div.textContent = t;
    sec.appendChild(div);
  });
  return sec;
}

document.getElementById('scan').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const out = document.getElementById('out');
  out.textContent = '';
  status.textContent = 'Scanning...';
  let tab;
  try {
    tab = await getActiveTab();
  } catch (e) { status.textContent = 'Cannot access tabs: ' + e; return; }
  if (!tab) { status.textContent = 'Cannot access tabs API. Reload extension.'; return; }
  if (!apiAvailable()) { status.textContent = 'Extension API not available.'; return; }
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_SQLXSS' }).catch(e => ({ ok: false, error: String(e) }));
  } catch (e) {
    status.textContent = 'Cannot scan this page (content script not injected). Try refreshing.';
    return;
  }
  if (!resp || !resp.ok) { status.textContent = 'Scan failed: ' + (resp && resp.error || 'no response'); return; }
  lastData = resp.data;
  const d = resp.data;
  const outEl = document.getElementById('out');
  outEl.appendChild(section('SQL Errors (' + d.sqlErrors.length + ')', d.sqlErrors.map(esc)));
  outEl.appendChild(section('Reflected Params (' + d.reflected.length + ')', d.reflected.length ? [esc(d.reflected.join(', '))] : []));
  outEl.appendChild(section('Query Params (' + d.params.length + ')', d.params.map(p => esc(p.name) + '=' + esc(p.value))));
  outEl.appendChild(section('Forms (' + d.forms.length + ')', d.forms.map(f => esc(f.method) + ' ' + esc(f.action) + ' [' + f.inputs.map(i => esc(i.name)).join(', ') + ']')));
  status.textContent = 'Done. ' + d.params.length + ' params, ' + d.forms.length + ' forms.';
});

document.getElementById('sqlmap').addEventListener('click', async () => {
  const out = document.getElementById('out');
  if (!lastData) { out.textContent = 'Run a scan first.'; return; }
  const d = lastData;
  try { new URL(d.url); } catch (e) { out.textContent = 'Invalid URL.'; return; }
  const params = d.params.map(p => p.name).join(',');
  let cmd = 'sqlmap -u ' + shellQuote(d.url);
  if (params) cmd += ' -p ' + shellQuote(params);
  cmd += ' --batch --level=3 --risk=2 --random-agent --threads=5';
  if (d.forms.length) {
    const f = d.forms[0];
    const data = f.inputs.filter(i => i.name).map(i => i.name + '=' + (i.value || 'test')).join('&');
    if (data) cmd += ' --data=' + shellQuote(data);
  }
  cmd += ' --dbs';
  out.textContent = '';
  out.appendChild(section('sqlmap command', [cmd]));
});

document.getElementById('deep').addEventListener('click', async () => {
  const out = document.getElementById('out');
  if (!lastData) { out.textContent = 'Run a scan first.'; return; }
  out.textContent = 'Analyzing with Ollama...';
  if (!apiAvailable()) { out.textContent = 'Extension API not available.'; return; }
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'AI_ANALYZE_SQLXSS', data: lastData }).catch(e => ({ ok: false, error: String(e) }));
    if (resp && resp.ok) {
      out.textContent = '';
      out.appendChild(section('AI Analysis', [resp.text]));
    } else {
      out.textContent = 'Ollama error: ' + esc(resp && resp.error || 'no response');
    }
  } catch (e) { out.textContent = 'Error: ' + esc(e); }
});
