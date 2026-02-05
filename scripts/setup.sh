#!/bin/bash

# Walt Tipping System - Quick Setup Script

echo "🚀 Setting up $WALT Tipping System..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📋 Creating .env from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your TELEGRAM_BOT_TOKEN"
    echo "   Get it from @BotFather on Telegram"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for database
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set in .env"
    echo "   Using default: postgresql://localhost:5432/walt_tips"
    echo "   Make sure PostgreSQL is running!"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the bot:"
echo "  npm start"
echo ""
echo "For development (auto-reload):"
echo "  npm run dev"
echo ""
echo "Bot commands:"
echo "  /start - Connect wallet"
echo "  /balance - Check balance"
echo "  /tip @user amount [message] - Send tip"
echo "  /history - View history"
echo "  /help - Show help"
