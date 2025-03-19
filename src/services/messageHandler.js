import whatsappService from './whatsappService.js';
import appendToSheet from './googleSheetsService.js';
import openRouterService from './openRouterService.js';

class MessageHandler {
  constructor() {
    this.appointState = {};
    this.assistandState = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text' && message?.from && message?.id) {
      try {
        const incomingMessage = message.text.body.toLowerCase().trim();

        if (this.appointState[message.from]) {
          console.log("En flujo de agendamiento:", this.appointState[message.from]);
          await this.handleAppointmentFlow(message.from, incomingMessage);
          return;
        }

        if (this.isGreeting(incomingMessage)) {
          await this.sendWelcomeMessage(message.from, message.id, senderInfo);
          await this.sendWelcomeMenu(message.from);
        } else if (incomingMessage === "media") {
          await this.sendMedia(message.from);
        } else if (incomingMessage === "emergencia") {
          const response = "Si esto es una emergencia, te invitamos a llamar a nuestra línea de atención.";
          await whatsappService.sendMessage(message.from, response, message.id);
          await this.sendContact(message.from);
        } else {
          const aiResponse = await openRouterService.getAIResponse(message.text.body);
          await whatsappService.sendMessage(message.from, aiResponse, message.id);
        }
        await whatsappService.markAsRead(message.id);
      } catch (error) {
        console.error('Error handling message:', error);
        await whatsappService.sendMessage(message.from, "Lo siento, ocurrió un error. Intenta de nuevo.");
      }
    } else if (message?.type === 'interactive') {
      const option = message?.interactive?.button_reply?.title.toLowerCase().trim();
      await this.handleMenuOption(message.from, option);
      await whatsappService.markAsRead(message.id);
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

  async sendWelcomeMenu(to) {
    const menuMessage = "Elige una opción";
    const buttons = [
      { type: 'reply', reply: { id: 'option_1', title: "Agendar" } },
      { type: 'reply', reply: { id: 'option_2', title: "Emergencia" } },
      { type: 'reply', reply: { id: 'option_3', title: "AsistenteAi" } }
    ];
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async handleMenuOption(to, option) {
    console.log("Opción seleccionada:", option);
    switch (option) {
      case 'agendar':
        this.appointState[to] = { step: 'name' };
        await whatsappService.sendMessage(to, "Por favor ingresa tu nombre");
        break;
      case 'emergencia':
        await whatsappService.sendMessage(to, "Si esto es una emergencia, te invitamos a llamar a nuestra línea de atención.");
        await this.sendContact(to);
        break;
      case 'asistenteai':
        await whatsappService.sendMessage(to, "Soy tu asistente IA. ¿En qué puedo ayudarte?");
        break;
      default:
        await whatsappService.sendMessage(to, "Lo siento, no entendí tu selección. Por favor elige una de las opciones del menú.");
    }
  }

  async sendMedia(to) {
    const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-imagen.png';
    const caption = '¡Esto es una Imagen!';
    const type = 'image';
    await whatsappService.sendMediaMessage(to, type, mediaUrl, caption);
  }

  completeAppointment(to) {
    const appointment = this.appointState[to];
    if (!appointment) {
      return "Error: No hay una cita en curso.";
    }
    delete this.appointState[to];
    const userData = [
      to,
      appointment.name,
      appointment.petName,
      appointment.petType,
      appointment.reason,
      new Date().toISOString()
    ];
    console.log("Datos de la cita completada:", userData);
    appendToSheet(userData);
    return "¡Gracias! Tu cita ha sido registrada correctamente.";
  }

  async handleAppointmentFlow(to, message) {
    const state = this.appointState[to];
    if (!state) {
      console.error(`❌ No hay flujo de agendamiento activo para ${to}`);
      return;
    }
    let response;
    switch (state.step) {
      case 'name':
        state.name = message;
        state.step = 'petName';
        response = 'Gracias, ahora ¿cuál es el nombre de tu mascota?';
        break;
      case 'petName':
        state.petName = message;
        state.step = 'petType';
        response = '¿Qué tipo de mascota es? (ejemplo: perro, gato, etc.)';
        break;
      case 'petType':
        state.petType = message;
        state.step = 'reason';
        response = '¿Cuál es el motivo de la consulta?';
        break;
      case 'reason':
        state.reason = message;
        response = this.completeAppointment(to);
        break;
      default:
        console.error(`❌ Estado desconocido en el flujo de agendamiento para ${to}:`, state);
        response = "Ocurrió un error. Inténtalo de nuevo.";
    }
    if (response) {
      await whatsappService.sendMessage(to, response);
    }
  }

  async sendContact(to) {
    const contact = {
      addresses: [{
        street: "Calle Principal",
        city: "Ciudad",
        state: "Estado",
        zip: "1234",
        country: "Colombia",
        country_code: "CO",
        type: "WORK"
      }],
      emails: [{
        email: "contabilidad@cargalibre.com.co",
        type: "WORK"
      }],
      name: {
        formatted_name: "Transporte Carga Libre",
        first_name: "Carga Libre",
        last_name: "Contacto",
        middle_name: "",
        suffix: "",
        prefix: ""
      },
      org: {
        company: "Carga Libre",
        department: "Atención al cliente",
        title: "Representante"
      },
      phones: [{
        phone: "+573135815118",
        wa_id: "573135815118",
        type: "WORK"
      }],
      urls: [{
        url: "https://cargalibre.com.co",
        type: "WORK"
      }]
    };
    await whatsappService.sendContactMessage(to, contact);
  }
  async sendLocation(to){
    const latitud=6.2071694;
    const longuitud=-75.574607;
    const name='Carga Libre';
    const addres='Cra dededededede';

    await whatsappService.sendLocationMessage(to,latitud,longuitud,name,addres)
  }
}

export default new MessageHandler();