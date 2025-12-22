import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export function Verified() {
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email");
    const navigate = useNavigate();

    return (
        <div style={{ maxWidth: "500px", margin: "4rem auto", padding: "2rem", border: "2px solid #4caf50", borderRadius: "8px", backgroundColor: "#f1f8f4", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ marginBottom: "1rem", color: "#4caf50" }}>Account Verified!</h2>
            {email && (
                <p style={{ marginBottom: "1rem", color: "#666" }}>
                    Your account <strong>{email}</strong> has been successfully verified.
                </p>
            )}
            <p style={{ marginBottom: "2rem" }}>
                You can now log in and start playing!
            </p>
            <button
                onClick={() => navigate("/login")}
                style={{
                    padding: "0.75rem 2rem",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: "pointer"
                }}
            >
                Go to Login
            </button>
        </div>
    );
}


