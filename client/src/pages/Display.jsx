import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, isAuthenticated } from "../utils/auth.js";
import { useQuizRoomState } from "../quiz/useQuizRoomState.js";
import { deriveDisplayViewModel } from "../quiz/viewModels.js";
import { Timer } from "../components/Timer.jsx";
import { Scoreboard } from "../components/Scoreboard.jsx";
import { EffectsOverlay } from "../components/EffectsOverlay.jsx";

export function Display() {
  const navigate = useNavigate();
  const token = getToken();
  
  // Use centralized state hook
  const { state, room, connectionStatus } = useQuizRoomState({ role: "display", token });
  
  // Derive display view model
  const displayVM = deriveDisplayViewModel(state);
  
  // Extract state values
  const roundState = state.round?.roundState || "ROUND_WAITING";
  const roundNumber = state.round?.roundNumber || 0;
  const questionText = state.round?.questionText || "";
  const timeRemaining = state.round?.timeRemaining || 0;
  const timerEnabled = state.round?.timerEnabled || false;
  const teams = state.teams || {};
  const matchScore = state.scoring?.matchScores || {};
  const roundResult = state.scoring?.roundResult || null;
  const matchResult = state.scoring?.matchResult || null;
  const matchOver = state.scoring?.matchOver || false;
  const moderationState = state.moderation || { mutedPlayers: [], frozenTeams: [], roundFrozen: false };
  const activeEffects = state.effects?.activeEffects || [];
  
  // Derive team gold from teams state
  const teamGold = {};
  for (const [teamId, teamData] of Object.entries(teams)) {
    teamGold[teamId] = teamData.gold || 0;
  }

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
  }, [navigate]);
  
  // Handle connection errors
  useEffect(() => {
    if (connectionStatus === "error" && !room) {
      alert("Display cannot connect: No active quiz room found.\n\nPlease ensure:\n1. Teacher has connected to a quiz room first, OR\n2. Connect via the lobby (which shares the room ID)");
    }
  }, [connectionStatus, room]);

  // Get state message based on roundState
  const getStateMessage = () => {
    switch (roundState) {
      case "ROUND_WAITING":
        return "Waiting for teacher to start round...";
      case "ROUND_ACTIVE":
        return "Round in progress";
      case "ROUND_REVIEW":
        return "Round ended – scoring in progress...";
      case "ROUND_ENDED":
        return matchOver ? "Match Over" : "Round scored – waiting for next round...";
      default:
        return "Waiting...";
    }
  };

  // Get team list for display
  const teamList = Object.entries(teams).map(([teamId, teamData]) => {
    // Writer is a sessionId, show a shortened version or "N/A"
    let writerDisplay = "N/A";
    if (teamData.writer) {
      // Show first 8 characters of sessionId
      writerDisplay = teamData.writer.substring(0, 8) + "...";
    }
    
    return {
      teamId,
      name: teamData.name || teamId,
      writer: writerDisplay,
      gold: teamGold[teamId] || teamData.gold || 0,
      roundPoints: matchScore[teamId] || 0,
      evaluationScore: roundResult?.evaluationScores?.teams?.[teamId] || null
    };
  });

  // Sort teams by round points (descending)
  teamList.sort((a, b) => b.roundPoints - a.roundPoints);

  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "#f5f5f5",
      padding: "2rem",
      fontFamily: "Arial, sans-serif"
    }}>
      {/* Connection Status */}
      <div style={{ 
        position: "fixed", 
        top: "1rem", 
        right: "1rem", 
        padding: "0.5rem 1rem",
        backgroundColor: connectionStatus === "connected" ? "#4caf50" : "#f44336",
        color: "white",
        borderRadius: "4px",
        fontSize: "0.9rem",
        zIndex: 1000
      }}>
        {connectionStatus === "connected" ? "● Connected" : connectionStatus === "connecting" ? "● Connecting..." : "● Disconnected"}
      </div>

      {/* Chapter 12: Round Paused Overlay */}
      {moderationState.roundFrozen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          color: "white",
          fontSize: "3rem",
          fontWeight: "bold"
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "5rem", marginBottom: "1rem" }}>⏸️</div>
            <div>Round Paused by Teacher</div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "2rem",
        padding: "1.5rem",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        {/* Left: Round Info */}
        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2196f3" }}>
          Round {roundNumber || 0} – {roundState || "ROUND_WAITING"}
          {moderationState.roundFrozen && (
            <span style={{ marginLeft: "1rem", color: "#ff5722", fontSize: "1rem" }}>⏸️ PAUSED</span>
          )}
        </div>

        {/* Center: Question */}
        <div style={{ 
          flex: 1, 
          textAlign: "center", 
          padding: "0 2rem",
          fontSize: roundState === "ROUND_ACTIVE" ? "2rem" : "1.5rem",
          fontWeight: "bold",
          color: "#333",
          minHeight: "3rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          {roundState === "ROUND_ACTIVE" && questionText ? (
            questionText
          ) : roundState === "ROUND_WAITING" ? (
            <span style={{ color: "#999", fontStyle: "italic" }}>Waiting for question...</span>
          ) : (
            questionText || <span style={{ color: "#999" }}>No question set</span>
          )}
        </div>

        {/* Right: Timer */}
        {timerEnabled && roundState === "ROUND_ACTIVE" && (
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ff9800" }}>
            <Timer timeRemaining={timeRemaining} />
          </div>
        )}
      </div>

      {/* Middle: Scoreboard */}
      <div style={{ 
        marginBottom: "2rem",
        padding: "1.5rem",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: "1.5rem", fontSize: "2rem", color: "#2196f3" }}>
          Scoreboard
        </h2>
        
        {teamList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#999" }}>
            No teams yet
          </div>
        ) : (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
            gap: "1.5rem" 
          }}>
            {teamList.map((team, index) => (
              <div 
                key={team.teamId}
                style={{
                  padding: "1.5rem",
                  backgroundColor: moderationState.frozenTeams.includes(team.teamId) 
                    ? "#ffebee" 
                    : (index === 0 ? "#e3f2fd" : "#f9f9f9"),
                  borderRadius: "8px",
                  border: moderationState.frozenTeams.includes(team.teamId)
                    ? "3px solid #ff5722"
                    : (index === 0 ? "3px solid #2196f3" : "1px solid #ddd")
                }}
              >
                <div style={{ 
                  fontSize: "1.8rem", 
                  fontWeight: "bold", 
                  marginBottom: "0.5rem",
                  color: "#2196f3",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}>
                  {team.name}
                  {moderationState.frozenTeams.includes(team.teamId) && (
                    <span style={{ fontSize: "1rem", color: "#ff5722" }}>❄️ FROZEN</span>
                  )}
                </div>
                
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                  <strong>Points:</strong> {team.roundPoints}
                </div>
                
                <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem", color: "#666" }}>
                  <strong>Writer:</strong> {team.writer}
                </div>
                
                <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem", color: "#666" }}>
                  <strong>Gold:</strong> {team.gold}
                </div>
                
                {(roundState === "ROUND_REVIEW" || roundState === "ROUND_ENDED") && team.evaluationScore !== null && (
                  <div style={{ fontSize: "1.2rem", color: "#4caf50", fontWeight: "bold" }}>
                    Round Score: {team.evaluationScore}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Status Message */}
      <div style={{ 
        padding: "1.5rem",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "1.5rem", color: "#666", marginBottom: "1rem" }}>
          {getStateMessage()}
        </div>
        
        {matchOver && matchResult && (
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#4caf50", marginTop: "1rem" }}>
            🎉 Match Winner: {matchResult.winner || "N/A"} 🎉
          </div>
        )}
      </div>

      {/* Effects Overlay - Show all effects */}
      {activeEffects.length > 0 && (
        <EffectsOverlay 
          activeEffects={activeEffects}
          showAll={true}
        />
      )}
    </div>
  );
}

