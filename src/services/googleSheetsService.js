import path from 'path';
import { google } from 'googleapis';

const sheets = google.sheets('v4');

// Función para agregar datos a una hoja específica
async function addRowToSheets(auth, spreadsheetId, values, sheetName) {
  const request = {
    spreadsheetId,
    range: `${sheetName}!A:Z`, // Ajusta el rango según las columnas necesarias (A:Z cubre hasta 26 columnas)
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
    throw error; // Lanza el error para que sea manejado por el llamador
  }
}

// Función exportada que acepta datos y el nombre de la hoja
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
    throw error; // Propaga el error para manejarlo en MessageHandler.js si es necesario
  }
};

export default appendToSheet;