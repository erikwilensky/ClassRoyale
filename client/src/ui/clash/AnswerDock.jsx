import React from "react";
import { WriterInput } from "../../components/WriterInput.jsx";
import { SuggesterBox } from "../../components/SuggesterBox.jsx";

/**
 * Unified panel for writer/suggester interactions.
 * Presentation-only; delegates to existing components.
 */
export function AnswerDock({
  isWriter,
  teamId,
  teamLocked,
  teamAnswer,
  suggestions,
  onAnswerChange,
  onInsertSuggestion,
  onLockAnswer,
  canWriteAnswer,
  suggestionText,
  onSuggestionChange,
  onSubmitSuggestion,
  canSuggest,
}) {
  if (!teamId) {
    return null;
  }

  return (
    <section className="clash-answer-dock clash-panel">
      <header className="clash-answer-header">
        <h3 className="clash-answer-title">
          {isWriter ? "Your Answer" : "Suggest an Answer"}
        </h3>
        {teamLocked && (
          <span className="clash-chip clash-chip--lock">🔒 Locked</span>
        )}
      </header>

      {isWriter ? (
        <div className="clash-answer-body">
          <WriterInput
            teamAnswer={teamAnswer}
            suggestions={suggestions}
            onAnswerChange={onAnswerChange}
            onInsertSuggestion={onInsertSuggestion}
            onLockAnswer={onLockAnswer}
            disabled={!canWriteAnswer}
            locked={teamLocked}
            // Chapter 17.2: Inject Clash theme classes
            textareaClassName="clash-textarea"
            buttonClassName="clash-btn clash-btn--primary"
            suggestionsClassName=""
          />
        </div>
      ) : (
        <div className="clash-answer-body">
          <SuggesterBox
            suggestionText={suggestionText}
            teamAnswer={teamAnswer}
            onSuggestionChange={onSuggestionChange}
            onSubmitSuggestion={onSubmitSuggestion}
            disabled={!canSuggest}
            // Chapter 17.2: Inject Clash theme classes
            inputClassName="clash-input"
            buttonClassName="clash-btn clash-btn--secondary"
            readOnlyAnswerClassName="clash-panel"
          />
        </div>
      )}
    </section>
  );
}


