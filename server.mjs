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
Return each item in this structured format exactly:

Product: [name]
URL: [url if any]
Confidence: [score between 0 and 1]

Only include real products or ads that sound legit.

Content: """${content}"""`
      }]
    });

    const aiText = response.choices[0].message.content;
    const lines = aiText.split('\n').filter(line => line.trim());
    const items = [];

    let currentItem = {};

    lines.forEach(line => {
      if (line.toLowerCase().startsWith('product:')) {
        if (currentItem.name) items.push(currentItem);
        currentItem = {
          name: line.split(':')[1]?.trim() || 'Unnamed',
          url: '',
          score: 0.7
        };
      } else if (line.toLowerCase().startsWith('url:')) {
        currentItem.url = line.split(':')[1]?.trim() || '';
      } else if (line.toLowerCase().startsWith('confidence:')) {
        const score = parseFloat(line.split(':')[1]?.trim());
        currentItem.score = isNaN(score) ? 0.7 : score;
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
  console.log(`Server running on port ${PORT}`);
});
