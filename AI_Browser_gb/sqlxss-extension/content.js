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
  const SQL_ERRORS = [
    /SQL syntax.*MySQL/i, /Warning.*mysql_/i, /MySqlClient\./i,
    /PostgreSQL.*ERROR/i, /pg_query\(\)/i, /valid PostgreSQL result/i,
    /ORA-[0-9]{5}/i, /Oracle error/i, /Oracle.*Driver/i,
    /SQL Server.*Driver/i, /SqlException/i, /\[SQL Server\]/i,
    /SQLite\/JDBCDriver/i, /SQLite\.Exception/i, /System\.Data\.SQLite/i,
    /Unclosed quotation mark/i, /quoted string not properly terminated/i
  ];

  function getParams(url) {
    const out = [];
    try {
      const u = new URL(url);
      u.searchParams.forEach((v, k) => out.push({ name: k, value: v, source: 'query' }));
    } catch (e) {}
    return out;
  }

  function getForms() {
    const forms = [];
    document.querySelectorAll('form').forEach((f, i) => {
      const inputs = [];
      f.querySelectorAll('input,textarea,select').forEach((inp) => {
        inputs.push({ name: inp.name || inp.id || '', type: inp.type || 'text', value: inp.value || '' });
      });
      forms.push({ index: i, action: f.action || location.href, method: (f.method || 'GET').toUpperCase(), inputs });
    });
    return forms;
  }

  function sqlErrors() {
    const text = document.documentElement ? document.documentElement.outerHTML : '';
    const found = [];
    for (const re of SQL_ERRORS) {
      const m = text.match(re);
      if (m) found.push(m[0].slice(0, 200));
    }
    return [...new Set(found)];
  }

  function reflectedXSS(params) {
    const html = document.documentElement ? document.documentElement.outerHTML : '';
    const res = [];
    for (const p of params) {
      if (p.value && p.value.length >= 3 && html.includes(p.value)) {
        res.push(p.name);
      }
    }
    return res;
  }

  function collect() {
    const params = getParams(location.href);
    const forms = getForms();
    const formParams = [];
    forms.forEach(f => f.inputs.forEach((inp) => {
      if (inp.name) formParams.push({ name: inp.name, value: inp.value, source: 'form:' + f.method, action: f.action, method: f.method });
    }));
    return {
      url: location.href,
      title: document.title,
      params,
      forms,
      formParams,
      sqlErrors: sqlErrors(),
      reflected: reflectedXSS(params),
      hasForms: forms.length > 0
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) { sendResponse({ ok: false, error: 'Invalid message' }); return true; }
    if (msg && msg.type === 'SCAN_SQLXSS') {
      try { sendResponse({ ok: true, data: collect() }); } catch (e) { sendResponse({ ok: false, error: String(e) }); }
    }
    return true;
  });
})();
