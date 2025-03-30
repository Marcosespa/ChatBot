import { appendToSheet, fetchFromSheet } from './googleSheetsService.js';
import messageSender from './messageSender.js';
import tripManager from './tripManager.js';

const STEPS = {
  VEHICLE_TYPE: 'vehicleType',
  PLACA: 'placa',
  MODELO: 'modelo',
  VOLUME: 'volume',
  CAPACITY: 'capacity',
  LOCATION: 'location',
  BALANCE_ID: 'balanceId'
};

// const validatePlaca = (placa) => /^[A-Z]{3}\d{3}$/.test(placa.toUpperCase());
const validatePlaca = (placa) => /^[A-Z]{3}\d{2,3}[A-Z]?$/.test(placa.toUpperCase()); // ABC123 o ABC123A
const validateYear = (year) => /^\d{4}$/.test(year) && parseInt(year) >= 1900 && parseInt(year) <= new Date().getFullYear();
const validateNumber = (num) => !isNaN(parseFloat(num)) && parseFloat(num) > 0;
const VEHICLE_TYPES = ["turbo", "sencillo", "dobletroque", "mula", "volqueta", "furgón"];



class ConversationFlow {
  constructor() {
    this.state = {};
  }

  async handleFlow(to, message) {
    const state = this.state[to];
    if (!state) return;

    // Cambio 2: Permitir salir del flujo
    if (message === 'salir') {
      this.resetState(to);
      await messageSender.sendText(to, "¡Listo! 🙌 Has salido del flujo. ¿En qué más puedo ayudarte? 😊");
      return;
    }

    try {
      // Cambio 5: Manejar mensajes de texto en paso de ubicación
      if (state.step === STEPS.LOCATION) {
        await messageSender.sendText(to, "¡Hey! 📍 Por favor, envía tu ubicación con el botón de WhatsApp (o di 'salir' para cancelar).");
        return;
      }

      if (state.step === STEPS.BALANCE_ID) {
        await this.handleBalanceFlow(to, message);
      } else {
        await this.handleAvailabilityFlow(to, message);
      }
    } catch (error) {
      console.error(`Error en flujo para ${to}:`, error);
      await messageSender.sendText(to, "¡Ups! 😓 Algo salió mal. Vamos a empezar de nuevo. 🚀");
      this.resetState(to);
    }
  }


  

  async handleAvailabilityFlow(to, message) {
    const state = this.state[to];
    switch (state.step) {
      case STEPS.VEHICLE_TYPE:
        const userInput = message.toLowerCase().trim();
        if (!VEHICLE_TYPES.includes(userInput)){
          await messageSender.sendText(to,
            `🚫 *Tipo de vehículo no reconocido*\n\n` +
            `Ejemplos válidos:\n` +
            `- ${VEHICLE_TYPES.slice(0, 3).join(", ")}\n` +
            `- ${VEHICLE_TYPES.slice(3).join(", ")}\n\n` +
            `¿Cuál es tu tipo de vehículo? (o escribe *"salir"* para cancelar)`
          );
          return;
          
        }
        state.vehicleType = userInput;
        state.vehicleType = message;
        state.step = STEPS.PLACA;
        await messageSender.sendText(to, "¡Perfecto! 🔢 ¿Cuál es la placa de tu vehículo?");
        break;
      case STEPS.PLACA:
        if (!validatePlaca(message)) {
          // Cambio 2: Mensaje más amigable con opción de salir
          await messageSender.sendText(to, "¡Oops! 🙈 Ingresa una placa válida (ejemplo: ABC123) o di 'salir' para cancelar.");
        } else {
          state.placa = message.toUpperCase();
          state.step = STEPS.MODELO;
          await messageSender.sendText(to, "¡Bien! 📅 ¿Qué modelo es tu vehículo? (ejemplo: 2020)");
        }
        break;
      case STEPS.MODELO:
        if (!validateYear(message)) {
          await messageSender.sendText(to, "¡Vamos! 🚫 Ingresa un año válido (ejemplo: 2020) o di 'salir' para cancelar.");
        } else {
          state.modelo = message;
          state.step = STEPS.VOLUME;
          await messageSender.sendText(to, "¡Genial! 📏 ¿Cuál es la capacidad de volumen en metros cúbicos?");
        }
        break;
      case STEPS.VOLUME:
        if (!validateNumber(message)) {
          await messageSender.sendText(to, "¡Casi! 🔍 Ingresa un número válido mayor a 0 (o di 'salir' para cancelar).");
        } else {
          state.volume = parseFloat(message);
          state.step = STEPS.CAPACITY;
          await messageSender.sendText(to, "¡Super! ⚖️ ¿Cuál es la capacidad de carga máxima en toneladas?");
        }
        break;
      case STEPS.CAPACITY:
        if (!validateNumber(message)) {
          await messageSender.sendText(to, "¡Un paso más! 🔢 Ingresa un número válido mayor a 0 (o di 'salir' para cancelar).");
        } else {
          state.capacity = parseFloat(message);
          state.step = STEPS.LOCATION;
          await messageSender.sendText(to, "¡Último paso! 📍 Comparte tu ubicación actual con el botón de WhatsApp.");
        }
        break;
    }
  }

