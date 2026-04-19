require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const chatRoutes = require('./routes/chat');
const toolRoutes = require('./routes/tools');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/chat', chatRoutes);
app.use('/tools', toolRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    aiProvider: config.activeProvider,
    availableProviders: config.getAvailableProviders()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB, load tools, and start server
const toolRegistry = require('./services/toolRegistry');

async function start() {
  try {
    // Load tools on startup
    await toolRegistry.loadTools();
    console.log(`Tools loaded: ${toolRegistry.list().join(', ')}`);

    // Connect to MongoDB using config
    // Strip unsupported query params from URI — mongoose 8.x driver handles these via options
    const rawUri = config.mongodb.uri;
    const uriObj = new URL(rawUri);
    const dbName = uriObj.pathname.replace(/^\//, ''); // remove leading /
    const cleanUri = `${uriObj.protocol}//${uriObj.host}${uriObj.pathname}`;
    
    await mongoose.connect(cleanUri, {
      dbName: dbName || undefined,
      retryWrites: true,
      w: 'majority'
    });
    console.log('Connected to MongoDB');

    // Start server — respect PORT env var (Render sets this) or config
    const PORT = process.env.PORT || config.server.port;
    app.listen(PORT, () => {
      console.log(`Dora API running on port ${PORT}`);
      console.log(`AI Provider: ${config.activeProvider}`);
      console.log(`Available: ${config.getAvailableProviders().join(', ')}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
