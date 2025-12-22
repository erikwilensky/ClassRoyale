import React from "react";

export function AnswerInput({
  value,
  onChange,
  onSubmit,
  disabled
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!disabled && onSubmit) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
      <input
        type="text"
        placeholder="Enter your answer"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        style={{
          padding: "0.5rem",
          marginRight: "0.5rem",
          width: "70%"
        }}
      />
      <button type="submit" disabled={disabled}>
        Submit
      </button>
    </form>
  );
}






