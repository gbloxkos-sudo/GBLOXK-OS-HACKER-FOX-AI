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

async function analyzeWithAI(prompt) {
  const r = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: AI_MODEL, stream: false, prompt })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j.response || JSON.stringify(j);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) { sendResponse({ ok: false, error: 'Invalid message' }); return true; }
  if (msg.type === 'AI_ANALYZE_SQLXSS') {
    if (!msg.data) { sendResponse({ ok: false, error: 'No data provided' }); return true; }
    const prompt = 'You are a web security expert. Analyze this page for SQL injection and XSS vulnerabilities. Data:\n' +
      JSON.stringify(msg.data, null, 2) +
      '\nProvide findings, exploitation ideas, and sqlmap commands. Be concise.';
    analyzeWithAI(prompt)
      .then(text => sendResponse({ ok: true, text }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  sendResponse({ ok: false, error: 'Unknown message type: ' + msg.type });
  return true;
});
