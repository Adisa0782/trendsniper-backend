import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// OpenAI or OpenRouter configuration
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Leaderboard tracking object
const leaderboard = {};

// Home route (basic health check)
app.get('/', (req, res) => res.send('TrendSniper backend is live.'));

// Analyze multiple ads or products
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content, pro, type } = req.body;

    // Input validation
    if (!content || content.trim().length < 30) {
      return res.status(400).json({ error: 'Content too short for analysis.' });
    }

    const limit = pro ? 10 : 3;

    // Build prompt for AI based on type
    const prompt = type === 'products' ? `
You are an expert in identifying viral winning products.
Analyze the following content to detect potential high-selling products.
Return ONLY a valid JSON array of up to ${limit} items, each with the following fields:
- name
- url
- image
- category
- confidence
- adPlatform
- adAngle
- targetAudience
- adScript
- summary
- verdict
- advice
IMPORTANT: ONLY output a JSON array. No explanations or extra text.
Content:
"""${content.slice(0, 4000)}"""
` : `
You are an expert in analyzing advertisements.
Analyze the following content to detect high-potential ads.
Return ONLY a valid JSON array of up to ${limit} items, each with the following fields:
- name
- url
- image
- category
- confidence
- adPlatform
- adAngle
- targetAudience
- adScript
- summary
- verdict
- advice
IMPORTANT: ONLY output a JSON array. No explanations or extra text.
Content:
"""${content.slice(0, 4000)}"""
`;

    // Call OpenAI API
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
      // Extract and parse JSON safely
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

    // Update leaderboard
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
    console.error('Server error during analysis:', err);
    res.status(500).json({ error: 'Server error during analysis.' });
  }
});

// Leaderboard route
app.get('/leaderboard', (req, res) => {
  const top = Object.values(leaderboard)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  res.json({ top });
});

app.listen(PORT, () => console.log(`🔥 TrendSniper backend running on port ${PORT}`));
