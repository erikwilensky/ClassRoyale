// Chapter 11.5: Scoring System Module
// Handles scoring, XP, and match win conditions

import { MATCH_SETTINGS } from "../config/scoring.js";
import { flushXP } from "../services/xpService.js";

/**
 * ScoringSystem - Manages scoring, XP, and match win conditions
 */
export class ScoringSystem {
    constructor(room) {
        this.room = room; // Reference to QuizRoom instance
        this.xpCache = new Map(); // Map<playerId, {totalXP: number, reasons: string[]}>
        
        // Scoring state (stored on room, but managed by this system)
        // Access via this.room.scores
    }

    /**
     * Initialize scoring state (called from QuizRoom.onCreate)
     */
    initializeScores() {
        this.room.scores = {
            teams: new Map(),  // teamId -> roundPoints (match score, not evaluation score)
            perPlayer: new Map(),  // playerId -> { roundScores: [], totalEvaluationScore: 0 }
            roundScores: new Map(),  // roundNumber -> { teamId: evaluationScore }
            roundNumber: 0,
            matchOver: false,
            winner: null  // teamId of winner
        };
    }

    /**
     * Add XP to cache (will be flushed later)
     */
    addXPToCache(playerId, amount, reason) {
        if (!playerId || amount <= 0) return;

        if (!this.xpCache.has(playerId)) {
            this.xpCache.set(playerId, { totalXP: 0, reasons: [] });
        }

        const cache = this.xpCache.get(playerId);
        cache.totalXP += amount;
        cache.reasons.push(reason);
    }

    /**
     * Flush all cached XP to database and notify clients
     */
    flushAllXP() {
        for (const [playerId, cache] of this.xpCache.entries()) {
            if (cache.totalXP <= 0) continue;

            const result = flushXP(playerId, cache);

            if (result) {
                // Find client(s) for this player (exclude display clients)
                const playerClients = this.room.clients.filter(c => 
                    c.metadata && 
                    c.metadata.playerId === playerId &&
                    !c.metadata.isDisplay
                );

                playerClients.forEach(client => {
                    client.send("XP_EARNED", {
                        amount: cache.totalXP,
                        newXP: result.newXP,
                        newLevel: result.newLevel,
                        unlockedCards: result.unlockedCards || []
                    });
                });
            }

            // Clear cache
            this.xpCache.delete(playerId);
        }
    }

    /**
     * Collect answers from all teams at round end
     */
    collectAnswers() {
        this.room.answers.set(this.room.scores.roundNumber, new Map());
        const roundAnswers = this.room.answers.get(this.room.scores.roundNumber);
        
        console.log(`[ScoringSystem] Collecting answers from ${this.room.state.teams.size} teams`);
        for (const [teamId, team] of this.room.state.teams.entries()) {
            const writerClient = this.room.clients.find(c => c.sessionId === team.writer);
            const writerId = writerClient?.metadata?.playerId || null;
            const suggesterIds = team.suggesters.map(sId => {
                const suggesterClient = this.room.clients.find(c => c.sessionId === sId);
                return suggesterClient?.metadata?.playerId || null;
            }).filter(Boolean);
            
            console.log(`[ScoringSystem] Team ${teamId}: answer="${team.answer}", length=${team.answer?.length || 0}, locked=${team.locked}, writer=${team.writer}, writerId=${writerId}`);
            
            roundAnswers.set(teamId, {
                text: team.answer || "",
                writerId,
                suggesterIds
            });
        }
        
        console.log(`[ScoringSystem] Collected ${roundAnswers.size} answers`);
        return roundAnswers;
    }

    /**
     * Award participation XP to all active players
     */
    awardParticipationXP() {
        const activePlayerIds = new Set();
        this.room.clients.forEach(client => {
            if (client.metadata && client.metadata.playerId && !client.metadata.isTeacher) {
                activePlayerIds.add(client.metadata.playerId);
                this.addXPToCache(client.metadata.playerId, 5, "onRoundEnd");
            }
        });
    }

