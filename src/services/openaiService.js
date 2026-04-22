const axios = require("axios");
const { buildSystemPrompt, buildUserPrompt } = require("../utils/promptBuilder");

async function generateOrderResponse({ order, messages, customerMessage, savedAddress, nextQuestion }) {
  const payload = {
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(savedAddress)
      },
      {
        role: "user",
        content: buildUserPrompt({
          order,
          messages,
          customerMessage,
          nextQuestion
        })
      }
    ]
  };

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    payload,
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Resposta vazia da OpenAI");
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`JSON inválido retornado pela OpenAI: ${content}`);
  }
}

module.exports = {
  generateOrderResponse
};