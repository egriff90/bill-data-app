import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { securityHeaders } from './middleware/security';

const app = express();
const PORT = process.env.PORT || 3001;

// Railway's proxy sits in front of the app; trust its X-Forwarded-For hop so req.ip is the
// client's address (the rate limits key on it). Override with TRUST_PROXY if the hop count differs.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1);
app.disable('x-powered-by');

// Middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// API routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/v1`);
});
