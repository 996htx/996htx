#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ⏱  TimeTrack - Starting up..."
echo "================================"

# Install backend deps
echo ""
echo "📦 Installing backend dependencies..."
cd "$ROOT/backend"
npm install --silent
npm rebuild better-sqlite3 --silent 2>/dev/null || true

# Install frontend deps
echo "📦 Installing frontend dependencies..."
cd "$ROOT/frontend"
npm install --silent

echo ""
echo "🚀 Starting backend on http://localhost:3001"
cd "$ROOT/backend"
node server.js &
BACKEND_PID=$!

sleep 1

echo "🎨 Starting frontend on http://localhost:5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "  ✅ TimeTrack is running!"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:3001"
echo ""
echo "  Press Ctrl+C to stop"
echo "================================"
echo ""

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM
wait
