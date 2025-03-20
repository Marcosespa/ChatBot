// import express from 'express';
// import config from './config/env.js';
// import webhookRoutes from './routes/webhookRoutes.js';
// import 'dotenv/config';

// const app = express();
// app.use(express.json());

// app.use('/', webhookRoutes);

// app.get('/', (req, res) => {
//   res.send(`<pre>Nothing to see here.
// Checkout README.md to start.</pre>`);
// });

// app.listen(config.PORT, () => {
//   console.log(`Server is listening on port:  ${config.PORT}`);
// });

import express from 'express';
import config from './config/env.js';
import webhookRoutes from './routes/webhookRoutes.js';
import 'dotenv/config';

const app = express();
app.use(express.json());

// Cargar rutas del webhook
app.use('/', webhookRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

// Ruta de prueba para verificar servicios
app.get('/test', async (req, res) => {
  try {
    // Aquí puedes probar servicios como WhatsApp o Google Sheets manualmente
    res.json({ success: true, message: 'Server is running', config });
  } catch (error) {
    console.error('Error in /test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar el servidor
app.listen(config.PORT, () => {
  console.log(`Server is listening on port: ${config.PORT}`);
  console.log('Environment config loaded:', config);
});