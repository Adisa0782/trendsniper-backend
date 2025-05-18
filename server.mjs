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

    const prompt = `
You are an expert AI ad strategist.

Analyze the following content:
"""${content.slice(0, 4000)}"""

Extract up to ${pro ? 10 : 3} product or ad insights and return them as a JSON array ONLY.

Each item must include:
- name
- url
- category
- confidence
- adPlatform
- adAngle
- targetAudience
- adScript
- summary
- verdict
- advice

Only return valid JSON array. No extra explanation, markdown, or code blocks.
`;

    let response;
    try {
      response = await openai.chat.completions.create({
        model: pro ? 'openai/gpt-4-1106-preview' : 'mistralai/mistral-7b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4
      });
    } catch (err) {
      console.error('AI failed:', err.response?.data || err.message);
      return res.status(500).json({ error: 'AI request failed. Check OpenRouter key or balance.' });
    }

    const aiText = response.choices?.[0]?.message?.content?.trim();
    if (!aiText || aiText.length < 10) {
      console.error('AI returned empty or short content');
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

    // Track leaderboard
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
    console.error('Fatal server error:', err.message || err);
    res.status(500).json({ error: 'Server error during analysis.' });
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
