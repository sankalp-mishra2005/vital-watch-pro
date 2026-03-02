const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const logger = require('./config/logger');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:8080').split(',');

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join_patient', (patientId) => {
    socket.join(`patient_${patientId}`);
    logger.info(`Socket ${socket.id} joined patient_${patientId}`);
  });

  socket.on('join_admin', () => {
    socket.join('admin');
    logger.info(`Socket ${socket.id} joined admin room`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  logger.info(`VitalSync server running on port ${PORT}`);
});
