import React, { useEffect, useState } from "react";

export function XPPopup({ amount, onComplete }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            if (onComplete) {
                setTimeout(onComplete, 300); // Wait for fade out
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [onComplete]);

    if (!visible) {
        return null;
    }

    return (
        <div
            style={{
                position: "fixed",
                top: "20%",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "#4caf50",
                color: "white",
                padding: "1rem 2rem",
                borderRadius: "8px",
                fontSize: "1.5rem",
                fontWeight: "bold",
                zIndex: 10000,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                animation: "xpPopup 0.3s ease-out",
                pointerEvents: "none"
            }}
        >
            +{amount} XP
            <style>{`
                @keyframes xpPopup {
                    0% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px) scale(0.8);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}


