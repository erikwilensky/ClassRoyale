import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinQuizRoom, joinQuizRoomById } from "../ws/colyseusClient.js";
import { getToken, isAuthenticated } from "../utils/auth.js";
import { Timer } from "../components/Timer.jsx";
import { Scoreboard } from "../components/Scoreboard.jsx";
import { EffectsOverlay } from "../components/EffectsOverlay.jsx";

export function Display() {
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  // Round state
  const [roundState, setRoundState] = useState("ROUND_WAITING");
  const [roundNumber, setRoundNumber] = useState(0);
  const [questionText, setQuestionText] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerEnabled, setTimerEnabled] = useState(false);

  // Teams state
  const [teams, setTeams] = useState({});
  const [matchScore, setMatchScore] = useState({});
  const [teamGold, setTeamGold] = useState({});
  const [disabledCards, setDisabledCards] = useState(new Set());
  const [goldCostModifiers, setGoldCostModifiers] = useState({});

  // Scoring state
  const [roundResult, setRoundResult] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [matchOver, setMatchOver] = useState(false);

  // Effects state (all effects, not just for one team)
  const [activeEffects, setActiveEffects] = useState([]);

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    async function connect() {
      // Check authentication again
      if (!isAuthenticated()) {
        navigate("/login");
        return;
      }

      try {
        // Get token and join room as display
        const token = getToken();
        
        // Chapter 9: Get room ID from localStorage (set by teacher when they connect)
        // Check both currentQuizRoomId (from teacher) and quizRoomId (from lobby)
        const quizRoomIdFromLobby = localStorage.getItem("quizRoomId");
        const quizRoomIdFromTeacher = localStorage.getItem("currentQuizRoomId");
        const quizRoomIdFromSession = sessionStorage.getItem("currentQuizRoomId");
        const quizRoomId = quizRoomIdFromLobby || quizRoomIdFromTeacher || quizRoomIdFromSession;
        
        console.log("[Display] Room ID lookup - lobby:", quizRoomIdFromLobby, "teacher:", quizRoomIdFromTeacher, "session:", quizRoomIdFromSession);
        
        let joinedRoom;
        
        if (quizRoomId) {
          // Connect to specific QuizRoom
          console.log("[Display] Connecting to QuizRoom by ID:", quizRoomId);
          try {
            joinedRoom = await joinQuizRoomById(quizRoomId, "display", token);
            if (quizRoomIdFromLobby) {
              localStorage.removeItem("quizRoomId"); // Clear after use if from lobby
            }
            console.log("[Display] Successfully connected to room by ID:", joinedRoom?.id || joinedRoom?.roomId);
          } catch (error) {
            console.error("[Display] Failed to join room by ID:", error);
            console.error("[Display] Error details:", error.message, error.stack);
            if (isMounted) {
              setConnectionStatus("error");
              alert(`Display cannot connect to room ${quizRoomId}.\n\nError: ${error.message}\n\nPlease ensure the teacher has started a match.`);
            }
            return;
          }
        } else {
          // No room ID found - cannot connect without knowing which room
          console.error("[Display] No room ID found in localStorage or sessionStorage.");
          console.error("[Display] Teacher must connect first to create/store room ID, or connect via lobby.");
          if (isMounted) {
            setConnectionStatus("error");
            alert("Display cannot connect: No active quiz room found.\n\nPlease ensure:\n1. Teacher has connected to a quiz room first, OR\n2. Connect via the lobby (which shares the room ID)");
          }
          return;
        }
        
        // Log room connection details
        const roomId = joinedRoom?.id || joinedRoom?.roomId || "unknown";
        console.log("[Display] Connected to room. ID:", roomId, "Room object:", joinedRoom);
        
        if (!isMounted || !joinedRoom) {
          return;
        }

        // CRITICAL: Register ALL message handlers IMMEDIATELY after connection
        // Do this synchronously before any other operations to prevent race conditions
        
        // Message handlers - register FIRST, synchronously
        joinedRoom.onMessage("ROUND_STATE_UPDATE", (message) => {
          console.log("[Display] Round state update:", message);
          if (message && message.state) {
            setRoundState(message.state);
          }
          if (message && message.roundNumber !== undefined) {
            setRoundNumber(message.roundNumber);
          }
        });

        joinedRoom.onMessage("QUESTION_UPDATE", (message) => {
          console.log("[Display] Question update:", message);
          if (message.question !== undefined && message.question !== null) {
            setQuestionText(message.question);
          }
        });

        joinedRoom.onMessage("ROUND_STARTED", (message) => {
          console.log("[Display] Round started:", message);
          if (message.question) {
            setQuestionText(message.question);
          }
          if (message.duration !== undefined) {
            setTimeRemaining(message.duration);
          }
          setRoundState("ROUND_ACTIVE");
        });

        joinedRoom.onMessage("TIMER_UPDATE", (message) => {
          console.log("[Display] Timer update:", message);
          setTimeRemaining(message.timeRemaining);
          if (message.enabled !== undefined) {
            setTimerEnabled(message.enabled);
          }
        });

        joinedRoom.onMessage("TEAM_UPDATE", (message) => {
          console.log("[Display] Team update:", message);
          if (message && message.teams) {
            console.log("[Display] Teams received:", Object.keys(message.teams).length, "teams");
            setTeams(message.teams);
            
            // Update team gold
            const gold = {};
            for (const [teamId, teamData] of Object.entries(message.teams)) {
              if (teamData.gold !== undefined) {
                gold[teamId] = teamData.gold;
              }
            }
            setTeamGold(gold);
            console.log("[Display] Updated teams state, gold:", gold);
          }
        });

        joinedRoom.onMessage("GOLD_UPDATE", (message) => {
          console.log("[Display] Gold update:", message);
          if (message && message.gold) {
            setTeamGold(message.gold);
          }
        });

        joinedRoom.onMessage("ROUND_SCORE", (message) => {
          console.log("[Display] Round score:", message);
          setRoundResult(message);
          if (message.roundPoints?.teams) {
            setMatchScore(message.roundPoints.teams);
          }
          if (message.matchOver) {
            setMatchOver(true);
          }
        });

        joinedRoom.onMessage("MATCH_OVER", (message) => {
          console.log("[Display] Match over:", message);
          setMatchResult(message);
          setMatchOver(true);
          
          // Update final scores
          if (message.finalScores?.teams) {
            setMatchScore(message.finalScores.teams);
          }
        });

        joinedRoom.onMessage("CARD_CAST", (message) => {
          console.log("[Display] Card cast:", message);
          // Add effect to active effects
          if (message.cardId && message.targetTeamId) {
            const effect = {
              cardId: message.cardId,
              casterTeamId: message.casterTeamId,
              targetTeamId: message.targetTeamId,
              timestamp: Date.now()
            };
            setActiveEffects(prev => [...prev, effect]);
            
            // Remove effect after 10 seconds
            setTimeout(() => {
              setActiveEffects(prev => prev.filter(e => 
                e.cardId !== effect.cardId || 
                e.casterTeamId !== effect.casterTeamId || 
                e.timestamp !== effect.timestamp
              ));
            }, 10000);
          }
        });

        joinedRoom.onMessage("CARD_RULES_UPDATE", (message) => {
          console.log("[Display] CARD_RULES_UPDATE:", message);
          if (message.disabledCards) {
            setDisabledCards(new Set(message.disabledCards));
          }
          if (message.goldCostModifiers) {
            setGoldCostModifiers(message.goldCostModifiers);
          }
        });

        joinedRoom.onMessage("MATCH_RESET", (message) => {
          console.log("[Display] Match reset:", message);
          setMatchResult(null);
          setMatchOver(false);
          setRoundResult(null);
          setRoundNumber(0);
          setMatchScore({});
        });

        joinedRoom.onMessage("ERROR", (message) => {
          console.error("[Display] Error:", message);
        });

        // Sync with room state - register AFTER message handlers
        joinedRoom.onStateChange((state) => {
          console.log("[Display] State change:", state);
          if (state.roundState) {
            setRoundState(state.roundState);
          }
          if (state.questionText !== undefined) {
            setQuestionText(state.questionText);
          }
          if (state.timeRemaining !== undefined) {
            setTimeRemaining(state.timeRemaining);
          }
          if (state.timerEnabled !== undefined) {
            setTimerEnabled(state.timerEnabled);
          }
        });

        // NOW set room state - all handlers are registered
        setRoom(joinedRoom);
        setConnectionStatus("connected");

        // Handle disconnection
        joinedRoom.onLeave(() => {
          console.log("[Display] Left room");
          if (isMounted) {
            setConnectionStatus("disconnected");
          }
        });

      } catch (error) {
        console.error("[Display] Failed to join room:", error);
        if (isMounted) {
          setConnectionStatus("error");
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (room) {
        room.leave();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
                  backgroundColor: index === 0 ? "#e3f2fd" : "#f9f9f9",
                  borderRadius: "8px",
                  border: index === 0 ? "3px solid #2196f3" : "1px solid #ddd"
                }}
              >
                <div style={{ 
                  fontSize: "1.8rem", 
                  fontWeight: "bold", 
                  marginBottom: "0.5rem",
                  color: "#2196f3"
                }}>
                  {team.name}
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

