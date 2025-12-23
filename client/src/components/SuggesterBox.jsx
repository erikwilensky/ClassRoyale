import React from "react";

export function SuggesterBox({
  suggestionText,
  teamAnswer,
  onSuggestionChange,
  onSubmitSuggestion,
  disabled,
  // Chapter 17.2: Themeable className props
  className = "",
  inputClassName = "clash-input",
  buttonClassName = "clash-btn clash-btn--secondary",
  readOnlyAnswerClassName = "",
  formClassName = "",
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (suggestionText && suggestionText.trim().length > 0 && onSubmitSuggestion) {
      onSubmitSuggestion(suggestionText.trim());
    }
  };

  const isSubmitDisabled = disabled || !suggestionText || suggestionText.trim().length === 0;

  return (
    <div className={className || "clash-field"}>
      {teamAnswer && (
        <div className={readOnlyAnswerClassName || "clash-panel"} style={{ 
          marginBottom: "1rem", 
          padding: "1rem"
        }}>
          <div className="clash-label" style={{ marginBottom: "0.5rem" }}>
            Current Team Answer (read-only):
          </div>
          <div className={`clash-readonly-answer ${!teamAnswer ? "clash-readonly-answer--empty" : ""}`}>
            {teamAnswer || "Writer hasn't started the answer yet..."}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={formClassName || ""}>
        <label className="clash-label">
          Propose Text Suggestion:
        </label>
        <div className="clash-form-row">
          <input
            type="text"
            value={suggestionText || ""}
            onChange={(e) => onSuggestionChange && onSuggestionChange(e.target.value)}
            disabled={disabled}
            placeholder="Type your suggestion here..."
            className={inputClassName}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={buttonClassName}
          >
            Submit Suggestion
          </button>
        </div>
        <div className="clash-helper-text">
          The writer will see your suggestion and can choose to insert it into the answer.
        </div>
      </form>
    </div>
  );
}






