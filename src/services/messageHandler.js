import whatsappService from './whatsappService.js';
// import appendToSheet from './googleSheetsService.js';
// import openAiService from './openAiService.js';

// const WELCOME_MESSAGE = "Hola bienvenido a CargaLibre. En qué puedo ayudarte el día de hoy?";

class MessageHandler {
  async handleIncomingMessage(message,senderInfo) {
    if (message?.type === 'text' && message?.from && message?.id) {
      try {
        const incomingMessage = message.text.body.toLowerCase().trim();

        if (this.isGreeting(incomingMessage)) {
          await this.sendWelcomeMessage(message.from, message.id,senderInfo);
          await this.sendWelcomeMenu(message.from);
        } else {
          const response = `Echo: ${message.text.body}`;
          await whatsappService.sendMessage(message.from, response, message.id);
        }
        await whatsappService.markAsRead(message.id);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    } else if (message?.type === 'interactive') {
        const option = message?.interactive?.button_reply?.title.toLowerCase().trim();
        await this.handleMenuOption(message.from,option);
        await whatsappService.markAsRead(message.id)
    }
  }


  isGreeting(message) {
    const greetings = ["hola", "hello", "buenas tardes", "buenos días", "hi"];
    return greetings.some(greeting => message.startsWith(greeting));
  }
  getSenderName(senderInfo) {
    const rawName = senderInfo?.profile?.name || senderInfo?.wa_id || "amiguito";
    const cleanedName = rawName.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ'-. ]+/g)?.join('') || "amiguito";
    return cleanedName.trim();
}


  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    const WELCOME_MESSAGE = `Hola ${name}, bienvenido a CargaLibre. ¿En qué puedo ayudarte el día de hoy?`;
    await whatsappService.sendMessage(to, WELCOME_MESSAGE, messageId);
}

async sendWelcomeMenu(to){
  const menuMessage="Elige una opcion"
  const buttons= [
    {
      type:'reply', reply:{id: 'option_1', title: "Agendar"}
    },
    {
      type:'reply', reply:{id: 'option_2', title: "Consultar"}
    },
    {
      type:'reply', reply:{id: 'option_3', title: "Ubicacion"}
    },
    ];
    await whatsappService.sendInteractiveButtons(to,menuMessage,buttons)
  }


  async handleMenuOption(to,option){
    let response;
    switch(option){
      case 'agendar': 
        response="Agendar una cita";
        break;
      case 'consultar':
        response="Realizar tu consulta";
        break
      case 'ubicacion':
        response="Envia la ubicacion";
        break
      default:
        response="Lo siento no entendi tu seleccion, Porfavor elige una de las opciones en el menu"
    }
    await whatsappService.sendMessage(to,response);

  }
}

export default new MessageHandler();