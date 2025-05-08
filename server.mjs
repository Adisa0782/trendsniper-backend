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
        content: `Analyze this content and extract any ad or product mentions. 
        For each mention, return a product/ad name, a URL if present, and how confident you are it's a real ad (0 to 1).
        Content: """${content}"""`
      }]
    });

    const aiText = response.choices[0].message.content;

    res.json({
      items: [
        {
          name: 'Example Product from AI',
          url: 'https://example.com',
          score: 0.87
        }
      ],
      raw: aiText
    });

  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze content' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
