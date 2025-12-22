import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { joinQuizRoom, joinQuizRoomById, castCard } from "../ws/colyseusClient.js";
import { getToken, isAuthenticated, removeToken } from "../utils/auth.js";
import { Timer } from "../components/Timer.jsx";
import { QuestionDisplay } from "../components/QuestionDisplay.jsx";
import { TeamStatus } from "../components/TeamStatus.jsx";
import { WriterInput } from "../components/WriterInput.jsx";
import { SuggesterBox } from "../components/SuggesterBox.jsx";
import { GoldDisplay } from "../components/GoldDisplay.jsx";
import { CardBar } from "../components/CardBar.jsx";
import { EffectsOverlay } from "../components/EffectsOverlay.jsx";
import { XPBar } from "../components/XPBar.jsx";
import { XPPopup } from "../components/XPPopup.jsx";
import { Scoreboard } from "../components/Scoreboard.jsx";
import { RoundResult } from "../components/RoundResult.jsx";
import { MatchResult } from "../components/MatchResult.jsx";

export function Student() {
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  const [questionText, setQuestionText] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [roundState, setRoundState] = useState("ROUND_WAITING"); // Chapter 8: Explicit round state
  const [roundActive, setRoundActive] = useState(false); // Computed from roundState
  const [timerEnabled, setTimerEnabled] = useState(false); // Chapter 8: Timer toggle

  // Team state
  const [teamId, setTeamId] = useState(null);
  const [teamName, setTeamName] = useState(null); // Display name for team
  const [isWriter, setIsWriter] = useState(false);
  const [teamAnswer, setTeamAnswer] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [teamLocked, setTeamLocked] = useState(false);
  const [writer, setWriter] = useState(null);
  const [suggesters, setSuggesters] = useState([]);

  // Suggester state
  const [suggestionText, setSuggestionText] = useState("");

  // Team assembly state
  const [availableTeams, setAvailableTeams] = useState([]);
  const [minTeamSize, setMinTeamSize] = useState(2);
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [newTeamName, setNewTeamName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Card system state
  const [teamGold, setTeamGold] = useState(0);
  const [activeEffects, setActiveEffects] = useState([]);
  const [disabledCards, setDisabledCards] = useState(new Set());
  const [goldCostModifiers, setGoldCostModifiers] = useState({});
  // XP and unlock state
  const [unlockedCards, setUnlockedCards] = useState([]);
  const [playerXP, setPlayerXP] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [xpPopup, setXPPopup] = useState(null);

  // Scoring state
  const [roundScore, setRoundScore] = useState(null);
  const [matchScore, setMatchScore] = useState({});
  const [matchOver, setMatchOver] = useState(false);
  const [roundResult, setRoundResult] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  // Track if user dismissed match result (persist in sessionStorage to survive refreshes)
  const [matchResultDismissed, setMatchResultDismissed] = useState(() => {
    return sessionStorage.getItem('matchResultDismissed') === 'true';
  });
  const [roundData, setRoundData] = useState(null); // ROUND_DATA message
  const [scoresPending, setScoresPending] = useState(false);

  // Use refs for state setters to avoid closure issues
  const setTeamAnswerRef = useRef(setTeamAnswer);
  const setSuggestionsRef = useRef(setSuggestions);
  const isLockingRef = useRef(false);
  const insertingRef = useRef(new Set()); // Track which suggestions are being inserted
  const isWriterRef = useRef(isWriter);
  const teamIdRef = useRef(teamId);
  useEffect(() => {
    setTeamAnswerRef.current = setTeamAnswer;
    setSuggestionsRef.current = setSuggestions;
    isWriterRef.current = isWriter;
    teamIdRef.current = teamId;
  }, [isWriter, teamId]);

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
        // Try to restore team from localStorage (if user was in a team before refresh)
        const savedTeamId = localStorage.getItem("lastTeamId");
        
        // Reset all team-related state when connecting
        setTeamId(null);
        setIsWriter(false);
        setTeamAnswer("");
        setSuggestions([]);
        setTeamLocked(false);
        setWriter(null);
        setSuggesters([]);
        setAvailableTeams([]);
        
        // Reset scoring state when connecting (will be set by messages if needed)
        setRoundResult(null);
        // Don't clear matchResult/matchOver if match result was dismissed (user doesn't want to see it again)
        // Check sessionStorage in case state was reset on refresh
        const wasDismissed = sessionStorage.getItem('matchResultDismissed') === 'true';
        if (!wasDismissed) {
          setMatchResult(null);
          setMatchOver(false);
        }
        setRoundData(null);
        setScoresPending(false);
        
        // Get token and join room
        const token = getToken();
        
        // Check if coming from lobby (has quizRoomId in localStorage)
        const quizRoomId = localStorage.getItem("quizRoomId");
        let joinedRoom;
        
        if (quizRoomId) {
          // Connect to specific QuizRoom from lobby
          console.log("[Student] Connecting to QuizRoom from lobby:", quizRoomId);
          joinedRoom = await joinQuizRoomById(quizRoomId, "student", token);
          localStorage.removeItem("quizRoomId"); // Clear after use
        } else {
          // Normal join (backward compatibility)
          joinedRoom = await joinQuizRoom("student", token);
        }
        
        if (!isMounted) {
          return;
        }

        setRoom(joinedRoom);
        setConnectionStatus("connected");
        
        // Load profile data (XP, level) on connect
        try {
          const profileResponse = await fetch("http://localhost:3000/api/profile", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            setPlayerXP(profile.xp);
            setPlayerLevel(profile.level);
            if (profile.unlockedCards) {
              setUnlockedCards(profile.unlockedCards);
            }
          }
        } catch (error) {
          console.error("Failed to load profile:", error);
        }

        joinedRoom.onMessage("*", (type, message) => {
          console.log("[Student] Message:", type, message);
        });

        joinedRoom.onMessage("TEAM_JOINED", (message) => {
          console.log("[Student] Team joined:", message);
          setTeamId(message.teamId);
          // Set team name from message, fallback to teamId
          const displayName = message.teamName || message.teamId;
          setTeamName(displayName);
          const newIsWriter = Boolean(message.isWriter);
          setIsWriter(newIsWriter);
          isWriterRef.current = newIsWriter;
          setWriter(message.writer || null);
          // Ensure suggesters is always an array
          const suggestersArray = Array.isArray(message.suggesters) ? message.suggesters : [];
          setSuggesters(suggestersArray);
          if (message.currentAnswer) {
            setTeamAnswer(message.currentAnswer);
          }
          setErrorMessage("");
          console.log("[Student] Team joined - isWriter:", newIsWriter, "teamName:", displayName, "suggesters count:", suggestersArray.length);
        });

        joinedRoom.onMessage("TEAM_LEFT", (message) => {
          console.log("[Student] Team left:", message);
          setTeamId(null);
          setIsWriter(false);
          setWriter(null);
          setSuggesters([]);
          setTeamAnswer("");
          setTeamLocked(false);
          // Clear saved team ID
          localStorage.removeItem("lastTeamId");
        });

        joinedRoom.onMessage("AVAILABLE_TEAMS", (message) => {
          console.log("[Student] Available teams:", message);
          setAvailableTeams(message.teams || []);
        });

        joinedRoom.onMessage("TEAM_SETTINGS_UPDATE", (message) => {
          console.log("[Student] Team settings update:", message);
          if (message.minTeamSize !== undefined) {
            setMinTeamSize(message.minTeamSize);
          }
          if (message.maxTeamSize !== undefined) {
            setMaxTeamSize(message.maxTeamSize);
          }
        });

        joinedRoom.onMessage("ERROR", (message) => {
          console.log("[Student] Error:", message);
          setErrorMessage(message.message || "An error occurred");
          setTimeout(() => setErrorMessage(""), 5000); // Clear after 5 seconds
        });
        
        // Listen for XP earned messages
        joinedRoom.onMessage("XP_EARNED", (message) => {
          console.log("[Student] XP earned:", message);
          setPlayerXP(message.newXP);
          setPlayerLevel(message.newLevel);
          
          // Show XP popup
          setXPPopup({
            amount: message.amount,
            id: Date.now()
          });
          
          // Update unlocked cards if new ones were unlocked
          if (message.unlockedCards && message.unlockedCards.length > 0) {
            setUnlockedCards(prev => {
              const updated = [...prev];
              message.unlockedCards.forEach(cardId => {
                if (!updated.includes(cardId)) {
                  updated.push(cardId);
                }
              });
              return updated;
            });
          }
        });

        joinedRoom.onMessage("WRITER_TRANSFERRED", (message) => {
          console.log("[Student] Writer transferred:", message);
          if (message.teamId === teamId) {
            setWriter(message.newWriter);
            // Check if current user is the new writer
            const newIsWriter = message.newWriter === joinedRoom.sessionId;
            setIsWriter(newIsWriter);
            isWriterRef.current = newIsWriter; // Update ref immediately
            // Update suggesters list - old writer becomes suggester, new writer removed from suggesters
            setSuggesters(prev => {
              const newList = [...prev];
              // Remove new writer from suggesters (they're now the writer)
              const newWriterIndex = newList.indexOf(message.newWriter);
              if (newWriterIndex >= 0) {
                newList.splice(newWriterIndex, 1);
              }
              // Add old writer to suggesters (if not already there)
              if (!newList.includes(message.oldWriter)) {
                newList.push(message.oldWriter);
              }
              return newList;
            });
          }
        });

        joinedRoom.onMessage("TEAM_UPDATE", (message) => {
          console.log("[Student] Team update:", message);
          if (message.teams) {
            // Find our team by checking if we're the writer or a suggester
            Object.keys(message.teams).forEach(tId => {
              const team = message.teams[tId];
              const isOurTeam = team.writer === joinedRoom.sessionId || 
                               (Array.isArray(team.suggesters) && team.suggesters.includes(joinedRoom.sessionId));
              if (isOurTeam) {
                setTeamId(tId);
                const newIsWriter = team.writer === joinedRoom.sessionId;
                setIsWriter(newIsWriter);
                isWriterRef.current = newIsWriter;
                setWriter(team.writer || null);
                const suggestersArray = Array.isArray(team.suggesters) ? team.suggesters : [];
                setSuggesters(suggestersArray);
                if (team.answer !== undefined) {
                  setTeamAnswer(team.answer || "");
                }
                setTeamLocked(team.locked || false);
                // Sync suggestions from TEAM_UPDATE for writers
                if (newIsWriter && team.suggestions !== undefined) {
                  const teamSuggestions = Array.isArray(team.suggestions) 
                    ? team.suggestions.map(s => ({
                        text: s.text || "",
                        suggesterId: s.suggesterId || "",
                        timestamp: s.timestamp || Date.now()
                      }))
                    : [];
                  setSuggestionsRef.current(teamSuggestions);
                  console.log("[Student] Writer suggestions synced from TEAM_UPDATE:", teamSuggestions.length);
                }
                console.log("[Student] Team updated - teamId:", tId, "isWriter:", newIsWriter, "suggesters:", suggestersArray.length);
              }
            });
          }
        });

        joinedRoom.onMessage("SUGGESTION", (message) => {
          console.log("[Student] Received suggestion:", message);
          // Use ref to check current isWriter value (avoids stale closure)
          if (isWriterRef.current) {
            // Add to suggestions list
            setSuggestionsRef.current(prev => {
              const newSuggestions = [...(prev || [])];
              newSuggestions.push({
                text: message.text,
                suggesterId: message.suggesterId,
                timestamp: message.timestamp
              });
              return newSuggestions;
            });
          } else {
            console.log("[Student] Received suggestion but not writer, current isWriter:", isWriterRef.current);
          }
        });

        joinedRoom.onMessage("ANSWER_UPDATE", (message) => {
          console.log("[Student] Answer update:", message);
          // Use ref for current teamId to avoid stale closure
          if (message.teamId === teamIdRef.current) {
            setTeamAnswerRef.current(message.answer || "");
            // Clear inserting ref - the insert was successful
            insertingRef.current.clear();
          }
        });

        joinedRoom.onMessage("LOCK", (message) => {
          console.log("[Student] Lock update:", message);
          // Use ref for current teamId to avoid stale closure
          if (message.teamId === teamIdRef.current) {
            setTeamLocked(true);
          }
        });

        // Chapter 8: New message handlers
        joinedRoom.onMessage("ROUND_STATE_UPDATE", (message) => {
          console.log("[Student] Round state update:", message);
          if (message.state) {
            setRoundState(message.state);
            setRoundActive(message.state === "ROUND_ACTIVE");
            if (message.state === "ROUND_ACTIVE") {
              setTeamLocked(false);
              isLockingRef.current = false;
            }
          }
        });

        joinedRoom.onMessage("QUESTION_UPDATE", (message) => {
          console.log("[Student] Question update:", message);
          // Store question but don't show until ROUND_ACTIVE
          if (message.question) {
            // Only update if in ACTIVE state, otherwise store for later
            if (roundState === "ROUND_ACTIVE") {
              setQuestionText(message.question);
            }
          }
        });

        joinedRoom.onMessage("WRITER_ROTATED", (message) => {
          console.log("[Student] Writer rotated:", message);
          if (message.teamId === teamId) {
            // Check if current player is now the writer
            // This will be confirmed via TEAM_UPDATE
          }
        });

        joinedRoom.onMessage("ROUND_STARTED", (message) => {
          console.log("[Student] Round started:", message);
          setQuestionText(message.question);
          setTimeRemaining(message.duration);
          setRoundState("ROUND_ACTIVE");
          setRoundActive(true);
          setTeamLocked(false);
          setSuggestions([]);
          setSuggestionText("");
          setActiveEffects([]); // Clear effects on new round
          isLockingRef.current = false; // Reset lock flag for new round
          setRoundResult(null); // Clear previous round result
          setRoundData(null); // Clear round data
          setScoresPending(false); // Clear pending state
        });

        joinedRoom.onMessage("TIMER_UPDATE", (message) => {
          console.log("[Student] Timer update:", message);
          setTimeRemaining(message.timeRemaining);
          if (message.enabled !== undefined) {
            setTimerEnabled(message.enabled);
          }
        });

        joinedRoom.onMessage("ROUND_ENDED", (message) => {
          console.log("[Student] Round ended:", message);
          setRoundState("ROUND_REVIEW");
          setRoundActive(false);
          setTeamLocked(true);
          setActiveEffects([]); // Clear effects on round end
        });

        joinedRoom.onMessage("ROUND_DATA", (message) => {
          console.log("[Student] Round data (waiting for teacher to score):", message);
          setRoundData(message);
          setScoresPending(true);
          // Clear previous round result
          setRoundResult(null);
        });

        joinedRoom.onMessage("ROUND_SCORE", (message) => {
          // #region agent log
          console.log("[Student] ROUND_SCORE received:", message);
          fetch('http://127.0.0.1:7243/ingest/30c23a0c-c564-4f36-b729-3b41b956410e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Student.jsx:418',message:'ROUND_SCORE received',data:{hasMessage:!!message,matchOver:message?.matchOver,roundNumber:message?.roundNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          console.log("[Student] Round score:", message);
          
          // If match is over, don't set roundResult (matchResult will be set by MATCH_OVER)
          // This prevents showing "Round scored" when match has ended
          if (message.matchOver) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/30c23a0c-c564-4f36-b729-3b41b956410e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Student.jsx:428',message:'Match over in ROUND_SCORE, not setting roundResult',data:{matchOver:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            setMatchOver(true);
            // Don't set roundResult - wait for MATCH_OVER message which will set matchResult
            setRoundResult(null);
          } else {
            setRoundResult(message);
          }
          
          setScoresPending(false);
          setRoundData(null);
          // Update match scores
          if (message.roundPoints?.teams) {
            setMatchScore(message.roundPoints.teams);
          }
        });

        joinedRoom.onMessage("MATCH_OVER", (message) => {
          // #region agent log
          console.log("[Student] MATCH_OVER received:", message);
          fetch('http://127.0.0.1:7243/ingest/30c23a0c-c564-4f36-b729-3b41b956410e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Student.jsx:447',message:'MATCH_OVER received',data:{hasMessage:!!message,winner:message?.winner,hasFinalScores:!!message?.finalScores},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          console.log("[Student] Match over:", message);
          // Only set match result if not already set and not dismissed (prevents duplicate displays)
          setMatchResult(prev => {
            if (prev) {
              console.log("[Student] Match result already set, ignoring duplicate MATCH_OVER");
              return prev;
            }
            return message;
          });
          // Only set matchOver if match result hasn't been dismissed
          // Check both state and sessionStorage (in case state was reset on refresh)
          const wasDismissed = matchResultDismissed || sessionStorage.getItem('matchResultDismissed') === 'true';
          if (!wasDismissed) {
            setMatchOver(true);
          }
        });

        joinedRoom.onMessage("TEAM_SCORE_UPDATE", (message) => {
          console.log("[Student] Team score update:", message);
          setMatchScore(prev => ({
            ...prev,
            [message.teamId]: message.newRoundPoints
          }));
        });

        joinedRoom.onMessage("PLAYER_SCORE_UPDATE", (message) => {
          console.log("[Student] Player score update:", message);
          // Update round result if it exists
          setRoundResult(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              evaluationScores: {
                ...prev.evaluationScores,
                perPlayer: {
                  ...prev.evaluationScores?.perPlayer,
                  [message.playerId]: message.newEvaluationScore
                }
              }
            };
          });
        });

        joinedRoom.onMessage("ROUND_SCORE_UPDATE", (message) => {
          console.log("[Student] Round score update:", message);
          setRoundResult(prev => ({
            ...prev,
            roundWinner: message.newRoundWinner,
            roundPoints: {
              teams: message.updatedScores.teams
            }
          }));
          setMatchScore(message.updatedScores.teams);
        });

        joinedRoom.onMessage("GOLD_UPDATE", (message) => {
          console.log("[Student] Gold update:", message);
          if (message.gold && teamIdRef.current && message.gold[teamIdRef.current] !== undefined) {
            setTeamGold(message.gold[teamIdRef.current]);
          }
        });

        joinedRoom.onMessage("CARD_CAST", (message) => {
          console.log("[Student] Card cast:", message);
          if (message.targetTeamId === teamIdRef.current) {
            // This effect targets our team
            const newEffect = {
              cardId: message.cardId,
              casterTeamId: message.casterTeamId,
              targetTeamId: message.targetTeamId,
              timestamp: Date.now()
            };
            setActiveEffects(prev => [...prev, newEffect]);
          }
        });

        joinedRoom.onMessage("CARD_RULES_UPDATE", (message) => {
          console.log("[Student] CARD_RULES_UPDATE:", message);
          if (message.disabledCards) {
            setDisabledCards(new Set(message.disabledCards));
          }
          if (message.goldCostModifiers) {
            setGoldCostModifiers(message.goldCostModifiers);
          }
        });

        joinedRoom.onStateChange((state) => {
          console.log("[Student] State changed:", state);
          // Chapter 8: Use explicit roundState
          if (state.roundState !== undefined) {
            setRoundState(state.roundState);
            setRoundActive(state.roundState === "ROUND_ACTIVE");
            if (state.roundState === "ROUND_ACTIVE" && state.questionText) {
              setQuestionText(state.questionText);
            }
          } else if (state.roundActive !== undefined) {
            // Backward compatibility
            setRoundActive(state.roundActive);
            setRoundState(state.roundActive ? "ROUND_ACTIVE" : "ROUND_WAITING");
            if (state.roundActive) {
              setQuestionText(state.questionText || "Question loading...");
            }
          }
          setTimeRemaining(state.timeRemaining);
          if (state.timerEnabled !== undefined) {
            setTimerEnabled(state.timerEnabled);
          }
          
          // Sync team state from room state - find our team
          if (state.teams && state.teams.has) {
            state.teams.forEach((team, tId) => {
              const isOurTeam = team.writer === joinedRoom.sessionId || 
                               (Array.isArray(team.suggesters) && team.suggesters.includes(joinedRoom.sessionId));
              if (isOurTeam) {
                setTeamId(tId);
                const newIsWriter = team.writer === joinedRoom.sessionId;
                setIsWriter(newIsWriter);
                isWriterRef.current = newIsWriter;
                setWriter(team.writer || null);
                const suggestersArray = Array.isArray(team.suggesters) ? Array.from(team.suggesters) : [];
                setSuggesters(suggestersArray);
                setTeamAnswer(team.answer || "");
                setTeamLocked(team.locked || false);
                // Sync gold from team state
                if (team.gold !== undefined) {
                  setTeamGold(team.gold);
                }
                // Sync suggestions if writer
                if (newIsWriter && team.suggestions) {
                  const teamSuggestions = Array.from(team.suggestions).map(s => ({
                    text: s.text || "",
                    suggesterId: s.suggesterId || "",
                    timestamp: s.timestamp || Date.now()
                  }));
                  setSuggestionsRef.current(teamSuggestions);
                } else if (!newIsWriter) {
                  setSuggestionsRef.current([]);
                }
              }
            });
          }

          // Sync gold from state
          if (state.gold && state.gold.has && teamIdRef.current) {
            const goldValue = state.gold.get(teamIdRef.current);
            if (goldValue !== undefined) {
              setTeamGold(goldValue);
            }
          }
        });
      } catch (error) {
        console.error("[Student] Failed to join room:", error);
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

  const handleAnswerChange = (newAnswer) => {
    if (!room || !isWriter || teamLocked) {
      return;
    }
    setTeamAnswer(newAnswer);
    // Keep server-side team.answer in sync so timeout can still collect it
    room.send("updateAnswer", { answer: newAnswer });
  };

  const handleInsertSuggestion = (suggestion, index) => {
    if (!room || !isWriter || teamLocked) {
      return;
    }

    // Prevent duplicate inserts
    const suggestionKey = `${suggestion.suggesterId}-${suggestion.timestamp}`;
    if (insertingRef.current.has(suggestionKey)) {
      return;
    }
    insertingRef.current.add(suggestionKey);

    console.log("[Student] Inserting suggestion:", suggestion);
    
    room.send("insertSuggestion", {
      suggesterId: suggestion.suggesterId,
      timestamp: suggestion.timestamp || Date.now(),
      index: -1
    });

    // Remove from set after 2 seconds
    setTimeout(() => {
      insertingRef.current.delete(suggestionKey);
    }, 2000);
  };

  const handleLockAnswer = () => {
    if (!room || !isWriter || teamLocked || !teamAnswer || teamAnswer.trim().length === 0) {
      return;
    }

    // Prevent duplicate sends using ref
    if (isLockingRef.current) {
      console.log("[Student] Lock already in progress, ignoring duplicate request");
      return;
    }

    const trimmedAnswer = teamAnswer.trim();
    if (!trimmedAnswer) {
      alert("Answer cannot be empty");
      return;
    }

    // Mark as locking to prevent double-click
    isLockingRef.current = true;
    setTeamLocked(true);
    
    room.send("lockAnswer", { answer: trimmedAnswer });
    console.log("[Student] Sent lockAnswer with answer:", trimmedAnswer);
  };

  const handleSubmitSuggestion = (text) => {
    if (!room || isWriter || teamLocked) {
      return;
    }

    room.send("suggestion", { text });
    console.log("[Student] Sent suggestion:", text);
    setSuggestionText("");
  };

  const handleCreateTeam = () => {
    if (!room || teamId) {
      return;
    }

    const teamName = newTeamName.trim() || `Team${Date.now()}`;
    room.send("createTeam", { teamName });
    console.log("[Student] Sent createTeam:", teamName);
    setNewTeamName("");
  };

  const handleJoinTeam = (targetTeamId) => {
    if (!room || teamId) {
      // Already in a team
      return;
    }

    room.send("joinTeam", { teamId: targetTeamId });
    console.log("[Student] Sent joinTeam:", targetTeamId);
  };

  const handleLeaveTeam = () => {
    if (!room || !teamId) {
      return;
    }

    if (roundActive && !teamLocked) {
      if (!confirm("Leave team? You won't be able to participate in the current round.")) {
        return;
      }
    }

    room.send("leaveTeam", {});
    console.log("[Student] Sent leaveTeam");
  };

  const handleTransferWriter = (newWriterId) => {
    console.log("[Student] handleTransferWriter called:", { room: !!room, teamId, isWriter, newWriterId });
    if (!room || !teamId || !isWriter) {
      console.log("[Student] Cannot transfer: missing requirements", { room: !!room, teamId, isWriter });
      return;
    }

    if (!confirm(`Transfer writer role to this team member?`)) {
      return;
    }

    room.send("transferWriter", { newWriterId });
    console.log("[Student] Sent transferWriter:", newWriterId);
  };

  const handleCastCard = (cardId, targetTeamId) => {
    console.log("[Student] handleCastCard called:", { cardId, targetTeamId, hasRoom: !!room, teamId, roundActive });
    if (!room) {
      console.warn("[Student] Cannot cast card: no room");
      return;
    }
    if (!teamId) {
      console.warn("[Student] Cannot cast card: no teamId");
      return;
    }
    if (!roundActive) {
      console.warn("[Student] Cannot cast card: round not active");
      return;
    }
    console.log("[Student] Sending castCard message to server");
    castCard(room, cardId, targetTeamId);
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
        <h1>Student</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link
            to="/shop"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#9c27b0",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "0.9rem",
              fontWeight: "bold"
            }}
          >
            🎴 Shop
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
      <div style={{ marginBottom: "1rem" }}>
        Status:{" "}
        <strong>
          {connectionStatus === "connecting" && "Connecting..."}
          {connectionStatus === "connected" && "Connected"}
          {connectionStatus === "error" && "Error (see console)"}
        </strong>
      </div>

      {errorMessage && (
        <div style={{
          padding: "1rem",
          backgroundColor: "#ffebee",
          color: "#c62828",
          borderRadius: "4px",
          marginBottom: "1rem",
          border: "1px solid #ef5350"
        }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Match Result - Show even if not on a team (match is over) */}
      {matchOver && matchResult && !matchResultDismissed && sessionStorage.getItem('matchResultDismissed') !== 'true' ? (
        <MatchResult 
          matchData={matchResult} 
          teamId={teamId} 
          onClose={() => {
            // Hide match result, mark as dismissed, leave room, and redirect to lobby
            setMatchResultDismissed(true);
            sessionStorage.setItem('matchResultDismissed', 'true');
            setMatchOver(false);
            
            // Leave the quiz room
            if (room) {
              room.leave();
            }
            
            // Redirect to lobby after a short delay to allow state updates
            setTimeout(() => {
              navigate("/lobby");
            }, 100);
          }}
        />
      ) : roundResult ? (
        <RoundResult roundData={roundResult} teamId={teamId} />
      ) : null}

      {!teamId ? (
        /* Team Assembly UI */
        <div style={{ marginBottom: "2rem", border: "2px solid #2196f3", padding: "1.5rem", borderRadius: "4px", backgroundColor: "#e3f2fd" }}>
          <h3 style={{ color: "#2196f3", marginBottom: "1rem" }}>👥 Join or Create a Team</h3>
          <div style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#666" }}>
            Teams must have between {minTeamSize} and {maxTeamSize} members.
          </div>

          {/* Create Team */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>Create New Team:</h4>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name (optional)"
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  border: "2px solid #2196f3",
                  borderRadius: "4px",
                  fontSize: "1rem"
                }}
              />
              <button
                onClick={handleCreateTeam}
                disabled={connectionStatus !== "connected"}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: connectionStatus === "connected" ? "#2196f3" : "#ccc",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: connectionStatus === "connected" ? "pointer" : "not-allowed",
                  fontWeight: "bold"
                }}
              >
                Create Team
              </button>
            </div>
          </div>

          {/* Join Existing Team */}
          {availableTeams.length > 0 && (
            <div>
              <h4 style={{ marginBottom: "0.5rem" }}>Join Existing Team:</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {availableTeams.map((team) => (
                  <div
                    key={team.teamId}
                    style={{
                      padding: "0.75rem",
                      backgroundColor: "white",
                      borderRadius: "4px",
                      border: "1px solid #90caf9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong>{team.teamId.toUpperCase()}</strong>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>
                        {team.currentSize}/{team.maxSize} members • Writer: {team.writerName}
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinTeam(team.teamId)}
                      disabled={connectionStatus !== "connected"}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: connectionStatus === "connected" ? "#4caf50" : "#ccc",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: connectionStatus === "connected" ? "pointer" : "not-allowed"
                      }}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableTeams.length === 0 && (
            <div style={{ color: "#666", fontStyle: "italic" }}>
              No teams available. Create a new team to get started!
            </div>
          )}
        </div>
      ) : (
        /* Team Management UI */
        <>
          <TeamStatus
            teamId={teamId}
            teamName={teamName}
            isWriter={isWriter}
            teamRole={isWriter ? "writer" : "suggester"}
            writer={writer}
            suggesters={suggesters}
            locked={teamLocked}
            onTransferWriter={handleTransferWriter}
            currentClientSessionId={room?.sessionId}
          />

          <GoldDisplay gold={teamGold} teamId={teamId} />
          
          <XPBar xp={playerXP} level={playerLevel} />

          <Scoreboard scores={matchScore} roundNumber={roundResult?.roundNumber || 0} matchOver={matchOver} />

          {teamId && (
            <CardBar
              gold={teamGold}
              onCastCard={handleCastCard}
              disabled={teamLocked}
              roundActive={roundActive}
              availableTeams={availableTeams}
              currentTeamId={teamId}
              unlockedCards={unlockedCards}
              playerLevel={playerLevel}
              disabledCards={disabledCards}
              goldCostModifiers={goldCostModifiers}
            />
          )}

          <EffectsOverlay activeEffects={activeEffects} teamId={teamId} />
          
          {xpPopup && (
            <XPPopup
              amount={xpPopup.amount}
              onComplete={() => setXPPopup(null)}
            />
          )}

          {/* #region agent log */}
          {(() => {
            fetch('http://127.0.0.1:7243/ingest/30c23a0c-c564-4f36-b729-3b41b956410e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Student.jsx:900',message:'Rendering result components',data:{matchOver,hasMatchResult:!!matchResult,hasRoundResult:!!roundResult},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            return null;
          })()}
          {/* #endregion */}
          
          {/* Round Result - Only show if match is not over */}
          {!matchOver && roundResult ? (
            <RoundResult roundData={roundResult} teamId={teamId} />
          ) : null}

          {/* Writer Transfer Controls */}
          {isWriter && Array.isArray(suggesters) && suggesters.length > 0 && (
            <div style={{ marginBottom: "1rem", padding: "1rem", backgroundColor: "#fff9c4", borderRadius: "4px", border: "2px solid #fbc02d" }}>
              <h4 style={{ marginBottom: "0.5rem", color: "#f57c00" }}>⚙️ Transfer Writer Role</h4>
              {teamLocked ? (
                <div style={{ color: "#666", fontStyle: "italic" }}>Cannot transfer writer role while round is locked.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {suggesters.map((suggesterId) => (
                    <button
                      key={suggesterId}
                      onClick={() => handleTransferWriter(suggesterId)}
                      style={{
                        padding: "0.75rem 1rem",
                        backgroundColor: "#ff9800",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        textAlign: "left",
                        fontWeight: "bold",
                        fontSize: "1rem"
                      }}
                    >
                      👤 Transfer Writer Role to {suggesterId.substring(0, 20)}...
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Leave Team Button */}
          {!roundActive && (
            <button
              onClick={handleLeaveTeam}
              style={{
                marginBottom: "1rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Leave Team
            </button>
          )}
        </>
      )}

      {/* Chapter 8: Question Display with State Messages */}
      {roundState === "ROUND_ACTIVE" ? (
        <QuestionDisplay
          questionText={questionText}
          roundActive={true}
        />
      ) : (
        <div style={{ marginBottom: "2rem", padding: "2rem", backgroundColor: "#f5f5f5", borderRadius: "8px", textAlign: "center" }}>
          <h2 style={{ color: "#666" }}>
            {roundState === "ROUND_WAITING" && "⏳ Waiting for teacher to start round..."}
            {roundState === "ROUND_REVIEW" && "✅ Round complete. Waiting for scoring..."}
            {roundState === "ROUND_ENDED" && "🎯 Round scored. Waiting for next round..."}
            {!roundState && "⏳ Waiting..."}
          </h2>
          {roundState === "ROUND_ACTIVE" && questionText && (
            <p style={{ marginTop: "1rem", fontSize: "1.1rem" }}>{questionText}</p>
          )}
        </div>
      )}
      {/* Chapter 8: Timer only shows if enabled and active */}
      {timerEnabled && roundState === "ROUND_ACTIVE" && (
        <Timer timeRemaining={timeRemaining} />
      )}

      {/* Chapter 8: Input fields only enabled in ROUND_ACTIVE */}
      {isWriter ? (
        <WriterInput
          teamAnswer={teamAnswer}
          suggestions={suggestions}
          onAnswerChange={handleAnswerChange}
          onInsertSuggestion={handleInsertSuggestion}
          onLockAnswer={handleLockAnswer}
          disabled={roundState !== "ROUND_ACTIVE"}
          locked={teamLocked}
        />
      ) : (
        <SuggesterBox
          suggestionText={suggestionText}
          teamAnswer={teamAnswer}
          onSuggestionChange={setSuggestionText}
          onSubmitSuggestion={handleSubmitSuggestion}
          disabled={roundState !== "ROUND_ACTIVE" || teamLocked}
        />
      )}
    </div>
  );
}


