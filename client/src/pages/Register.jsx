import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export function Register() {
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [isTeacher, setIsTeacher] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verificationLink, setVerificationLink] = useState("");
    const navigate = useNavigate();

    const validateDisplayName = (name) => {
        if (!name || name.length < 2) {
            return "Display name must be at least 2 characters";
        }
        if (name.includes("@")) {
            return "Display name cannot be an email address";
        }
        const lower = name.toLowerCase();
        if (lower === "admin" || lower === "teacher") {
            return "Display name cannot be 'Admin' or 'Teacher'";
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess(false);
        setLoading(true);

        // Client-side validation
        const nameError = validateDisplayName(displayName);
        if (nameError) {
            setError(nameError);
            setLoading(false);
            return;
        }

        if (!email.endsWith("@nist.ac.th")) {
            setError("Email must be a valid @nist.ac.th address");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("http://localhost:3000/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, displayName, password, isTeacher })
            });

            const data = await response.json();
            console.log("[Register] Response status:", response.status);
            console.log("[Register] Server response data:", JSON.stringify(data, null, 2));

            if (!response.ok) {
                console.error("[Register] Error response:", data);
                setError(data.error || "Registration failed");
                setLoading(false);
                return;
            }

            // Show success message with verification link
            const link = data.verificationUrl || (data.verificationToken ? `http://localhost:3000/api/verify?token=${data.verificationToken}` : "");
            setVerificationLink(link);
            setSuccess(true);
            setLoading(false);
        } catch (error) {
            console.error("Registration error:", error);
            setError("Network error. Please try again.");
            setLoading(false);
        }
    };

    if (success) {
        console.log("[Register] Rendering success screen. verificationLink state:", verificationLink);
        return (
            <div style={{ maxWidth: "500px", margin: "2rem auto", padding: "2rem", border: "1px solid #4caf50", borderRadius: "8px", backgroundColor: "#f1f8f4" }}>
                <h2 style={{ marginBottom: "1rem", color: "#4caf50" }}>✅ Registration Successful!</h2>
                <p style={{ marginBottom: "1.5rem" }}>
                    Your account has been created. Please verify your email by clicking the link below:
                </p>
                
                <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "white", borderRadius: "4px", border: "2px solid #4caf50" }}>
                    <p style={{ marginBottom: "0.5rem", fontWeight: "bold", fontSize: "0.9rem" }}>Verification Link:</p>
                    <a 
                        href={verificationLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: "#007bff",
                            wordBreak: "break-all",
                            textDecoration: "underline",
                            fontSize: "0.9rem",
                            display: "block",
                            marginBottom: "0.5rem",
                            padding: "0.5rem",
                            backgroundColor: "#f0f0f0",
                            borderRadius: "4px"
                        }}
                    >
                        {verificationLink || "Loading..."}
                    </a>
                    {verificationLink && (
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(verificationLink);
                                alert("Link copied to clipboard!");
                            }}
                            style={{
                                padding: "0.5rem 1rem",
                                backgroundColor: "#6c757d",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                marginBottom: "0.5rem"
                            }}
                        >
                            Copy Link
                        </button>
                    )}
                    <p style={{ fontSize: "0.85rem", color: "#666" }}>
                        Click the link above to verify your account, then you can log in.
                    </p>
                </div>
                
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        onClick={() => navigate("/login")}
                        style={{
                            flex: 1,
                            padding: "0.75rem",
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
                    <button
                        onClick={() => {
                            setSuccess(false);
                            setEmail("");
                            setDisplayName("");
                            setPassword("");
                            setVerificationLink("");
                        }}
                        style={{
                            flex: 1,
                            padding: "0.75rem",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "1rem",
                            fontWeight: "bold",
                            cursor: "pointer"
                        }}
                    >
                        Register Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "400px", margin: "2rem auto", padding: "2rem", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Register</h2>
            
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
                        placeholder="yourname@nist.ac.th"
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            border: "1px solid #ccc",
                            borderRadius: "4px"
                        }}
                    />
                </div>

                <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
                        Display Name
                    </label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        placeholder="Your name"
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            border: "1px solid #ccc",
                            borderRadius: "4px"
                        }}
                    />
                    <small style={{ color: "#666", fontSize: "0.85rem" }}>
                        Cannot be an email, "Admin", or "Teacher"
                    </small>
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

                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={isTeacher}
                            onChange={(e) => setIsTeacher(e.target.checked)}
                            style={{ marginRight: "0.5rem", width: "auto" }}
                        />
                        <span style={{ fontWeight: "bold" }}>Register as Teacher</span>
                    </label>
                    <small style={{ display: "block", color: "#666", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                        Teachers can create and manage quiz rounds
                    </small>
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
                    {loading ? "Registering..." : "Register"}
                </button>
            </form>

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <p>
                    Already have an account?{" "}
                    <a href="/login" style={{ color: "#007bff" }}>Login</a>
                </p>
            </div>
        </div>
    );
}

