/**
 * Tests for role-specific message handler configuration.
 */

import { describe, it, expect } from "@jest/globals";
import { getRoleMessageTypes } from "../../client/src/quiz/roleHandlers.js";
import { MSG } from "../../client/src/quiz/messageTypes.js";

describe("roleHandlers", () => {
  describe("getRoleMessageTypes", () => {
    it("returns an array of message type strings", () => {
      const messages = getRoleMessageTypes("teacher");
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      messages.forEach(msg => {
        expect(typeof msg).toBe("string");
      });
    });

    describe("display role", () => {
      it("includes required core messages", () => {
        const messages = getRoleMessageTypes("display");
        expect(messages).toContain(MSG.ROUND_STATE_UPDATE);
        expect(messages).toContain(MSG.QUESTION_UPDATE);
        expect(messages).toContain(MSG.TIMER_UPDATE);
        expect(messages).toContain(MSG.TEAM_UPDATE);
        expect(messages).toContain(MSG.GOLD_UPDATE);
      });

      it("includes moderation and card messages", () => {
        const messages = getRoleMessageTypes("display");
        expect(messages).toContain(MSG.MODERATION_UPDATE);
        expect(messages).toContain(MSG.CARD_RULES_UPDATE);
        expect(messages).toContain(MSG.CARD_CAST);
      });

      it("includes scoring messages", () => {
        const messages = getRoleMessageTypes("display");
        expect(messages).toContain(MSG.MATCH_OVER);
        expect(messages).toContain(MSG.ROUND_SCORE);
        expect(messages).toContain(MSG.MATCH_RESET);
      });

      it("includes system messages", () => {
        const messages = getRoleMessageTypes("display");
        expect(messages).toContain(MSG.ROOM_ID);
        expect(messages).toContain(MSG.ERROR);
      });

      it("does not include student-specific messages", () => {
        const messages = getRoleMessageTypes("display");
        expect(messages).not.toContain(MSG.SUGGESTION);
        expect(messages).not.toContain(MSG.XP_EARNED);
      });
    });

    describe("teacher role", () => {
      it("includes all display messages", () => {
        const teacherMessages = getRoleMessageTypes("teacher");
        const displayMessages = getRoleMessageTypes("display");
        
        displayMessages.forEach(msg => {
          expect(teacherMessages).toContain(msg);
        });
      });

      it("includes teacher-specific messages", () => {
        const messages = getRoleMessageTypes("teacher");
        expect(messages).toContain(MSG.ROOM_ID);
        expect(messages).toContain(MSG.ERROR);
      });

      it("includes team assembly messages", () => {
        const messages = getRoleMessageTypes("teacher");
        expect(messages).toContain(MSG.TEAM_JOINED);
        expect(messages).toContain(MSG.AVAILABLE_TEAMS);
      });
    });

    describe("student role", () => {
      it("includes core messages", () => {
        const messages = getRoleMessageTypes("student");
        expect(messages).toContain(MSG.ROUND_STATE_UPDATE);
        expect(messages).toContain(MSG.QUESTION_UPDATE);
        expect(messages).toContain(MSG.TIMER_UPDATE);
        expect(messages).toContain(MSG.TEAM_UPDATE);
        expect(messages).toContain(MSG.GOLD_UPDATE);
      });

      it("includes student-specific messages", () => {
        const messages = getRoleMessageTypes("student");
        expect(messages).toContain(MSG.SUGGESTION);
        expect(messages).toContain(MSG.XP_EARNED);
        expect(messages).toContain(MSG.ROUND_DATA);
      });

      it("includes team assembly messages", () => {
        const messages = getRoleMessageTypes("student");
        expect(messages).toContain(MSG.TEAM_JOINED);
        expect(messages).toContain(MSG.AVAILABLE_TEAMS);
      });

      it("does not include ROOM_ID", () => {
        const messages = getRoleMessageTypes("student");
        expect(messages).not.toContain(MSG.ROOM_ID);
      });
    });

    describe("all roles", () => {
      it("all roles include ERROR", () => {
        const roles = ["teacher", "student", "display"];
        roles.forEach(role => {
          const messages = getRoleMessageTypes(role);
          expect(messages).toContain(MSG.ERROR);
        });
      });

      it("all roles include core sync events", () => {
        const roles = ["teacher", "student", "display"];
        const coreMessages = [
          MSG.ROUND_STATE_UPDATE,
          MSG.QUESTION_UPDATE,
          MSG.TIMER_UPDATE,
          MSG.TEAM_UPDATE,
          MSG.GOLD_UPDATE
        ];
        
        roles.forEach(role => {
          const messages = getRoleMessageTypes(role);
          coreMessages.forEach(coreMsg => {
            expect(messages).toContain(coreMsg);
          });
        });
      });
    });
  });
});

