#!/usr/bin/env node

require('dotenv').config();
const { startServer } = require('./server');
const logger = require('./utils/logger');

// Start the web server
logger.info('🚀 Starting TruckingConsole AI-powered permit parser...');
startServer();
