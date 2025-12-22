import React from "react";

export function XPBar({ xp, level }) {
    // Simplified XP calculation (would ideally come from server config)
    const currentLevelXP = level === 1 ? 0 : (level - 1) * 100;
    const nextLevelXP = level * 100;
    const xpInLevel = xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const progressPercent = Math.min(100, (xpInLevel / xpNeeded) * 100);

    return (
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px", border: "1px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", alignItems: "center" }}>
                <div>
                    <strong>Level {level}</strong>
                </div>
                <div style={{ fontSize: "0.9rem", color: "#666" }}>
                    {xpInLevel} / {xpNeeded} XP
                </div>
            </div>
            <div style={{ 
                width: "100%", 
                height: "20px", 
                backgroundColor: "#e0e0e0", 
                borderRadius: "10px",
                overflow: "hidden",
                position: "relative"
            }}>
                <div style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    backgroundColor: "#4caf50",
                    transition: "width 0.5s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: "4px"
                }}>
                    {progressPercent > 10 && (
                        <span style={{ fontSize: "0.7rem", color: "white", fontWeight: "bold" }}>
                            {Math.round(progressPercent)}%
                        </span>
                    )}
                </div>
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                Total XP: {xp}
            </div>
        </div>
    );
}


