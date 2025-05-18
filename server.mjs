import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

// Health check
app.get('/', (req, res) => {
  res.send('TrendSniper backend is live.');
});

// Analyze endpoint
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro } = req.body;

    if (!content || content.trim().length < 30) {
      return res.status(400).json({ error: 'Content is too short to analyze' });
    }

    const prompt = `
You are an expert AI ad strategist.

Based on the following content:
"""${content}"""

Extract up to 10 product or ad insights and return them as JSON objects in this format:
[
  {
    "name": "Wireless Earbuds",
    "url": "https://example.com",
    "category": "Tech",
    "confidence": 0.92,
    "adPlatform": "TikTok",
    "adAngle": "Problem-solving",
    "targetAudience": "Students, 18–25",
    "adScript": "Tired of your old earbuds? This one will change your sound forever.",
    "summary": "Strong pain-point targeting with a fast hook. Great for TikTok.",
    "verdict": "Run this ad — it has high potential for viral growth.",
    "advice": "Use quick before/after visuals and target mobile users 18–30 with urgency-based copy."
  }
]
Return only valid JSON.
    `;

    const response = await openai.chat.completions.create({
      model: pro ? 'openai/gpt-4' : 'openchat/openchat-3.5',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const aiText = response.choices[0].message.content;
    let items;

    try {
      items = JSON.parse(aiText);
    } catch (err) {
      console.error('AI returned invalid JSON:', err.message);
      return res.status(500).json({ error: 'AI returned invalid JSON', raw: aiText });
    }

    if (!pro && items.length > 3) {
      items = items.slice(0, 3);
    }

    // Track leaderboard
    items.forEach(item => {
      if (item.name) {
        const key = item.name.trim().toLowerCase();
        leaderboard[key] = leaderboard[key] || {
          name: item.name,
          count: 0,
          category: item.category || 'Other',
        };
        leaderboard[key].count += 1;
      }
    });

    res.json({ items, raw: aiText });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
  }
});

// Leaderboard route
app.get('/leaderboard', (req, res) => {
  const top = Object.values(leaderboard)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  res.json({ top });
});

app.listen(PORT, () => {
  console.log(`TrendSniper backend running on port ${PORT}`);
});
