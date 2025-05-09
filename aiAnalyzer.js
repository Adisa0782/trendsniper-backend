import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeWithAI(text) {
  const prompt = `
You are an expert product scanner.

Based on this input text: "${text}", tell me:

1. Is this a real ad or winning product? (yes or no)
2. What's the product or ad name (short and clear)?
3. Confidence score from 1-100

Respond in JSON like:
{
  "isAdOrProduct": true,
  "name": "Wireless Earbuds",
  "confidence": 92
}
`;

  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  });

  const jsonString = chat.choices[0].message.content.trim();

  try {
    const result = JSON.parse(jsonString);
    return result;
  } catch (err) {
    console.error("JSON Parse Error:", err);
    return {
      isAdOrProduct: false,
      name: "Unknown",
      confidence: 0
    };
  }
}
