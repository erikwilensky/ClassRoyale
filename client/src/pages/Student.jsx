import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { castCard } from "../ws/colyseusClient.js";
import { getToken, isAuthenticated, removeToken } from "../utils/auth.js";
import { useQuizRoomState } from "../quiz/useQuizRoomState.js";
import { deriveStudentCapabilities, deriveRoundViewModel } from "../quiz/viewModels.js";
import { EffectsOverlay } from "../components/EffectsOverlay.jsx";
import { XPBar } from "../components/XPBar.jsx";
import { XPPopup } from "../components/XPPopup.jsx";
import { RoundResult } from "../components/RoundResult.jsx";
import { MatchResult } from "../components/MatchResult.jsx";
import { useCardDrag } from "../ui/drag/useCardDrag.js";
import { getEffectiveGoldCost, getValidDropTargets, canStartDrag } from "../ui/drag/dragRules.js";
import { StudentClashLayout } from "../ui/clash/StudentClashLayout.jsx";

export function Student() {
  const navigate = useNavigate();
  const token = getToken();
  
  // Use centralized state hook
  const { state, room, connectionStatus } = useQuizRoomState({ role: "student", token });
  
  // Extract normalized state values
  const roundState = state.round?.roundState || "ROUND_WAITING";
  const roundActive = roundState === "ROUND_ACTIVE";
  const questionText = state.round?.questionText || "";
  const timeRemaining = state.round?.timeRemaining || 0;
  const timerEnabled = state.round?.timerEnabled || false;
  const moderationState = state.moderation || { mutedPlayers: [], frozenTeams: [], roundFrozen: false };
  const matchScore = state.scoring?.matchScores || {};
  const roundResult = state.scoring?.roundResult || null;
  const matchResult = state.scoring?.matchResult || null;
  const matchOver = state.scoring?.matchOver || false;
  const disabledCards = new Set(state.cardRules?.disabledCards || []);
  const goldCostModifiers = state.cardRules?.goldCostModifiers || {};
  
  // Student-specific local state (UI state, not normalized)
  const [suggestionText, setSuggestionText] = useState("");
  const [availableTeams, setAvailableTeams] = useState([]);
  const [minTeamSize, setMinTeamSize] = useState(2);
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [newTeamName, setNewTeamName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [unlockedCards, setUnlockedCards] = useState([]);
  const [playerXP, setPlayerXP] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [xpPopup, setXPPopup] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [matchResultDismissed, setMatchResultDismissed] = useState(() => {
    return sessionStorage.getItem('matchResultDismissed') === 'true';
  });
  const [roundData, setRoundData] = useState(null);
  const [scoresPending, setScoresPending] = useState(false);
  
  // Team state - derived from normalized state by finding our team
  const [teamId, setTeamId] = useState(null);
  const [teamName, setTeamName] = useState(null);
  const [isWriter, setIsWriter] = useState(false);
  const [teamAnswer, setTeamAnswer] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [teamLocked, setTeamLocked] = useState(false);
  const [writer, setWriter] = useState(null);
  const [suggesters, setSuggesters] = useState([]);
  const [teamGold, setTeamGold] = useState(0);
  const [activeEffects, setActiveEffects] = useState([]);
  
  // Use refs for state setters to avoid closure issues
  const setTeamAnswerRef = useRef(setTeamAnswer);
  const setSuggestionsRef = useRef(setSuggestions);
  const isLockingRef = useRef(false);
  const insertingRef = useRef(new Set());
  const isWriterRef = useRef(isWriter);
  const teamIdRef = useRef(teamId);
  const teamDropRefs = useRef(new Map());
  
  useEffect(() => {
    setTeamAnswerRef.current = setTeamAnswer;
    setSuggestionsRef.current = setSuggestions;
    isWriterRef.current = isWriter;
    teamIdRef.current = teamId;
  }, [isWriter, teamId]);

  // Drag state (Chapter 14)
  const {
    isDragging,
    dragCardId,
    dragCardMeta,
    pointerX,
    pointerY,
    validTargetTeamIds,
    hoveredTargetTeamId,
    selectedCardId,
    beginDrag,
    updatePointer,
    endDrag,
    cancelDrag,
    selectCard,
    clearSelection,
    setHoveredTargetTeamId,
    isTeamValidDropTarget,
  } = useCardDrag();
  
  // Derive team info from normalized state by matching sessionId
  useEffect(() => {
    if (!room || !state.teams) return;
    
    const sessionId = room.sessionId;
    for (const [tId, teamData] of Object.entries(state.teams)) {
      const isOurTeam = teamData.writer === sessionId || 
                       (Array.isArray(teamData.suggesters) && teamData.suggesters.includes(sessionId));
      if (isOurTeam) {
        setTeamId(tId);
        setTeamName(teamData.name || tId);
        const newIsWriter = teamData.writer === sessionId;
        setIsWriter(newIsWriter);
        isWriterRef.current = newIsWriter;
        setWriter(teamData.writer || null);
        const suggestersArray = Array.isArray(teamData.suggesters) ? teamData.suggesters : [];
        setSuggesters(suggestersArray);
        if (teamData.answer !== undefined) {
          setTeamAnswer(teamData.answer || "");
        }
        setTeamLocked(teamData.locked || false);
        setTeamGold(teamData.gold || 0);
        // Sync suggestions for writers
        if (newIsWriter && teamData.suggestions !== undefined) {
          const teamSuggestions = Array.isArray(teamData.suggestions) 
            ? teamData.suggestions.map(s => ({
                text: s.text || "",
                suggesterId: s.suggesterId || "",
                timestamp: s.timestamp || Date.now()
              }))
            : [];
          setSuggestions(teamSuggestions);
        }
        break;
      }
    }
  }, [room, state.teams]);
  
  // Derive student capabilities
  const capabilities = useMemo(() => {
    if (!playerId || !teamId) {
      return {
        canWriteAnswer: false,
        canLockAnswer: false,
        canSuggest: false,
        canInsertSuggestion: false,
        canCastCards: false
      };
    }
    return deriveStudentCapabilities(state, {
      playerId,
      teamId,
      isWriter,
      teamAnswer
    });
  }, [state, playerId, teamId, isWriter, teamAnswer]);

  const allTeamIds = useMemo(() => Object.keys(state.teams || {}), [state.teams]);
  const opponentTeamIds = useMemo(
    () => (teamId ? allTeamIds.filter((id) => id !== teamId) : []),
    [allTeamIds, teamId]
  );

  const registerDropRef = (teamIdForRef, el) => {
    if (!el) return;
    teamDropRefs.current.set(teamIdForRef, el);
  };

  const handleGlobalPointerMove = (event) => {
    if (!isDragging) return;
    updatePointer(event);

    // Hit test to update hovered target
    let newHovered = null;
    for (const [tId, el] of teamDropRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        newHovered = tId;
        break;
      }
    }
    setHoveredTargetTeamId(newHovered);
  };

  const handleGlobalPointerUp = (event) => {
    if (!isDragging) return;
    updatePointer(event);
    const result = endDrag();
    if (result.didDrop && result.cardId && result.targetTeamId) {
      handleCastCard(result.cardId, result.targetTeamId, { skipModerationCheck: false, fromDrag: true });
    }
  };

  useEffect(() => {
    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  });

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
  }, [navigate]);
  
  // Load profile data (XP, level) on connect
  useEffect(() => {
    if (!room || !token) return;
    
    async function loadProfile() {
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
          if (profile.id) {
            setPlayerId(profile.id);
          }
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    }
    
    loadProfile();
  }, [room, token]);
  
  // Handle student-specific messages that aren't in normalized state
  useEffect(() => {
    if (!room) return;
    
    // TEAM_JOINED - handled via TEAM_UPDATE in normalized state, but keep for immediate UI update
    room.onMessage("TEAM_JOINED", (message) => {
      console.log("[Student] Team joined:", message);
      setTeamId(message.teamId);
      setTeamName(message.teamName || message.teamId);
      const newIsWriter = Boolean(message.isWriter);
      setIsWriter(newIsWriter);
      isWriterRef.current = newIsWriter;
      setWriter(message.writer || null);
      const suggestersArray = Array.isArray(message.suggesters) ? message.suggesters : [];
      setSuggesters(suggestersArray);
      if (message.currentAnswer) {
        setTeamAnswer(message.currentAnswer);
      }
      setErrorMessage("");
      localStorage.setItem("lastTeamId", message.teamId);
    });
    
    room.onMessage("TEAM_LEFT", (message) => {
      console.log("[Student] Team left:", message);
      setTeamId(null);
      setIsWriter(false);
      setWriter(null);
      setSuggesters([]);
      setTeamAnswer("");
      setTeamLocked(false);
      localStorage.removeItem("lastTeamId");
    });
    
    room.onMessage("AVAILABLE_TEAMS", (message) => {
      console.log("[Student] Available teams:", message);
      setAvailableTeams(message.teams || []);
    });
    
    room.onMessage("TEAM_SETTINGS_UPDATE", (message) => {
      console.log("[Student] Team settings update:", message);
      if (message.minTeamSize !== undefined) {
        setMinTeamSize(message.minTeamSize);
      }
      if (message.maxTeamSize !== undefined) {
        setMaxTeamSize(message.maxTeamSize);
      }
    });
    
    room.onMessage("ERROR", (message) => {
      console.log("[Student] Error:", message);
      setErrorMessage(message.message || "An error occurred");
      setTimeout(() => setErrorMessage(""), 5000);
    });
    
    room.onMessage("XP_EARNED", (message) => {
      console.log("[Student] XP earned:", message);
      setPlayerXP(message.newXP);
      setPlayerLevel(message.newLevel);
      setXPPopup({
        amount: message.amount,
        id: Date.now()
      });
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
    
    room.onMessage("WRITER_TRANSFERRED", (message) => {
      console.log("[Student] Writer transferred:", message);
      if (message.teamId === teamId) {
        setWriter(message.newWriter);
        const newIsWriter = message.newWriter === room.sessionId;
        setIsWriter(newIsWriter);
        isWriterRef.current = newIsWriter;
        setSuggesters(prev => {
          const newList = [...prev];
          const newWriterIndex = newList.indexOf(message.newWriter);
          if (newWriterIndex >= 0) {
            newList.splice(newWriterIndex, 1);
          }
          if (!newList.includes(message.oldWriter)) {
            newList.push(message.oldWriter);
          }
          return newList;
        });
      }
    });
    
    room.onMessage("SUGGESTION", (message) => {
      console.log("[Student] Received suggestion:", message);
      if (isWriterRef.current) {
        setSuggestionsRef.current(prev => {
          const newSuggestions = [...(prev || [])];
          newSuggestions.push({
            text: message.text,
            suggesterId: message.suggesterId,
            timestamp: message.timestamp
          });
          return newSuggestions;
        });
      }
    });
    
    room.onMessage("ANSWER_UPDATE", (message) => {
      console.log("[Student] Answer update:", message);
      if (message.teamId === teamIdRef.current) {
        setTeamAnswerRef.current(message.answer || "");
        insertingRef.current.clear();
      }
    });
    
    room.onMessage("LOCK", (message) => {
      console.log("[Student] Lock update:", message);
      if (message.teamId === teamIdRef.current) {
        setTeamLocked(true);
      }
    });
    
    room.onMessage("ROUND_STARTED", (message) => {
      console.log("[Student] Round started:", message);
      setTeamLocked(false);
      setSuggestions([]);
      setSuggestionText("");
      setActiveEffects([]);
      isLockingRef.current = false;
      setRoundData(null);
      setScoresPending(false);
    });
    
    room.onMessage("ROUND_ENDED", (message) => {
      console.log("[Student] Round ended:", message);
      setTeamLocked(true);
      setActiveEffects([]);
    });
    
    room.onMessage("ROUND_DATA", (message) => {
      console.log("[Student] Round data:", message);
      setRoundData(message);
      setScoresPending(true);
    });
    
    room.onMessage("ROUND_SCORE", (message) => {
      console.log("[Student] Round score:", message);
      if (message.matchOver) {
        // Match over - handled by normalized state
        setScoresPending(false);
        setRoundData(null);
      } else {
        // Round scored but match continues
        setScoresPending(false);
        setRoundData(null);
      }
    });
    
    room.onMessage("MATCH_OVER", (message) => {
      console.log("[Student] Match over:", message);
      const wasDismissed = matchResultDismissed || sessionStorage.getItem('matchResultDismissed') === 'true';
      if (!wasDismissed) {
        // Match result will be set by normalized state
      }
    });
    
    room.onMessage("TEAM_SCORE_UPDATE", (message) => {
      console.log("[Student] Team score update:", message);
      // Match scores are handled by normalized state
    });
    
    room.onMessage("PLAYER_SCORE_UPDATE", (message) => {
      console.log("[Student] Player score update:", message);
      // Round result updates are handled by normalized state
    });
    
    room.onMessage("ROUND_SCORE_UPDATE", (message) => {
      console.log("[Student] Round score update:", message);
      // Match scores are handled by normalized state
    });
    
    // CARD_CAST - filter for our team's effects
    room.onMessage("CARD_CAST", (message) => {
      console.log("[Student] Card cast:", message);
      if (message.targetTeamId === teamIdRef.current) {
        const newEffect = {
          cardId: message.cardId,
          casterTeamId: message.casterTeamId,
          targetTeamId: message.targetTeamId,
          timestamp: Date.now()
        };
        setActiveEffects(prev => [...prev, newEffect]);
      }
    });
  }, [room, teamId, matchResultDismissed]);
  
  // Filter active effects for our team from normalized state
  useEffect(() => {
    if (!teamId) {
      setActiveEffects([]);
      return;
    }
    const ourEffects = (state.effects?.activeEffects || []).filter(
      effect => effect.targetTeamId === teamId
    );
    setActiveEffects(ourEffects);
  }, [state.effects?.activeEffects, teamId]);

  const handleAnswerChange = (newAnswer) => {
    // Use capabilities from view model
    if (!capabilities.canWriteAnswer) {
      return;
    }
    if (!room || teamLocked) {
      return;
    }
    setTeamAnswer(newAnswer);
    room.send("updateAnswer", { answer: newAnswer });
  };

  const handleInsertSuggestion = (suggestion, index) => {
    // Use capabilities from view model
    if (!capabilities.canInsertSuggestion) {
      return;
    }
    if (!room || teamLocked) {
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
    // Chapter 12: Check moderation state
    if (moderationState.roundFrozen) {
      return; // Round is frozen
    }
    if (teamId && moderationState.frozenTeams.includes(teamId)) {
      return; // Team is frozen
    }
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
    // Chapter 12: Check moderation state
    if (moderationState.roundFrozen) {
      return; // Round is frozen
    }
    if (playerId && moderationState.mutedPlayers.includes(playerId)) {
      return; // Player is muted
    }
    if (teamId && moderationState.frozenTeams.includes(teamId)) {
      return; // Team is frozen
    }
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

  const handleCastCard = (cardId, targetTeamId, options = {}) => {
    console.log("[Student] handleCastCard called:", { cardId, targetTeamId, hasRoom: !!room, teamId, roundActive });
    // Chapter 12: Check moderation state
    if (!options.skipModerationCheck && moderationState.roundFrozen) {
      console.warn("[Student] Cannot cast card: round is frozen");
      return;
    }
    if (!options.skipModerationCheck && playerId && moderationState.mutedPlayers.includes(playerId)) {
      console.warn("[Student] Cannot cast card: player is muted");
      return;
    }
    if (!options.skipModerationCheck && teamId && moderationState.frozenTeams.includes(teamId)) {
      console.warn("[Student] Cannot cast card: team is frozen");
      return;
    }
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

  const handleCardPointerDown = (card, event) => {
    if (!teamId || !capabilities.canCastCards || !roundActive || matchOver) {
      return;
    }
    const isOwned = unlockedCards.includes(card.id);
    const isDisabled = disabledCards.has(card.id);
    const effectiveCost = getEffectiveGoldCost({ card, goldCostModifiers });
    const canDrag = canStartDrag({
      card,
      capabilities,
      isOwned,
      isDisabled,
      effectiveGoldCost: effectiveCost,
      teamGold,
      roundState,
      matchOver,
    });
    if (!canDrag) return;

    const validTargets = getValidDropTargets({
      card,
      myTeamId: teamId,
      teamIds: allTeamIds,
    });
    if (validTargets.length === 0) {
      return;
    }

    event.preventDefault();
    beginDrag(
      {
        id: card.id,
        name: card.name,
        type: card.type,
        displayCostText:
          card.type === "cosmetic"
            ? "Free"
            : `${effectiveCost}💰`,
      },
      event,
      validTargets
    );
  };

  const handleCardClickForSelect = (card, event) => {
    if (!teamId || !capabilities.canCastCards || !roundActive || matchOver) {
      return;
    }
    const isOwned = unlockedCards.includes(card.id);
    const isDisabled = disabledCards.has(card.id);
    const effectiveCost = getEffectiveGoldCost({ card, goldCostModifiers });
    const canUse = canStartDrag({
      card,
      capabilities,
      isOwned,
      isDisabled,
      effectiveGoldCost: effectiveCost,
      teamGold,
      roundState,
      matchOver,
    });
    if (!canUse) return;

    // For self-target cards, treat click as immediate cast on own team.
    if (card.target === "self") {
      handleCastCard(card.id, teamId);
      clearSelection();
      return;
    }

    // For opponent-target cards, if there is exactly one opponent, cast immediately.
    if (card.target === "opponent" && opponentTeamIds.length === 1) {
      handleCastCard(card.id, opponentTeamIds[0]);
      clearSelection();
      return;
    }

    // Otherwise, use tap-to-select fallback.
    if (selectedCardId === card.id) {
      clearSelection();
    } else {
      selectCard(card.id);
    }
  };

  const handleTeamClickForCast = (targetTeamId) => {
    if (!selectedCardId || !teamId) return;
    handleCastCard(selectedCardId, targetTeamId);
    clearSelection();
  };

  const handleLogout = () => {
    if (room) {
      room.leave();
    }
    removeToken();
    navigate("/login");
    window.location.replace("/login");
  };

  const roundVm = deriveRoundViewModel(state);

  const hudProps = {
    round: { ...roundVm, roundResult },
    connectionStatus,
    roomId: state.connection?.roomId,
    teamName,
    teamGold,
    matchScores: matchScore,
    matchOver,
    moderation: moderationState,
    playerId,
    onLogout: handleLogout,
    showShopLink: true,
  };

  const yourTeam = teamId
    ? {
        id: teamId,
        name: teamName || teamId,
        gold: teamGold,
        writer,
        locked: teamLocked,
        isFrozen: moderationState.frozenTeams?.includes?.(teamId) || false,
      }
    : null;

  const opponentTeams = opponentTeamIds.map((id) => {
    const t = state.teams?.[id] || {};
    return {
      teamId: id,
      name: t.name || id,
      gold: t.gold || 0,
      writer: t.writer || null,
      locked: !!t.locked,
      isFrozen: moderationState.frozenTeams?.includes?.(id) || false,
    };
  });

  const arenaProps = {
    yourTeam,
    opponentTeams,
    hoveredTeamId: hoveredTargetTeamId,
    isTeamValidDropTarget,
    registerDropRef,
    onTeamClickForCast: selectedCardId ? handleTeamClickForCast : undefined,
  };

  const answerProps = {
    isWriter,
    teamId,
    teamLocked,
    teamAnswer,
    suggestions,
    onAnswerChange: handleAnswerChange,
    onInsertSuggestion: handleInsertSuggestion,
    onLockAnswer: handleLockAnswer,
    canWriteAnswer: capabilities.canWriteAnswer,
    suggestionText,
    onSuggestionChange: setSuggestionText,
    onSubmitSuggestion: handleSubmitSuggestion,
    canSuggest: capabilities.canSuggest,
  };

  // Chapter 16: Determine if match has started (Round 1 active) and get deck filter
  // Use deckLocked from server state as the source of truth - server sets it when match starts
  const roundNumber = state.round?.roundNumber || 0;
  const serverDeckLocked = state.teams?.[teamId]?.deckLocked || false;
  
  // Debug: Log deck locked state
  if (teamId) {
    console.log('[Student] Deck state:', { 
      teamId, 
      serverDeckLocked, 
      roundNumber, 
      deckLockedFromState: state.teams?.[teamId]?.deckLocked,
      teamData: state.teams?.[teamId] 
    });
  }
  // Match started when roundNumber >= 1 (for filtering hand cards to deck only)
  const matchStarted = roundNumber >= 1;
  const teamDeckSlots = teamId && state.teams?.[teamId]?.deckSlots 
    ? state.teams[teamId].deckSlots 
    : [null, null, null, null];
  const deckFilterIds = matchStarted 
    ? teamDeckSlots.filter(Boolean) // Only non-null card IDs
    : null; // Show all cards pre-match

  const handProps = {
    gold: teamGold,
    disabled: !capabilities.canCastCards,
    roundActive,
    availableTeams,
    currentTeamId: teamId,
    unlockedCards,
    playerLevel,
    disabledCards,
    goldCostModifiers,
    onCardPointerDown: handleCardPointerDown,
    onCardClickForSelect: handleCardClickForSelect,
    selectedCardId,
    cardFilterIds: deckFilterIds, // Chapter 16: Filter to deck only when match started
  };

  const teamSelectionContent = (
    <>
      <h3>👥 Join or Create a Team</h3>
      <p className="clash-team-select-sub">
        Teams must have between {minTeamSize} and {maxTeamSize} members.
      </p>
      <div className="clash-team-row">
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="Enter team name (optional)"
          className="clash-input"
        />
        <button
          onClick={handleCreateTeam}
          disabled={connectionStatus !== "connected"}
          className="clash-btn clash-btn--primary"
        >
          Create Team
        </button>
      </div>
      {availableTeams.length > 0 ? (
        <div className="clash-team-list">
          {availableTeams.map((team) => (
            <div key={team.teamId} className="clash-team-card">
              <div className="clash-team-card-main">
                <strong>{team.teamId.toUpperCase()}</strong>
                <div className="clash-team-card-sub">
                  {team.currentSize}/{team.maxSize} members • Writer:{" "}
                  {team.writerName}
                </div>
              </div>
              <button
                onClick={() => handleJoinTeam(team.teamId)}
                disabled={connectionStatus !== "connected"}
                className="clash-btn clash-btn--success"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="clash-team-empty">
          No teams available. Create a new team to get started!
        </p>
      )}
    </>
  );

  return (
    <>
      {matchOver &&
      matchResult &&
      !matchResultDismissed &&
      sessionStorage.getItem("matchResultDismissed") !== "true" ? (
        <MatchResult
          matchData={matchResult}
          teamId={teamId}
          onClose={() => {
            setMatchResultDismissed(true);
            sessionStorage.setItem("matchResultDismissed", "true");
            setMatchOver(false);
            if (room) {
              room.leave();
            }
            setTimeout(() => {
              navigate("/lobby");
            }, 100);
          }}
        />
      ) : roundResult ? (
        <RoundResult roundData={roundResult} teamId={teamId} />
      ) : null}

      <StudentClashLayout
        hudProps={hudProps}
        hasTeam={!!teamId}
        arenaProps={arenaProps}
        answerProps={answerProps}
        handProps={handProps} // Always show hand - filtered to deck cards during match, all cards before match
        teamSelectionContent={teamSelectionContent}
        deckBuilderProps={teamId && !serverDeckLocked && roundNumber === 0 ? (() => {
          // Only show deck builder when deck is NOT locked AND round hasn't started
          const props = {
            teamId,
            deckSlots: teamDeckSlots,
            teamCardPool: state.teams?.[teamId]?.teamCardPool || [],
            deckLocked: serverDeckLocked, // Use server's deckLocked flag
            matchStarted: false, // Don't use matchStarted to lock deck - only use deckLocked
            room,
          };
          // Only log if there's an issue
          if (props.deckLocked && props.teamCardPool.length === 0) {
            console.warn('[Student] DeckBuilder: deckLocked but no cards in pool');
          }
          return props;
        })() : null}
      />

      {teamId && <EffectsOverlay activeEffects={activeEffects} teamId={teamId} />}
      {xpPopup && (
        <XPPopup
          amount={xpPopup.amount}
          onComplete={() => setXPPopup(null)}
        />
      )}
    </>
  );
}


