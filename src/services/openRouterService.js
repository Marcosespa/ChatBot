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
              "content": "Responde siempre en español. Eres un asistente de Transporte CargaLibre (https://cargalibre.com.co). Solo responde preguntas relacionadas con el negocio, como transporte, disponibilidad de viajes, saldos, rastreo de envíos o soporte. Si la pregunta no está relacionada, di que solo puedes ayudar con temas del negocio. Si el usuario pregunta sobre 'disponibilidad' o 'viajes', sugiere que puede usar el flujo diciendo: 'Puedo guiarte para registrar tu disponibilidad si quieres.' Si pregunta sobre 'saldo', 'pago' o 'factura', sugiere: 'Puedo ayudarte a consultar tu saldo si me das tu ID de transportista.'"
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