    /**
     * Determine round winner from evaluation scores
     */
    determineRoundWinner(evaluationScores) {
        let winner = null;
        let maxScore = -1;
        
        for (const [teamId, score] of evaluationScores.entries()) {
            if (score > maxScore) {
                maxScore = score;
                winner = teamId;
            }
        }
        
        return winner;
    }

    /**
     * Check if match win condition is met
     */
    checkMatchWinCondition() {
        const roundsToWin = MATCH_SETTINGS.roundsToWin;
        const maxRounds = MATCH_SETTINGS.maxRounds;
        
        console.log(`[ScoringSystem] checkMatchWinCondition: roundsToWin=${roundsToWin}, maxRounds=${maxRounds}, roundNumber=${this.room.scores.roundNumber}`);
        const allTeamPoints = Array.from(this.room.scores.teams.entries()).map(([tid, pts]) => `${tid}: ${pts}`).join(', ');
        console.log(`[ScoringSystem] checkMatchWinCondition: Team round points: ${allTeamPoints}`);
        
        // Check if max rounds reached
        if (maxRounds !== null && this.room.scores.roundNumber >= maxRounds) {
            // Determine winner by round points at max rounds
            let winnerTeamId = null;
            let maxPoints = -1;
            for (const [teamId, roundPoints] of this.room.scores.teams.entries()) {
                if (roundPoints > maxPoints) {
                    maxPoints = roundPoints;
                    winnerTeamId = teamId;
                }
            }
            this.room.scores.matchOver = true;
            this.room.scores.winner = winnerTeamId;
            console.log(`[ScoringSystem] Match over! Max rounds (${maxRounds}) reached. Winner: ${winnerTeamId} with ${maxPoints} round points`);
            return true;
        }
        
        // Check if any team reached roundsToWin
        for (const [teamId, roundPoints] of this.room.scores.teams.entries()) {
            console.log(`[ScoringSystem] Checking team ${teamId}: ${roundPoints} >= ${roundsToWin}? ${roundPoints >= roundsToWin}`);
            if (roundPoints >= roundsToWin) {
                this.room.scores.matchOver = true;
                this.room.scores.winner = teamId;
                console.log(`[ScoringSystem] Match over! Winner: ${teamId} with ${roundPoints} round points (reached ${roundsToWin})`);
                return true;
            }
        }
        
        console.log(`[ScoringSystem] Match continues - no team has reached ${roundsToWin} round points yet`);
        return false;
    }

    /**
     * Award scoring XP (round winner, match winner, MVP)
     */
    awardScoringXP(roundWinner, matchWon) {
        // Round winner team: +3 XP per player
        if (roundWinner) {
            const roundAnswers = this.room.answers.get(this.room.scores.roundNumber);
            if (roundAnswers) {
                const winnerAnswer = roundAnswers.get(roundWinner);
                if (winnerAnswer && winnerAnswer.writerId) {
                    this.addXPToCache(winnerAnswer.writerId, 3, "roundWinner");
                }
                // Award to suggesters too
                if (winnerAnswer && winnerAnswer.suggesterIds) {
                    winnerAnswer.suggesterIds.forEach(playerId => {
                        this.addXPToCache(playerId, 3, "roundWinner");
                    });
                }
            }
        }

        // Match MVP and match winning team bonuses only on match end
        if (matchWon && this.room.scores.winner) {
            // Match MVP (highest totalEvaluationScore): +10 XP
            let mvp = null;
            let maxScore = -1;
            for (const [playerId, data] of this.room.scores.perPlayer.entries()) {
                if (data.totalEvaluationScore > maxScore) {
                    maxScore = data.totalEvaluationScore;
                    mvp = playerId;
                }
            }
            if (mvp) {
                this.addXPToCache(mvp, 10, "matchMVP");
            }

            // Match winning team: +20 XP per player
            const winnerAnswer = this.room.answers.get(this.room.scores.roundNumber)?.get(this.room.scores.winner);
            if (winnerAnswer) {
                if (winnerAnswer.writerId) {
                    this.addXPToCache(winnerAnswer.writerId, 20, "matchWinner");
                }
                if (winnerAnswer.suggesterIds) {
                    winnerAnswer.suggesterIds.forEach(playerId => {
                        this.addXPToCache(playerId, 20, "matchWinner");
                    });
                }
            }
        }
    }

