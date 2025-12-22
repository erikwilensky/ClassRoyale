import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { joinQuizRoom, joinQuizRoomById } from "../ws/colyseusClient.js";
import { removeToken, getToken } from "../utils/auth.js";
import { Timer } from "../components/Timer.jsx";
import { QuestionDisplay } from "../components/QuestionDisplay.jsx";
import { RoundControls } from "../components/RoundControls.jsx";
import { AnswerList } from "../components/AnswerList.jsx";

export function Teacher() {
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  const [question, setQuestion] = useState("");
  const [duration, setDuration] = useState("60");

  const [questionText, setQuestionText] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [roundState, setRoundState] = useState("ROUND_WAITING"); // Chapter 8: Explicit round state
  const [roundActive, setRoundActive] = useState(false); // Computed from roundState
  const [timerEnabled, setTimerEnabled] = useState(false); // Chapter 8: Timer toggle
  const [questionInput, setQuestionInput] = useState(""); // Chapter 8: Question input field
  const [collectedAnswers, setCollectedAnswers] = useState([]);
  const [teams, setTeams] = useState({});
  const [teamGold, setTeamGold] = useState({});
  const [cardCastLog, setCardCastLog] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  const [roundNumber, setRoundNumber] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [roundData, setRoundData] = useState(null); // ROUND_DATA message
  const [pendingRound, setPendingRound] = useState(null); // Round waiting for scoring
  const [scoreInputs, setScoreInputs] = useState({}); // { teamId: score }
  const [roundsToWin, setRoundsToWin] = useState(5);
  const [maxRounds, setMaxRounds] = useState(null); // null = unlimited
  
  // Use ref to ensure we always have the latest setter
  const setCollectedAnswersRef = useRef(setCollectedAnswers);
  const setTeamsRef = useRef(setTeams);
  useEffect(() => {
    setCollectedAnswersRef.current = setCollectedAnswers;
    setTeamsRef.current = setTeams;
  }, []);

  // Chapter 9: Watch room state and store room ID when available
  // Use localStorage so display can access it from different tabs
  useEffect(() => {
    if (room) {
      const roomId = room.id || room.roomId;
      if (roomId) {
        const currentStored = localStorage.getItem("currentQuizRoomId");
        if (currentStored !== roomId) {
          localStorage.setItem("currentQuizRoomId", roomId);
          sessionStorage.setItem("currentQuizRoomId", roomId); // Also store in sessionStorage
          console.log("[Teacher] Stored room ID from room state:", roomId);
        }
      } else {
        // Room ID not available yet, try again after a delay
        const timeout = setTimeout(() => {
          const delayedRoomId = room.id || room.roomId;
          if (delayedRoomId) {
            localStorage.setItem("currentQuizRoomId", delayedRoomId);
            sessionStorage.setItem("currentQuizRoomId", delayedRoomId); // Also store in sessionStorage
            console.log("[Teacher] Stored room ID (delayed from useEffect):", delayedRoomId);
          }
        }, 1000);
        return () => clearTimeout(timeout);
      }
    }
  }, [room]);

  // Debug: Log when collectedAnswers changes
  useEffect(() => {
    console.log("[Teacher] collectedAnswers state updated:", collectedAnswers);
    console.log("[Teacher] collectedAnswers.length:", collectedAnswers.length);
  }, [collectedAnswers]);

  useEffect(() => {
    let isMounted = true;

    async function connect() {
      try {
        // Check if coming from lobby (has quizRoomId in localStorage)
        const quizRoomId = localStorage.getItem("quizRoomId");
        let joinedRoom;
        
        if (quizRoomId) {
          // Connect to specific QuizRoom from lobby
          const token = getToken();
          console.log("[Teacher] Connecting to QuizRoom from lobby:", quizRoomId);
          joinedRoom = await joinQuizRoomById(quizRoomId, "teacher", token);
          localStorage.removeItem("quizRoomId"); // Clear after use
        } else {
          // Normal join (backward compatibility)
          joinedRoom = await joinQuizRoom("teacher");
        }
        
        if (!isMounted) {
          return;
        }

        // Chapter 9: Always store room ID in localStorage for display to use (shared across tabs)
        // Try multiple ways to get room ID (Colyseus may expose it differently)
        const roomId = joinedRoom?.id || joinedRoom?.roomId || (joinedRoom && Object.getOwnPropertyDescriptor(joinedRoom, 'id')?.value);
        if (joinedRoom && roomId) {
          localStorage.setItem("currentQuizRoomId", roomId);
          sessionStorage.setItem("currentQuizRoomId", roomId); // Also store in sessionStorage
          console.log("[Teacher] Stored room ID for display:", roomId);
        } else {
          console.warn("[Teacher] Joined room but room ID is undefined. Room object:", joinedRoom);
          // Try to get room ID from room state or connection
          if (joinedRoom) {
            console.warn("[Teacher] Room properties:", Object.keys(joinedRoom));
            // Store a placeholder and try to get it later
            setTimeout(() => {
              const delayedRoomId = joinedRoom.id || joinedRoom.roomId;
              if (delayedRoomId) {
                localStorage.setItem("currentQuizRoomId", delayedRoomId);
                sessionStorage.setItem("currentQuizRoomId", delayedRoomId); // Also store in sessionStorage
                console.log("[Teacher] Stored room ID (delayed):", delayedRoomId);
              }
            }, 1000);
          }
        }

        setRoom(joinedRoom);
        setConnectionStatus("connected");
        
        // Also store room ID after state is set (in case it wasn't available immediately)
        if (joinedRoom) {
          // Use a ref or effect to store room ID when it becomes available
          const checkAndStoreRoomId = () => {
            const currentRoomId = joinedRoom.id || joinedRoom.roomId;
            if (currentRoomId && localStorage.getItem("currentQuizRoomId") !== currentRoomId) {
              localStorage.setItem("currentQuizRoomId", currentRoomId);
              sessionStorage.setItem("currentQuizRoomId", currentRoomId); // Also store in sessionStorage
              console.log("[Teacher] Stored room ID (after state set):", currentRoomId);
            }
          };
          // Check immediately and also after a short delay
          checkAndStoreRoomId();
          setTimeout(checkAndStoreRoomId, 500);
        }

        // Chapter 9: Register ROOM_ID handler to store room ID from server
        // Use localStorage instead of sessionStorage so display can access it from different tabs
        joinedRoom.onMessage("ROOM_ID", (message) => {
          if (message && message.roomId) {
            localStorage.setItem("currentQuizRoomId", message.roomId);
            sessionStorage.setItem("currentQuizRoomId", message.roomId); // Also store in sessionStorage for same-tab access
            console.log("[Teacher] Received room ID from server:", message.roomId);
          }
        });

        // Chapter 8: Register ROUND_STATE_UPDATE FIRST to catch initial state
        joinedRoom.onMessage("ROUND_STATE_UPDATE", (message) => {
          console.log("[Teacher] Round state update:", message);
          if (message && message.state) {
            // Always update state from server (server is source of truth)
            setRoundState(message.state);
            setRoundActive(message.state === "ROUND_ACTIVE");
          } else {
            // Default to ROUND_WAITING if not specified
            setRoundState("ROUND_WAITING");
            setRoundActive(false);
          }
          if (message && message.roundNumber !== undefined) {
            setRoundNumber(message.roundNumber);
          }
        });

        // Register TEAM_UPDATE handler early to catch initial teams
        joinedRoom.onMessage("TEAM_UPDATE", (message) => {
          console.log("[Teacher] Team update:", message);
          if (message && message.teams) {
            setTeamsRef.current(message.teams);
          }
        });

        joinedRoom.onMessage("QUESTION_UPDATE", (message) => {
          console.log("[Teacher] Question update:", message);
          // Handle both empty string and undefined/null (empty string clears the question)
          if (message.question !== undefined && message.question !== null) {
            setQuestionText(message.question);
            setQuestionInput(message.question); // Update input field
          }
        });

        joinedRoom.onMessage("WRITER_ROTATED", (message) => {
          console.log("[Teacher] Writer rotated:", message);
          // Team display will update via TEAM_UPDATE
        });

        // Register ROUND_ENDED handler BEFORE catch-all to ensure it's processed
        joinedRoom.onMessage("ROUND_ENDED", (message) => {
          console.log("[Teacher] ROUND_ENDED handler called - full message:", message);
          
          // Handle team-based answers
          if (message.teams) {
            const teamsData = {};
            const answersArray = [];
            message.teams.forEach(team => {
              teamsData[team.teamId] = team;
              // Convert team answers to collectedAnswers format for display
              if (team.answer) {
                answersArray.push({
                  clientId: team.teamId,
                  text: team.answer,
                  teamId: team.teamId,
                  writer: team.writerName || team.writer
                });
              }
            });
            setTeamsRef.current(teamsData);
            // Update collectedAnswers with team answers
            setCollectedAnswersRef.current(answersArray);
            console.log("[Teacher] Teams data:", teamsData);
            console.log("[Teacher] Collected answers from teams:", answersArray);
          }
          
          // Keep individual answers for backward compatibility (merge with team answers)
          const legacyAnswers = message.answers || [];
          if (legacyAnswers.length > 0) {
            setCollectedAnswersRef.current(prev => {
              const existing = prev || [];
              // Merge, avoiding duplicates
              const merged = [...existing];
              legacyAnswers.forEach(legacy => {
                if (!merged.find(a => a.clientId === legacy.clientId)) {
                  merged.push(legacy);
                }
              });
              return merged;
            });
          }
          
          setRoundActive(false);
          setRoundState("ROUND_REVIEW"); // Chapter 8: Explicit state
        });

        joinedRoom.onMessage("*", (type, message) => {
          console.log("[Teacher] * Message:", type, message);
          // ROUND_ENDED is handled by specific handler above
        });

        joinedRoom.onMessage("LOCK", (message) => {
          console.log("[Teacher] Team locked:", message);
          // Teams state will be updated via TEAM_UPDATE
        });

        joinedRoom.onMessage("GOLD_UPDATE", (message) => {
          console.log("[Teacher] Gold update:", message);
          if (message.gold) {
            setTeamGold(prev => ({ ...prev, ...message.gold }));
          }
        });

        joinedRoom.onMessage("ROUND_STARTED", (message) => {
          setQuestionText(message.question);
          setTimeRemaining(message.duration);
          setRoundActive(true);
          setCollectedAnswers([]); // Clear previous answers when new round starts
          // Immediately sync gold from room state (GOLD_UPDATE message should also arrive)
          if (joinedRoom.state && joinedRoom.state.gold) {
            const goldData = {};
            joinedRoom.state.gold.forEach((gold, teamId) => {
              goldData[teamId] = gold;
            });
            if (Object.keys(goldData).length > 0) {
              setTeamGold(prev => ({ ...prev, ...goldData }));
            }
          }
          // Don't clear cardCastLog - keep it across rounds
        });

        joinedRoom.onMessage("ROUND_DATA", (message) => {
          console.log("[Teacher] Round data (answers for scoring):", message);
          setRoundData(message);
          setPendingRound(message.roundNumber);
          
          // Use ROUND_DATA.answers as the canonical source for collected answers
          // This is more reliable than ROUND_ENDED.teams[].answer
          if (message.answers) {
            const answersArray = [];
            Object.keys(message.answers).forEach(teamId => {
              const answerData = message.answers[teamId];
              const answerText = answerData.text || "";
              answersArray.push({
                clientId: teamId,
                text: answerText.trim().length > 0 ? answerText : "(No answer submitted)",
                teamId: teamId,
                writer: answerData.writerId || teamId
              });
            });
            setCollectedAnswersRef.current(answersArray);
            console.log("[Teacher] Collected answers from ROUND_DATA:", answersArray);
          }
          
          // Initialize score inputs
          const inputs = {};
          if (message.answers) {
            Object.keys(message.answers).forEach(teamId => {
              inputs[teamId] = "";
            });
          }
          setScoreInputs(inputs);
        });

        joinedRoom.onMessage("ROUND_ENDED", (message) => {
          console.log("[Teacher] ROUND_ENDED handler called - full message:", message);

          // Handle team-based answers
          if (message.teams && Array.isArray(message.teams)) {
            const teamsData = {};
            const answersArray = [];

            message.teams.forEach(team => {
              const rawAnswer = typeof team.answer === "string" ? team.answer : "";
              const displayAnswer = rawAnswer.trim().length > 0 ? rawAnswer : "(No answer submitted)";

              console.log(
                `[Teacher] Processing team ${team.teamId}: ` +
                `answer="${rawAnswer}", display="${displayAnswer}", ` +
                `answer length=${rawAnswer.length}`
              );

              teamsData[team.teamId] = team;

              // Always add an entry so teacher sees all teams, even if they left it blank
              answersArray.push({
                clientId: team.teamId,
                text: displayAnswer,
                teamId: team.teamId,
                writer: team.writerName || team.writer
              });
            });

            setTeamsRef.current(teamsData);
            setCollectedAnswersRef.current(answersArray);

            console.log("[Teacher] Teams data:", teamsData);
            console.log("[Teacher] Collected answers from teams:", answersArray);
            console.log("[Teacher] Collected answers count:", answersArray.length);
          } else {
            console.warn("[Teacher] ROUND_ENDED message.teams is missing or not an array:", message.teams);
          }

          // Keep individual answers for backward compatibility (merge with team answers)
          const legacyAnswers = message.answers || [];
          if (legacyAnswers.length > 0) {
            setCollectedAnswersRef.current(prev => {
              const existing = prev || [];
              // Merge, avoiding duplicates
              const merged = [...existing];
              legacyAnswers.forEach(legacy => {
                if (!merged.find(a => a.clientId === legacy.clientId)) {
                  merged.push(legacy);
                }
              });
              return merged;
            });
          }
          
          setRoundActive(false);
        });

        joinedRoom.onMessage("ROUND_SCORE", (message) => {
          console.log("[Teacher] Round score:", message);
          setRoundNumber(message.roundNumber || 0);
          if (message.roundPoints?.teams) {
            setMatchScores(message.roundPoints.teams);
          }
          if (message.matchOver) {
            setMatchOver(true);
          } else {
            // If match is not over, update round state to ROUND_ENDED (to enable Next Round button)
            setRoundState("ROUND_ENDED");
            setRoundActive(false);
            // Clear question text when round ends (if match not over)
            setQuestionText("");
            setQuestionInput("");
          }
          // Clear pending round after scores received
          if (message.roundNumber === pendingRound) {
            setPendingRound(null);
            setRoundData(null);
            setScoreInputs({});
          }
        });

        joinedRoom.onMessage("MATCH_OVER", (message) => {
          console.log("[Teacher] Match over:", message);
          setMatchOver(true);
          if (message.finalScores?.teams) {
            setMatchScores(message.finalScores.teams);
          }
        });

        joinedRoom.onMessage("MATCH_RESET", (message) => {
          console.log("[Teacher] Match reset:", message);
          setMatchOver(false);
          setRoundNumber(0);
          setMatchScores({});
          setQuestionText("");
          setQuestionInput("");
          setRoundState("ROUND_WAITING");
          setRoundActive(false);
        });

        joinedRoom.onMessage("MATCH_SETTINGS_UPDATE", (message) => {
          console.log("[Teacher] Match settings update:", message);
          if (message.roundsToWin !== undefined) {
            setRoundsToWin(message.roundsToWin);
          }
          if (message.maxRounds !== undefined) {
            setMaxRounds(message.maxRounds);
          }
        });

        joinedRoom.onMessage("TEAM_SCORE_UPDATE", (message) => {
          console.log("[Teacher] Team score update:", message);
          setMatchScores(prev => ({
            ...prev,
            [message.teamId]: message.newRoundPoints
          }));
        });

        joinedRoom.onMessage("ROUND_SCORE_UPDATE", (message) => {
          console.log("[Teacher] Round score update:", message);
          setMatchScores(message.updatedScores.teams);
        });

        joinedRoom.onMessage("TIMER_UPDATE", (message) => {
          setTimeRemaining(message.timeRemaining);
          if (message.enabled !== undefined) {
            setTimerEnabled(message.enabled);
          }
        });

        joinedRoom.onStateChange((state) => {
          try {
            console.log("[Teacher] State changed:", state);
            if (state.questionText !== undefined) {
              setQuestionText(state.questionText);
            }
            if (state.timeRemaining !== undefined) {
              setTimeRemaining(state.timeRemaining);
            }
            // Chapter 8: Use explicit roundState
            if (state.roundState !== undefined && state.roundState !== null) {
              setRoundState(state.roundState);
              setRoundActive(state.roundState === "ROUND_ACTIVE");
            } else if (state.roundActive !== undefined) {
              // Backward compatibility
              setRoundActive(state.roundActive);
              setRoundState(state.roundActive ? "ROUND_ACTIVE" : "ROUND_WAITING");
            } else {
              // If neither roundState nor roundActive exists, default to ROUND_WAITING
              // This handles the case where state doesn't have these properties yet
              setRoundState("ROUND_WAITING");
              setRoundActive(false);
            }
            if (state.timerEnabled !== undefined) {
              setTimerEnabled(state.timerEnabled);
            }
          } catch (error) {
            console.error("[Teacher] Error in onStateChange:", error);
          }
          
          // Sync team settings
          // Team settings are now managed in the lobby
          
          // Sync teams from state
          if (state.teams) {
            const teamsData = {};
            const goldData = {};
            state.teams.forEach((team, teamId) => {
              const teamName = team.name || teamId;
              teamsData[teamId] = {
                teamId: teamId,
                name: teamName, // Include team name
                writer: team.writer,
                suggesters: Array.from(team.suggesters || []),
                answer: team.answer,
                locked: team.locked
              };
              // Sync gold from team state
              if (team.gold !== undefined) {
                goldData[teamId] = team.gold;
              }
            });
            
            setTeamsRef.current(teamsData);
            if (Object.keys(goldData).length > 0) {
              setTeamGold(prev => ({ ...prev, ...goldData }));
            }
          }

          // Sync gold from state
          if (state.gold && state.gold.has) {
            const goldData = {};
            state.gold.forEach((gold, teamId) => {
              goldData[teamId] = gold;
            });
            if (Object.keys(goldData).length > 0) {
              setTeamGold(prev => ({ ...prev, ...goldData }));
            }
          }
        });
      } catch (error) {
        console.error("[Teacher] Failed to join room:", error);
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

  // Chapter 8: New round control handlers
  const handleSetQuestion = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    const trimmedQuestion = questionInput.trim();
    if (!trimmedQuestion) {
      alert("Please enter a question.");
      return;
    }

    room.send("SET_QUESTION", {
      text: trimmedQuestion
    });
    console.log("[Teacher] Sent SET_QUESTION:", trimmedQuestion);
  };

  const handleStartRound = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    if (matchOver) {
      alert("Cannot start new round: match is over. Please reset the match first.");
      return;
    }

    if (!questionText || questionText.trim().length === 0) {
      alert("Please set a question before starting the round.");
      return;
    }

    room.send("START_ROUND", {
      duration: parseInt(duration, 10) || 60
    });

    console.log("[Teacher] Sent START_ROUND");
  };

  const handleResetMatch = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    if (!window.confirm("Are you sure you want to reset the match? This will clear all scores and start a new match.")) {
      return;
    }

    room.send("RESET_MATCH", {});
    console.log("[Teacher] Sent RESET_MATCH");
  };

  const handleEndRound = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    room.send("END_ROUND");
    console.log("[Teacher] Sent END_ROUND");
  };

  const handleNextRound = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    room.send("NEXT_ROUND");
    setQuestionInput(""); // Clear input
    setQuestionText(""); // Clear question text state immediately
    console.log("[Teacher] Sent NEXT_ROUND");
  };

  const handleEnableTimer = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    const parsedDuration = parseInt(duration, 10) || 60;
    if (parsedDuration <= 0) {
      alert("Please enter a valid duration.");
      return;
    }

    room.send("ENABLE_TIMER", {
      duration: parsedDuration
    });
    console.log("[Teacher] Sent ENABLE_TIMER:", parsedDuration);
  };

  const handleDisableTimer = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    room.send("DISABLE_TIMER");
    console.log("[Teacher] Sent DISABLE_TIMER");
  };

  const handleSetMatchSettings = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    if (matchOver) {
      alert("Cannot change match settings: match is over.");
      return;
    }

    const roundsToWinNum = typeof roundsToWin === 'number' ? roundsToWin : parseInt(roundsToWin, 10);
    const maxRoundsNum = maxRounds === "" || maxRounds === null ? null : (typeof maxRounds === 'number' ? maxRounds : parseInt(maxRounds, 10));

    if (!roundsToWinNum || roundsToWinNum < 1) {
      alert("Rounds to win must be at least 1");
      return;
    }

    if (maxRoundsNum !== null && (!maxRoundsNum || maxRoundsNum < 1)) {
      alert("Max rounds must be at least 1 or empty");
      return;
    }

    room.send("setMatchSettings", {
      roundsToWin: roundsToWinNum,
      maxRounds: maxRoundsNum
    });

    console.log("[Teacher] Sent setMatchSettings:", {
      roundsToWin: roundsToWinNum,
      maxRounds: maxRoundsNum
    });
  };

  const handleEndMatch = () => {
    if (!room) {
      alert("Not connected yet.");
      return;
    }

    if (matchOver) {
      alert("Match is already over.");
      return;
    }

    if (!window.confirm("Are you sure you want to end the match? The team with the most round points will win.")) {
      return;
    }

    room.send("endMatch", {});
    console.log("[Teacher] Sent endMatch");
  };

  // Team settings are now managed in the lobby (/teacher/lobby)

  const handleSubmitScores = async () => {
    console.log("[Teacher] handleSubmitScores called");
    console.log("[Teacher] pendingRound:", pendingRound);
    console.log("[Teacher] roundData:", roundData);
    console.log("[Teacher] scoreInputs:", scoreInputs);

    if (!pendingRound || !roundData) {
      console.error("[Teacher] Cannot submit: missing pendingRound or roundData");
      alert("Error: Round data not available. Please wait for round to end.");
      return;
    }

    // Validate all scores are filled
    const scores = {};
    const missingScores = [];
    
    for (const teamId of Object.keys(roundData.answers || {})) {
      const scoreValue = scoreInputs[teamId];
      console.log(`[Teacher] Checking score for ${teamId}:`, scoreValue);
      
      if (scoreValue === undefined || scoreValue === null || scoreValue === "") {
        missingScores.push(teamId);
        continue;
      }
      
      const score = parseFloat(scoreValue);
      if (isNaN(score) || score < 0 || score > 10) {
        alert(`Please enter a valid score (0-10) for ${teamId}`);
        return;
      }
      scores[teamId] = score;
    }

    if (missingScores.length > 0) {
      alert(`Please enter scores for all teams. Missing: ${missingScores.join(", ")}`);
      return;
    }

    if (Object.keys(scores).length === 0) {
      alert("No scores to submit. Please enter at least one score.");
      return;
    }

    console.log("[Teacher] Submitting scores:", { round: pendingRound, scores });

    try {
      const token = getToken();
      if (!token) {
        alert("Error: Not authenticated. Please log in again.");
        return;
      }

      console.log("[Teacher] Sending request to /api/score/submit");
      const response = await fetch("http://localhost:3000/api/score/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          round: pendingRound,
          scores: scores
        })
      });

      console.log("[Teacher] Response status:", response.status);

      if (!response.ok) {
        const data = await response.json();
        console.error("[Teacher] Server error:", data);
        throw new Error(data.error || "Failed to submit scores");
      }

      const result = await response.json();
      console.log("[Teacher] Scores submitted successfully:", result);
      alert("Scores submitted successfully!");
      // Scores will be cleared when ROUND_SCORE message is received
    } catch (error) {
      console.error("[Teacher] Error submitting scores:", error);
      alert(`Error submitting scores: ${error.message}`);
    }
  };

  const handleLogout = () => {
    if (room) {
      room.leave();
    }
    removeToken();
    navigate("/login");
    window.location.replace("/login");
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Teacher</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/teacher/cards" style={{ textDecoration: "none", color: "#1976d2", fontSize: "0.9rem" }}>
            Card Controls
          </Link>
          <button
            onClick={handleLogout}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9rem"
            }}
          >
            Logout
          </button>
        </div>
      </div>
      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          Status:{" "}
          <strong>
            {connectionStatus === "connecting" && "Connecting..."}
            {connectionStatus === "connected" && "Connected"}
            {connectionStatus === "error" && "Error (see console)"}
          </strong>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link 
            to="/display"
            target="_blank"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#ff9800",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "0.9rem"
            }}
          >
            Open Classroom Display
          </Link>
          <Link 
            to="/teacher/scoreboard"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#4caf50",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "0.9rem"
            }}
          >
            View Scoreboard
          </Link>
        </div>
      </div>

      {roundNumber > 0 && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#e3f2fd", borderRadius: "4px" }}>
          <strong>Round:</strong> {roundNumber} | 
          <strong> Match Status:</strong> {matchOver ? ` Over - Winner: ${Object.keys(matchScores).find(t => matchScores[t] >= 5) || "N/A"}` : " Active"}
          {Object.keys(matchScores).length > 0 && (
            <span> | <strong>Scores:</strong> {Object.entries(matchScores).map(([tid, pts]) => `${tid}: ${pts}`).join(", ")}</span>
          )}
        </div>
      )}

      {/* Team Info (Teams assigned in lobby) */}
      <div style={{ marginTop: "2rem", marginBottom: "2rem", border: "2px solid #2196f3", padding: "1rem", borderRadius: "4px", backgroundColor: "#e3f2fd" }}>
        <h3 style={{ color: "#2196f3", marginBottom: "0.5rem" }}>📋 Team Information</h3>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
          Teams are assigned in the lobby before the match starts. To manage teams, go to <Link to="/teacher/lobby" style={{ color: "#2196f3", textDecoration: "underline" }}>/teacher/lobby</Link>.
        </p>
      </div>

      {/* Chapter 8: Round Control Panel */}
      <div style={{ marginTop: "2rem", marginBottom: "2rem", padding: "1.5rem", border: "2px solid #ff9800", borderRadius: "8px", backgroundColor: "#fff3e0" }}>
        <h2 style={{ marginTop: 0, color: "#ff9800" }}>🎮 Round Control Panel</h2>
        
        {/* Round State Display */}
        <div style={{ marginBottom: "1.5rem", padding: "0.75rem", backgroundColor: 
          roundState === "ROUND_WAITING" ? "#e0e0e0" :
          roundState === "ROUND_ACTIVE" ? "#c8e6c9" :
          roundState === "ROUND_REVIEW" ? "#fff9c4" :
          "#bbdefb",
          borderRadius: "4px", textAlign: "center" }}>
          <strong style={{ fontSize: "1.2rem" }}>Round State: {roundState}</strong>
          {roundNumber > 0 && <span style={{ marginLeft: "1rem" }}>(Round {roundNumber})</span>}
        </div>

        {/* Question Input */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            Question Text:
          </label>
          <textarea
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Paste or type question here..."
            disabled={roundState === "ROUND_ACTIVE" || roundState === "ROUND_REVIEW"}
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "0.75rem",
              fontSize: "1rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontFamily: "inherit"
            }}
          />
          <button
            onClick={handleSetQuestion}
            disabled={connectionStatus !== "connected" || roundState === "ROUND_ACTIVE" || roundState === "ROUND_REVIEW" || !questionInput.trim()}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: (connectionStatus !== "connected" || roundState === "ROUND_ACTIVE" || roundState === "ROUND_REVIEW" || !questionInput.trim()) ? "not-allowed" : "pointer",
              opacity: (connectionStatus !== "connected" || roundState === "ROUND_ACTIVE" || roundState === "ROUND_REVIEW" || !questionInput.trim()) ? 0.6 : 1
            }}
          >
            Set Question
          </button>
          {questionText && (
            <div style={{ marginTop: "0.5rem", padding: "0.5rem", backgroundColor: "#f5f5f5", borderRadius: "4px", fontSize: "0.9rem" }}>
              <strong>Current Question:</strong> {questionText}
            </div>
          )}
        </div>

        {/* Round Controls */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button
            onClick={handleStartRound}
            disabled={connectionStatus !== "connected" || matchOver || roundState !== "ROUND_WAITING" || !questionText.trim()}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: (connectionStatus !== "connected" || matchOver || roundState !== "ROUND_WAITING" || !questionText.trim()) ? "not-allowed" : "pointer",
              opacity: (connectionStatus !== "connected" || matchOver || roundState !== "ROUND_WAITING" || !questionText.trim()) ? 0.6 : 1
            }}
          >
            Start Round
          </button>
          <button
            onClick={handleEndRound}
            disabled={connectionStatus !== "connected" || roundState !== "ROUND_ACTIVE"}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: (connectionStatus !== "connected" || roundState !== "ROUND_ACTIVE") ? "not-allowed" : "pointer",
              opacity: (connectionStatus !== "connected" || roundState !== "ROUND_ACTIVE") ? 0.6 : 1
            }}
          >
            End Round
          </button>
          <button
            onClick={handleNextRound}
            disabled={connectionStatus !== "connected" || roundState !== "ROUND_ENDED"}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: (connectionStatus !== "connected" || roundState !== "ROUND_ENDED") ? "not-allowed" : "pointer",
              opacity: (connectionStatus !== "connected" || roundState !== "ROUND_ENDED") ? 0.6 : 1
            }}
          >
            Next Round
          </button>
        </div>

        {/* Timer Controls */}
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
          <h3 style={{ marginTop: 0, fontSize: "1rem" }}>⏱️ Timer Controls</h3>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                Duration (seconds):
              </label>
              <input
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{ width: "100px", padding: "0.5rem" }}
              />
            </div>
            <button
              onClick={handleEnableTimer}
              disabled={connectionStatus !== "connected"}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: connectionStatus !== "connected" ? "not-allowed" : "pointer",
                opacity: connectionStatus !== "connected" ? 0.6 : 1
              }}
            >
              Enable Timer
            </button>
            <button
              onClick={handleDisableTimer}
              disabled={connectionStatus !== "connected"}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#9e9e9e",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: connectionStatus !== "connected" ? "not-allowed" : "pointer",
                opacity: connectionStatus !== "connected" ? 0.6 : 1
              }}
            >
              Disable Timer
            </button>
            {timerEnabled && roundState === "ROUND_ACTIVE" && (
              <div style={{ padding: "0.5rem 1rem", backgroundColor: "#fff", borderRadius: "4px", border: "2px solid #ff9800" }}>
                <strong>Timer: {timeRemaining}s</strong>
              </div>
            )}
            {timerEnabled && (
              <span style={{ fontSize: "0.9rem", color: "#4caf50" }}>✓ Timer Enabled</span>
            )}
          </div>
        </div>
      </div>

      <QuestionDisplay
        questionText={questionText}
        roundActive={roundActive}
      />
      {timerEnabled && roundState === "ROUND_ACTIVE" && (
        <Timer timeRemaining={timeRemaining} />
      )}

      {/* Match Settings */}
      <div style={{ marginTop: "1.5rem", padding: "1rem", border: "2px solid #2196f3", borderRadius: "4px", backgroundColor: "#e3f2fd" }}>
        <h3 style={{ marginTop: 0, color: "#2196f3" }}>Match Settings</h3>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
              Rounds to Win:
            </label>
            <input
              type="number"
              min="1"
              value={roundsToWin}
              onChange={(e) => setRoundsToWin(parseInt(e.target.value, 10) || 5)}
              style={{ width: "80px", padding: "0.5rem" }}
              disabled={matchOver}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
              Max Rounds (leave empty for unlimited):
            </label>
            <input
              type="number"
              min="1"
              value={maxRounds || ""}
              onChange={(e) => setMaxRounds(e.target.value === "" ? null : (parseInt(e.target.value, 10) || null))}
              placeholder="Unlimited"
              style={{ width: "120px", padding: "0.5rem" }}
              disabled={matchOver}
            />
          </div>
          <button
            onClick={handleSetMatchSettings}
            disabled={connectionStatus !== "connected" || matchOver}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: connectionStatus !== "connected" || matchOver ? "not-allowed" : "pointer",
              opacity: connectionStatus !== "connected" || matchOver ? 0.6 : 1
            }}
          >
            Update Match Settings
          </button>
          <button
            onClick={handleEndMatch}
            disabled={connectionStatus !== "connected" || matchOver}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: connectionStatus !== "connected" || matchOver ? "not-allowed" : "pointer",
              opacity: connectionStatus !== "connected" || matchOver ? 0.6 : 1,
              marginLeft: "auto"
            }}
          >
            End Match Now
          </button>
          {matchOver && (
            <button
              onClick={handleResetMatch}
              disabled={connectionStatus !== "connected"}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#9c27b0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: connectionStatus !== "connected" ? "not-allowed" : "pointer",
                opacity: connectionStatus !== "connected" ? 0.6 : 1,
                marginLeft: "0.5rem"
              }}
            >
              Reset Match
            </button>
          )}
        </div>
        {matchOver && (
          <div style={{ marginTop: "0.5rem", padding: "0.5rem", backgroundColor: "#ffebee", borderRadius: "4px", color: "#c62828" }}>
            Match is over. Winner: {matchScores && Object.keys(matchScores).length > 0 ? Object.entries(matchScores).sort((a, b) => b[1] - a[1])[0][0] : "N/A"}
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
              Click "Reset Match" to start a new match.
            </div>
          </div>
        )}
      </div>

      {/* Teams Display */}
      <div style={{ marginTop: "2rem", border: "2px solid #9c27b0", padding: "1rem", borderRadius: "4px", backgroundColor: "#f3e5f5" }}>
        <h3 style={{ color: "#9c27b0", marginBottom: "1rem" }}>
          Teams ({Object.keys(teams).length}):
        </h3>
        {Object.keys(teams).length === 0 ? (
          <div style={{ color: "#666", fontStyle: "italic" }}>
            No teams yet. Students will be assigned when they join.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {Object.entries(teams).map(([teamId, team]) => (
              <div
                key={teamId}
                style={{
                  padding: "1rem",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  border: team.locked ? "2px solid #4caf50" : "1px solid #ccc"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div>
                    <h4 style={{ margin: 0, color: "#9c27b0", display: "inline-block", marginRight: "1rem" }}>
                      {team.name || teamId.toUpperCase()}
                    </h4>
                    <span style={{
                      backgroundColor: "#ffd700",
                      color: "#333",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      fontWeight: "bold"
                    }}>
                      💰 {teamGold[teamId] !== undefined ? teamGold[teamId] : 0} gold
                    </span>
                  </div>
                  {team.locked && (
                    <span style={{
                      backgroundColor: "#4caf50",
                      color: "white",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      fontWeight: "bold"
                    }}>
                      🔒 LOCKED
                    </span>
                  )}
                </div>
                
                <div style={{ marginTop: "0.5rem" }}>
                  <div><strong>Writer:</strong> {team.writer ? team.writer.substring(0, 12) + "..." : "None"}</div>
                  <div style={{ marginTop: "0.25rem" }}>
                    <strong>Suggesters ({team.suggesters?.length || 0}):</strong>{" "}
                    {team.suggesters && team.suggesters.length > 0 ? (
                      team.suggesters.map((id, idx) => (
                        <span key={idx}>
                          {id.substring(0, 12)}...{idx < team.suggesters.length - 1 ? ", " : ""}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontStyle: "italic", color: "#666" }}>None</span>
                    )}
                  </div>
                  
                  {team.answer && (
                    <div style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      backgroundColor: "#e8f5e9",
                      borderRadius: "4px",
                      border: "1px solid #4caf50"
                    }}>
                      <strong>Final Answer:</strong>
                      <div style={{ marginTop: "0.25rem", fontStyle: "italic" }}>
                        "{team.answer}"
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: "2rem", border: "2px solid #ff6b6b", padding: "1rem", borderRadius: "4px", backgroundColor: "#fff", minHeight: "100px" }}>
        <h3 style={{ marginBottom: "0.5rem", color: "#ff6b6b" }}>🎴 Card Cast Log ({cardCastLog.length} entries)</h3>
        {cardCastLog.length > 0 ? (
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            {cardCastLog.map((log, idx) => (
              <div
                key={idx}
                style={{
                  padding: "0.5rem",
                  marginBottom: "0.25rem",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  fontSize: "0.9rem"
                }}
              >
                <strong>{log.timestamp}</strong>: Team <strong>{log.casterTeamId}</strong> cast <strong>{log.cardId}</strong> on Team <strong>{log.targetTeamId}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "1rem", color: "#666", fontStyle: "italic" }}>
            No cards cast yet. Cards will appear here when teams cast them.
          </div>
        )}
      </div>

      {pendingRound && roundData && (
        <div style={{ marginBottom: "1.5rem", padding: "1rem", border: "2px solid #ff9800", borderRadius: "4px", backgroundColor: "#fff3e0" }}>
          <h3 style={{ marginTop: 0, color: "#ff9800" }}>📝 Score Round {pendingRound}</h3>
          <div style={{ marginBottom: "1rem" }}>
            <strong>Question:</strong> {roundData.question}
          </div>
          <div style={{ marginBottom: "1rem" }}>
            {Object.entries(roundData.answers || {}).map(([teamId, answerData]) => (
              <div key={teamId} style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "white", borderRadius: "4px", border: "1px solid #ddd" }}>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>{teamId}:</strong> {answerData.text || "(No answer)"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <label>Score (0-10):</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={scoreInputs[teamId] || ""}
                    onChange={(e) => setScoreInputs(prev => ({ ...prev, [teamId]: e.target.value }))}
                    style={{ width: "80px", padding: "0.25rem" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSubmitScores}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "bold"
            }}
          >
            Submit Scores
          </button>
        </div>
      )}

      <div style={{ marginTop: "2rem", border: "2px solid #007bff", padding: "1rem", borderRadius: "4px", backgroundColor: "#f8f9fa" }}>
        <h3 style={{ color: "#007bff" }}>
          Collected Answers ({collectedAnswers.length}):
          {collectedAnswers.length > 0 && " ✅"}
        </h3>
        <div style={{ marginTop: "0.5rem" }}>
          {collectedAnswers.length > 0 ? (
            <>
              <AnswerList answers={collectedAnswers} />
              {/* Direct render test */}
              <div style={{ marginTop: "1rem", padding: "0.5rem", backgroundColor: "#fff3cd", borderRadius: "4px" }}>
                <strong>Direct Render Test:</strong>
                <ul>
                  {collectedAnswers.map((answer, idx) => (
                    <li key={idx}>
                      Answer {idx + 1}: {answer.text || JSON.stringify(answer)}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div style={{ color: "#666", fontStyle: "italic" }}>
              {roundActive ? "Round in progress..." : "No answers yet. Start a round!"}
            </div>
          )}
        </div>
        {/* Always show debug in dev */}
        <details style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#666" }}>
          <summary>Debug Info (click to expand)</summary>
          <pre style={{ backgroundColor: "#f5f5f5", padding: "0.5rem", overflow: "auto" }}>
            {JSON.stringify(collectedAnswers, null, 2)}
          </pre>
          <div style={{ marginTop: "0.5rem", fontSize: "0.7rem" }}>
            State length: {collectedAnswers.length} | 
            Is Array: {Array.isArray(collectedAnswers) ? "Yes" : "No"} |
            Round Active: {roundActive ? "Yes" : "No"}
          </div>
        </details>
      </div>
    </div>
  );
}


