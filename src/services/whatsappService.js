import axios from 'axios';
import config from '../config/env.js';

class WhatsAppService {


  async sendMessage(to, body, messageId) {
    try {
      await axios({
        method: 'POST',
        url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
        headers: {
          Authorization: `Bearer ${config.API_TOKEN}`,
        },
        data: {
          messaging_product: 'whatsapp',
          to,
          text: { body },
          // context: {
          //   message_id: messageId,
          // },
        },
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
  async markAsRead(messageId) {
    try {
      await axios({
        method: 'POST',
        url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
        headers: {
          Authorization: `Bearer ${config.API_TOKEN}`,
        },
        data: {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }
  async sendInteractiveButtons(to, BodyText, buttons) {
    try {
      await axios({
        method: 'POST',
        url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
        headers: {
          Authorization: `Bearer ${config.API_TOKEN}`,
        },
        data: {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: BodyText },
            action: {
              buttons
            }
          }
        },
      });
    } catch (error) {
      console.log(error)
    }
  }
  async sendMediaMessage(to, type, mediaUrl, caption) {
    try {
      const mediaObject = {};
      switch (type) {
        case 'image':
          mediaObject.image = { link: mediaUrl, caption: caption }
          break;
        case 'audio':
          mediaObject.audio = { link: mediaUrl };
          break;
        case 'document':
          mediaObject.document = { link: mediaUrl, caption: caption }
          break;
        default:
          throw new Error('not soported media');
          break;
      }
      await axios({
        method: 'POST',
        url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
        headers: {
          Authorization: `Bearer ${config.API_TOKEN}`,
        },
        data: {
          messaging_product: 'whatsapp',
          to,
          type: type,
          ...mediaObject
        },
      });


    } catch (error) {
      console.error(error)
    }

  }

  async SendContactMessage(to, contact){
    try {
      
      await axios({
        method: 'POST',
        url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
        headers: {
          Authorization: `Bearer ${config.API_TOKEN}`,
        },
        data: {
          messaging_product: 'whatsapp',
          to,
          text: 'contacs',
          contacts:[contact]
        },
      });

    } catch (error) {
      console.log(error)
    }
  }
}

export default new WhatsAppService();