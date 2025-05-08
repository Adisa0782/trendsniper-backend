import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post('/analyze-multi', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `Analyze this page text:\n\n${content}\n\nGive 3 winning products or ads with a confidence score and a link.`,
      }],
    });

    const aiText = response.choices[0].message.content;

    // This is mock logic to extract 3 fake items from the AI text
    const items = [
      { name: "Product A", url: "https://example.com/a", score: 0.95 },
      { name: "Product B", url: "https://example.com/b", score: 0.87 },
      { name: "Product C", url: "https://example.com/c", score: 0.78 }
    ];

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post('/analyze-multi', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: `Analyze this page text:\n\n${content}\n\nGive 3 winning products or ads with a confidence score and a link.`,
      }],
    });

    const aiText = response.choices[0].message.content;

    // This is mock logic to extract 3 fake items from the AI text
    const items = [
      { name: "Product A", url: "https://example.com/a", score: 0.95 },
      { name: "Product B", url: "https://example.com/b", score: 0.87 },
      { name: "Product C", url: "https://example.com/c", score: 0.78 }
    ];

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
