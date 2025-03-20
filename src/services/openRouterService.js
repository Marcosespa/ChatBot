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
              "content": "Eres un asistente especializado en transporte y logística para Transporte CargaLibre (https://cargalibre.com.co). Solo respondes preguntas relacionadas con el negocio, como envíos, saldos, facturación, rastreo, disponibilidad de vehículos y soporte. Si la consulta no está relacionada con estos temas, responde: Lo siento, solo puedo ayudarte con temas de transporte como envíos, saldos o disponibilidad. ¿En qué puedo ayudarte? Si el usuario menciona disponibilidad o viajes, sugiere: Puedo guiarte para registrar tu disponibilidad si quieres. Si pregunta sobre saldo, pago o factura, indica: Puedo ayudarte a consultar tu saldo si me das tu ID de manifiesto. Evita respuestas genéricas de error como ¡Ups! Parece que hubo un error con los datos. y responde siempre en español."
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