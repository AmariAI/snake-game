# Snake Clash

A browser snake arena with an optional real-time multiplayer mode backed by a Node.js WebSocket server.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Open `http://localhost:3000`. Press **Play multiplayer**, leave the room code blank to create a room, or enter an existing six-character room code to join it. Share that code with other players.

## Deploy a persistent multiplayer server

This repository includes `render.yaml` for Render deployment. Create a Web Service from this repository and use the included configuration. Choose an always-on plan if you want rooms available without the server sleeping. The service serves the game and accepts WebSocket connections at the same origin.

If the game remains hosted on GitHub Pages, enter the deployed server's `wss://...` URL in the multiplayer dialog. GitHub Pages cannot host the Node.js server itself.

Rooms are in-memory and last while at least one player remains connected; a server restart clears active matches. The game has no account system or database persistence. Rooms allow up to 12 connected players.
