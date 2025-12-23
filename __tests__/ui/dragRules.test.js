import { describe, it, expect } from "@jest/globals";
import {
  getEffectiveGoldCost,
  getValidDropTargets,
  canStartDrag,
} from "../../client/src/ui/drag/dragRules.js";

describe("dragRules", () => {
  describe("getEffectiveGoldCost", () => {
    it("returns 0 for cosmetic cards", () => {
      const cost = getEffectiveGoldCost({
        card: { id: "COSMO", type: "cosmetic", cost: 5 },
        goldCostModifiers: {},
      });
      expect(cost).toBe(0);
    });

    it("applies modifier and ceil with minimum 1 for standard cards", () => {
      const cost = getEffectiveGoldCost({
        card: { id: "SHAKE", type: "standard", cost: 3 },
        goldCostModifiers: { SHAKE: 1.5 },
      });
      // 3 * 1.5 = 4.5 -> ceil => 5
      expect(cost).toBe(5);
    });

    it("uses base cost when no modifier present", () => {
      const cost = getEffectiveGoldCost({
        card: { id: "BLUR", type: "standard", cost: 2 },
        goldCostModifiers: {},
      });
      expect(cost).toBe(2);
    });
  });

  describe("getValidDropTargets", () => {
    const teamIds = ["A", "B", "C"];

    it("returns only my team for self-target cards", () => {
      const result = getValidDropTargets({
        card: { id: "HEAL", target: "self" },
        myTeamId: "B",
        teamIds,
      });
      expect(result).toEqual(["B"]);
    });

    it("returns all opponents for opponent-target cards", () => {
      const result = getValidDropTargets({
        card: { id: "SHAKE", target: "opponent" },
        myTeamId: "B",
        teamIds,
      });
      expect(result.sort()).toEqual(["A", "C"].sort());
    });

    it("returns empty array when no teamIds provided", () => {
      const result = getValidDropTargets({
        card: { id: "SHAKE", target: "opponent" },
        myTeamId: "B",
        teamIds: null,
      });
      expect(result).toEqual([]);
    });
  });

  describe("canStartDrag", () => {
    const baseContext = {
      capabilities: { canCastCards: true },
      isOwned: true,
      isDisabled: false,
      effectiveGoldCost: 3,
      teamGold: 5,
      roundState: "ROUND_ACTIVE",
      matchOver: false,
    };
    const standardCard = { id: "SHAKE", type: "standard", cost: 3 };
    const cosmeticCard = { id: "COSMO", type: "cosmetic", cost: 0 };

    it("allows drag when all conditions satisfied for standard card", () => {
      const ok = canStartDrag({
        card: standardCard,
        ...baseContext,
      });
      expect(ok).toBe(true);
    });

    it("blocks when capabilities.canCastCards is false", () => {
      const ok = canStartDrag({
        card: standardCard,
        ...baseContext,
        capabilities: { canCastCards: false },
      });
      expect(ok).toBe(false);
    });

    it("blocks when card is disabled", () => {
      const ok = canStartDrag({
        card: standardCard,
        ...baseContext,
        isDisabled: true,
      });
      expect(ok).toBe(false);
    });

    it("blocks when card is not owned", () => {
      const ok = canStartDrag({
        card: standardCard,
        ...baseContext,
        isOwned: false,
      });
      expect(ok).toBe(false);
    });

    it("blocks when matchOver is true", () => {
      const ok = canStartDrag({
        card: standardCard,
        ...baseContext,
        matchOver: true,
      });
      expect(ok).toBe(false);
    });

    it("blocks when round state is not active", () => {
      const states = ["ROUND_WAITING", "ROUND_REVIEW", "ROUND_ENDED"];
      states.forEach((roundState) => {
        const ok = canStartDrag({
          card: standardCard,
          ...baseContext,
          roundState,
        });
        expect(ok).toBe(false);
      });
    });

    it("blocks when team gold is insufficient for standard card", () => {
      const ok = canStartDrag({
        card: standardCard,
        ...baseContext,
        teamGold: 2,
      });
      expect(ok).toBe(false);
    });

    it("allows drag for cosmetic cards even with zero gold", () => {
      const ok = canStartDrag({
        card: cosmeticCard,
        ...baseContext,
        effectiveGoldCost: 0,
        teamGold: 0,
      });
      expect(ok).toBe(true);
    });
  });
});


