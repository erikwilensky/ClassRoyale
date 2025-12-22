import React from "react";

export function RoundControls({
  question,
  duration,
  onChangeQuestion,
  onChangeDuration,
  onStartRound,
  disabled
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!disabled && onStartRound) {
      onStartRound();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
      <h2>Start Round</h2>
      <div style={{ marginBottom: "0.5rem" }}>
        <input
          type="text"
          placeholder="Enter question text"
          value={question}
          onChange={(event) => onChangeQuestion?.(event.target.value)}
          style={{
            padding: "0.5rem",
            width: "100%",
            boxSizing: "border-box"
          }}
        />
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <input
          type="number"
          placeholder="Duration in seconds"
          min={1}
          value={duration}
          onChange={(event) => onChangeDuration?.(event.target.value)}
          style={{
            padding: "0.5rem",
            width: "100%",
            boxSizing: "border-box"
          }}
        />
      </div>
      <button type="submit" disabled={disabled}>
        Start Round
      </button>
    </form>
  );
}






