import React, { useEffect, useState } from "react";

const EFFECT_DURATION = 10000; // 10 seconds

export function EffectsOverlay({ activeEffects, teamId, showAll = false }) {
  const [localEffects, setLocalEffects] = useState([]);

  useEffect(() => {
    if (!activeEffects || !Array.isArray(activeEffects)) {
      return;
    }

    // Filter effects that target this team (unless showAll is true)
    const teamEffects = showAll 
      ? activeEffects.filter(effect => effect) // Show all effects
      : (teamId ? activeEffects.filter(
          effect => effect && effect.targetTeamId === teamId
        ) : []);

    // Add new effects
    teamEffects.forEach(effect => {
      const exists = localEffects.some(
        e => e.cardId === effect.cardId && e.casterTeamId === effect.casterTeamId && e.timestamp === effect.timestamp
      );
      if (!exists) {
        const newEffect = {
          ...effect,
          id: `${effect.cardId}-${effect.casterTeamId}-${effect.timestamp}`,
          startTime: Date.now()
        };
        setLocalEffects(prev => [...prev, newEffect]);

        // Auto-remove after duration
        setTimeout(() => {
          setLocalEffects(prev => prev.filter(e => e.id !== newEffect.id));
        }, EFFECT_DURATION);
      }
    });
  }, [activeEffects, teamId]);

  if (localEffects.length === 0) {
    return null;
  }

  // Get the most recent effect (or combine multiple)
  const currentEffect = localEffects[localEffects.length - 1];
  // Card Catalog v1: Support effectType-based rendering, fall back to cardId for legacy
  const effectStyles = getEffectStyles(currentEffect.effectType || currentEffect.cardId, currentEffect);

  // Apply effects to the entire viewport
  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    zIndex: 9999,
    ...effectStyles
  };

  // Card Catalog v1: Check effectType first, then cardId for backwards compatibility
  const effectType = currentEffect.effectType || "";
  const cardId = currentEffect.cardId || "";
  
  // For BLUR and OVERCLOCK (legacy) or SCREEN_BLUR/SCREEN_DISTORT (new), add semi-transparent background
  if (cardId === "BLUR" || cardId === "OVERCLOCK" || effectType === "SCREEN_BLUR" || effectType === "SCREEN_DISTORT") {
    overlayStyle.backgroundColor = "rgba(0, 0, 0, 0.3)";
  }

  // For SHAKE (legacy) or SCREEN_SHAKE (new), add visible overlay
  if (cardId === "SHAKE" || effectType === "SCREEN_SHAKE") {
    overlayStyle.backgroundColor = "rgba(255, 0, 0, 0.25)"; // More visible red tint
    overlayStyle.animation = "shake 0.15s infinite, flash 0.3s infinite";
  }

  // For DISTRACT (legacy) or MICRO_DISTRACTION (new), add glow effect
  if (cardId === "DISTRACT" || effectType === "MICRO_DISTRACTION") {
    overlayStyle.backgroundColor = "rgba(76, 175, 80, 0.1)";
  }

  // For cosmetic cards (legacy cardIds or COSMETIC effectType)
  if (cardId === "WRITER_SPOTLIGHT" || 
      cardId === "TEAM_BANNER_COLOR" ||
      cardId === "VICTORY_FLOURISH" ||
      cardId === "SIGNATURE_STYLE" ||
      effectType === "COSMETIC") {
    // Cosmetic effects are already styled in getEffectStyles, but ensure they're visible
    if (!overlayStyle.backgroundColor && cardId !== "VICTORY_FLOURISH") {
      overlayStyle.backgroundColor = "rgba(255, 255, 255, 0.05)";
    }
  }

  return <div style={overlayStyle} />;
}