    /**
     * Submit round scores (called from REST API)
     */
    submitRoundScores(round, scores) {
        console.log(`[ScoringSystem] submitRoundScores called for round ${round} with scores:`, scores);
        console.log(`[ScoringSystem] Current roundNumber: ${this.room.scores.roundNumber}`);
        
        // Validate round exists
        const roundAnswers = this.room.answers.get(round);
        if (!roundAnswers) {
            console.error(`[ScoringSystem] Round ${round} not found in answers. Available rounds:`, Array.from(this.room.answers.keys()));
            return { success: false, error: "Round not found" };
        }

        // Validate match not over
        if (this.room.scores.matchOver) {
            return { success: false, error: "Cannot submit scores after match has ended" };
        }

        // Validate all teams in round have scores
        const teamIds = Array.from(roundAnswers.keys());
        for (const teamId of teamIds) {
            if (scores[teamId] === undefined || scores[teamId] === null) {
                return { success: false, error: `Missing score for team ${teamId}` };
            }
            if (typeof scores[teamId] !== 'number' || scores[teamId] < 0 || scores[teamId] > 10) {
                return { success: false, error: `Invalid score for team ${teamId}. Must be 0-10` };
            }
        }

        // Store round scores
        this.room.scores.roundScores.set(round, scores);

        // Assign evaluation scores to writers (100% to writer)
        const evaluationScores = new Map(); // teamId -> evaluationScore
        for (const [teamId, score] of Object.entries(scores)) {
            evaluationScores.set(teamId, score);
            const answerData = roundAnswers.get(teamId);
            if (answerData && answerData.writerId) {
                const writerId = answerData.writerId;
                if (!this.room.scores.perPlayer.has(writerId)) {
                    this.room.scores.perPlayer.set(writerId, { roundScores: [], totalEvaluationScore: 0 });
                }
                const playerData = this.room.scores.perPlayer.get(writerId);
                const oldScore = playerData.roundScores[round - 1] || 0;
                playerData.roundScores[round - 1] = score;
                // Only add the difference to total (in case of override)
                playerData.totalEvaluationScore = playerData.totalEvaluationScore - oldScore + score;
                console.log(`[ScoringSystem] Round ${round}, Team ${teamId}, Writer ${writerId}: Score ${score}, Total Eval: ${playerData.totalEvaluationScore}`);
            }
        }

        // Determine round winner (team with highest evaluation score)
        const roundWinner = this.determineRoundWinner(evaluationScores);

        // Award round point (+1) to winning team
        if (roundWinner) {
            const currentPoints = this.room.scores.teams.get(roundWinner) || 0;
            const newPoints = currentPoints + 1;
            this.room.scores.teams.set(roundWinner, newPoints);
            console.log(`[ScoringSystem] Round ${round} winner: ${roundWinner}. Round points: ${currentPoints} -> ${newPoints}`);
            console.log(`[ScoringSystem] All team round points:`, Array.from(this.room.scores.teams.entries()).map(([tid, pts]) => `${tid}: ${pts}`).join(', '));
        } else {
            console.log(`[ScoringSystem] Round ${round}: No winner determined`);
        }

        // Check match win condition (this sets matchOver = true if condition met)
        console.log(`[ScoringSystem] Checking match win condition. roundsToWin: ${MATCH_SETTINGS.roundsToWin}, maxRounds: ${MATCH_SETTINGS.maxRounds}`);
        const wasMatchOver = this.room.scores.matchOver; // Check if match was already over before
        const matchWon = this.checkMatchWinCondition();
        const isNewMatchEnd = matchWon && !wasMatchOver; // Match just ended (not already over)

        // Award XP bonuses (round winner, match winner, MVP)
        // Only award if match was not already over (prevents duplicate XP on refresh/reconnect)
        if (!wasMatchOver) {
            this.awardScoringXP(roundWinner, matchWon);
        }

        // Build ROUND_SCORE message
        const evaluationScoresObj = {};
        for (const [teamId, score] of evaluationScores.entries()) {
            evaluationScoresObj[teamId] = score;
        }
        
        const perPlayerScoresObj = {};
        for (const [playerId, data] of this.room.scores.perPlayer.entries()) {
            const roundScore = data.roundScores[round - 1];
            if (roundScore !== undefined) {
                perPlayerScoresObj[playerId] = roundScore;
            }
        }
        
        const roundPointsObj = {};
        for (const [teamId, points] of this.room.scores.teams.entries()) {
            roundPointsObj[teamId] = points;
        }
        
        const answersObj = {};
        for (const [teamId, answerData] of roundAnswers.entries()) {
            answersObj[teamId] = {
                text: answerData.text,
                writerId: answerData.writerId,
                suggesterIds: answerData.suggesterIds
            };
        }

        // Transition to ROUND_ENDED after scoring
        this.room.state.roundState = "ROUND_ENDED";

        // Broadcast ROUND_STATE_UPDATE
        this.room.broadcast("ROUND_STATE_UPDATE", {
            state: this.room.state.roundState,
            roundNumber: round
        });
        
        // Clear question text after round ends (to prepare for next round)
        // Don't clear if match is over (will be handled by RESET_MATCH)
        if (!this.room.scores.matchOver) {
            this.room.state.questionText = "";
            this.room.broadcast("QUESTION_UPDATE", {
                question: ""
            });
        }

        // Broadcast ROUND_SCORE message
        console.log(`[ScoringSystem] Broadcasting ROUND_SCORE: matchWon=${matchWon}, this.room.scores.matchOver=${this.room.scores.matchOver}, isNewMatchEnd=${isNewMatchEnd}`);
        this.room.broadcast("ROUND_SCORE", {
            roundNumber: round,
            question: this.room.state.questionText,
            evaluationScores: {
                teams: evaluationScoresObj,
                perPlayer: perPlayerScoresObj
            },
            roundPoints: {
                teams: roundPointsObj
            },
            answers: answersObj,
            roundWinner: roundWinner,
            matchOver: this.room.scores.matchOver // Use actual state, not return value
        });

        // If match won, broadcast MATCH_OVER (AFTER ROUND_SCORE)
        // Only flush XP once when match ends (prevents duplicate XP on refresh/reconnect)
        if (isNewMatchEnd) {
            // Flush XP before broadcasting match over (only once, when match first ends)
            this.flushAllXP();
            
            const finalScoresObj = {};
            for (const [teamId, points] of this.room.scores.teams.entries()) {
                finalScoresObj[teamId] = points;
            }
            
            const finalPerPlayerObj = {};
            for (const [playerId, data] of this.room.scores.perPlayer.entries()) {
                finalPerPlayerObj[playerId] = {
                    roundScores: data.roundScores,
                    totalEvaluationScore: data.totalEvaluationScore
                };
            }
            
            // Find MVP (highest totalEvaluationScore)
            let mvp = null;
            let maxScore = -1;
            for (const [playerId, data] of this.room.scores.perPlayer.entries()) {
                if (data.totalEvaluationScore > maxScore) {
                    maxScore = data.totalEvaluationScore;
                    mvp = playerId;
                }
            }
            
            this.room.broadcast("MATCH_OVER", {
                winner: this.room.scores.winner,
                finalScores: {
                    teams: finalScoresObj,
                    perPlayer: finalPerPlayerObj
                },
                mvp: mvp
            });
        }

        return {
            success: true,
            roundWinner: roundWinner,
            matchWon: matchWon
        };
    }

