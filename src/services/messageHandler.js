import messageSender from './messageSender.js';
import tripManager from './tripManager.js';
import conversationFlow from './conversationFlow.js';
import openRouterService from './openRouterService.js';

class MessageHandler {
  constructor() {
    this.assistantState = {};
    this.menuSent = {};
    this.processing = new Set(); 
  }

  async handleIncomingMessage(message, senderInfo) {
    if (!message?.from || !message?.id || this.processing.has(message.from)) return;
    this.processing.add(message.from); // Cambio 6: Bloquear procesamiento múltiple

    try {
      if (message.type === 'text') {
        const text = message.text.body.toLowerCase().trim();
        const hasPreviousState = 
          !!conversationFlow.state[message.from] || 
          !!tripManager.assignments[message.from] || 
          !!this.assistantState[message.from];

        if (conversationFlow.state[message.from]) {
          await conversationFlow.handleFlow(message.from, text);
        } else if (tripManager.assignments[message.from]) {
          const completed = await tripManager.handleTripResponse(message.from, text);
          if (completed) await this.completeFlow(message.from); // Cambio 4: Limpieza consistente
        } else if (this.assistantState[message.from]) {
          await this.handleAIAssistantFlow(message.from, text);
        } else if (this.isConversationStarter(text, hasPreviousState)) {
          await this.sendWelcomeMessage(message.from, message.id, senderInfo);
          await this.sendMainMenuIfNotSent(message.from);
        } else {
          const validCommands = ['saldo', 'conseguir viaje', 'soporte', 'viaje', 'factura'];
          if (validCommands.some(cmd => text.includes(cmd))) {
            const aiResponse = await openRouterService.getAIResponse(message.text.body);
            await messageSender.sendText(message.from, aiResponse, message.id);
          } else {
            // Cambio 7: Mensaje más amigable para mensajes no válidos
            await messageSender.sendText(message.from, "¡Ups! 🙈 No entendí eso. Prueba con 'hola' para empezar o 'soporte' para ayuda. 😊");
          }
          await this.sendMainMenuIfNotSent(message.from);
        }
      } else if (message.type === 'location') {
        await conversationFlow.handleLocation(message.from, message.location);
      } else if (message.type === 'interactive') {
        const option = message.interactive.button_reply.title.toLowerCase().trim();
        if (tripManager.assignments[message.from]) {
          const completed = await tripManager.handleTripResponse(message.from, option);
          if (completed) await this.completeFlow(message.from); // Cambio 4: Limpieza consistente
        } else {
          await this.handleMenuOption(message.from, option);
        }
      }
      await messageSender.markAsRead(message.id);
    } catch (error) {
      console.error('Error handling message:', error);
      await messageSender.sendText(message.from, "¡Lo siento! 😓 Ocurrió un error. Intenta de nuevo, por favor. 🙏");
    } finally {
      this.processing.delete(message.from); // Cambio 6: Liberar bloqueo
    }
  }

  isConversationStarter(message, hasPreviousState) {
    const starters = [
      "hola", "hello", "hi", "buenos días", "buenas tardes", "buenas noches", "tardes", "días", "saludos",
      "ayuda", "soporte", "menú", "menu", "inicio", "empezar", "start", "hablemos",
      "qué", "cómo", "cuándo", "dónde", "quién", "cuánto", "por qué", "puedes", "necesito",
      "hey", "oye", "alo", "listo", "ok", "sí", "claro", "quiero",
      "viaje", "viajes", "carga", "transporte", "saldo", "factura", "disponibilidad"
    ];
    if (!hasPreviousState) return true;
    return starters.some(starter => 
      message.startsWith(starter) || message.includes(` ${starter} `) || message === starter
    );
  }

  getSenderName(senderInfo) {
    const rawName = senderInfo?.profile?.name || senderInfo?.wa_id || "transportista";
    const cleanedName = rawName.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ'-. ]+/g)?.join('') || "transportista";
    return cleanedName.trim();
  }

  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    // Cambio 1: Mensaje más amigable con emojis
    const WELCOME_MESSAGE = `¡Hola ${name}! 👋 Bienvenid@ a Transporte CargaLibre. ¿En qué puedo ayudarte hoy? 😊`;
    await messageSender.sendText(to, WELCOME_MESSAGE, messageId);
  }

  async sendMainMenu(to) {
    // Cambio 1: Menú con emojis
    const menuMessage = "Selecciona una opción: 🚚";
    const buttons = [
      { type: 'reply', reply: { id: 'option_1', title: "Conseguir viaje 🚛" } },
      { type: 'reply', reply: { id: 'option_2', title: "Consultar Saldo 💰" } },
      { type: 'reply', reply: { id: 'option_3', title: "Soporte 🆘" } }
    ];
    await messageSender.sendButtons(to, menuMessage, buttons);
  }

  async sendMainMenuIfNotSent(to) {
    if (!this.menuSent[to]) {
      await this.sendMainMenu(to);
      this.menuSent[to] = true;
    }
  }

  async completeFlow(to) {
    // Cambio 4: Limpieza consistente de todos los estados
    conversationFlow.resetState(to);
    delete tripManager.assignments[to];
    if (tripManager.timeoutIds[to]) {
      clearTimeout(tripManager.timeoutIds[to]);
      delete tripManager.timeoutIds[to];
    }
    delete this.assistantState[to];
    delete this.menuSent[to];
    await this.sendMainMenu(to);
  }

  async handleMenuOption(to, option) {
    switch (option) {
      case 'conseguir viaje':
        delete this.assistantState[to];
        conversationFlow.startAvailabilityFlow(to);
        // Cambio 1: Mensaje más amigable
        await messageSender.sendText(to, "¡Genial! 🚚 Indica el tipo de vehículo (turbo, sencillo, dobletroque, mula, etc.).");
        break;
      case 'consultar saldo':
        delete this.assistantState[to];
        conversationFlow.startBalanceFlow(to);
        await messageSender.sendText(to, "¡Claro! 💸 Por favor, ingresa tu ID de manifiesto.");
        break;
      case 'soporte':
        this.assistantState[to] = { active: true };
        await messageSender.sendText(to, "¡Aquí estoy para ayudarte! 🤖 Soy tu asistente de Transporte CargaLibre. ¿En qué te ayudo? (Di 'salir' para volver o 'agente' para soporte humano).");
        break;
      default:
        await messageSender.sendText(to, "¡Ups! 🙈 Opción no válida. Usa los botones del menú, por favor. 😊");
    }
  }

  async handleAIAssistantFlow(to, message) {
    if (message === 'salir' || message === 'volver') {
      await this.completeFlow(to); // Cambio 4: Usar limpieza completa
      return;
    }

    if (message.includes('agente') || message.includes('humano')) {
      const confirmMessage = "¿Seguro que quieres hablar con un agente humano? 🤔";
      const buttons = [
        { type: 'reply', reply: { id: 'yes_agent', title: "Sí ✅" } },
        { type: 'reply', reply: { id: 'no_agent', title: "No ❌" } }
      ];
      await messageSender.sendButtons(to, confirmMessage, buttons);
      return;
    }

    const aiResponse = await openRouterService.getAIResponse(message);
    await messageSender.sendText(to, `${aiResponse}\n\n¿Algo más? 🌟 Di 'salir' para volver o 'agente' para soporte humano.`);
  }
}

export default new MessageHandler();