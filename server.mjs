import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/analyze', async (req, res) => {
  try {
    const { content } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Is this a winning product ad or not? Just say "Winning Product" or "Not a Winning Product":\n\n${content}`,
        },
      ],
    });

    const result = response.choices[0].message.content.trim();
    res.json({ result });
  } catch (error) {
    console.error('Error from OpenAI:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`TrendSniper AI backend running on port ${PORT}`);
});
