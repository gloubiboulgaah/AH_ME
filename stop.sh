#!/bin/bash
# Script d'arrêt du projet

echo "🛑 Arrêt du jeu isométrique 3D..."

docker compose down

echo "✅ Conteneurs arrêtés."
echo ""
echo "💡 Pour supprimer aussi les volumes: docker compose down -v"
