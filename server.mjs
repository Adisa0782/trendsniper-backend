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

// Home route
app.get('/', (req, res) => {
  res.send('TrendSniper backend is live.');
});

// Analyze content
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro } = req.body;

    if (!content || content.trim().length < 30) {
      return res.status(400).json({ error: 'Content too short for analysis' });
    }

    const cleanContent = content.replace(/[^a-zA-Z0-9\s.,;:!?'"()\-]/g, ' ').slice(0, 4000);

    const prompt = `
You are an expert AI ad strategist.

Based on the following content:
\"\"\"${cleanContent}\"\"\"

Extract up to ${pro ? 10 : 3} product or ad insights and return them as JSON array:
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

Only return the array. No explanation, no notes, no code blocks.
`;

    const response = await openai.chat.completions.create({
    model: pro ? 'openai/gpt-4-1106-preview' : 'mistralai/mistral-7b-instruct:free'
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    });

    const aiText = response.choices?.[0]?.message?.content?.trim();
    if (!aiText) {
      console.error("AI returned no content.");
      return res.status(500).json({ error: 'AI returned empty response.' });
    }

    let items;
    try {
      items = JSON.parse(aiText);
      if (!Array.isArray(items)) throw new Error('Not an array');
    } catch (err) {
      console.error('Invalid JSON from AI:', aiText);
      return res.status(500).json({ error: 'AI returned invalid JSON.', raw: aiText });
    }

    if (!pro && items.length > 3) {
      items = items.slice(0, 3);
    }

    // Update leaderboard
    items.forEach(item => {
      if (item?.name) {
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

    res.json({ items });

  } catch (err) {
    console.error('Fatal error in analyze-multi:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Failed to analyze content. Server error.' });
  }
});

// Leaderboard route
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
