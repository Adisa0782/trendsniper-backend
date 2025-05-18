import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import { OpenAI } from 'openai';

config(); // Load .env

const app = express();
const port = process.env.PORT || 3000;

// OpenRouter or OpenAI support
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1' // Important for OpenRouter
});

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

// POST /analyze-multi
app.post('/analyze-multi', async (req, res) => {
  const { content, pro } = req.body;

  if (!content || content.trim().length < 30) {
    return res.status(400).json({ error: 'Content too short for analysis' });
  }

  const prompt = `
You are a strict JSON generator.

Given the following content:
"""${content}"""

Extract up to ${pro ? 10 : 3} products or ad insights in pure JSON array format ONLY.
Each object should have:
- name
- url
- category
- confidence (0.0–1.0)
- adPlatform
- adAngle
- targetAudience
- adScript
- summary
- verdict
- advice

Respond ONLY with the array like this:
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

Return only the array. No commentary. No wrapping.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'openrouter/auto', // or another model like 'mistralai/mixtral-8x7b'
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    });

    const raw = completion.choices[0].message.content.trim();

    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) throw new Error('Not an array');
      return res.json({ items });
    } catch (jsonErr) {
      console.error('Invalid JSON from AI:', jsonErr.message);
      return res.status(500).json({ error: 'AI returned invalid JSON', raw });
    }

  } catch (err) {
    const details = err?.response?.data || err.message || 'Unknown AI error';
    console.error('AI error:', details);
    return res.status(500).json({ error: 'Failed to analyze content', details });
  }
});

// License verification
app.get('/verify', (req, res) => {
  const code = req.query.code;
  const validCodes = ['PURL2024']; // Add more if needed
  const valid = validCodes.includes(code);
  res.json({ valid });
});

// Leaderboard
app.get('/leaderboard', (req, res) => {
  res.json({
    top: [
      { name: "Mini Massager", count: 132, category: "Health Products" },
      { name: "Wireless Earbuds", count: 109, category: "Tech" },
      { name: "Hair Curler", count: 98, category: "Beauty & Skincare" }
    ]
  });
});

app.listen(port, () => {
  console.log(`TrendSniper backend live on http://localhost:${port}`);
});
