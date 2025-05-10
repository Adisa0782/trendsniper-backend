import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/analyze-multi', async (req, res) => {
  try {
    const { content } = req.body;
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

    // Try to parse JSON output from GPT
    let items;
    try {
      items = JSON.parse(aiText);
    } catch (err) {
      console.error('JSON Parse Error:', err.message);
      return res.status(500).json({ error: 'AI response could not be parsed', raw: aiText });
    }

    res.json({ items, raw: aiText });

  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
  }
});

app.listen(PORT, () => {
  console.log(`TrendSniper AI backend running on port ${PORT}`);
});import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/analyze-multi', async (req, res) => {
  try {
    const { content } = req.body;
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

    // Try to parse JSON output from GPT
    let items;
    try {
      items = JSON.parse(aiText);
    } catch (err) {
      console.error('JSON Parse Error:', err.message);
      return res.status(500).json({ error: 'AI response could not be parsed', raw: aiText });
    }

    res.json({ items, raw: aiText });

  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
  }
});

app.listen(PORT, () => {
  console.log(`TrendSniper AI backend running on port ${PORT}`);
});
