import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeWithAI(text) {
  const prompt = `
You are an expert product scanner.

Based on this input text: """${text}""",
return a JSON array of all product or ad mentions.

Each item should be like:
{
  "name": "Wireless Earbuds",
  "isAdOrProduct": true,
  "confidence": 93,
  "niche": "Fitness",
  "estimatedCost": "$25",
  "adStrength": 4
}

Return up to 50 items.
`;

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const jsonString = chat.choices[0].message.content;
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('AI Parse Error:', err);
    return [
      {
        isAdOrProduct: false,
        name: 'Unknown',
        confidence: 0,
        niche: 'Unknown',
        estimatedCost: 'N/A',
        adStrength: 0,
      },
    ];
  }
}
