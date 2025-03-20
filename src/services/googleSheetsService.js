import path from 'path';
import { google } from 'googleapis';
import config from '../config/env.js';

const sheets = google.sheets('v4');

// Función para agregar datos a una hoja específica
async function addRowToSheets(auth, spreadsheetId, values, sheetName) {
  const request = {
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [values],
    },
    auth,
  };

  try {
    const response = await sheets.spreadsheets.values.append(request);
    console.log(`Datos agregados a ${sheetName}:`, values);
    return response;
  } catch (error) {
    console.error(`Error al agregar datos a ${sheetName}:`, error);
    throw error;
  }
}

// Nueva función para leer datos de una hoja específica
async function readFromSheet(auth, spreadsheetId, sheetName, range = 'A:Z') {
  const request = {
    spreadsheetId,
    range: `${sheetName}!${range}`,
    auth,
  };

  try {
    const response = await sheets.spreadsheets.values.get(request);
    const rows = response.data.values || [];
    console.log(`Datos leídos de ${sheetName}:`, rows);
    return rows;
  } catch (error) {
    console.error(`Error al leer datos de ${sheetName}:`, error);
    throw error;
  }
}

// Función exportada para agregar datos
const appendToSheet = async (data, sheetName = 'Disponibilidad') => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'src', 'credentials', 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const spreadsheetId = '1kax_Mk_k62WJVOhVGamIDXf7_MmpHkohVYWAgZW0W1I';

    await addRowToSheets(authClient, spreadsheetId, data, sheetName);
    return 'Exitoso';
  } catch (error) {
    console.error('Error en appendToSheet:', error);
    throw error;
  }
};

// Nueva función exportada para leer datos
const fetchFromSheet = async (sheetName, range = 'A:Z') => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'src', 'credentials', 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const spreadsheetId = '1kax_Mk_k62WJVOhVGamIDXf7_MmpHkohVYWAgZW0W1I';

    const rows = await readFromSheet(authClient, spreadsheetId, sheetName, range);
    return rows;
  } catch (error) {
    console.error('Error en fetchFromSheet:', error);
    throw error;
  }
};

export { appendToSheet, fetchFromSheet };