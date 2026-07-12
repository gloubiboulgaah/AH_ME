#!/bin/bash
# Script de démarrage rapide du projet

echo "🚀 Démarrage du jeu isométrique 3D..."

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installez Docker avant de continuer."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Installez Docker Compose avant de continuer."
    exit 1
fi

# Créer .env si n'existe pas
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env..."
    cp .env.example .env
fi

# Build et démarrage
echo "🔨 Build des images Docker..."
docker compose build

echo "▶️  Démarrage des conteneurs..."
docker compose up -d

echo ""
echo "✅ Projet démarré avec succès!"
echo ""
echo "📍 Accès:"
echo "   - Frontend: http://localhost:8080"
echo "   - Backend:  http://localhost:3000"
echo "   - Health:   http://localhost:3000/health"
echo ""
echo "📊 Voir les logs: docker compose logs -f"
echo "🛑 Arrêter:      docker compose down"
echo ""
