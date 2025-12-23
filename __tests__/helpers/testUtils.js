// Test utility functions

/**
 * Wait for a condition to be true
 */
export function waitFor(condition, timeout = 1000, interval = 50) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
}

/**
 * Create a mock team state
 */
export function createMockTeam(teamId, overrides = {}) {
  return {
    teamId,
    name: `Team ${teamId}`,
    writer: `session_writer_${teamId}`,
    writerPlayerId: `player_writer_${teamId}`,
    suggesters: [],
    answer: "",
    locked: false,
    gold: 5,
    suggestions: [],
    ...overrides
  };
}

/**
 * Create a mock player client
 */
export function createMockPlayerClient(playerId, overrides = {}) {
  return {
    sessionId: `session_${playerId}`,
    metadata: {
      role: 'student',
      playerId,
      unlockedCards: [],
      isTeacher: false,
      isDisplay: false,
      ...overrides.metadata
    },
    ...overrides
  };
}

/**
 * Setup a complete match scenario
 */
export function setupMatchScenario(room) {
  const teamA = createMockTeam('A', {
    writer: 'session_writer_a',
    writerPlayerId: 'player_writer_a',
    gold: 5
  });
  const teamB = createMockTeam('B', {
    writer: 'session_writer_b',
    writerPlayerId: 'player_writer_b',
    gold: 5
  });
  
  room.state.teams.set('A', teamA);
  room.state.teams.set('B', teamB);
  room.state.gold.set('A', 5);
  room.state.gold.set('B', 5);
  
  const clientA = createMockPlayerClient('player_writer_a');
  const clientB = createMockPlayerClient('player_writer_b');
  room.clients.push(clientA, clientB);
  
  return { teamA, teamB, clientA, clientB };
}

/**
 * Assert broadcast was sent
 */
export function expectBroadcast(room, type, matcher = () => true) {
  const broadcasts = room.getAllBroadcasts(type);
  expect(broadcasts.length).toBeGreaterThan(0);
  const matching = broadcasts.filter(b => matcher(b.message));
  expect(matching.length).toBeGreaterThan(0);
  return matching[0];
}

/**
 * Assert message was sent to client
 */
export function expectClientMessage(client, type, matcher = () => true) {
  const messages = client.getAllMessages(type);
  expect(messages.length).toBeGreaterThan(0);
  const matching = messages.filter(m => matcher(m.message));
  expect(matching.length).toBeGreaterThan(0);
  return matching[0];
}


