import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, isAuthenticated, removeToken } from "../utils/auth.js";

export function Profile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated()) {
            navigate("/login");
            return;
        }

        fetchProfile();
    }, [navigate]);

    const fetchProfile = async () => {
        try {
            const token = getToken();
            const response = await fetch("http://localhost:3000/api/profile", {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    navigate("/login");
                    return;
                }
                throw new Error("Failed to fetch profile");
            }

            const data = await response.json();
            setProfile(data);
        } catch (error) {
            console.error("Profile fetch error:", error);
            setError("Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={{ padding: "2rem", textAlign: "center" }}>Loading profile...</div>;
    }

    if (error) {
        return <div style={{ padding: "2rem", color: "#c33" }}>{error}</div>;
    }

    if (!profile) {
        return null;
    }

    // Calculate XP progress (simplified - would need to import from server config)
    const currentLevelXP = profile.level === 1 ? 0 : (profile.level - 1) * 100;
    const nextLevelXP = profile.level * 100;
    const xpInLevel = profile.xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const progressPercent = Math.min(100, (xpInLevel / xpNeeded) * 100);

    return (
        <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "2rem" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Profile</h2>
            
            <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px" }}>
                <div style={{ marginBottom: "1rem" }}>
                    <strong>Display Name:</strong> {profile.displayName}
                </div>
                <div style={{ marginBottom: "1rem" }}>
                    <strong>Email:</strong> {profile.email}
                </div>
                <div style={{ marginBottom: "1rem" }}>
                    <strong>Level:</strong> {profile.level}
                </div>
                <div style={{ marginBottom: "1rem" }}>
                    <strong>XP:</strong> {profile.xp}
                </div>
                
                <div style={{ marginTop: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span>Progress to Level {profile.level + 1}</span>
                        <span>{xpInLevel} / {xpNeeded} XP</span>
                    </div>
                    <div style={{ 
                        width: "100%", 
                        height: "24px", 
                        backgroundColor: "#e0e0e0", 
                        borderRadius: "12px",
                        overflow: "hidden"
                    }}>
                        <div style={{
                            width: `${progressPercent}%`,
                            height: "100%",
                            backgroundColor: "#4caf50",
                            transition: "width 0.3s ease"
                        }} />
                    </div>
                </div>
            </div>

            <div style={{ padding: "1.5rem", border: "1px solid #ddd", borderRadius: "8px" }}>
                <h3 style={{ marginBottom: "1rem" }}>Unlocked Cards</h3>
                {profile.unlockedCards && profile.unlockedCards.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {profile.unlockedCards.map(cardId => (
                            <div
                                key={cardId}
                                style={{
                                    padding: "0.5rem 1rem",
                                    backgroundColor: "#4caf50",
                                    color: "white",
                                    borderRadius: "4px",
                                    fontWeight: "bold"
                                }}
                            >
                                {cardId}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: "#666", fontStyle: "italic" }}>No cards unlocked yet. Play matches to earn XP and unlock cards!</p>
                )}
            </div>

            <div style={{ marginTop: "2rem", textAlign: "center" }}>
                <button
                    onClick={() => navigate("/student")}
                    style={{
                        padding: "0.75rem 2rem",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "1rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        marginRight: "1rem"
                    }}
                >
                    Play Game
                </button>
                <button
                    onClick={() => {
                        removeToken();
                        navigate("/login");
                    }}
                    style={{
                        padding: "0.75rem 2rem",
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "1rem",
                        fontWeight: "bold",
                        cursor: "pointer"
                    }}
                >
                    Logout
                </button>
            </div>
        </div>
    );
}

