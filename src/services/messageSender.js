import whatsappService from './whatsappService.js';

class MessageSender {
  /**
   * Envía un mensaje de texto simple.
   * @param {string} to - Número de teléfono del destinatario.
   * @param {string} text - Texto del mensaje.
   * @param {string} [messageId] - ID del mensaje al que responde (opcional).
   */
  async sendText(to, text, messageId) {
    await whatsappService.sendMessage(to, text, messageId);
  }

  /**
   * Envía un mensaje con botones interactivos.
   * @param {string} to - Número de teléfono del destinatario.
   * @param {string} text - Texto del mensaje.
   * @param {Array} buttons - Lista de botones interactivos.
   */
  async sendButtons(to, text, buttons) {
    await whatsappService.sendInteractiveButtons(to, text, buttons);
  }

  /**
   * Envía el contacto de soporte.
   * @param {string} to - Número de teléfono del destinatario.
   */
  async sendSupportContact(to) {
    const contact = {
      name: { formatted_name: "Transporte CargaLibre", first_name: "CargaLibre" },
      phones: [{ phone: "+573135815118", wa_id: "573135815118", type: "WORK" }],
      emails: [{ email: "soporte@cargalibre.com.co", type: "WORK" }],
      urls: [{ url: "https://cargalibre.com.co", type: "WORK" }]
    };
    await whatsappService.sendContactMessage(to, contact);
  }

  /**
   * Marca un mensaje como leído.
   * @param {string} messageId - ID del mensaje.
   */
  async markAsRead(messageId) {
    await whatsappService.markAsRead(messageId);
  }
}

export default new MessageSender();