import React, { useState } from 'react';
import './FormattedMessage.css';

interface FormattedMessageProps {
  content: string;
}

const YouTubeIcon: React.FC = () => (
  <svg className="yt-svg-icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const ExternalLinkIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{language || 'code'}</span>
        <button type="button" className="md-copy-btn" onClick={handleCopy}>
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#56d364" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Đã chép</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      <pre className="md-code-content">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Function to parse inline elements: bold, italic, inline code, and links (including YouTube)
function parseInline(text: string): React.ReactNode[] {
  // Regex matches markdown links [title](url), bold **text**, italic *text*, inline `code`
  const regex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    const [fullMatch, , linkTitle, linkUrl, boldText, italicText, inlineCode] = match;

    if (linkTitle && linkUrl) {
      const isYouTube = linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be');
      if (isYouTube) {
        result.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="md-yt-link-chip"
            title={`Xem video YouTube: ${linkTitle}`}
          >
            <span className="yt-badge-icon">
              <YouTubeIcon />
            </span>
            <span className="yt-link-title">{linkTitle}</span>
            <span className="yt-action-label">Xem Video <ExternalLinkIcon /></span>
          </a>
        );
      } else {
        result.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="md-link"
          >
            {linkTitle} <ExternalLinkIcon />
          </a>
        );
      }
    } else if (boldText) {
      result.push(<strong key={match.index} className="md-bold">{boldText}</strong>);
    } else if (italicText) {
      result.push(<em key={match.index} className="md-italic">{italicText}</em>);
    } else if (inlineCode) {
      result.push(<code key={match.index} className="md-inline-code">{inlineCode}</code>);
    } else {
      result.push(fullMatch);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content }) => {
  if (!content) return null;

  // Split by code blocks first
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.substring(lastIndex, match.index);
      blocks.push(renderTextBlocks(textChunk, `text-${lastIndex}`));
    }

    const lang = match[1] || '';
    const code = match[2].trim();
    blocks.push(<CodeBlock key={`code-${match.index}`} language={lang} code={code} />);

    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    const textChunk = content.substring(lastIndex);
    blocks.push(renderTextBlocks(textChunk, `text-${lastIndex}`));
  }

  return <div className="formatted-message-body">{blocks}</div>;
};

function renderTextBlocks(text: string, keyPrefix: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let currentListItems: React.ReactNode[] = [];
  let currentListType: 'ol' | 'ul' | null = null;

  const flushList = () => {
    if (currentListItems.length > 0 && currentListType) {
      if (currentListType === 'ol') {
        elements.push(
          <ol key={`${keyPrefix}-list-${elements.length}`} className="md-ordered-list">
            {currentListItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`${keyPrefix}-list-${elements.length}`} className="md-unordered-list">
            {currentListItems}
          </ul>
        );
      }
      currentListItems = [];
      currentListType = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    // Header 1 (# ...)
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`${keyPrefix}-${idx}`} className="md-h1">
          {parseInline(trimmed.substring(2))}
        </h1>
      );
      return;
    }

    // Header 2 (## ...)
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`${keyPrefix}-${idx}`} className="md-h2">
          {parseInline(trimmed.substring(3))}
        </h2>
      );
      return;
    }

    // Header 3 (### ...)
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`${keyPrefix}-${idx}`} className="md-h3">
          {parseInline(trimmed.substring(4))}
        </h3>
      );
      return;
    }

    // Ordered list (1. ..., 2. ...)
    const olMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (olMatch) {
      if (currentListType && currentListType !== 'ol') {
        flushList();
      }
      currentListType = 'ol';
      const num = olMatch[1];
      const itemText = olMatch[2];
      currentListItems.push(
        <li key={`item-${idx}`} className="md-list-item md-ol-item">
          <span className="md-ol-num">{num}</span>
          <div className="md-item-content">{parseInline(itemText)}</div>
        </li>
      );
      return;
    }

    // Unordered list (- ... or * ...)
    const ulMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    if (ulMatch) {
      if (currentListType && currentListType !== 'ul') {
        flushList();
      }
      currentListType = 'ul';
      const itemText = ulMatch[1];
      currentListItems.push(
        <li key={`item-${idx}`} className="md-list-item md-ul-item">
          <span className="md-bullet">•</span>
          <div className="md-item-content">{parseInline(itemText)}</div>
        </li>
      );
      return;
    }

    // Normal Paragraph
    flushList();
    elements.push(
      <p key={`${keyPrefix}-${idx}`} className="md-paragraph">
        {parseInline(line)}
      </p>
    );
  });

  flushList();

  return <React.Fragment key={keyPrefix}>{elements}</React.Fragment>;
}

export default FormattedMessage;
