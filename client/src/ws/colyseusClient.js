import { Client } from "colyseus.js";

let client;

export function getClient() {
  if (!client) {
    client = new Client("http://localhost:3000");
  }
  return client;
}

export async function joinQuizRoom(role, token = null) {
  const currentClient = getClient();
  const options = { role };
  if (token) {
    options.token = token;
  }
  const room = await currentClient.joinOrCreate("quiz_room", options);
  return room;
}

export async function joinQuizRoomById(roomId, role, token = null) {
  const currentClient = getClient();
  const options = { role };
  if (token) {
    options.token = token;
  }
  const room = await currentClient.joinById(roomId, options);
  return room;
}

export async function joinLobbyRoom(role, token = null) {
  const currentClient = getClient();
  const options = { role };
  if (token) {
    options.token = token;
  }
  const room = await currentClient.joinOrCreate("lobby", options);
  return room;
}

export function castCard(room, cardId, targetTeamId) {
  room.send("castCard", { cardId, targetTeamId });
}

