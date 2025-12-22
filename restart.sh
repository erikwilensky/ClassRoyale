#!/bin/bash

echo "🛑 Killing existing processes..."

# Kill processes using port 3000 (server)
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "   Killing process on port 3000..."
    kill $(lsof -ti:3000) 2>/dev/null || true
    sleep 1
fi

# Kill processes using port 5173 (client)
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "   Killing process on port 5173..."
    kill $(lsof -ti:5173) 2>/dev/null || true
    sleep 1
fi

# Kill any remaining node/vite processes related to our project
pkill -f "node.*server/index.js" 2>/dev/null || true
pkill -f "vite.*client" 2>/dev/null || true

# Wait for processes to fully terminate
sleep 2

echo "🧹 Clearing caches..."
cd client
rm -rf node_modules/.vite dist .vite 2>/dev/null || true
cd ..

# Check if user wants to see logs or run in background
if [ "$1" == "--background" ] || [ "$1" == "-b" ]; then
    echo "🚀 Starting server in background..."
    cd "$(dirname "$0")"
    npm start > /tmp/classroyale-server.log 2>&1 &
    SERVER_PID=$!
    echo "   Server PID: $SERVER_PID"
    echo "   Server logs: tail -f /tmp/classroyale-server.log"
    
    echo "⏳ Waiting for server..."
    sleep 2
    
    echo "🚀 Starting client in background..."
    cd client
    npm run dev > /tmp/classroyale-client.log 2>&1 &
    CLIENT_PID=$!
    echo "   Client PID: $CLIENT_PID"
    echo "   Client logs: tail -f /tmp/classroyale-client.log"
    
    echo "⏳ Waiting for client..."
    sleep 3
    
    echo ""
    echo "✅ Servers started in background!"
    echo "   Server PID: $SERVER_PID"
    echo "   Client PID: $CLIENT_PID"
    echo ""
    echo "To view logs:"
    echo "   Server: tail -f /tmp/classroyale-server.log"
    echo "   Client: tail -f /tmp/classroyale-client.log"
    echo ""
    echo "To stop: kill $SERVER_PID $CLIENT_PID"
    echo "Or: kill \$(lsof -ti:3000) \$(lsof -ti:5173)"
else
    echo "🚀 Starting server (logs visible)..."
    cd "$(dirname "$0")"
    
    # Start server in background but don't redirect output
    npm start &
    SERVER_PID=$!
    echo "   Server PID: $SERVER_PID"
    
    echo "⏳ Waiting for server to start..."
    sleep 3
    
    echo "🚀 Starting client (logs visible)..."
    cd client
    
    # Start client in background but don't redirect output
    npm run dev &
    CLIENT_PID=$!
    echo "   Client PID: $CLIENT_PID"
    
    echo ""
    echo "✅ Servers started! Logs are visible in this terminal."
    echo "   Server PID: $SERVER_PID"
    echo "   Client PID: $CLIENT_PID"
    echo ""
    echo "Press Ctrl+C to stop both servers"
    echo ""
    echo "To run in background instead, use: ./restart.sh --background"
    echo ""
    
    # Wait for user interrupt
    trap "echo ''; echo '🛑 Stopping servers...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
    wait
fi