  async handleLocation(to, location) {
    const state = this.state[to];
    if (state?.step === STEPS.LOCATION) {
      state.location = { latitude: location.latitude, longitude: location.longitude };
      await this.completeAvailability(to);
    }
  }

  async completeAvailability(to) {
    const state = this.state[to];
    const transportData = {
      phone: to,
      vehicleType: state.vehicleType,
      placa: state.placa,
      modelo: state.modelo,
      capacity: state.capacity,
      volume: state.volume,
      location: state.location,
      timestamp: new Date().toISOString()
    };
    const availabilityData = [
      transportData.phone, transportData.vehicleType, transportData.placa,
      transportData.modelo, transportData.capacity, transportData.volume,
      `${transportData.location.latitude},${transportData.location.longitude}`,
      transportData.timestamp
    ];

    await appendToSheet(availabilityData, "Disponibilidad");
    await messageSender.sendText(to, "¡Gracias! 🎉 Estamos buscando un viaje para ti... 🚚");
    const tripMessage = await tripManager.assignTrip(to, transportData);
    if (tripMessage) {
      await messageSender.sendButtons(to, tripMessage.text, tripMessage.buttons);
    }
    this.resetState(to);
  }

  async handleBalanceFlow(to, message) {
    const balances = await this.getBalance(message);
    let response;

    if (balances.length === 0) {
      response = `ID: ${message}\n¡Vaya! 😕 No encontré saldos para este ID.`;
    } else {
      const totalAvailable = balances.reduce((sum, b) => sum + b.available, 0);
      const totalPending = balances.reduce((sum, b) => sum + b.pending, 0);
      const pendingDetails = balances.map((b, index) =>
        `Pago ${index + 1}: $${b.pending} (Próximo pago: ${b.nextPayment})`
      ).join('\n');
      response = `
        ID: ${message}
        Saldo disponible total: $${totalAvailable} 💰
        Facturas pendientes totales: $${totalPending} 📊
        Detalles de pagos pendientes:
        ${pendingDetails}
      `;
    }

    await messageSender.sendText(to, response);
    this.resetState(to);
  }

  async getBalance(id) {
    const rows = await fetchFromSheet("Saldos", "A:D");
    if (!rows || rows.length <= 1) return [];
    const balanceRows = rows.slice(1).filter(row => row[0] === id);
    return balanceRows.map(row => ({
      available: parseFloat(row[1]) || 0,
      pending: parseFloat(row[2]) || 0,
      nextPayment: row[3] || "N/A"
    }));
  }

  startAvailabilityFlow(to) {
    this.state[to] = { step: STEPS.VEHICLE_TYPE };
    if (this.state[to].timeoutId) clearTimeout(this.state[to].timeoutId);
    this.state[to].timeoutId = setTimeout(() => {
      this.resetState(to);
      messageSender.sendText(to," *Sesión cerrada* por inactividad. ¡Envía 'hola' para empezar de nuevo! ")
    },600_000);

  }

  startBalanceFlow(to) {
    this.state[to] = { step: STEPS.BALANCE_ID };
    if(this.state[to],timeoutId) clearTimeout(this.state[to].timeoutId);
    this.state[to].timeoutId =setTimeout(()=>{
      this.resetState(to);
      messageSender.sendText(to," *Sesión cerrada* por inactividad. ¡Envía 'hola' para empezar de nuevo! ")
    },600_000)
  }
  resetState(to) {
    if (this.state[to]?.timeoutId) {
      clearTimeout(this.state[to].timeoutId); // Limpiar el timeout
    }
    delete this.state[to]; // Eliminar el estado
  }
}

export default new ConversationFlow();