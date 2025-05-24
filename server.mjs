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

app.get('/', (req, res) => res.send('TrendSniper backend is live.'));

app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro, type } = req.body;
    if (!content || content.trim().length < 30) {
      return res.status(400).json({ error: 'Content too short for analysis.' });
    }

    const limit = pro ? 10 : 3;

    // Updated AI prompt for always returning image
    const prompt = type === 'products' ? `
You are an expert in identifying viral winning products.
Analyze the following content to detect potential high-selling products.
Return ONLY a valid JSON array of up to ${limit} items, each with the following fields:
- name: the product name.
- url: the product URL.
- image: a valid, real image URL (required for every item).
- category: the product category.
- confidence: an integer (1-100) showing your confidence level.
- adPlatform: the ad platform (if applicable).
- adAngle: a description of the ad's approach.
- targetAudience: the intended audience.
- adScript: a short ad copy or script.
- summary: a brief analysis of the product.
- verdict: your overall judgment.
- advice: suggestions for improving the product or marketing.

IMPORTANT: Always include a valid "image" field for each product. Do not return empty or placeholder URLs. Focus on real, usable image links.
Content:
"""${content.slice(0, 4000)}"""
` : `
You are an expert in analyzing advertisements.
Analyze the following content to detect high-potential ads.
Return ONLY a valid JSON array of up to ${limit} items, each with the following fields:
- name: the ad name.
- url: the ad link.
- image: a valid, real image URL (required for every item).
- category: the ad category.
- confidence: an integer (1-100) showing your confidence level.
- adPlatform: the ad platform.
- adAngle: the ad approach.
- targetAudience: the intended audience.
- adScript: a short ad copy or script.
- summary: a brief analysis of the ad.
- verdict: your overall judgment.
- advice: suggestions for improving the ad.

IMPORTANT: Always include a valid "image" field for each ad. Do not return empty or placeholder URLs. Focus on real, usable image links.
Content:
"""${content.slice(0, 4000)}"""
`;

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
      const jsonStart = aiText.indexOf('[');
      const jsonEnd = aiText.lastIndexOf(']');
      const jsonString = aiText.slice(jsonStart, jsonEnd + 1);
      items = JSON.parse(jsonString);
      if (!Array.isArray(items)) throw new Error('Invalid JSON array');
    } catch (err) {
      return res.status(500).json({ error: 'AI returned invalid JSON.', message: err.message, raw: aiText });
    }

    if (!pro && items.length > 3) items = items.slice(0, 3);

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
    console.error('Server error:', err.message || err);
    res.status(500).json({ error: 'Server error during analysis.' });
  }
});

app.get('/leaderboard', (req, res) => {
  const top = Object.values(leaderboard)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  res.json({ top });
});

app.listen(PORT, () => console.log(`🔥 TrendSniper backend running on port ${PORT}`));
