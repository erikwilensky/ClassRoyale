// Mock client for testing

export class MockClient {
  constructor(metadata = {}) {
    this.sessionId = `session_${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      role: "student",
      playerId: `player_${Math.random().toString(36).substr(2, 9)}`,
      unlockedCards: [],
      isTeacher: false,
      isDisplay: false,
      ...metadata
    };
    this.sentMessages = [];
  }

  send(type, message) {
    this.sentMessages.push({ type, message });
  }

  getLastMessage(type) {
    const messages = this.sentMessages.filter(m => m.type === type);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  getAllMessages(type) {
    return this.sentMessages.filter(m => m.type === type);
  }

  clearMessages() {
    this.sentMessages = [];
  }

  receiveMessage(type, message) {
    // Alias for send - used when room sends to client
    this.send(type, message);
  }
}

