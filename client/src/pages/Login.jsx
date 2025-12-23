import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setToken } from "../utils/auth.js";

export function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("http://localhost:3000/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Login failed");
                setLoading(false);
                return;
            }

            // Save token
            setToken(data.token);

            // Redirect based on role:
            // - Teachers go to teacher lobby
            // - Students go to student lobby (from there they join a match, then go to /student)
            if (data.player.isTeacher) {
                navigate("/teacher/lobby");
            } else {
                navigate("/lobby");
            }
        } catch (error) {
            console.error("Login error:", error);
            setError("Network error. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "2rem auto", padding: "2rem", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Login</h2>
            
            {error && (
                <div style={{ 
                    padding: "0.75rem", 
                    marginBottom: "1rem", 
                    backgroundColor: "#fee", 
                    color: "#c33", 
                    borderRadius: "4px" 
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
                        Email (@nist.ac.th)
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            border: "1px solid #ccc",
                            borderRadius: "4px"
                        }}
                    />
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            border: "1px solid #ccc",
                            borderRadius: "4px"
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "0.75rem",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "1rem",
                        fontWeight: "bold",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <p>
                    Don't have an account?{" "}
                    <a href="/register" style={{ color: "#007bff" }}>Register</a>
                </p>
            </div>
        </div>
    );
}

