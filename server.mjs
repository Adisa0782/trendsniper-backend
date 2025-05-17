import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const leaderboard = {};

// Health check route
app.get('/', (req, res) => {
  res.send('TrendSniper backend is live.');
});

// AI scan and analysis route
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content' });

    const prompt = `
You are an expert AI ad analyst.

Based on the content below:
"""${content}"""

Extract up to 10 ad or product insights. For each one, return a JSON object in this format:

{
  "name": "Product Name",
  "url": "https://example.com",
  "category": "[Pick from: Tech, Beauty & Skincare, Home & Kitchen, Fitness & Wellness, Baby & Kids, Pets, Fashion & Accessories, Tools & DIY, Car Accessories, Health Products, Viral TikTok Items, Office & WFH, Seasonal & Holiday, Other]",
  "confidence": 0.93,
  "adPlatform": "TikTok",
  "adAngle": "Problem-solving",
  "targetAudience": "18–35, students, mobile users",
  "adScript": "Tired of your charger breaking? This one is unbreakable.",
  "summary": "Strong TikTok-style hook with viral potential.",
  "verdict": "Worth testing — strong creative angle and good targeting.",
  "advice": "Use fast visual cuts and urgency-driven captions."
}

Only return valid JSON in an array. Do not include any explanation — just the array.
    `;

    const response = await openai.chat.completions.create({
      model: pro ? 'openai/gpt-4' : 'openchat/openchat-3.5',
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

    // Limit for free users
    if (!pro && items.length > 3) {
      items = items.slice(0, 3);
    }

    // Update leaderboard
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
    console.error('AI Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
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
