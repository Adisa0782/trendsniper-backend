import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Redis Client Setup
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Rate Limiting
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: '🚫 Too many requests, slow down.',
}));

// ✅ Optional: API Key Protection
app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (process.env.TSN_API_KEY && key !== process.env.TSN_API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
});

// ✅ OpenRouter API
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// ✅ Health Check
app.get('/', (req, res) => res.send('🔥 TrendSniper AI Backend Live'));

// ✅ Proxy for Images
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing URL');
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.aliexpress.com'
      }
    });
    if (!response.ok) throw new Error(`Proxy failed: ${response.status}`);
    res.set('Content-Type', response.headers.get('Content-Type'));
    response.body.pipe(res);
  } catch (err) {
    console.error('❌ Proxy error:', err.message);
    res.status(500).send('Proxy fetch failed.');
  }
});

// ✅ Core AI Analysis Endpoint
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro, type } = req.body;
    if (!content || content.length < 30) {
      return res.status(400).json({ error: 'Too little content' });
    }

    const limit = pro ? 10 : 3;

    const prompt = type === 'products'
      ? `You are a product research expert trained to detect high-potential and viral winning products from text content.

Analyze the following content and return a JSON array of up to ${limit} items with:
- name
- url
- image
- category
- confidence (0–100)
- adPlatform
- adAngle
- targetAudience
- adScript
- summary
- verdict
- advice
- demandSignal
- adQuality
- trendTiming
- engagement

Rules:
- Use all clues in the text: product titles, reviews, keywords, urgency, scarcity, trends, and marketing language.
- For "confidence", base your judgment on signs of viral success.
- Respond ONLY with a JSON array. No extra text.

Content:
"""${content.slice(0, 4000)}"""`
      : `You are an expert ad intelligence system.

Analyze the following content to detect high-converting or viral ads. Return a JSON array of up to ${limit} items with:
- name
- url
- image
- category
- confidence (0–100)
- adPlatform
- adAngle
- targetAudience
- adScript
- summary
- verdict
- advice
- demandSignal
- adQuality
- trendTiming
- engagement

Only return a VALID JSON array. No explanation or extra text.

Content:
"""${content.slice(0, 4000)}"""`;

    const response = await openai.chat.completions.create({
      model: pro ? 'openai/gpt-4-1106-preview' : 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const aiText = response.choices?.[0]?.message?.content?.trim();
    if (!aiText || aiText.length < 10) {
      return res.status(500).json({ error: 'AI returned empty response.' });
    }

    let items;
    try {
      const start = aiText.indexOf('[');
      const end = aiText.lastIndexOf(']');
      const json = aiText.slice(start, end + 1);
      items = JSON.parse(json);
      if (!Array.isArray(items)) throw new Error('Invalid JSON array');
    } catch (err) {
      console.error('❌ AI JSON parse failed:', err.message);
      return res.status(500).json({ error: 'AI returned invalid JSON', raw: aiText });
    }

    if (!pro && items.length > 3) items = items.slice(0, 3);

    for (const item of items) {
      const key = `leaderboard:${item.name?.toLowerCase()?.trim()}`;
      if (!key) continue;
      await redis.hSet(key, {
        name: item.name,
        category: item.category || 'General'
      });
      await redis.hIncrBy(key, 'count', 1);
    }

    res.json({ items });
  } catch (err) {
    console.error('❌ Analysis Error:', err.message);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// ✅ Leaderboard Endpoint
app.get('/leaderboard', async (req, res) => {
  try {
    const keys = await redis.keys('leaderboard:*');
    const entries = [];

    for (const key of keys) {
      const entry = await redis.hGetAll(key);
      if (entry.name && entry.count) {
        entry.count = parseInt(entry.count);
        entries.push(entry);
      }
    }

    entries.sort((a, b) => b.count - a.count);
    res.json({ top: entries.slice(0, 10) });
  } catch (err) {
    console.error('❌ Leaderboard error:', err.message);
    res.status(500).json({ error: 'Leaderboard failed' });
  }
});

app.listen(PORT, () => console.log(`🚀 TrendSniper backend live on port ${PORT}`));
