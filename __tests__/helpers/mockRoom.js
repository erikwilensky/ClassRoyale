// Mock QuizRoom for testing cardSystem and scoringSystem

export class MockRoom {
  constructor() {
    this.state = {
      teams: new Map(),
      gold: new Map(),
      activeEffects: new Map(),
      roundState: "ROUND_WAITING",
      questionText: "",
      timeRemaining: 0,
      timerEnabled: false
    };
    this.clients = [];
    this.scores = {
      teams: new Map(),
      perPlayer: new Map(),
      roundScores: new Map(),
      roundNumber: 0,
      matchOver: false,
      winner: null
    };
    this.answers = new Map();
    this.broadcastMessages = [];
    // Chapter 13: Add moderationState for moderation gate
    this.moderationState = {
      mutedPlayers: new Set(),
      frozenTeams: new Set(),
      roundFrozen: false
    };
  }

  broadcast(type, message) {
    this.broadcastMessages.push({ type, message });
  }

  clearBroadcasts() {
    this.broadcastMessages = [];
  }

  getLastBroadcast(type) {
    const broadcasts = this.broadcastMessages.filter(b => b.type === type);
    return broadcasts.length > 0 ? broadcasts[broadcasts.length - 1] : null;
  }

  getAllBroadcasts(type) {
    return this.broadcastMessages.filter(b => b.type === type);
  }

  broadcastGoldUpdate() {
    // Mock implementation - just broadcast to all clients
    this.broadcast("GOLD_UPDATE", {});
  }

  broadcastTeamUpdate() {
    // Mock implementation - just broadcast to all clients
    this.broadcast("TEAM_UPDATE", {});
  }

  send(client, type, message) {
    // Mock implementation for sending to specific client
    if (client && client.receiveMessage) {
      client.receiveMessage(type, message);
    }
  }
}

