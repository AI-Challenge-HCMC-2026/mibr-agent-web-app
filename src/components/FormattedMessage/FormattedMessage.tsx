import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
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
  inGallery?: boolean;
  onOpen: (src: string, alt: string) => void;
}> = ({ src, alt, inGallery, onOpen }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src) return null;

  // Show a visible broken-image fallback so the user knows an image was expected
  if (failed) {
    return (
      <figure className={`md-image-figure md-image-figure--broken${inGallery ? ' md-image-figure--gallery' : ''}`}>
        <div className="md-image-broken">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="md-image-broken-text">Không tải được ảnh</span>
        </div>
        <a className="md-image-broken-url" href={src} target="_blank" rel="noopener noreferrer" title={src}>
          {src.length > 60 ? `${src.slice(0, 58)}…` : src}
        </a>
        {alt && <figcaption className="md-image-caption">{alt}</figcaption>}
      </figure>
    );
  }

  return (
    <figure
      className={`md-image-figure${inGallery ? ' md-image-figure--gallery' : ''}`}
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
        className={`md-image${loaded ? ' md-image--loaded' : ''}${inGallery ? ' md-image--gallery' : ''}`}
        src={src}
        alt={alt || ''}
        loading="lazy"
        referrerPolicy="no-referrer"
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

// ─── Helpers: detect image-only paragraphs & group consecutive images ────────

/** Check if a React child is a rendered image element (from our img override). */
const isImageElement = (child: React.ReactNode): boolean => {
  if (!React.isValidElement(child)) return false;
  // Our img override renders <LightboxImage>, which produces <figure class="md-image-figure">
  // ReactMarkdown passes { node, src, alt, ... } to our `img` component override.
  // The child here is the return value of our `img:` component, which is <LightboxImage>.
  const el = child as React.ReactElement<any>;
  return el.type === LightboxImage || el.props?.src !== undefined;
};

/**
 * Pre-process markdown to:
 * 1. Convert bare image URLs (standalone line with .jpg/.png/.gif/.webp/etc.) to markdown images
 * 2. Convert HTML <img> tags to markdown image syntax for consistent handling
 * 3. Group consecutive image-only lines into a single paragraph (gallery layout)
 */
const groupConsecutiveImages = (md: string): string => {
  const lines = md.split('\n');
  const result: string[] = [];
  let imageBuffer: string[] = [];

  const flushImages = () => {
    if (imageBuffer.length > 1) {
      // Join with a space so they stay in one paragraph
      result.push(imageBuffer.join(' '));
    } else if (imageBuffer.length === 1) {
      result.push(imageBuffer[0]);
    }
    imageBuffer = [];
  };

  const imageLineRe = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/;
  // Bare image URL on its own line (http(s)://...image extension or known image CDN patterns)
  const bareImageUrlRe = /^\s*(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|avif)(?:\?[^\s]*)?)\s*$/i;
  // HTML <img> tag
  const htmlImgRe = /^\s*<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>\s*$/i;

  for (const line of lines) {
    // Already markdown image
    if (imageLineRe.test(line)) {
      imageBuffer.push(line.trim());
    }
    // Bare image URL → convert to markdown image
    else if (bareImageUrlRe.test(line)) {
      const match = line.match(bareImageUrlRe);
      if (match) {
        imageBuffer.push(`![](${match[1]})`);
      }
    }
    // HTML <img> tag → convert to markdown image
    else if (htmlImgRe.test(line)) {
      const match = line.match(htmlImgRe);
      if (match) {
        const altMatch = line.match(/alt=["']([^"']*?)["']/i);
        const altText = altMatch ? altMatch[1] : '';
        imageBuffer.push(`![${altText}](${match[1]})`);
      }
    }
    else {
      flushImages();
      result.push(line);
    }
  }
  flushImages();

  return result.join('\n');
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

  const processedContent = useMemo(() => groupConsecutiveImages(content), [content]);

  if (!content) return null;

  return (
    <div className="formatted-message-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Paragraphs — detect image-only content for gallery layout
          p: ({ children }) => {
            const childArray = React.Children.toArray(children).filter(
              (c) => !(typeof c === 'string' && c.trim() === '')
            );
            const imageChildren = childArray.filter(isImageElement);

            // All children are images → render as gallery grid
            if (imageChildren.length > 1 && imageChildren.length === childArray.length) {
              return (
                <div className={`md-image-gallery md-image-gallery--${Math.min(imageChildren.length, 4)}`}>
                  {React.Children.map(children, (child) => {
                    if (React.isValidElement(child) && isImageElement(child)) {
                      const el = child as React.ReactElement<any>;
                      return <LightboxImage {...el.props} inGallery onOpen={openLightbox} />;
                    }
                    return child;
                  })}
                </div>
              );
            }

            return <p className="md-paragraph">{children}</p>;
          },

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

          // Links (with smart image autolink detection)
          a: ({ href, children }) => {
            const url = href || '';
            const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
            const childText = React.Children.toArray(children).join('');
            const isBareUrl = childText === url || childText.trim() === shortenUrl(url);

            // Check if link target is an image (including Cloudflare R2, S3 presigned URLs with query params)
            const cleanPath = url.split('?')[0].split('#')[0];
            const isImage =
              /\.(?:jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(cleanPath) ||
              /r2\.cloudflarestorage\.com/i.test(url) ||
              /supabase\.co\/storage\/v1\/object/i.test(url);

            if (isImage) {
              return (
                <LightboxImage
                  src={url}
                  alt={isBareUrl ? '' : childText}
                  onOpen={openLightbox}
                />
              );
            }

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
          img: ({ src, alt }: any) => (
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
        {processedContent}
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
