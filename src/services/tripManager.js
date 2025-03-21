import { appendToSheet, fetchFromSheet } from './googleSheetsService.js';
import messageSender from './messageSender.js';

class TripManager {
  constructor() {
    this.assignments = {};
    this.timeoutIds = {};
  }

  async assignTrip(to, transportData) {
    const availableTrip = await this.findAvailableTrip(transportData);
    if (!availableTrip) {
      // Cambio 1: Mensaje más amigable
      await messageSender.sendText(to, "¡Vaya! 😔 No hay viajes disponibles ahora. Intenta de nuevo más tarde. 🚚");
      return null;
    }

    this.assignments[to] = { trip: availableTrip, assignedAt: Date.now() };
    const tripMessage = {
      text: `
        ¡Te tenemos un viaje! 🎉
        - Tipo de carga: ${availableTrip.cargoType}
        - Peso: ${availableTrip.weight} toneladas
        - Volumen: ${availableTrip.volume} m³
        - Origen: ${availableTrip.origin}
        - Destino: ${availableTrip.destination}
        - Recogida: ${availableTrip.pickupTime}
        - Flete: $${availableTrip.flete}
        Tienes 10 minutos para responder. ¿Aceptas? ⏳
      `,
      buttons: [
        { type: 'reply', reply: { id: 'accept', title: "Aceptar ✅" } },
        { type: 'reply', reply: { id: 'reject', title: "Rechazar ❌" } }
      ]
    };
    this.timeoutIds[to] = setTimeout(() => this.handleTimeout(to), 10 * 60 * 1000);
    return tripMessage;
  }

  async handleTripResponse(to, response) {
    const assignment = this.assignments[to];
    if (!assignment) {
      await messageSender.sendText(to, "¡Ups! 😅 No tienes un viaje asignado. Usa 'Conseguir viaje' para empezar. 🚛");
      return false;
    }

    // Cambio 3: Verificar si el temporizador sigue activo
    if (this.timeoutIds[to]) {
      clearTimeout(this.timeoutIds[to]);
      delete this.timeoutIds[to];
    } else {
      await messageSender.sendText(to, "¡Lo siento! ⏰ El tiempo para responder ya pasó. Pide otro viaje cuando quieras. 😊");
      delete this.assignments[to];
      return false;
    }

    if (response === 'aceptar') {
      const confirmationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const finalMessage = `
        ¡Viaje aceptado! 🎉
        Código de confirmación: ${confirmationCode}
        Contacto del cliente: +573135815118
        Detalles: ${assignment.trip.origin} -> ${assignment.trip.destination}
        Flete: $${assignment.trip.flete}
      `;
      await messageSender.sendText(to, finalMessage);
      await messageSender.sendText(to, "📞 Comunícate con nuestro despachador para ultimar detalles.");
      await messageSender.sendSupportContact(to);

      const tripData = [
        to, assignment.trip.cargoType, assignment.trip.weight, assignment.trip.volume,
        assignment.trip.origin, assignment.trip.destination, assignment.trip.pickupTime,
        assignment.trip.flete, confirmationCode, new Date().toISOString()
      ];
      await appendToSheet(tripData, "ViajesAceptados");
      delete this.assignments[to];
      return true;
    } else if (response === 'rechazar') {
      await messageSender.sendText(to, "¡Entendido! 🙌 Viaje rechazado. Pide otro cuando quieras. 🚚");
      delete this.assignments[to];
      return true;
    } else {
      await messageSender.sendText(to, "¡Ups! 🙈 Respuesta no válida. Usa los botones 'Aceptar' o 'Rechazar', por favor. 😊");
      return false;
    }
  }

  async handleTimeout(to) {
    if (this.assignments[to]) {
      await messageSender.sendText(to, "¡Tiempo agotado! ⏰ El viaje se reasignó. Intenta de nuevo cuando quieras. 🚛");
      delete this.assignments[to];
      delete this.timeoutIds[to];
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
}

export default new TripManager();