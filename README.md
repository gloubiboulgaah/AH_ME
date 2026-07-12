<!-- @format -->

# AH_ME 🎮

Espace communautaire 3D isométrique multijoueur (inspiration Habbo). Projet Epitech W@C WebAcadémie 2025/2026.

## 📁 Structure

```
AH_ME/
├── client/                  # Frontend Next.js (React + Three.js)
│   ├── app/                 # pages (accueil, login, register, play)
│   ├── src/
│   │   ├── game/            # moteur three.js, client socket, interactions
│   │   ├── components/      # GameCanvas, ChatBox
│   │   └── lib/             # api auth, config
│   └── Dockerfile
│
├── server/                  # Backend Node.js (monolithe modulaire)
│   ├── src/
│   │   ├── index.js         # point d'entree, assemble les modules
│   │   ├── db/              # pool pg, schema, migration
│   │   └── modules/
│   │       ├── auth/        # register/login/logout, sessions
│   │       ├── world/       # positions joueurs, persistance
│   │       ├── chat/        # chat global, prives, emotes
│   │       └── api/         # routes REST (health)
│   └── Dockerfile
│
└── docker-compose.yml       # db (postgres) + backend + frontend
```

## 🏗️ Stack

- **Frontend** : Next.js (React) + Three.js (canvas monté dans un composant client, pas de R3F) + socket.io-client
- **Backend** : Node.js + Express + Socket.io — monolithe modulaire (`auth` / `world` / `chat` / `api`)
- **Base de données** : PostgreSQL (comptes, sessions, salons, positions)
- **Infra** : Docker Compose

## 🚀 Démarrage

### Avec Docker (tout-en-un)

```bash
docker compose up --build
```

- Frontend : http://localhost:8080
- Backend : http://localhost:3000 (health : `/health`)

### En développement local

```bash
./dev.sh
```

Ou à la main :

```bash
docker compose up -d db          # postgres
cd server && npm install && npm run dev
cd client && npm install && npx next dev -p 8080
```

Variables d'env : voir `.env.example`.

## 🎮 Fonctionnalités

- Rendu 3D isométrique (Three.js dans React)
- Déplacement clavier (WASD/flèches) + joystick tactile
- Multijoueur temps réel (Socket.io)
- Comptes : inscription / connexion (bcrypt + session cookie httpOnly)
- Position et couleur du joueur persistées en PostgreSQL (comptes)
- Chat global, messages privés (touche E), émotes
- Invités possibles sans compte (pseudo `Guest_xxx`, non persisté)

## 📡 Événements Socket.io

Client → serveur : `playerMove`, `chatMessage`, `privateMessage`, `emote`
Serveur → client : `init`, `currentPlayers`, `playerJoined`, `playerMoved`, `playerLeft`, `chatMessage`, `privateMessage`, `emote`

## 🔐 API Auth

- `POST /auth/register` — `{ username, email, password }`
- `POST /auth/login` — `{ email, password }`
- `POST /auth/logout`
- `GET /auth/me`

Le cookie de session (`sid`, httpOnly) est aussi lu à la connexion Socket.io : le pseudo en jeu est celui du compte.

## 📋 Suivi

Kanban, agenda et répartition des tâches : page Notion **AH_ME > Suivi & Tâches**.

La phase 3D voxel / textures est prévue en fin de projet.
