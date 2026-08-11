import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './FormattedMessage.css';

interface FormattedMessageProps {
  content: string;
}

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#56d364" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ExternalLinkIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// Bare URLs (autolinked by GFM) render as unreadable walls of text inside table
// cells. Collapse them to "domain.com/first-segment…" while keeping the href.
const shortenUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '') return host;
    const label = `${host}${path}`;
    return label.length > 38 ? `${label.slice(0, 36)}…` : label;
  } catch {
    return url.length > 38 ? `${url.slice(0, 36)}…` : url;
  }
};


const YouTubeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// ─── Code Block with Copy Button ─────────────────────────────────────────────

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
              <CheckIcon />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon />
              <span>Copy</span>
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

// ─── Lightbox Image Component ────────────────────────────────────────────────

const LightboxImage: React.FC<{
  src?: string;
  alt?: string;
  onOpen: (src: string, alt: string) => void;
}> = ({ src, alt, onOpen }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed || !src) return null;

  return (
    <figure
      className="md-image-figure"
      onClick={() => onOpen(src, alt || '')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(src, alt || '');
        }
      }}
    >
      <img
        className={`md-image${loaded ? ' md-image--loaded' : ''}`}
        src={src}
        alt={alt || ''}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded && <div className="md-image-skeleton" />}
      {loaded && (
        <div className="md-image-overlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </div>
      )}
      {alt && <figcaption className="md-image-caption">{alt}</figcaption>}
    </figure>
  );
};

// ─── Main FormattedMessage Component ─────────────────────────────────────────

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content }) => {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const openLightbox = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [lightbox, closeLightbox]);

  if (!content) return null;

  return (
    <div className="formatted-message-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Paragraphs
          p: ({ children }) => (
            <p className="md-paragraph">{children}</p>
          ),

          // Headings
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="md-h4">{children}</h4>,

          // Bold & Italic
          strong: ({ children }) => <strong className="md-bold">{children}</strong>,
          em: ({ children }) => <em className="md-italic">{children}</em>,

          // Horizontal Rule
          hr: () => <hr className="md-hr" />,

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="md-blockquote">{children}</blockquote>
          ),

          // Lists
          ul: ({ children }) => <ul className="md-unordered-list">{children}</ul>,
          ol: ({ children }) => <ol className="md-ordered-list">{children}</ol>,
          li: ({ children }) => (
            <li className="md-list-item md-ul-item">
              <div className="md-item-content">{children}</div>
            </li>
          ),

          // Links
          a: ({ href, children }) => {
            const url = href || '';
            const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
            const childText = React.Children.toArray(children).join('');
            const isBareUrl = childText === url;

            if (isYouTube) {
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md-yt-link-chip"
                  title={`Watch YouTube: ${children}`}
                >
                  <span className="yt-badge-icon">
                    <YouTubeIcon />
                  </span>
                  <span className="yt-link-title">
                    {isBareUrl ? shortenUrl(url) : children}
                  </span>
                  <span className="yt-action-label">
                    Watch <ExternalLinkIcon />
                  </span>
                </a>
              );
            }

            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="md-link"
                title={url}
              >
                {isBareUrl ? shortenUrl(url) : children}
                <ExternalLinkIcon />
              </a>
            );
          },

          // Images — click to open lightbox
          img: ({ src, alt }) => (
            <LightboxImage src={src} alt={alt} onOpen={openLightbox} />
          ),

          // Inline Code & Code Blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = Boolean(match);
            const codeString = String(children).replace(/\n$/, '');

            if (isBlock) {
              return <CodeBlock language={match ? match[1] : ''} code={codeString} />;
            }

            return (
              <code className="md-inline-code" {...props}>
                {children}
              </code>
            );
          },

          // Suppress default <pre> wrapper since CodeBlock handles it
          pre: ({ children }) => <>{children}</>,

          // Tables (GFM)
          table: ({ children }) => (
            <div className="md-table-wrap">
              <table className="md-table">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="md-thead">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="md-tr">{children}</tr>,
          th: ({ children }) => <th className="md-th">{children}</th>,
          td: ({ children }) => <td className="md-td">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Lightbox overlay */}
      {lightbox &&
        createPortal(
          <div className="md-lightbox" onClick={closeLightbox}>
            <button
              className="md-lightbox-close"
              onClick={closeLightbox}
              aria-label="Close image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="md-lightbox-content" onClick={(e) => e.stopPropagation()}>
              <img
                className="md-lightbox-img"
                src={lightbox.src}
                alt={lightbox.alt}
              />
              {lightbox.alt && (
                <div className="md-lightbox-caption">{lightbox.alt}</div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default FormattedMessage;