    /**
     * Apply score override (called from REST API)
     */
    applyOverride(teamId, playerId, round, newEvaluationScore) {
        if (this.room.scores.matchOver) {
            return { success: false, error: "Cannot override scores after match has ended" };
        }

        const roundAnswers = this.room.answers.get(round);
        if (!roundAnswers) {
            return { success: false, error: "Round not found" };
        }

        const answerData = roundAnswers.get(teamId);
        if (!answerData) {
            return { success: false, error: "Team answer not found for this round" };
        }

        const writerId = answerData.writerId;
        if (!writerId) {
            return { success: false, error: "Writer ID not found for this answer" };
        }

        // Update evaluation score
        const oldScore = this.room.scores.perPlayer.get(writerId)?.roundScores[round - 1] || 0;
        const scoreDiff = newEvaluationScore - oldScore;

        if (!this.room.scores.perPlayer.has(writerId)) {
            this.room.scores.perPlayer.set(writerId, { roundScores: [], totalEvaluationScore: 0 });
        }
        const playerData = this.room.scores.perPlayer.get(writerId);
        playerData.roundScores[round - 1] = newEvaluationScore;
        playerData.totalEvaluationScore += scoreDiff;

        // Recalculate round outcome
        const recalcResult = this.recalculateRoundOutcome(round);

        // Broadcast updates
        this.room.broadcast("PLAYER_SCORE_UPDATE", {
            playerId: writerId,
            round: round,
            newEvaluationScore: newEvaluationScore,
            newTotalEvaluationScore: playerData.totalEvaluationScore
        });

        if (recalcResult.roundWinnerChanged) {
            this.room.broadcast("ROUND_SCORE_UPDATE", {
                round: round,
                newRoundWinner: recalcResult.newRoundWinner,
                updatedScores: {
                    teams: recalcResult.teamScores,
                    perPlayer: { [writerId]: newEvaluationScore }
                }
            });
        }

        return {
            success: true,
            updatedScores: {
                teams: recalcResult.teamScores,
                perPlayer: { [writerId]: { roundScores: playerData.roundScores, totalEvaluationScore: playerData.totalEvaluationScore } }
            }
        };
    }

