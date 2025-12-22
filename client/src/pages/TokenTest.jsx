import React, { useState, useEffect } from "react";
import { getToken, isAuthenticated, isTokenExpired, getPlayerId, getIsTeacher } from "../utils/auth.js";

export function TokenTest() {
    const [tokenInfo, setTokenInfo] = useState(null);

    useEffect(() => {
        updateTokenInfo();
    }, []);

    const updateTokenInfo = () => {
        const token = getToken();
        if (!token) {
            setTokenInfo({ error: "No token found" });
            return;
        }

        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            const exp = payload.exp * 1000; // Convert to milliseconds
            const now = Date.now();
            const expiresIn = exp - now;
            const expiresInHours = expiresIn / (1000 * 60 * 60);
            const expiresInDays = expiresIn / (1000 * 60 * 60 * 24);

            setTokenInfo({
                token: token.substring(0, 50) + "...",
                playerId: payload.playerId,
                isTeacher: payload.isTeacher,
                issuedAt: new Date(payload.iat * 1000).toLocaleString(),
                expiresAt: new Date(exp).toLocaleString(),
                expiresInMs: expiresIn,
                expiresInHours: expiresInHours.toFixed(2),
                expiresInDays: expiresInDays.toFixed(2),
                isExpired: isTokenExpired(token),
                isAuthenticated: isAuthenticated(),
                rawPayload: payload
            });
        } catch (error) {
            setTokenInfo({ error: `Failed to parse token: ${error.message}` });
        }
    };

    const checkLocalStorage = () => {
        const token = localStorage.getItem("classroyale_token");
        return token ? `Found token (${token.length} chars)` : "No token in localStorage";
    };

    return (
        <div style={{ maxWidth: "800px", margin: "2rem auto", padding: "2rem", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h2>JWT Token Test</h2>
            
            <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                <h3>LocalStorage Check</h3>
                <p><strong>Token in localStorage:</strong> {checkLocalStorage()}</p>
                <p><strong>Key used:</strong> "classroyale_token"</p>
            </div>

            {tokenInfo?.error ? (
                <div style={{ padding: "1rem", backgroundColor: "#fee", color: "#c33", borderRadius: "4px" }}>
                    <strong>Error:</strong> {tokenInfo.error}
                </div>
            ) : tokenInfo ? (
                <div>
                    <h3>Token Information</h3>
                    <div style={{ padding: "1rem", backgroundColor: "#f9f9f9", borderRadius: "4px", marginBottom: "1rem" }}>
                        <p><strong>Token (first 50 chars):</strong> {tokenInfo.token}</p>
                        <p><strong>Player ID:</strong> {tokenInfo.playerId}</p>
                        <p><strong>Is Teacher:</strong> {tokenInfo.isTeacher ? "Yes" : "No"}</p>
                        <p><strong>Issued At:</strong> {tokenInfo.issuedAt}</p>
                        <p><strong>Expires At:</strong> {tokenInfo.expiresAt}</p>
                        <p><strong>Expires In:</strong> {tokenInfo.expiresInHours} hours ({tokenInfo.expiresInDays} days)</p>
                        <p><strong>Is Expired:</strong> {tokenInfo.isExpired ? <span style={{ color: "#c33" }}>Yes ❌</span> : <span style={{ color: "#4caf50" }}>No ✅</span>}</p>
                        <p><strong>Is Authenticated:</strong> {tokenInfo.isAuthenticated ? <span style={{ color: "#4caf50" }}>Yes ✅</span> : <span style={{ color: "#c33" }}>No ❌</span>}</p>
                    </div>

                    <div style={{ padding: "1rem", backgroundColor: "#e3f2fd", borderRadius: "4px", marginBottom: "1rem" }}>
                        <h4>Expiry Test</h4>
                        <p>Token expires in <strong>{tokenInfo.expiresInDays} days</strong> (1 day = 24 hours)</p>
                        <p>Expected expiry: ~24 hours from login</p>
                    </div>

                    <div style={{ padding: "1rem", backgroundColor: "#fff3e0", borderRadius: "4px" }}>
                        <h4>Raw Token Payload</h4>
                        <pre style={{ backgroundColor: "#fff", padding: "0.5rem", borderRadius: "4px", overflow: "auto" }}>
                            {JSON.stringify(tokenInfo.rawPayload, null, 2)}
                        </pre>
                    </div>
                </div>
            ) : (
                <p>Loading token info...</p>
            )}

            <div style={{ marginTop: "1.5rem" }}>
                <button
                    onClick={updateTokenInfo}
                    style={{
                        padding: "0.75rem 1.5rem",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "1rem"
                    }}
                >
                    Refresh Token Info
                </button>
                <button
                    onClick={() => {
                        localStorage.removeItem("classroyale_token");
                        setTokenInfo(null);
                        alert("Token removed from localStorage. Refresh page to see changes.");
                    }}
                    style={{
                        padding: "0.75rem 1.5rem",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                    }}
                >
                    Clear Token (Test)
                </button>
            </div>

            <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
                <h4>Testing Instructions</h4>
                <ol style={{ paddingLeft: "1.5rem" }}>
                    <li><strong>Login:</strong> Go to /login and login with your account</li>
                    <li><strong>Check localStorage:</strong> Open browser DevTools (F12) → Application/Storage → Local Storage → localhost:5173 → Look for "classroyale_token"</li>
                    <li><strong>Check expiry:</strong> Token should expire in ~24 hours (1 day)</li>
                    <li><strong>Test expiry check:</strong> The "Is Expired" field should show "No" if token is valid</li>
                    <li><strong>Test persistence:</strong> Refresh page - token should still be there</li>
                    <li><strong>Test expiry:</strong> Manually edit token expiry in localStorage (or wait 24 hours) - "Is Expired" should show "Yes"</li>
                </ol>
            </div>
        </div>
    );
}


