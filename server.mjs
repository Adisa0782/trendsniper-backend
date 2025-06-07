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

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const leaderboard = {};

app.get('/', (req, res) => res.send('🔥 TrendSniper AI Backend Live'));

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

// 🔥 ANALYZE MULTI
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro, type } = req.body;
    if (!content || content.length < 30) {
      return res.status(400).json({ error: 'Too little content' });
    }

    const limit = pro ? 10 : 3;

    const prompt = type === 'products' ? `
You are an AI expert in eCommerce and viral product trends.

Analyze the following text to identify high-potential WINNING PRODUCTS.
Each winning product should:
- Have recent sales momentum
- Target a specific audience
- Use effective ad angles or wow factor
- Have viral potential or uniqueness

For each product, return:
{
  "name": "",
  "url": "",
  "image": "",
  "category": "",
  "confidence": 0-100,
  "targetAudience": "",
  "adAngle": "",
  "adScript": "",
  "verdict": "Winning" | "Too Late" | "Low Potential",
  "advice": "",
  "insights": ""
}

Analyze the following content and return a VALID JSON ARRAY of max ${limit} items.

CONTENT:
"""${content.slice(0, 4000)}"""
` : `
You are an AI ad analyst.

From the text below, detect ads with high potential to convert. Each should include:
- What product or service is being advertised
- Target audience
- Ad script style
- Ad angle (emotional, wow factor, practical)
- Advice to improve it

Return up to ${limit} items formatted as a VALID JSON ARRAY with:
{
  "name": "",
  "url": "",
  "image": "",
  "category": "",
  "confidence": 0-100,
  "targetAudience": "",
  "adAngle": "",
  "adScript": "",
  "verdict": "Good Ad" | "Average" | "Low Potential",
  "advice": "",
  "insights": ""
}

CONTENT:
"""${content.slice(0, 4000)}"""
`;

    const response = await openai.chat.completions.create({
      model: pro ? 'openai/gpt-4-1106-preview' : 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const aiText = response.choices?.[0]?.message?.content?.trim();
    if (!aiText || aiText.length < 10) {
      return res.status(500).json({ error: 'AI returned blank.' });
    }

    // Extract JSON Array
    let items;
    try {
      const jsonStart = aiText.indexOf('[');
      const jsonEnd = aiText.lastIndexOf(']');
      const jsonString = aiText.slice(jsonStart, jsonEnd + 1);
      items = JSON.parse(jsonString);
      if (!Array.isArray(items)) throw new Error('Invalid format');
    } catch (err) {
      console.error('❌ Failed to parse JSON:', err.message);
      return res.status(500).json({ error: 'AI returned invalid JSON.', raw: aiText });
    }

    if (!pro && items.length > 3) items = items.slice(0, 3);

    // Update leaderboard
    items.forEach(item => {
      const key = item?.name?.toLowerCase()?.trim();
      if (key) {
        leaderboard[key] = leaderboard[key]
          ? { ...leaderboard[key], count: leaderboard[key].count + 1 }
          : { name: item.name, count: 1, category: item.category || 'General' };
      }
    });

    res.json({ items });
  } catch (err) {
    console.error('❌ Server error:', err.message);
    res.status(500).json({ error: 'Backend error', message: err.message });
  }
});

app.get('/leaderboard', (req, res) => {
  const top = Object.values(leaderboard)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  res.json({ top });
});

app.listen(PORT, () => console.log(`🚀 TrendSniper backend running on ${PORT}`));
