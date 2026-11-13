const express = require('express');
const router = express.Router();
const { getDBStatus } = require('../config/db');

/**
 * GET /api/health
 * Production health & telemetry endpoint
 */
router.get('/', (req, res) => {
  const dbStatus = getDBStatus();
  const uptime = process.uptime();
  const mem = process.memoryUsage();

  const io = req.app.get('io');
  const connectedSockets = io ? io.engine?.clientsCount || 0 : 0;

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime)}s`,
    uptimeSeconds: Math.floor(uptime),
    service: 'ConnectSphere Real-Time API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbStatus.isConnected,
      readyState: dbStatus.readyState,
      host: dbStatus.host || 'local/configured'
    },
    sockets: {
      activeConnections: connectedSockets
    },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024)
    }
  });
});

/**
 * GET /api/health/live
 * Kubernetes / Container Liveness Probe
 * Verifies that the Node.js process event loop is active and accepting requests.
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

/**
 * GET /api/health/ready
 * Kubernetes / Container Readiness Probe
 * Verifies that the service and dependent database connections are ready to accept traffic.
 */
router.get('/ready', (req, res) => {
  const dbStatus = getDBStatus();
  const isReady = dbStatus.isConnected || dbStatus.readyState === 1 || process.env.NODE_ENV === 'test';

  if (isReady) {
    return res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      databaseReady: true
    });
  }

  return res.status(503).json({
    status: 'not_ready',
    timestamp: new Date().toISOString(),
    databaseReady: false,
    reason: 'Database connection not initialized'
  });
});

module.exports = router;
