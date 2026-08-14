import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';

const app = express();
app.use(express.json({ limit: '1mb' }));

// The extension calls from a chrome-extension:// origin, which is opaque.
// Allow it, but keep the surface small.
app.use(cors({ origin: true, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'X-Licence-Key'] }));
app.set('trust proxy', 1); // Render sits behind a proxy

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Licence store =========================================================
// Entitlement is decided HERE, never by the extension. Swap the Set for your
// real store (Stripe, Gumroad webhook, Redis) when you have one.
const PRO_KEYS = new Set(
  (process.env.PRO_KEYS || '').split(',').map(k => k.trim()).filter(Boolean)
);
const isPro = req => {
  const key = req.get('X-Licence-Key');
  return !!key && PRO_KEYS.has(key);
};

// === Rate limiting =========================================================
// Without this a single script can drain the OpenAI balance.
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (isPro(req) ? 30 : 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Slow down.' }
});

app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.post('/verify-licence', (req, res) => {
  const key = (req.body?.key || '').trim();
  res.json({ valid: PRO_KEYS.has(key) });
});

// === Analysis ==============================================================
// Field names below MUST match what panel.js renders, or every card shows "-".
const FIELDS = [
  'name', 'url', 'category', 'confidence', 'targetAudience', 'adAngle',
  'adScript', 'verdict', 'advice', 'summary', 'demandSignal', 'adQuality',
  'trendTiming', 'engagement'
];

function buildPrompt({ content, type, platform, signals }) {
  const observed = Object.entries(signals || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  return [
    'You analyse e-commerce pages for dropshippers.',
    `Platform: ${platform || 'unknown'}. Scan type: ${type === 'ads' ? 'advertising angles' : 'winning product potential'}.`,
    observed ? `Signals scraped from the page (these are REAL - weight them heavily): ${observed}.` : 'No hard signals were scraped; say so in your reasoning and lower confidence accordingly.',
    '',
    'Return STRICT JSON, an object with one key "items", an array of at most 5 objects.',
    'Each object has exactly these keys:',
    JSON.stringify(FIELDS),
    '',
    'Rules:',
    '- confidence is an integer 0-100. Base it on the real signals above. If there are none, cap it at 45.',
    '- Never invent order counts, ratings or revenue. If unknown, write "unknown".',
    '- adScript is one or two sentences of actual ad copy, not a description.',
    '- Keep every string under 220 characters.',
    '',
    'Page content:',
    '"""',
    String(content || '').slice(0, 8000),
    '"""'
  ].join('\n');
}

app.post('/analyze-multi', scanLimiter, async (req, res) => {
  const { content, type = 'ads', platform, signals } = req.body || {};

  if (!content || String(content).length < 30) {
    return res.status(400).json({ error: 'Not enough content to analyse.' });
  }
  if (type === 'products' && !isPro(req)) {
    return res.status(402).json({ error: 'Product scans require Pro.' });
  }

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      // Forces valid JSON. Without this the model wraps output in markdown
      // fences and JSON.parse throws on every single call.
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'You return only valid JSON. No prose, no code fences.' },
        { role: 'user', content: buildPrompt({ content, type, platform, signals }) }
      ]
    });

    const raw = chat.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('Model returned non-JSON:', raw.slice(0, 300));
      return res.status(502).json({ error: 'Model returned malformed output.' });
    }

    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .slice(0, 5)
      .map(item => {
        const clean = {};
        FIELDS.forEach(f => { clean[f] = item?.[f] ?? ''; });
        const n = parseInt(clean.confidence, 10);
        clean.confidence = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
        // No hard signals means no high-confidence claim. Enforced server-side
        // so the UI can never show a number the data does not support.
        const hasSignals = Object.values(signals || {}).some(Boolean);
        if (!hasSignals) clean.confidence = Math.min(clean.confidence, 45);
        return clean;
      });

    if (!items.length) return res.status(502).json({ error: 'No items produced.' });

    recordScans(items, platform);
    res.json({ items, pro: isPro(req) });
  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.status(502).json({ error: 'Analysis failed.' });
  }
});

// === Leaderboard ===========================================================
// In-memory: resets when Render sleeps the instance. Move to Redis (already a
// dependency) once you care about persistence.
const tally = new Map();
function recordScans(items, platform) {
  items.forEach(i => {
    const key = (i.name || '').toLowerCase().trim();
    if (!key) return;
    const prev = tally.get(key) || { name: i.name, count: 0, category: i.category, confidence: i.confidence, platform };
    prev.count += 1;
    prev.confidence = Math.round((prev.confidence + i.confidence) / 2);
    tally.set(key, prev);
  });
}

app.get('/leaderboard', (req, res) => {
  const top = [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 20);
  res.json({ top });
});

app.get('/upgrade', (req, res) => {
  // Replace with a redirect to your real checkout.
  res.redirect(process.env.CHECKOUT_URL || 'https://example.com/trendsniper-pro');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('TrendSniper backend on ' + port));
