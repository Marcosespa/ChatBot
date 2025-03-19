import path from 'path';
import { google } from 'googleapis';

const sheets = google.sheets('v4');
async function addRowToSheets(auth, spreadsheetId, values) {

  const request = {
    spreadsheetId,
    range: 'reservas',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [values],

    },
    auth,

  }
  try {
    const respose = await sheets.spreadsheets.values.append(request)
    return respose;
  } catch (error) {
    console.error(error)
  }
}


const appendToSheed = async (data) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'src', 'credentials', 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const spreadsheetId = '1kax_Mk_k62WJVOhVGamIDXf7_MmpHkohVYWAgZW0W1I'

    await addRowToSheets(authClient, spreadsheetId, data);
    return 'Exitoso'
  } catch (error) {
    console.error(error)
  }
}
export default appendToSheed;