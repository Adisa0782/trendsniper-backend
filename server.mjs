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
  baseURL: 'https://openrouter.ai/api/v1'
});

const leaderboard = {};

app.get('/', (req, res) => {
  res.send('TrendSniper backend is live.');
});

app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro } = req.body;
    if (!content || content.trim().length < 30) {
      return res.status(400).json({ error: 'Content too short for analysis' });
    }

    const cleanContent = content.replace(/[^a-zA-Z0-9\s.,;:!?'"()-]/g, ' ').slice(0, 4000);
  const prompt = `
You are a strict JSON generator.

Given the following content:
"""${content}"""

Extract up to 10 products or ad insights in JSON array format ONLY. Each item must include:
- name
- url
- category
- confidence (0.0 to 1.0)
- adPlatform
- adAngle
- targetAudience
- adScript

Return ONLY a JSON array like this:
[
  {
    "name": "Wireless Earbuds",
    "url": "https://example.com",
    "category": "Tech",
    "confidence": 0.92,
    "adPlatform": "TikTok",
    "adAngle": "Problem-solving",
    "targetAudience": "Students, 18–25",
    "adScript": "Tired of your old earbuds? This one will change your sound forever."
  }
]
No commentary. No markdown. Only a valid array.
`;

    const response = await openai.chat.completions.create({
      model: pro ? 'openai/gpt-4' : 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const aiText = response.choices[0]?.message?.content;
    if (!aiText) {
      console.error("AI returned empty response");
      return res.status(500).json({ error: 'AI response was empty' });
    }

    let items;
    try {
      items = JSON.parse(aiText);
    } catch (err) {
      console.error('AI returned invalid JSON:', aiText);
      return res.status(500).json({ error: 'AI returned invalid JSON', raw: aiText });
    }

    if (!pro && items.length > 3) {
      items = items.slice(0, 3);
    }

    items.forEach(item => {
      if (item.name) {
        const key = item.name.trim().toLowerCase();
        if (!leaderboard[key]) {
          leaderboard[key] = {
            name: item.name,
            count: 1,
            category: item.category || 'Other'
          };
        } else {
          leaderboard[key].count += 1;
        }
      }
    });

    res.json({ items, raw: aiText });

  } catch (err) {
    console.error('Backend error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
  }
});

app.get('/leaderboard', (req, res) => {
  const top = Object.entries(leaderboard)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([_, data]) => ({
      name: data.name,
      count: data.count,
      category: data.category
    }));

  res.json({ top });
});

app.listen(PORT, () => {
  console.log(`TrendSniper AI backend running on port ${PORT}`);
});
