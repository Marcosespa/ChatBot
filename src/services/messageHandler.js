import whatsappService from './whatsappService.js';
import { appendToSheet, fetchFromSheet } from './googleSheetsService.js';
import openRouterService from './openRouterService.js';

class MessageHandler {
  constructor() {
    this.appointState = {};
    this.tripAssignment = {};
    this.assistantState = {};
    this.timeoutIds = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text' && message?.from && message?.id) {
      try {
        const incomingMessage = message.text.body.toLowerCase().trim();
        console.log(`Mensaje de texto recibido: ${incomingMessage}`);
        if (this.appointState[message.from]) {
          await this.handleAdditionalFlows(message.from, incomingMessage);
          return;
        }
        if (this.tripAssignment[message.from]) {
          console.log(`Asignación activa encontrada para ${message.from}, procesando texto`);
          await this.handleTripResponse(message.from, incomingMessage);
          return;
        }
        if (this.assistantState[message.from]) {
          await this.handleAIAssistantFlow(message.from, incomingMessage);
          return;
        }
        if (this.isGreeting(incomingMessage)) {
          await this.sendWelcomeMessage(message.from, message.id, senderInfo);
          await this.sendMainMenu(message.from);
        } else {
          const validCommands = ['saldo', 'conseguir viaje', 'soporte', 'viaje', 'factura'];
          if (validCommands.some(cmd => incomingMessage.includes(cmd))) {
            const aiResponse = await openRouterService.getAIResponse(message.text.body);
            await whatsappService.sendMessage(message.from, aiResponse, message.id);
          } else {
            await whatsappService.sendMessage(
              message.from,
              'No reconocí tu mensaje. Usa "hola" para empezar o di "soporte" para ayuda.',
              message.id
            );
          }
        }
        await whatsappService.markAsRead(message.id);
      } catch (error) {
        console.error('Error handling message:', error);
        await whatsappService.sendMessage(message.from, "Lo siento, ocurrió un error. Intenta de nuevo.");
      }
    } else if (message?.type === 'location' && message?.from && message?.id) {
      if (this.appointState[message.from] && this.appointState[message.from].step === 'location') {
        await this.handleLocationMessage(message.from, message.location);
      }
      await whatsappService.markAsRead(message.id);
    } else if (message?.type === 'interactive' && message?.from && message?.id) {
      const option = message.interactive.button_reply.title.toLowerCase().trim();
      console.log(`Mensaje interactivo recibido: ${option}, Asignación activa: ${!!this.tripAssignment[message.from]}`);
      if (this.tripAssignment[message.from]) {
        await this.handleTripResponse(message.from, option);
      } else {
        await this.handleMenuOption(message.from, option);
      }
      await whatsappService.markAsRead(message.id);
    }
  }

  async assignTrip(to, transportData) {
    console.log("Datos recibidos en assignTrip:", transportData);
    const availableTrip = await this.findAvailableTrip(transportData);
    if (!availableTrip) {
      await whatsappService.sendMessage(to, "No hay viajes disponibles ahora. Intenta más tarde.");
      return null;
    }

    this.tripAssignment[to] = { trip: availableTrip, assignedAt: Date.now() };
    console.log(`Asignación creada para ${to}:`, this.tripAssignment[to]);
    const tripMessage = {
      text: `
        Te hemos asignado un viaje:
        - Tipo de carga: ${availableTrip.cargoType}
        - Peso: ${availableTrip.weight} toneladas
        - Volumen: ${availableTrip.volume} m³
        - Origen: ${availableTrip.origin}
        - Destino: ${availableTrip.destination}
        - Recogida: ${availableTrip.pickupTime}
        - Flete: $${availableTrip.flete}
        Tienes 10 minutos para responder. ¿Aceptas?
      `,
      buttons: [
        { type: 'reply', reply: { id: 'accept', title: "Aceptar" } },
        { type: 'reply', reply: { id: 'reject', title: "Rechazar" } }
      ]
    };
    this.timeoutIds[to] = setTimeout(() => this.handleTripTimeout(to), 10 * 60 * 1000);
    return tripMessage;
  }

  async handleTripResponse(to, response) {
    const assignment = this.tripAssignment[to];
    console.log(`handleTripResponse - to: ${to}, response: ${response}, assignment:`, assignment);
    if (!assignment) {
      await whatsappService.sendMessage(to, "No hay una asignación activa. Por favor, registra tu disponibilidad nuevamente.");
      return;
    }

    clearTimeout(this.timeoutIds[to]);
    delete this.timeoutIds[to];

    if (response === 'aceptar') {
      const confirmationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const finalMessage = `
        ¡Viaje aceptado!
        Código de confirmación: ${confirmationCode}
        Contacto del cliente: +573135815118
        Detalles: ${assignment.trip.origin} -> ${assignment.trip.destination}
        Flete: $${assignment.trip.flete}
      `;
      
      await whatsappService.sendMessage(to, finalMessage);
      await whatsappService.sendMessage(to,"Para ultimar detalles y verificar que todo haya sido asignado de manera correcta comunicate con nuestro despachador");
      await this.sendContact(to);
      const acceptedTripData = [
        to,
        assignment.trip.cargoType,
        assignment.trip.weight,
        assignment.trip.volume,
        assignment.trip.origin,
        assignment.trip.destination,
        assignment.trip.pickupTime,
        assignment.trip.flete,
        confirmationCode,
        new Date().toISOString()
      ];
      await appendToSheet(acceptedTripData, "ViajesAceptados");
      delete this.tripAssignment[to];
    } else if (response === 'rechazar') {
      await whatsappService.sendMessage(to, "Viaje rechazado. Puedes solicitar otro cuando desees.");
      delete this.tripAssignment[to];
      await this.sendMainMenu(to);
    } else {
      await whatsappService.sendMessage(to, "Respuesta no válida. Usa los botones 'Aceptar' o 'Rechazar'.");
    }
  }

  isGreeting(message) {
    const greetings = ["hola", "hello", "buenas tardes", "buenos días", "hi"];
    return greetings.some(greeting => message.startsWith(greeting));
  }

  async handleLocationMessage(to, location) {
    const state = this.appointState[to];
    if (state.step === 'location') {
      state.location = { latitude: location.latitude, longitude: location.longitude };
      await this.completeTransportAvailability(to);
    }
  }

  getSenderName(senderInfo) {
    const rawName = senderInfo?.profile?.name || senderInfo?.wa_id || "transportista";
    const cleanedName = rawName.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ'-. ]+/g)?.join('') || "transportista";
    return cleanedName.trim();
  }

  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    const WELCOME_MESSAGE = `Hola ${name}, bienvenido a Transporte CargaLibre. ¿En qué puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, WELCOME_MESSAGE, messageId);
  }

  async sendMainMenu(to) {
    const menuMessage = "Selecciona una opción:";
    const buttons = [
      { type: 'reply', reply: { id: 'option_1', title: "Conseguir viaje" } },
      { type: 'reply', reply: { id: 'option_2', title: "Consultar Saldo" } },
      { type: 'reply', reply: { id: 'option_3', title: "Soporte" } }
    ];
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async askForHumanAgent(to) {
    const message = "¿Estás seguro de que quieres hablar con un agente humano?";
    const buttons = [
      { type: 'reply', reply: { id: 'yes_agent', title: "Sí" } },
      { type: 'reply', reply: { id: 'no_agent', title: "No" } }
    ];
    await whatsappService.sendInteractiveButtons(to, message, buttons);
  }

  async handleMenuOption(to, option) {
    switch (option) {
      case 'conseguir viaje':
        delete this.assistantState[to];
        this.appointState[to] = { step: 'vehicleType' };
        await whatsappService.sendMessage(to, "Por favor, indica el tipo de vehículo (turbo, sencillo, dobletroque, mula, etc.).");
        break;
      case 'consultar saldo':
        delete this.assistantState[to];
        await whatsappService.sendMessage(to, "Por favor, ingresa tu ID de manifiesto.");
        this.appointState[to] = { step: 'balanceId' };
        break;
      case 'soporte':
        this.assistantState[to] = { active: true };
        await whatsappService.sendMessage(to, "Soy tu asistente IA de Transporte CargaLibre. ¿En qué puedo ayudarte? Si necesitas salir, di 'salir'. Si quieres hablar con un humano, di 'agente'.");
        break;
      case 'sí':
        delete this.assistantState[to];
        await whatsappService.sendMessage(to, "Contacta a nuestro equipo: +573135815118");
        await this.sendContact(to);
        await this.sendMainMenu(to);
        break;
      case 'no':
        if (this.assistantState[to]) {
          await whatsappService.sendMessage(to, "Perfecto, sigo aquí para ayudarte. ¿En qué más puedo ayudarte?");
        } else {
          await this.sendMainMenu(to);
        }
        break;
      default:
        await whatsappService.sendMessage(to, "Opción no válida. Selecciona una del menú.");
    }
  }

  async handleAIAssistantFlow(to, message) {
    const lowerMessage = message.toLowerCase().trim();

    if (lowerMessage === 'salir' || lowerMessage === 'volver') {
      delete this.assistantState[to];
      await whatsappService.sendMessage(to, "Volviendo al menú principal...");
      await this.sendMainMenu(to);
      return;
    }

    if (lowerMessage.includes('agente') || lowerMessage.includes('humano')) {
      await this.askForHumanAgent(to);
      return;
    }

    if (lowerMessage.includes('disponibilidad')|| lowerMessage.includes('conseguir viaje') || lowerMessage.includes('viaje') || lowerMessage.includes('vehículo')) {
      delete this.assistantState[to];
      this.appointState[to] = { step: 'vehicleType' };
      await whatsappService.sendMessage(to, "Te voy a guiar para registrar tu disponibilidad. Por favor, indica el tipo de vehículo (camión, tráiler, furgón, etc.).");
      return;
    }
    if (lowerMessage.includes('saldo') || lowerMessage.includes('pago') || lowerMessage.includes('factura')) {
      delete this.assistantState[to];
      await whatsappService.sendMessage(to, "Te voy a ayudar a consultar tu saldo. Por favor, ingresa tu ID de transportista.");
      this.appointState[to] = { step: 'balanceId' };
      return;
    }

    const aiResponse = await openRouterService.getAIResponse(message);
    await whatsappService.sendMessage(to, `${aiResponse}\n\nSi necesitas algo más, solo dime. Puedes decir 'salir' para volver al menú o 'agente' si quieres hablar con un humano.`);
  }

  async handleTransportAvailabilityFlow(to, message) {
    const state = this.appointState[to];
    let response;
    switch (state.step) {
      case 'vehicleType':
        state.vehicleType = message;
        state.step = 'placa';
        response = '¿Cuál es la placa de tu vehículo?';
        break;
      case 'placa':
        if (!/^[A-Z]{3}\d{3}$/.test(message.toUpperCase())) {
          response = 'Por favor, ingresa una placa válida (ejemplo: ABC123).';
        } else {
          state.placa = message.toUpperCase();
          state.step = 'modelo';
          response = '¿Qué modelo es tu vehículo? (ejemplo: 2020)';
        }
        break;
      case 'modelo':
        if (!/^\d{4}$/.test(message)) {
          response = 'Por favor, ingresa un año válido (ejemplo: 2020).';
        } else {
          state.modelo = message;
          state.step = 'volume';
          response = '¿Cuál es la capacidad de volumen en metros cúbicos de tu vehículo?';
        }
        break;
      case 'volume':
        state.volume = parseFloat(message);
        if (isNaN(state.volume) || state.volume <= 0) {
          response = 'Por favor, ingresa un número válido mayor a 0 para el volumen.';
        } else {
          state.step = 'capacity';
          response = '¿Cuál es la capacidad de carga máxima en toneladas?';
        }
        break;
      case 'capacity':
        state.capacity = parseFloat(message);
        if (isNaN(state.capacity) || state.capacity <= 0) {
          response = 'Por favor, ingresa un número válido mayor a 0 para la capacidad.';
        } else {
          state.step = 'location';
          response = 'Por favor, comparte tu ubicación actual usando el botón de "Ubicación" en WhatsApp.';
        }
        break;
      default:
        console.error(`Estado inesperado en handleTransportAvailabilityFlow para ${to}:`, state);
        delete this.appointState[to];
        this.appointState[to] = { step: 'vehicleType' };
        response = "Parece que algo salió mal. Vamos a empezar de nuevo. Por favor, indica el tipo de vehículo (turbo, sencillo, dobletroque, mula, etc.).";
    }
    await whatsappService.sendMessage(to, response);
  } 

  async completeTransportAvailability(to) {
    const state = this.appointState[to];
    const transportData = {
      phone: to,
      vehicleType: state.vehicleType,
      placa: state.placa,
      modelo: state.modelo,
      capacity: state.capacity,
      volume: state.volume,
      location: typeof state.location === 'string' ? state.location : { latitude: state.location.latitude, longitude: state.location.longitude },
      timestamp: new Date().toISOString()
    };
    delete this.appointState[to];

    console.log("transportData final:", transportData);

    const availabilityData = [
      transportData.phone,
      transportData.vehicleType,
      transportData.placa,
      transportData.modelo,
      transportData.capacity,
      transportData.volume,
      typeof transportData.location === 'string' ? transportData.location : `${transportData.location.latitude},${transportData.location.longitude}`,
      transportData.timestamp
    ];

    try {
      await appendToSheet(availabilityData, "Disponibilidad");
      await whatsappService.sendMessage(to, "¡Gracias! Estamos buscando un viaje para ti...");      const tripMessage = await this.assignTrip(to, transportData);
      if (tripMessage) {
        await whatsappService.sendInteractiveButtons(to, tripMessage.text, tripMessage.buttons);
      }
    } catch (error) {
      console.error("Error en completeTransportAvailability:", error);
      await whatsappService.sendMessage(to, "Lo siento, ocurrió un error al registrar tu disponibilidad. Intenta de nuevo.");
    }
  }

  async findAvailableTrip(transportData) {
    try {
      const rows = await fetchFromSheet("ViajesDisponibles", "A:I");
      if (!rows || rows.length <= 1) {
        console.log("No hay viajes disponibles en ViajesDisponibles.");
        return null;
      }

      const trips = rows.slice(1).map(row => ({
        cargoType: row[0],
        weight: parseFloat(row[1]),
        volume: parseFloat(row[2]),
        origin: row[3],
        originLat: parseFloat(row[4]),
        originLon: parseFloat(row[5]),
        destination: row[6],
        pickupTime: row[7] || new Date().toISOString(),
        flete: parseFloat(row[8]) || 0
      }));

      function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      const foundTrip = trips.find(trip => {
        const weightMatch = trip.weight <= transportData.capacity;
        const volumeMatch = trip.volume <= transportData.volume;
        const distance = calculateDistance(
          transportData.location.latitude,
          transportData.location.longitude,
          trip.originLat,
          trip.originLon
        );
        const locationMatch = distance <= 50;
        console.log(`Evaluando viaje: ${trip.cargoType} - Peso: ${weightMatch}, Volumen: ${volumeMatch}, Distancia: ${distance.toFixed(2)} km, Coincide: ${locationMatch}, Flete: $${trip.flete}`);
        return weightMatch && volumeMatch && locationMatch;
      });

      console.log("Viaje encontrado:", foundTrip || "Ninguno");
      return foundTrip;
    } catch (error) {
      console.error("Error al consultar ViajesDisponibles:", error);
      return null;
    }
  }

  async handleTripTimeout(to) {
    if (this.tripAssignment[to]) {
      await whatsappService.sendMessage(to, "No respondiste a tiempo. El viaje se ha asignado a otro transportista.");
      delete this.tripAssignment[to];
      delete this.timeoutIds[to];
      await this.sendMainMenu(to);
    }
  }

  async handleBalanceFlow(to, message) {
    const state = this.appointState[to];
    if (state.step === 'balanceId') {
      const balances = await this.getBalance(message);
      let response;

      if (balances.length === 0) {
        response = `
          ID: ${message}
          No se encontraron saldos registrados para este ID.
        `;
      } else {
        const totalAvailable = balances.reduce((sum, b) => sum + b.available, 0);
        const totalPending = balances.reduce((sum, b) => sum + b.pending, 0);
        const pendingDetails = balances.map((b, index) =>
          `Pago ${index + 1}: $${b.pending} (Próximo pago: ${b.nextPayment})`
        ).join('\n');
        response = `
          ID: ${message}
          Saldo disponible total: $${totalAvailable}
          Facturas pendientes totales: $${totalPending}
          Detalles de pagos pendientes:
          ${pendingDetails}
        `;
      }

      await whatsappService.sendMessage(to, response);
      delete this.appointState[to];
      await this.sendMainMenu(to);
    }
  }

  async getBalance(id) {
    try {
      const rows = await fetchFromSheet("Saldos", "A:D");
      if (!rows || rows.length <= 1) {
        console.log("No hay datos de saldos en Saldos.");
        return [];
      }

      // Filtrar todas las filas que coincidan con el ID
      const balanceRows = rows.slice(1).filter(row => row[0] === id);
      if (balanceRows.length === 0) {
        console.log(`No se encontraron saldos para el ID: ${id}`);
        return [];
      }

      // Mapear todas las coincidencias a objetos
      const balances = balanceRows.map(row => ({
        available: parseFloat(row[1]) || 0,
        pending: parseFloat(row[2]) || 0,
        nextPayment: row[3] || "N/A"
      }));

      console.log(`Saldos encontrados para el ID ${id}:`, balances);
      return balances;
    } catch (error) {
      console.error("Error al consultar Saldos:", error);
      return [];
    }
  }

  async sendContact(to) {
    const contact = {
      name: { formatted_name: "Transporte CargaLibre", first_name: "CargaLibre" },
      phones: [{ phone: "+573135815118", wa_id: "573135815118", type: "WORK" }],
      emails: [{ email: "soporte@cargalibre.com.co", type: "WORK" }],
      urls: [{ url: "https://cargalibre.com.co", type: "WORK" }]
    };
    await whatsappService.sendContactMessage(to, contact);
  }


  async handleAdditionalFlows(to, message) {
    if (this.appointState[to]) {
      if (this.appointState[to].step === 'balanceId') {
        await this.handleBalanceFlow(to, message);
      } else {
        await this.handleTransportAvailabilityFlow(to, message);
      }
    }
  }
}

export default new MessageHandler();