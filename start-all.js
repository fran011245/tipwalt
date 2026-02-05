#!/usr/bin/env node
/**
 * Start both the Telegram bot and API server
 */

require('dotenv').config();

console.log('🚀 Starting $WALT Tipping System...\n');

// Start API server
console.log('📡 Starting API server...');
require('./api/server.js');

// Start Telegram bot
console.log('🤖 Starting Telegram bot...');
require('./bot/telegram-bot.js');

console.log('\n✅ All services started!');
console.log('   API: http://localhost:3001');
console.log('   Bot: @walt_tip_bot');
console.log('\nPress Ctrl+C to stop all services');
