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
    if (!content) {
      return res.status(400).json({ error: 'Missing content' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `Analyze the content below and extract any ad or product mentions.

For each product or ad found, return the following:

Product: [name]  
URL: [url if any]  
Category: [e.g., beauty, fitness, tech, health]  
Confidence: [score from 0 to 1]  
AdPlatform: [e.g., TikTok, Facebook, Instagram]  
AdAngle: [e.g., emotional, problem-solving, trendy, curiosity]  
TargetAudience: [e.g., Women 18–34, Pet owners, Tech lovers]  
AdScript: [1-line viral ad script idea]

Content: """${content}"""`,
      }]
    });

    const aiText = response.choices[0].message.content;
    const lines = aiText.split('\n').filter(line => line.trim());
    const items = [];
    let currentItem = {};

    lines.forEach(line => {
      const [label, ...rest] = line.split(':');
      const value = rest.join(':').trim();

      switch (label.trim().toLowerCase()) {
        case 'product':
          if (currentItem.name) items.push(currentItem);
          currentItem = { name: value, url: '', category: '', score: 0.7, adPlatform: '', adAngle: '', targetAudience: '', adScript: '' };
          break;
        case 'url':
          currentItem.url = value;
          break;
        case 'category':
          currentItem.category = value;
          break;
        case 'confidence':
          currentItem.score = parseFloat(value) || 0.7;
          break;
        case 'adplatform':
          currentItem.adPlatform = value;
          break;
        case 'adangle':
          currentItem.adAngle = value;
          break;
        case 'targetaudience':
          currentItem.targetAudience = value;
          break;
        case 'adscript':
          currentItem.adScript = value;
          break;
      }
    });

    if (currentItem.name) items.push(currentItem);

    res.json({ items, raw: aiText });

  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
  }
});

app.listen(PORT, () => {
  console.log(`TrendSniper AI backend running on port ${PORT}`);
});
