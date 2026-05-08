import { createServer } from 'http';
import app from './app.js';

const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { app };
