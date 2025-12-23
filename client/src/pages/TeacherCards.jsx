import React, { useEffect, useState } from "react";
import { getToken } from "../utils/auth.js";

export function TeacherCards() {
  const token = getToken();

  const [cards, setCards] = useState([]);
  const [disabledCards, setDisabledCards] = useState(new Set());
  const [goldCostModifiers, setGoldCostModifiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hasDefaults, setHasDefaults] = useState(false);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const fetchRules = async () => {
    try {
      setError(null);
      const response = await fetch("http://localhost:3000/api/match/cards", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to load match card settings (${response.status})`);
      }
      const data = await response.json();
      setCards(data.cards || []);
      setDisabledCards(new Set(data.disabledCards || []));
      setGoldCostModifiers(data.goldCostModifiers || {});
      
      // Also check if teacher has default settings
      await checkForDefaults();
    } catch (err) {
      console.error("[TeacherCards] Failed to load match card settings:", err);
      setError(err.message || "Failed to load match card settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setError("You must be logged in as a teacher to configure cards.");
      setLoading(false);
      return;
    }
    fetchRules();
  }, []);

  const handleToggleCard = async (cardId, shouldDisable) => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const endpoint = shouldDisable ? "disable" : "enable";
      const response = await fetch(`http://localhost:3000/api/match/cards/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cardId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to ${shouldDisable ? "disable" : "enable"} card`);
      }
      const result = await response.json();
      setDisabledCards(new Set(result.disabledCards || []));
    } catch (err) {
      console.error("[TeacherCards] Toggle card error:", err);
      setError(err.message || "Failed to update card state.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMultiplier = async (cardId, value) => {
    if (!token) return;
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0.5 || numeric > 2.0) {
      setError("Multiplier must be between 0.5 and 2.0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/cards/modify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cardId, multiplier: numeric }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to update multiplier");
      }
      const result = await response.json();
      setGoldCostModifiers(result.goldCostModifiers || {});
    } catch (err) {
      console.error("[TeacherCards] Update multiplier error:", err);
      setError(err.message || "Failed to update multiplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/match/cards/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to reset card rules");
      }
      setDisabledCards(new Set());
      setGoldCostModifiers({});
    } catch (err) {
      console.error("[TeacherCards] Reset error:", err);
      setError(err.message || "Failed to reset card rules.");
    } finally {
      setSaving(false);
    }
  };

  const checkForDefaults = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/match/cards/defaults", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setHasDefaults(data.hasDefaults || false);
      }
    } catch (err) {
      console.error("[TeacherCards] Failed to check defaults:", err);
    }
  };

  const handleSaveDefaults = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("http://localhost:3000/api/match/cards/defaults", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to save default settings");
      }
      await checkForDefaults();
      alert("Default card settings saved! They will be applied automatically to new matches.");
    } catch (err) {
      console.error("[TeacherCards] Save defaults error:", err);
      setError(err.message || "Failed to save default settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDefaults = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("http://localhost:3000/api/match/cards/load-defaults", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to load default settings");
      }
      const data = await response.json();
      setDisabledCards(new Set(data.disabledCards || []));
      setGoldCostModifiers(data.goldCostModifiers || {});
      setDefaultsLoaded(true);
      alert("Default card settings loaded and applied to this match!");
    } catch (err) {
      console.error("[TeacherCards] Load defaults error:", err);
      setError(err.message || "Failed to load default settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDefaults = async () => {
    if (!confirm("Delete your default card settings? This cannot be undone.")) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("http://localhost:3000/api/match/cards/defaults", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to delete default settings");
      }
      setHasDefaults(false);
      alert("Default card settings deleted.");
    } catch (err) {
      console.error("[TeacherCards] Delete defaults error:", err);
      setError(err.message || "Failed to delete default settings.");
    } finally {
      setSaving(false);
    }
  };

  const isDisabled = (cardId) => disabledCards.has(cardId);

  const getMultiplier = (cardId) => {
    const m = goldCostModifiers[cardId];
    return m !== undefined ? m : 1.0;
  };

  const handleLocalMultiplierChange = (cardId, value) => {
    setGoldCostModifiers((prev) => ({
      ...prev,
      [cardId]: value === "" ? undefined : Number(value),
    }));
  };

  const standardCards = cards.filter((c) => c.type === "standard");
  const cosmeticCards = cards.filter((c) => c.type === "cosmetic");

  if (loading) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Match Card Controls</h2>
        <p>Loading match card settings...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "960px", margin: "0 auto" }}>
      <h2>Match Card Controls</h2>
      <p style={{ color: "#555", marginBottom: "1rem" }}>
        Configure which cards are <strong>enabled</strong> for this match and adjust their gold cost multipliers.
        Changes here are <strong>match-only</strong> and will reset when the match ends or you press
        <strong> Reset Rules</strong>.
      </p>

      {error && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#ffebee", color: "#b71c1c", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={fetchRules}
            disabled={saving}
            style={{ padding: "0.5rem 1rem" }}
          >
            Refresh
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px" }}
            title="Clear all disabled cards and multipliers for this match"
          >
            Reset Rules
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {hasDefaults && (
            <button
              onClick={handleLoadDefaults}
              disabled={saving}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#2196f3", color: "white", border: "none", borderRadius: "4px" }}
              title="Load your saved default card settings into this match"
            >
              📥 Load Defaults
            </button>
          )}
          <button
            onClick={handleSaveDefaults}
            disabled={saving}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#4caf50", color: "white", border: "none", borderRadius: "4px" }}
            title="Save current match settings as your default (will be applied to new matches)"
          >
            💾 Save as Default
          </button>
          {hasDefaults && (
            <button
              onClick={handleDeleteDefaults}
              disabled={saving}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#ff9800", color: "white", border: "none", borderRadius: "4px" }}
              title="Delete your saved default card settings"
            >
              🗑️ Delete Defaults
            </button>
          )}
        </div>
      </div>
      
      {hasDefaults && !defaultsLoaded && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#e3f2fd", borderRadius: "4px", border: "1px solid #2196f3" }}>
          <strong>💡 Tip:</strong> You have saved default card settings. Click "📥 Load Defaults" to apply them to this match.
        </div>
      )}

      {/* Standard Cards */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>Standard Cards</h3>
        <p style={{ color: "#777", marginBottom: "0.5rem" }}>
          These cards affect gameplay and cost gold. You can disable them or adjust their gold cost for this match.
        </p>
        {standardCards.length === 0 && (
          <p style={{ color: "#777", fontStyle: "italic" }}>No standard cards configured.</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {standardCards.map((card) => {
            const disabled = isDisabled(card.id);
            const multiplier = getMultiplier(card.id);
            return (
              <div
                key={card.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  padding: "0.75rem",
                  width: "260px",
                  opacity: disabled ? 0.5 : 1,
                  backgroundColor: "#fafafa",
                }}
                title="Settings apply only to this match"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>{card.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "#777" }}>{card.effect}</div>
                  </div>
                  <div>
                    <button
                      onClick={() => handleToggleCard(card.id, !disabled)}
                      disabled={saving}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.8rem",
                        borderRadius: "4px",
                        border: "none",
                        backgroundColor: disabled ? "#4caf50" : "#f44336",
                        color: "white",
                      }}
                      title={disabled ? "Enable this card for this match" : "Disable this card for this match"}
                    >
                      {disabled ? "Enable" : "Disable"}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                  <div>Base Cost: {card.cost}💰</div>
                  <div style={{ marginTop: "0.25rem" }}>
                    <label style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>
                      Cost Multiplier (0.5x - 2x)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="number"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={multiplier}
                        onChange={(e) => handleLocalMultiplierChange(card.id, e.target.value)}
                        style={{ width: "70px" }}
                      />
                      <button
                        onClick={() => handleUpdateMultiplier(card.id, multiplier)}
                        disabled={saving}
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                        title="Apply multiplier for this match only"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cosmetic Cards */}
      <section>
        <h3>✨ Cosmetic Cards</h3>
        <p style={{ color: "#777", marginBottom: "0.5rem" }}>
          Cosmetic cards never affect scoring or timers. You can enable/disable them per match.
        </p>
        {cosmeticCards.length === 0 && (
          <p style={{ color: "#777", fontStyle: "italic" }}>No cosmetic cards configured.</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {cosmeticCards.map((card) => {
            const disabled = isDisabled(card.id);
            return (
              <div
                key={card.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  padding: "0.75rem",
                  width: "260px",
                  opacity: disabled ? 0.5 : 1,
                  backgroundColor: "#f9f0ff",
                }}
                title="Settings apply only to this match"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>{card.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "#777" }}>{card.effect}</div>
                  </div>
                  <div>
                    <button
                      onClick={() => handleToggleCard(card.id, !disabled)}
                      disabled={saving}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.8rem",
                        borderRadius: "4px",
                        border: "none",
                        backgroundColor: disabled ? "#4caf50" : "#f44336",
                        color: "white",
                      }}
                      title={disabled ? "Enable this cosmetic card for this match" : "Disable this cosmetic card for this match"}
                    >
                      {disabled ? "Enable" : "Disable"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
