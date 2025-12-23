// Test data fixtures

export const TEST_CARDS = {
  SHAKE: {
    id: "SHAKE",
    name: "Shake",
    unlockCost: 100,
    type: "standard",
    cost: 3,
    target: "opponent",
    effect: "Disrupts opponent's writing with screen shake effect",
    description: "Shake your opponent's screen to disrupt their focus"
  },
  BLUR: {
    id: "BLUR",
    name: "Blur",
    unlockCost: 80,
    type: "standard",
    cost: 2,
    target: "opponent",
    effect: "Blurs opponent's screen temporarily",
    description: "Blur your opponent's vision to slow them down"
  },
  GOLD_RUSH: {
    id: "GOLD_RUSH",
    name: "Gold Rush",
    unlockCost: 250,
    type: "standard",
    cost: 0,
    target: "self",
    effect: "+1 gold immediately",
    description: "Quick gold boost for your team"
  },
  WRITER_SPOTLIGHT: {
    id: "WRITER_SPOTLIGHT",
    name: "Writer Spotlight",
    unlockCost: 40,
    type: "cosmetic",
    cost: 0,
    target: "self",
    effect: "Coliseum-style spotlight ring around writer",
    description: "Make your writer shine!"
  }
};

export const TEST_TEAMS = {
  TEAM_A: {
    teamId: "A",
    name: "Team Alpha",
    writer: "session_writer_a",
    writerPlayerId: "player_writer_a",
    suggesters: ["session_suggester_a1", "session_suggester_a2"],
    answer: "",
    locked: false,
    gold: 5,
    suggestions: []
  },
  TEAM_B: {
    teamId: "B",
    name: "Team Beta",
    writer: "session_writer_b",
    writerPlayerId: "player_writer_b",
    suggesters: ["session_suggester_b1"],
    answer: "Test answer",
    locked: true,
    gold: 3,
    suggestions: []
  }
};

export const TEST_PLAYERS = {
  PLAYER_1: {
    playerId: "player_1",
    displayName: "Test Player 1",
    unlockedCards: ["SHAKE", "BLUR"]
  },
  PLAYER_2: {
    playerId: "player_2",
    displayName: "Test Player 2",
    unlockedCards: ["SHAKE", "GOLD_RUSH", "WRITER_SPOTLIGHT"]
  },
  TEACHER: {
    playerId: "teacher_1",
    displayName: "Test Teacher",
    isTeacher: true,
    unlockedCards: []
  }
};


