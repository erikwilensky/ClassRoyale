import React from "react";
import { SuggestionList } from "./SuggestionList.jsx";

export function WriterInput({
  teamAnswer,
  suggestions,
  onAnswerChange,
  onInsertSuggestion,
  onLockAnswer,
  disabled,
  locked,
  // Chapter 17.2: Themeable className props
  className = "",
  textareaClassName = "clash-textarea",
  actionsClassName = "",
  buttonClassName = "clash-btn clash-btn--primary",
  suggestionsClassName = "",
}) {
  const handleInsert = (suggestion, index) => {
    if (onInsertSuggestion) {
      onInsertSuggestion(suggestion, index);
    }
  };

  const isLockDisabled = disabled || locked || !teamAnswer || teamAnswer.trim().length === 0;

  return (
    <div className={className || "clash-field"}>
      <div className="clash-field">
        <label className="clash-label">
          Team Answer:
        </label>
        <textarea
          value={teamAnswer || ""}
          onChange={(e) => onAnswerChange && onAnswerChange(e.target.value)}
          disabled={disabled || locked}
          placeholder="Edit the team answer here. You can type directly or insert suggestions from your team."
          className={textareaClassName}
        />
      </div>

      <SuggestionList
        suggestions={suggestions}
        onInsert={handleInsert}
        disabled={disabled || locked}
        className={suggestionsClassName}
      />

      <div className={actionsClassName || ""} style={{ marginTop: "1rem" }}>
        <button
          onClick={onLockAnswer}
          disabled={isLockDisabled}
          className={buttonClassName}
        >
          {locked ? "🔒 Answer Locked" : "🔒 Lock Answer"}
        </button>
        {locked && (
          <div className="clash-locked-message">
            Your team's answer has been locked and submitted!
          </div>
        )}
      </div>
    </div>
  );
}






