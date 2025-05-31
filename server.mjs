import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// OpenAI or OpenRouter Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Leaderboard Tracking
const leaderboard = {};

// 🔥 Health Check Route
app.get('/', (req, res) => res.send('🔥 TrendSniper backend is live!'));

// 🔥 Proxy Route to Bypass CORS Restrictions
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing target URL.');

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.aliexpress.com',
      },
    });
    if (!response.ok) throw new Error(`Proxy fetch failed: ${response.status}`);
    res.set('Content-Type', response.headers.get('Content-Type'));
    response.body.pipe(res);
  } catch (err) {
    console.error('Proxy fetch error:', err.message);
    res.status(500).send('Proxy fetch failed.');
  }
});

// 🔥 Core Analyze-Multi Endpoint
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro, type } = req.body;

    // Validate Input
    if (!content || content.trim().length < 30) {
      return res.status(400).json({ error: 'Content too short for analysis.' });
    }

    const limit = pro ? 10 : 3;
    const prompt = type === 'products' ? `
You are an expert in identifying viral winning products.
Analyze the following content to detect potential high-selling products.
Return ONLY a valid JSON array of up to ${limit} items, each with:
- name, url, image, category, confidence, adPlatform, adAngle, targetAudience, adScript, summary, verdict, advice
IMPORTANT: ONLY output a JSON array. No explanations or extra text.
Content:
"""${content.slice(0, 4000)}"""
` : `
You are an expert in analyzing advertisements.
Analyze the following content to detect high-potential ads.
Return ONLY a valid JSON array of up to ${limit} items, each with:
- name, url, image, category, confidence, adPlatform, adAngle, targetAudience, adScript, summary, verdict, advice
IMPORTANT: ONLY output a JSON array. No explanations or extra text.
Content:
"""${content.slice(0, 4000)}"""
`;

    // 🔥 Call OpenAI or OpenRouter
    const response = await openai.chat.completions.create({
      model: pro ? 'openai/gpt-4-1106-preview' : 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const aiText = response.choices?.[0]?.message?.content?.trim();
    if (!aiText || aiText.length < 10) {
      return res.status(500).json({ error: 'AI returned empty response.' });
    }

    // 🔥 Safe JSON Extraction and Parsing
    let items;
    try {
      const jsonStart = aiText.indexOf('[');
      const jsonEnd = aiText.lastIndexOf(']');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON array found');
      const jsonString = aiText.slice(jsonStart, jsonEnd + 1);
      items = JSON.parse(jsonString);
      if (!Array.isArray(items)) throw new Error('Invalid JSON array');
    } catch (err) {
      console.error('AI response parsing error:', aiText);
      return res.status(500).json({ error: 'AI returned invalid JSON.', message: err.message, raw: aiText });
    }

    if (!pro && items.length > 3) items = items.slice(0, 3);

    // 🔥 Update Leaderboard
    items.forEach(item => {
      const key = item?.name?.trim()?.toLowerCase();
      if (key) {
        if (!leaderboard[key]) {
          leaderboard[key] = { name: item.name, count: 1, category: item.category || 'Other' };
        } else {
          leaderboard[key].count += 1;
        }
      }
    });

    res.json({ items });
  } catch (err) {
    console.error('Server error during analysis:', err.message || err);
    res.status(500).json({ error: 'Server error during analysis.' });
  }
});

// 🔥 Leaderboard Endpoint
app.get('/leaderboard', (req, res) => {
  const top = Object.values(leaderboard)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  res.json({ top });
});

// 🔥 Start the Server
app.listen(PORT, () => console.log(`🔥 TrendSniper backend running on port ${PORT}`));