function getEffectStyles(effectTypeOrCardId, effect = {}) {
  const baseStyles = {
    transition: "all 0.3s ease",
    backdropFilter: "none"
  };

  // Card Catalog v1: Support effectType-based rendering
  switch (effectTypeOrCardId) {
    // Legacy cardIds
    case "SHAKE":
    case "SCREEN_SHAKE":
      return {
        ...baseStyles,
        animation: "shake 0.15s infinite, flash 0.3s infinite"
      };

    case "BLUR":
    case "SCREEN_BLUR":
      // Support intensity levels for new blur cards
      const blurIntensity = effect.effectParams?.intensity || "medium";
      const blurAmounts = {
        low: "4px",
        medium: "8px",
        high: "12px",
        max: "16px"
      };
      return {
        ...baseStyles,
        backdropFilter: `blur(${blurAmounts[blurIntensity] || blurAmounts.medium})`,
        opacity: 0.8
      };

    case "DISTRACT":
    case "MICRO_DISTRACTION":
      return {
        ...baseStyles,
        filter: "brightness(1.2)",
        boxShadow: "0 0 20px rgba(76, 175, 80, 0.5) inset"
      };

    case "OVERCLOCK":
    case "SCREEN_DISTORT":
      return {
        ...baseStyles,
        animation: "shake 0.3s infinite",
        backdropFilter: "blur(3px)",
        opacity: 0.8
      };

    // Cosmetic cards (legacy)
    case "WRITER_SPOTLIGHT":
      return {
        ...baseStyles,
        boxShadow: "0 0 40px rgba(255, 255, 0, 0.6) inset",
        backgroundColor: "rgba(255, 255, 200, 0.1)"
      };

    case "TEAM_BANNER_COLOR":
      return {
        ...baseStyles,
        filter: "hue-rotate(180deg)",
        backgroundColor: "rgba(156, 39, 176, 0.1)"
      };

    case "VICTORY_FLOURISH":
      return {
        ...baseStyles,
        background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,140,0,0.2) 50%, transparent 100%)",
        animation: "confetti 1s ease-out"
      };

    case "SIGNATURE_STYLE":
      return {
        ...baseStyles,
        boxShadow: "0 0 30px rgba(33, 150, 243, 0.4) inset",
        border: "3px solid rgba(33, 150, 243, 0.6)"
      };

    // Card Catalog v1: New cosmetic effect types
    case "COSMETIC":
      const cosmeticKey = effect.effectParams?.cosmeticKey || "";
      switch (cosmeticKey) {
        case "writer_spotlight":
          return {
            ...baseStyles,
            boxShadow: "0 0 40px rgba(255, 255, 0, 0.6) inset",
            backgroundColor: "rgba(255, 255, 200, 0.1)"
          };
        case "team_banner_color":
          return {
            ...baseStyles,
            filter: "hue-rotate(180deg)",
            backgroundColor: "rgba(156, 39, 176, 0.1)"
          };
        case "victory_confetti":
          return {
            ...baseStyles,
            background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,140,0,0.2) 50%, transparent 100%)",
            animation: "confetti 1s ease-out"
          };
        case "writer_box_glow":
          return {
            ...baseStyles,
            boxShadow: "0 0 30px rgba(33, 150, 243, 0.4) inset",
            border: "3px solid rgba(33, 150, 243, 0.6)"
          };
        default:
          return baseStyles;
      }

    // Card Catalog v1: New UI effects
    case "UI_OVERLAY_FOG":
      return {
        ...baseStyles,
        backgroundColor: "rgba(200, 200, 200, 0.3)",
        backdropFilter: "blur(2px)",
        opacity: 0.6,
        filter: "contrast(0.8)"
      };

    case "UI_CURSOR_MIRAGE":
      // Cursor mirage is handled by a separate component that tracks cursor position
      // This overlay just indicates the effect is active
      return {
        ...baseStyles,
        pointerEvents: "none",
        opacity: 0.1
      };

    case "UI_PANEL_SWAP":
      // Panel swap is handled by layout changes, not overlay
      // This is just a placeholder
      return {
        ...baseStyles,
        pointerEvents: "none"
      };

    case "UI_DIM_INPUT":
      return {
        ...baseStyles,
        backgroundColor: "rgba(0, 0, 0, 0.2)",
        backdropFilter: "brightness(0.7)",
        opacity: 0.5
      };

    default:
      return baseStyles;
  }
}

// Add CSS keyframes via style tag
if (typeof document !== 'undefined') {
  const existingStyle = document.head.querySelector('style[data-card-effects]');
  if (!existingStyle) {
    const styleSheet = document.createElement("style");
    styleSheet.setAttribute('data-card-effects', 'true');
    styleSheet.textContent = `
      @keyframes shake {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        10% { transform: translate(-20px, -15px) rotate(-5deg); }
        20% { transform: translate(20px, 15px) rotate(5deg); }
        30% { transform: translate(-15px, 20px) rotate(-5deg); }
        40% { transform: translate(15px, -20px) rotate(5deg); }
        50% { transform: translate(-12px, 12px) rotate(-3deg); }
        60% { transform: translate(12px, -12px) rotate(3deg); }
        70% { transform: translate(-12px, -12px) rotate(-3deg); }
        80% { transform: translate(12px, 12px) rotate(3deg); }
        90% { transform: translate(-8px, 8px) rotate(-2deg); }
      }
      @keyframes flash {
        0%, 100% { opacity: 0.25; }
        50% { opacity: 0.4; }
      }
      @keyframes confetti {
        0% { transform: scale(0) rotate(0deg); opacity: 1; }
        50% { transform: scale(1.2) rotate(180deg); opacity: 0.8; }
        100% { transform: scale(0.8) rotate(360deg); opacity: 0; }
      }
    `;
    document.head.appendChild(styleSheet);
  }
}

