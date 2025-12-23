/**
 * Tests for moderation gate functions.
 * Pure unit tests - no Colyseus mocking needed.
 */

import { describe, it, expect } from "@jest/globals";
import { isPlayerMuted, isTeamFrozen, isRoundFrozen, canPerformAction } from "../../server/systems/moderationGate.js";

describe("moderationGate", () => {
  // Mock room object
  function createMockRoom(moderationState) {
    return {
      moderationState: {
        mutedPlayers: new Set(moderationState?.mutedPlayers || []),
        frozenTeams: new Set(moderationState?.frozenTeams || []),
        roundFrozen: moderationState?.roundFrozen || false
      }
    };
  }

  describe("isPlayerMuted", () => {
    it("returns true when player is muted", () => {
      const room = createMockRoom({ mutedPlayers: ["player1", "player2"] });
      expect(isPlayerMuted(room, "player1")).toBe(true);
      expect(isPlayerMuted(room, "player2")).toBe(true);
    });

    it("returns false when player is not muted", () => {
      const room = createMockRoom({ mutedPlayers: ["player1"] });
      expect(isPlayerMuted(room, "player2")).toBe(false);
    });

    it("returns false when no muted players", () => {
      const room = createMockRoom({ mutedPlayers: [] });
      expect(isPlayerMuted(room, "player1")).toBe(false);
    });

    it("returns false when room is null", () => {
      expect(isPlayerMuted(null, "player1")).toBe(false);
    });

    it("returns false when playerId is null", () => {
      const room = createMockRoom({ mutedPlayers: ["player1"] });
      expect(isPlayerMuted(room, null)).toBe(false);
    });
  });

  describe("isTeamFrozen", () => {
    it("returns true when team is frozen", () => {
      const room = createMockRoom({ frozenTeams: ["A", "B"] });
      expect(isTeamFrozen(room, "A")).toBe(true);
      expect(isTeamFrozen(room, "B")).toBe(true);
    });

    it("returns false when team is not frozen", () => {
      const room = createMockRoom({ frozenTeams: ["A"] });
      expect(isTeamFrozen(room, "B")).toBe(false);
    });

    it("returns false when no frozen teams", () => {
      const room = createMockRoom({ frozenTeams: [] });
      expect(isTeamFrozen(room, "A")).toBe(false);
    });

    it("returns false when room is null", () => {
      expect(isTeamFrozen(null, "A")).toBe(false);
    });

    it("returns false when teamId is null", () => {
      const room = createMockRoom({ frozenTeams: ["A"] });
      expect(isTeamFrozen(room, null)).toBe(false);
    });
  });

  describe("isRoundFrozen", () => {
    it("returns true when round is frozen", () => {
      const room = createMockRoom({ roundFrozen: true });
      expect(isRoundFrozen(room)).toBe(true);
    });

    it("returns false when round is not frozen", () => {
      const room = createMockRoom({ roundFrozen: false });
      expect(isRoundFrozen(room)).toBe(false);
    });

    it("returns false when room is null", () => {
      expect(isRoundFrozen(null)).toBe(false);
    });
  });

  describe("canPerformAction", () => {
    describe("muted player blocking", () => {
      it("blocks suggestion from muted player", () => {
        const room = createMockRoom({ mutedPlayers: ["player1"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "suggestion"
        });
        expect(result.ok).toBe(false);
      });

      it("blocks insertSuggestion from muted player", () => {
        const room = createMockRoom({ mutedPlayers: ["player1"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "insertSuggestion"
        });
        expect(result.ok).toBe(false);
      });

      it("blocks updateAnswer from muted player", () => {
        const room = createMockRoom({ mutedPlayers: ["player1"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "updateAnswer"
        });
        expect(result.ok).toBe(false);
      });

      it("blocks lockAnswer from muted player", () => {
        const room = createMockRoom({ mutedPlayers: ["player1"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "lockAnswer"
        });
        expect(result.ok).toBe(false);
      });

      it("blocks castCard from muted player", () => {
        const room = createMockRoom({ mutedPlayers: ["player1"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "castCard"
        });
        expect(result.ok).toBe(false);
      });

      it("allows action from unmuted player", () => {
        const room = createMockRoom({ mutedPlayers: ["player2"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "suggestion"
        });
        expect(result.ok).toBe(true);
      });
    });

    describe("frozen team blocking", () => {
      it("blocks updateAnswer from frozen team", () => {
        const room = createMockRoom({ frozenTeams: ["A"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "updateAnswer"
        });
        expect(result.ok).toBe(false);
      });

      it("blocks lockAnswer from frozen team", () => {
        const room = createMockRoom({ frozenTeams: ["A"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "lockAnswer"
        });
        expect(result.ok).toBe(false);
      });

      it("blocks castCard from frozen team", () => {
        const room = createMockRoom({ frozenTeams: ["A"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "castCard"
        });
        expect(result.ok).toBe(false);
      });

      it("allows suggestion from frozen team (team freeze doesn't block suggestions)", () => {
        const room = createMockRoom({ frozenTeams: ["A"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "suggestion"
        });
        expect(result.ok).toBe(true);
      });

      it("allows action from unfrozen team", () => {
        const room = createMockRoom({ frozenTeams: ["B"] });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "updateAnswer"
        });
        expect(result.ok).toBe(true);
      });
    });

    describe("round frozen blocking", () => {
      it("blocks all actions when round is frozen", () => {
        const room = createMockRoom({ roundFrozen: true });
        const actions = ["suggestion", "insertSuggestion", "updateAnswer", "lockAnswer", "castCard"];
        
        actions.forEach(action => {
          const result = canPerformAction(room, {
            playerId: "player1",
            teamId: "A",
            action
          });
          expect(result.ok).toBe(false);
        });
      });

      it("allows actions when round is not frozen", () => {
        const room = createMockRoom({ roundFrozen: false });
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: "updateAnswer"
        });
        expect(result.ok).toBe(true);
      });
    });

    describe("unmuted + unfrozen + active", () => {
      it("allows all actions when player is unmuted, team is unfrozen, and round is active", () => {
        const room = createMockRoom({
          mutedPlayers: [],
          frozenTeams: [],
          roundFrozen: false
        });
        
        const actions = ["suggestion", "insertSuggestion", "updateAnswer", "lockAnswer", "castCard"];
        
        actions.forEach(action => {
          const result = canPerformAction(room, {
            playerId: "player1",
            teamId: "A",
            action
          });
          expect(result.ok).toBe(true);
        });
      });
    });

    describe("edge cases", () => {
      it("returns false when room is null", () => {
        const result = canPerformAction(null, {
          playerId: "player1",
          teamId: "A",
          action: "updateAnswer"
        });
        expect(result.ok).toBe(false);
      });

      it("returns false when action is null", () => {
        const room = createMockRoom({});
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: "A",
          action: null
        });
        expect(result.ok).toBe(false);
      });

      it("returns false when teamId is missing for team-scoped actions", () => {
        const room = createMockRoom({});
        const result = canPerformAction(room, {
          playerId: "player1",
          teamId: null,
          action: "updateAnswer"
        });
        expect(result.ok).toBe(false);
      });
    });
  });
});

