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
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory leaderboard
const leaderboard = {};

app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content' });

    const prompt = `
You are an expert product scout.

Based on the following content:
"""${content}"""

Extract up to 50 product or ad mentions and return them in JSON array format.

Each item should include:
{
  "name": "Wireless Earbuds",
  "url": "https://example.com",
  "category": "Tech",
  "confidence": 0.88,
  "adPlatform": "TikTok",
  "adAngle": "Problem-solving",
  "targetAudience": "Students, 18–25",
  "adScript": "Tired of your old earbuds? This one will change your sound forever."
}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const aiText = response.choices[0].message.content;

    let items;
    try {
      items = JSON.parse(aiText);
    } catch (err) {
      console.error('JSON Parse Error:', err.message);
      return res.status(500).json({ error: 'AI returned invalid JSON', raw: aiText });
    }

    // Limit to 3 items if not Pro
    if (!pro && items.length > 3) {
      items = items.slice(0, 3);
    }

    // Update leaderboard
    items.forEach(item => {
      if (item.name) {
        const key = item.name.trim().toLowerCase();
        leaderboard[key] = (leaderboard[key] || 0) + 1;
      }
    });

    res.json({ items, raw: aiText });

  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
  }
});

// Leaderboard route
app.get('/leaderboard', (req, res) => {
  const top = Object.entries(leaderboard)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  res.json({ top });
});

// Server
app.listen(PORT, () => {
  console.log(`TrendSniper AI backend running on port ${PORT}`);
});
