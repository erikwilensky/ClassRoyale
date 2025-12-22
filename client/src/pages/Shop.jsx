import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, isAuthenticated } from "../utils/auth.js";
import { ShopCard } from "../components/ShopCard.jsx";

export function Shop() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchasingCardId, setPurchasingCardId] = useState(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    fetchShopData();
  }, [navigate]);

  const fetchShopData = async () => {
    try {
      const token = getToken();
      
      // Fetch cards and progress in parallel
      const [cardsResponse, progressResponse] = await Promise.all([
        fetch("http://localhost:3000/api/shop/cards", {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch("http://localhost:3000/api/player/progress", {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      if (!cardsResponse.ok || !progressResponse.ok) {
        if (cardsResponse.status === 401 || progressResponse.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to fetch shop data");
      }

      const cardsData = await cardsResponse.json();
      const progressData = await progressResponse.json();

      setCards(cardsData.cards || []);
      setProgress(progressData);
    } catch (error) {
      console.error("Shop fetch error:", error);
      setError("Failed to load shop. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (cardId) => {
    if (purchasingCardId) return; // Prevent double-purchases

    try {
      setPurchasingCardId(cardId);
      setError("");
      setPurchaseSuccess(null);

      const token = getToken();
      const response = await fetch("http://localhost:3000/api/shop/purchase", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ cardId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Purchase failed");
      }

      // Update progress with new availableXP
      setProgress(prev => ({
        ...prev,
        availableXP: data.newAvailableXP
      }));

      // Update card unlock status
      setCards(prevCards =>
        prevCards.map(card =>
          card.id === cardId ? { ...card, unlocked: true } : card
        )
      );

      // Show success animation
      setPurchaseSuccess(cardId);
      setTimeout(() => setPurchaseSuccess(null), 2000);

      // Refresh shop data to ensure consistency
      setTimeout(() => fetchShopData(), 500);
    } catch (error) {
      console.error("Purchase error:", error);
      setError(error.message || "Failed to purchase card. Please try again.");
    } finally {
      setPurchasingCardId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Loading shop...</h2>
      </div>
    );
  }

  if (error && !progress) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Error</h2>
        <p style={{ color: "#f44336" }}>{error}</p>
        <button
          onClick={() => {
            setError("");
            fetchShopData();
          }}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            backgroundColor: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const standardCards = cards.filter(card => card.type === "standard");
  const cosmeticCards = cards.filter(card => card.type === "cosmetic");
  const availableXP = progress?.availableXP || 0;
  const totalXP = progress?.totalXP || 0;
  const level = progress?.level || 1;

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>🎴 Card Shop</h1>

      {/* XP Balance Display */}
      <div
        style={{
          backgroundColor: "#e3f2fd",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <div>
          <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>
            Available XP (Spendable)
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2196f3" }}>
            {availableXP} XP
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>
            Total XP (Lifetime)
          </div>
          <div style={{ fontSize: "1.2rem", color: "#333" }}>
            {totalXP} XP
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>
            Level
          </div>
          <div style={{ fontSize: "1.2rem", color: "#333" }}>
            Level {level}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: "#ffebee",
            color: "#c62828",
            padding: "1rem",
            borderRadius: "4px",
            marginBottom: "1rem"
          }}
        >
          {error}
        </div>
      )}

      {/* Success Message */}
      {purchaseSuccess && (
        <div
          style={{
            backgroundColor: "#e8f5e9",
            color: "#2e7d32",
            padding: "1rem",
            borderRadius: "4px",
            marginBottom: "1rem",
            animation: "fadeIn 0.3s"
          }}
        >
          ✓ Card unlocked successfully!
        </div>
      )}

      {/* Standard Cards Section */}
      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ marginBottom: "1rem", color: "#2196f3" }}>
          Standard Cards
        </h2>
        <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
          Gameplay cards that require unlock and cost gold to use in matches
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem"
          }}
        >
          {standardCards.map(card => (
            <ShopCard
              key={card.id}
              card={card}
              unlocked={card.unlocked}
              availableXP={availableXP}
              onPurchase={handlePurchase}
              isPurchasing={purchasingCardId === card.id}
            />
          ))}
        </div>
      </section>

      {/* Cosmetic Cards Section */}
      <section>
        <h2 style={{ marginBottom: "1rem", color: "#9c27b0" }}>
          ✨ Cosmetic Cards
        </h2>
        <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
          Visual-only cards that are always free to use once unlocked
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem"
          }}
        >
          {cosmeticCards.map(card => (
            <ShopCard
              key={card.id}
              card={card}
              unlocked={card.unlocked}
              availableXP={availableXP}
              onPurchase={handlePurchase}
              isPurchasing={purchasingCardId === card.id}
            />
          ))}
        </div>
      </section>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

