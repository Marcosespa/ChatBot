import fetch from 'node-fetch';
import config from '../config/env.js';

class OpenRouterService {
  async getAIResponse(message) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1:free",
          messages: [
            {
              "role": "system",
              "content": "Responde siempre en español, con texto plano sin prefijos como 'Respuesta: y ademas no uses * "
            },
            {
              "role": "user",
              "content": message
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Error de OpenRouter: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("Error en OpenRouter:", error);
      return "Lo siento, ocurrió un error al procesar tu mensaje.";
    }
  }
}

export default new OpenRouterService();