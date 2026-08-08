import React, { useState } from 'react';
import FormattedMessage from './FormattedMessage';
import './ThoughtProcess.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolCallInfo {
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

interface ThoughtProcessProps {
  toolCalls: ToolCallInfo[];
  /** If true, shows a spinner indicating the call is still in progress */
  isActive?: boolean;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const WrenchIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const ChevronIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`tp-chevron ${isOpen ? 'tp-chevron--open' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckCircleIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const SpinnerIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="tp-spinner">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const ArrowRightIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// ─── Individual Tool Call Row ──────────────────────────────────────────────────

const ToolCallRow: React.FC<{ call: ToolCallInfo }> = ({ call }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasArgs = Boolean(call.args);
  const hasResult = call.result !== undefined && call.result !== null;
  const hasDetails = hasArgs || hasResult;

  return (
    <div className="tp-step">
      {/* Step connector line dot */}
      <div className="tp-step-dot" />

      <div className="tp-step-body">
        {/* Step header */}
        <div
          className={`tp-step-header ${hasDetails ? 'tp-step-header--clickable' : ''}`}
          onClick={() => hasDetails && setIsExpanded((p) => !p)}
          title={hasDetails ? (isExpanded ? 'Collapse details' : 'Expand details') : undefined}
        >
          <div className="tp-step-title">
            <CheckCircleIcon />
            <span className="tp-step-name">{call.name}</span>
            {!hasDetails && (
              <span className="tp-step-badge">no output</span>
            )}
          </div>

          {hasDetails && (
            <div className="tp-step-toggle">
              <span>{isExpanded ? 'Hide' : 'Show'}</span>
              <ChevronIcon isOpen={isExpanded} />
            </div>
          )}
        </div>

        {/* Expandable detail payload */}
        {isExpanded && hasDetails && (
          <div className="tp-step-detail">
            {hasArgs && (
              <div className="tp-detail-section">
                <div className="tp-detail-label">
                  <ArrowRightIcon />
                  <span>Arguments</span>
                </div>
                <pre className="tp-detail-code">
                  {JSON.stringify(call.args, null, 2)}
                </pre>
              </div>
            )}
            {hasResult && (
              <div className="tp-detail-section">
                <div className="tp-detail-label">
                  <ArrowRightIcon />
                  <span>Result</span>
                </div>
                <pre className="tp-detail-code">
                  {typeof call.result === 'string'
                    ? call.result
                    : JSON.stringify(call.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── ThoughtProcess (Tool Call Component) ───────────────────────────────────────

export const ThoughtProcess: React.FC<ThoughtProcessProps> = ({ toolCalls, isActive = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const count = toolCalls.length;

  if (count === 0) return null;

  return (
    <div className="tp-container">
      {/* Header toggle button */}
      <button
        type="button"
        className="tp-header"
        onClick={() => setIsOpen((p) => !p)}
        aria-expanded={isOpen}
      >
        {/* Left: icon + label */}
        <div className="tp-header-left">
          <span className="tp-header-icon">
            {isActive ? <SpinnerIcon /> : <WrenchIcon />}
          </span>
          <span className="tp-header-label">
            {isActive
              ? `Running tool…`
              : `Used ${count} MCP tool${count !== 1 ? 's' : ''}`}
          </span>

          {/* Status badge */}
          {isActive ? (
            <span className="tp-badge tp-badge--active">Running</span>
          ) : (
            <span className="tp-badge tp-badge--done">Done</span>
          )}
        </div>

        {/* Right: chevron */}
        <ChevronIcon isOpen={isOpen} />
      </button>

      {/* Expandable vertical-line steps */}
      {isOpen && (
        <div className="tp-steps">
          {toolCalls.map((call, idx) => (
            <ToolCallRow key={`${call.name}-${idx}`} call={call} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── ReasoningProcess (Self-contained Thought Process UI Component) ─────────────

export const ReasoningProcess: React.FC<{ reasoning?: string }> = ({ reasoning }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoning || !reasoning.trim()) return null;

  return (
    <div className="claude-reasoning-container">
      <div
        className="claude-reasoning-header"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? 'Thu gọn quá trình suy luận' : 'Xem chi tiết quá trình suy luận'}
      >
        <div className="claude-reasoning-title">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`claude-chevron ${isOpen ? 'open' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Quá trình suy luận</span>
        </div>
      </div>

      {isOpen && (
        <div className="claude-reasoning-body">
          <FormattedMessage content={reasoning} />
        </div>
      )}
    </div>
  );
};

export default ThoughtProcess;
