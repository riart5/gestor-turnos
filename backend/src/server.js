import { createApp } from './app.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el .env (copia .env.example a .env)');
  process.exit(1);
}

const port = process.env.PORT ?? 3000;
createApp().listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
