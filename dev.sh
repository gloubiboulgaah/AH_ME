#!/bin/bash
# dev local : postgres en docker, back et front en node

cleanup() {
    echo ""
    echo "arret des processus..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# postgres
if ! docker compose ps db 2>/dev/null | grep -q healthy; then
    echo "demarrage de postgres..."
    docker compose up -d db
    sleep 3
fi

# backend
echo "backend (port 3000)..."
cd server
[ ! -d "node_modules" ] && npm install
npm start &
BACKEND_PID=$!
cd ..

sleep 2

# frontend vite
echo "frontend (port 8080)..."
cd client
[ ! -d "node_modules" ] && npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "pret :"
echo "  - front : http://localhost:8080"
echo "  - back  : http://localhost:3000"
echo ""
echo "Ctrl+C pour arreter"

wait
