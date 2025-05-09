import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Route for analyzing multiple ads or product texts
app.post('/analyze-multi', async (req, res) => {
  try {
    const { content } = req.body;
    const chunks = content.split('\n').filter(line => line.trim().length > 10);

    const items = await Promise.all(
      chunks.map(async (chunk) => {
        const gptRes = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: `Is this a winning product ad or not? Just return the product name and a confidence score (0-1):\n\n${chunk}`
            }
          ],
        });

        const answer = gptRes.choices[0].message.content;
        const match = answer.match(/(.*?)(?:\s+-\s+Score:|,?\s*confidence\s*[:\-]?\s*)([0-9.]+)/i);

        return {
          name: match ? match[1].trim() : answer.trim(),
          score: match ? parseFloat(match[2]) : 0.5,
          url: 'https://tiktok.com', // or dynamically detect if needed
        };
      })
    );

    res.json({ items });
  } catch (error) {
    console.error("Error analyzing content:", error);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

app.listen(PORT, () => {
  console.log(`TrendSniper backend running on port ${PORT}`);
});
