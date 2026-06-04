// ai.js — Claude API client for browser-side AI features
// Requires store.js to be loaded first (reads API key from store.getApiKey()).

var ai = (function () {
  var API_URL  = 'https://api.anthropic.com/v1/messages';
  var MODEL_FAST = 'claude-haiku-4-5-20251001';  // claim extraction (fast + cheap)
  var MODEL_MAIN = 'claude-sonnet-4-6';           // First 100 Days generation

  var PILLAR_LIST = store.PILLARS.map(function (p) {
    return p.id + ' (' + p.label + ')';
  }).join(', ');

  function call(model, systemPrompt, userMessage, maxTokens) {
    var key = store.getApiKey();
    if (!key) return Promise.reject(new Error('NO_KEY'));

    return fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens || 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (err) {
          throw new Error(err.error ? err.error.message : 'API error ' + r.status);
        });
      }
      return r.json();
    }).then(function (data) {
      return data.content[0].text;
    });
  }

  // ── Claim extraction ────────────────────────────────────────────────────
  // Returns Promise<Array<{text, pillar}>>

  function extractClaims(text) {
    var system = [
      'You are helping a progressive policy thinker build their political platform.',
      'Your job is to extract specific, concrete factual claims or policy arguments from text.',
      'Return ONLY a valid JSON array, no other text.',
      'Each item must have:',
      '  "text": the claim or argument, as a direct quote or tight paraphrase (1-2 sentences max)',
      '  "pillar": the single most relevant pillar ID from this list: ' + PILLAR_LIST,
      'Extract 4-6 of the most substantive, arguable claims. Skip vague generalities.',
      'Example output: [{"text": "Housing First programs reduce chronic homelessness by 88%.", "pillar": "housing"}]'
    ].join('\n');

    return call(MODEL_FAST, system, 'Extract claims from this text:\n\n' + text.slice(0, 8000))
      .then(function (raw) {
        var json = raw.trim();
        // Strip markdown code fences if present
        json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        var claims = JSON.parse(json);
        if (!Array.isArray(claims)) throw new Error('Expected array');
        return claims.filter(function (c) { return c.text && c.pillar; });
      });
  }

  // ── First 100 Days generation ───────────────────────────────────────────
  // Returns Promise<string> (markdown)

  function generate100Days(positions) {
    var positionSummary = positions
      .filter(function (p) { return p.statement && p.statement.trim(); })
      .map(function (p) {
        var pillar = store.PILLARS.find(function (pl) { return pl.id === p.pillar; });
        var label = pillar ? pillar.label : p.pillar;
        var evidenceLines = (p.evidence || []).slice(0, 3).map(function (e) {
          return '    - ' + e.claim;
        }).join('\n');
        return '**' + label + ':** ' + p.statement + (evidenceLines ? '\n  Key evidence:\n' + evidenceLines : '');
      })
      .join('\n\n');

    if (!positionSummary.trim()) {
      return Promise.reject(new Error('NO_POSITIONS'));
    }

    var system = [
      'You are drafting a bold, progressive First 100 Days policy agenda.',
      'The person is unabashedly left — they want ambitious, concrete action, not hedged centrism.',
      'Write in second person ("On Day 1, you will...") or first person ("On Day 1, I will...").',
      'Structure as: Day 1, Days 2-10, Days 11-30, Days 31-60, Days 61-100.',
      'Each action should be specific and actionable (executive orders, legislation, agency directives).',
      'Ground every action in the positions provided. Do not invent positions not in the input.',
      'Format in clean Markdown with bold headers for each time block.',
      'Aim for 600-900 words total.'
    ].join('\n');

    var prompt = 'Based on these policy positions, write a First 100 Days agenda:\n\n' + positionSummary;

    return call(MODEL_MAIN, system, prompt, 1500);
  }

  // ── URL fetch via CORS proxy ────────────────────────────────────────────
  // Returns Promise<string> (page text) or rejects with {needsPaste: true}

  function fetchUrl(url) {
    var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
    return fetch(proxyUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.contents) throw new Error('empty');
        // Strip HTML tags to get readable text
        var text = data.contents
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (text.length < 200) throw new Error('too short');
        return text;
      })
      .catch(function () {
        var err = new Error('fetch_failed');
        err.needsPaste = true;
        throw err;
      });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  return {
    extractClaims: extractClaims,
    generate100Days: generate100Days,
    fetchUrl: fetchUrl,
    hasKey: function () { return !!store.getApiKey(); }
  };
}());
