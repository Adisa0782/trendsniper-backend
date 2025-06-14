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
  windowMs: 60 * 1000,
  max: 60,
  message: '🚫 Too many requests, slow down.',
}));

// ✅ Optional API Key Protection
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

// ✅ Image Proxy
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing URL');
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.aliexpress.com',
      },
    });
    if (!response.ok) throw new Error(`Proxy failed: ${response.status}`);
    res.set('Content-Type', response.headers.get('Content-Type'));
    response.body.pipe(res);
  } catch (err) {
    console.error('❌ Proxy error:', err.message);
    res.status(500).send('Proxy fetch failed.');
  }
});

// ✅ Core AI Analysis
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro, type, videos = [] } = req.body;
    if (!content || content.length < 30) {
      return res.status(400).json({ error: 'Too little content' });
    }

    const limit = pro ? 10 : 3;
    const hasVideo = videos.length > 0

    const prompt = type === 'products'
  ? `You are an expert product analysis AI.

The following input includes structured data from a product page:
- Title
- Price
- Image
- Reviews
- Full visible text

Analyze this and return a JSON array of up to ${limit} potential winning products.

Each item should include:
- name, url, image, category, confidence (0–100)
- adPlatform, adAngle, targetAudience, adScript
- summary, verdict, advice
- demandSignal, adQuality, trendTiming, engagement

Video Presence: ${hasVideo ? 'Yes' : 'No'}

Only return a valid JSON array. Do not include extra commentary.

Content:
"""${content.slice(0, 1800)}"""`

  : `You are an expert ad intelligence system.

The following input includes structured data from an ad landing page:
- Title
- Price
- Image
- Reviews
- Full visible page text

Analyze the ad and detect any high-converting or viral promotions. Return a JSON array of up to ${limit} ads.

Each item must include:
- name, url, image, category, confidence (0–100)
- adPlatform, adAngle, targetAudience, adScript
- summary, verdict, advice
- demandSignal, adQuality, trendTiming, engagement

Video Presence: ${hasVideo ? 'Yes' : 'No'}

Only return a valid JSON array. Do not include any explanation.

Content:
"""${content.slice(0, 1800)}"""`;

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

    // ✅ Append hasVideo field for frontend rendering
    const enrichedItems = items.map(item => ({
      ...item,
      hasVideo: hasVideo
    }));

    // ✅ Save leaderboard
    for (const item of enrichedItems) {
      const key = `leaderboard:${item.name?.toLowerCase()?.trim()}`;
      if (!key) continue;
      await redis.hSet(key, {
        name: item.name,
        category: item.category || 'General'
      });
      await redis.hIncrBy(key, 'count', 1);
    }

    res.json({ items: enrichedItems });
  } catch (err) {
    console.error('❌ Analysis Error:', err.message);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// ✅ Leaderboard
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
