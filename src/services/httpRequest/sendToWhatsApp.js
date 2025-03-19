import axios from "axios";
import config from '../../config/env.js';

console.log('Config loaded:', config); // Añade esto para depurar

const sendToWhatsApp = async (data) => {
    if (!config.BASE_URL) throw new Error('BASE_URL is not defined in config');
    if (!config.API_VERSION) throw new Error('API_VERSION is not defined in config');
    if (!config.BUSINESS_PHONE) throw new Error('BUSINESS_PHONE is not defined in config');
    if (!config.API_TOKEN) throw new Error('API_TOKEN is not defined in config');

    const baseUrl = `${config.BASE_URL}/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`;
    console.log('Generated URL:', baseUrl); // Añade esto para depurar

    const headers = {
        Authorization: `Bearer ${config.API_TOKEN}`
    };

    try {
        const response = await axios({
            method: 'POST',
            url: baseUrl,
            headers: headers,
            data,
        });
        return response.data;
    } catch (error) {
        console.error('Error sending to WhatsApp:', error.message);
        throw error;
    }
};

export default sendToWhatsApp;