    /**
     * Recalculate round outcome after override
     */
    recalculateRoundOutcome(round) {
        const roundAnswers = this.room.answers.get(round);
        if (!roundAnswers) {
            return { roundWinnerChanged: false };
        }

        // Get current evaluation scores for this round
        const evaluationScores = new Map();
        for (const [teamId, answerData] of roundAnswers.entries()) {
            const writerId = answerData.writerId;
            if (writerId && this.room.scores.perPlayer.has(writerId)) {
                const playerData = this.room.scores.perPlayer.get(writerId);
                const roundScore = playerData.roundScores[round - 1];
                if (roundScore !== undefined) {
                    evaluationScores.set(teamId, roundScore);
                }
            }
        }

        // Determine new round winner
        const newRoundWinner = this.determineRoundWinner(evaluationScores);

        // Get old round winner (need to track this - for now, recalculate from current state)
        // This is a simplification - in a full implementation, we'd track the original round winner
        const oldRoundWinner = newRoundWinner; // Simplified - would need to track original

        // Recalculate round points
        // Reset all round points and recalculate from round 1 to current round
        this.room.scores.teams.clear();
        for (let r = 1; r <= this.room.scores.roundNumber; r++) {
            const rAnswers = this.room.answers.get(r);
            if (rAnswers) {
                const rScores = new Map();
                for (const [teamId, answerData] of rAnswers.entries()) {
                    const writerId = answerData.writerId;
                    if (writerId && this.room.scores.perPlayer.has(writerId)) {
                        const playerData = this.room.scores.perPlayer.get(writerId);
                        const roundScore = playerData.roundScores[r - 1];
                        if (roundScore !== undefined) {
                            rScores.set(teamId, roundScore);
                        }
                    }
                }
                const rWinner = this.determineRoundWinner(rScores);
                if (rWinner) {
                    const currentPoints = this.room.scores.teams.get(rWinner) || 0;
                    this.room.scores.teams.set(rWinner, currentPoints + 1);
                }
            }
        }

        // Check if match win condition is met
        this.checkMatchWinCondition();

        const teamScores = {};
        for (const [teamId, points] of this.room.scores.teams.entries()) {
            teamScores[teamId] = points;
        }

        return {
            roundWinnerChanged: newRoundWinner !== oldRoundWinner,
            newRoundWinner: newRoundWinner,
            teamScores: teamScores
        };
    }
}

