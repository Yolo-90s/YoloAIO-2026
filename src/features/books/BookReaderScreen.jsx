import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import ShareIcon from '@mui/icons-material/Share';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { bookCache, fetchBookBody } from './gutendexClient.js';
import {
  addFavoriteBook,
  isFavoriteBook,
  removeFavoriteBook,
} from './bookFavoritesRepository.js';

const READER_BG = '#14101e';
const READER_FG = '#e6e0f3';

export function BookReaderScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const config = useAppConfig();
  const book = bookCache.byId(bookId);

  const [fetchState, setFetchState] = useState({ kind: 'loading' });
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    if (!book) return;
    isFavoriteBook(book.id).then(setIsFav);
  }, [book]);

  useEffect(() => {
    if (!book) return;
    if (!book.htmlUrl && !book.textUrl) {
      setFetchState({ kind: 'no-readable' });
      return;
    }
    let cancelled = false;
    setFetchState({ kind: 'loading' });
    const isHtml = Boolean(book.htmlUrl);
    const url = book.htmlUrl || book.textUrl;
    fetchBookBody({ url, proxyBase: config.booksApiBaseUrl })
      .then((body) => {
        if (cancelled) return;
        setFetchState({ kind: 'ready', body, isHtml });
      })
      .catch((e) => {
        if (!cancelled) {
          setFetchState({ kind: 'failed', message: e.message || "Couldn't load" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [book, config.booksApiBaseUrl]);

  const handleToggleFav = async () => {
    if (!book) return;
    if (isFav) {
      await removeFavoriteBook(book.id);
      setIsFav(false);
    } else {
      await addFavoriteBook(book);
      setIsFav(true);
    }
  };

  const handleShare = () => {
    if (!book) return;
    const url = book.htmlUrl || `https://www.gutenberg.org/ebooks/${book.id}`;
    const shareData = {
      title: `${book.title} — ${book.displayAuthor}`,
      text: `${book.title} by ${book.displayAuthor}`,
      url,
    };
    if (typeof navigator.share === 'function') {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  if (!book) {
    return <CenteredMessage title="Open this book from the list" message="We lost the book metadata. Go back and tap it again." onBack={() => navigate(-1)} />;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        backgroundColor: READER_BG,
        color: READER_FG,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Floating header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          right: 8,
          zIndex: 2,
          backgroundColor: 'rgba(20,16,30,0.6)',
          backdropFilter: 'blur(12px)',
          borderRadius: '14px',
          px: 1,
          py: 0.5,
        }}
      >
        <IconButton onClick={() => navigate(-1)} sx={{ color: READER_FG }} aria-label="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="subtitle2"
          sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}
        >
          {book.title}
        </Typography>
        <IconButton onClick={handleToggleFav} sx={{ color: isFav ? 'primary.main' : READER_FG }} aria-label="Favourite">
          {isFav ? <BookmarkIcon /> : <BookmarkBorderIcon />}
        </IconButton>
        <IconButton onClick={handleShare} sx={{ color: READER_FG }} aria-label="Share">
          <ShareIcon />
        </IconButton>
      </Stack>

      {/* Body */}
      {fetchState.kind === 'loading' && (
        <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
          <CircularProgress />
        </Stack>
      )}

      {fetchState.kind === 'failed' && (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ flex: 1, px: 3, textAlign: 'center' }}>
          <CloudOffIcon sx={{ fontSize: 56 }} />
          <Typography variant="h6">Couldn't load book</Typography>
          <Typography variant="body2" color="text.secondary">{fetchState.message}</Typography>
          {!config.booksApiBaseUrl && (
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360 }}>
              The books proxy isn't configured. Set <code>booksApiBaseUrl</code> in
              Firestore <code>config/app</code> to your <code>bookProxy</code> Cloud
              Function URL.
            </Typography>
          )}
          <Button variant="outlined" onClick={() => navigate(-1)}>Back</Button>
        </Stack>
      )}

      {fetchState.kind === 'no-readable' && (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ flex: 1, px: 3, textAlign: 'center' }}>
          <Typography variant="h6">No readable version</Typography>
          <Typography variant="body2" color="text.secondary">
            This title doesn't ship with an HTML or plain-text version on Gutenberg.
          </Typography>
          {book.epubUrl && (
            <Button variant="contained" component="a" href={book.epubUrl} target="_blank" rel="noopener noreferrer">
              Open EPUB externally
            </Button>
          )}
        </Stack>
      )}

      {fetchState.kind === 'ready' && (
        <PaginatedReader
          body={fetchState.body}
          isHtml={fetchState.isHtml}
          title={book.title}
        />
      )}
    </Box>
  );
}

/**
 * Paginated CSS-column reader. Same approach as the Android reader:
 * the book body is wrapped in a #book element with `column-width:
 * 9999px` (forces one column at container width) and we navigate by
 * applying `transform: translateX(-page * pageWidth)`. Swipe gestures
 * + tap zones flip pages with a small 3D fold.
 *
 * Pagination math lives in a same-origin iframe so its #book element's
 * scrollWidth is readable from the parent.
 */
function PaginatedReader({ body, isHtml, title }) {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [ready, setReady] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [animTransform, setAnimTransform] = useState(false);
  const dragStartRef = useRef(null);
  const containerWidthRef = useRef(0);

  // Build the paginated HTML string once per body change.
  const srcDoc = buildPaginatedHtml({ body, isHtml, title });

  // Re-measure after the iframe loads. We try once after a small delay
  // (Chrome paints the first frame before column layout settles), then
  // retry if the count came back as 1.
  const measure = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    const vp = doc?.getElementById('viewport');
    const bookEl = doc?.getElementById('book');
    if (!vp || !bookEl) return;
    const w = vp.clientWidth;
    const sw = bookEl.scrollWidth;
    const n = Math.max(1, Math.ceil(sw / Math.max(1, w)));
    setPageWidth(w);
    setPageCount(n);
    setCurrentPage(0);
    setReady(w > 0 && n > 0);
  }, []);

  const handleIframeLoad = () => {
    let tries = 0;
    const tick = () => {
      tries++;
      measure();
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      const bookEl = doc?.getElementById('book');
      const vp = doc?.getElementById('viewport');
      const finished =
        vp && bookEl && Math.ceil(bookEl.scrollWidth / Math.max(1, vp.clientWidth)) > 1;
      if (!finished && tries < 5) setTimeout(tick, 250);
    };
    setTimeout(tick, 80);
  };

  // Apply translateX inside the iframe.
  const applyPage = useCallback(
    (page) => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      const bookEl = doc?.getElementById('book');
      if (!bookEl) return;
      bookEl.style.transform = `translateX(-${page * pageWidth}px)`;
    },
    [pageWidth]
  );

  useEffect(() => {
    if (ready) applyPage(currentPage);
  }, [ready, currentPage, applyPage]);

  const goToPage = (target) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, target));
    if (clamped === currentPage) return;
    const dir = clamped > currentPage ? 1 : -1;
    const w = containerWidthRef.current;
    // Phase 1: flip current page out
    setAnimTransform(true);
    setDragX(-dir * w);
    setTimeout(() => {
      // Phase 2: swap page, jump to opposite side instantly
      setCurrentPage(clamped);
      setAnimTransform(false);
      setDragX(dir * w);
      // Phase 3: ease back to 0
      requestAnimationFrame(() => {
        setAnimTransform(true);
        setDragX(0);
        setTimeout(() => setAnimTransform(false), 230);
      });
    }, 200);
  };

  // Pointer-event swipe — works on touch and mouse.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready) return;
    containerWidthRef.current = el.clientWidth;

    const onDown = (e) => {
      // Ignore touches on the floating header.
      if (e.target?.closest('button')) return;
      dragStartRef.current = { x: e.clientX, t: performance.now() };
      el.setPointerCapture(e.pointerId);
      setAnimTransform(false);
    };
    const onMove = (e) => {
      if (!dragStartRef.current) return;
      setDragX(e.clientX - dragStartRef.current.x);
    };
    const onUp = (e) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const w = containerWidthRef.current;
      const threshold = w * 0.22;
      dragStartRef.current = null;
      el.releasePointerCapture?.(e.pointerId);
      if (dx < -threshold && currentPage < pageCount - 1) {
        goToPage(currentPage + 1);
      } else if (dx > threshold && currentPage > 0) {
        goToPage(currentPage - 1);
      } else {
        setAnimTransform(true);
        setDragX(0);
        setTimeout(() => setAnimTransform(false), 200);
      }
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [ready, currentPage, pageCount]);

  // Tap zones.
  const handleTap = (e) => {
    if (!ready || dragStartRef.current) return;
    // Ignore taps that the pointer move handler would also catch.
    if (Math.abs(dragX) > 5) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.33) goToPage(currentPage - 1);
    else if (x > rect.width * 0.67) goToPage(currentPage + 1);
  };

  // Window resize → re-measure (clientWidth changes, column count
  // changes). Cheap because the iframe stays loaded.
  useEffect(() => {
    const onResize = () => {
      containerWidthRef.current = containerRef.current?.clientWidth || 0;
      measure();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  const rotation = containerWidthRef.current > 0
    ? (dragX / containerWidthRef.current) * -18
    : 0;

  return (
    <Box
      ref={containerRef}
      onClick={handleTap}
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: 'grab',
        touchAction: 'pan-y',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          transform: `perspective(1200px) translateX(${dragX}px) rotateY(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: animTransform ? 'transform 200ms ease' : 'none',
        }}
      >
        <Box
          component="iframe"
          ref={iframeRef}
          srcDoc={srcDoc}
          onLoad={handleIframeLoad}
          sandbox="allow-same-origin"
          sx={{
            width: '100%',
            height: '100%',
            border: 0,
            display: 'block',
            backgroundColor: READER_BG,
          }}
        />
      </Box>

      {/* Page indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: '20px',
          px: 1.5,
          py: 0.5,
          color: '#fff',
          fontSize: 12,
          letterSpacing: 0.5,
        }}
      >
        {ready && pageCount > 1
          ? `${currentPage + 1} / ${pageCount}`
          : 'Preparing pages…'}
      </Box>
    </Box>
  );
}

function CenteredMessage({ title, message, onBack }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ height: '100dvh', textAlign: 'center', px: 3 }}>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary">{message}</Typography>
      <Button variant="outlined" onClick={onBack}>Back</Button>
    </Stack>
  );
}

function extractBodyContent(html) {
  const lower = html.toLowerCase();
  const bodyOpen = lower.indexOf('<body');
  if (bodyOpen < 0) return html;
  const afterTag = html.indexOf('>', bodyOpen);
  if (afterTag < 0) return html;
  const bodyClose = lower.lastIndexOf('</body>');
  return bodyClose > afterTag
    ? html.substring(afterTag + 1, bodyClose)
    : html.substring(afterTag + 1);
}

function buildPaginatedHtml({ body, isHtml, title }) {
  const safeTitle = (title || '').replace(/[<>]/g, '');
  const inner = isHtml
    ? extractBodyContent(body)
    : `<pre style="white-space:pre-wrap;word-wrap:break-word;margin:0;font-family:inherit">${
        body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }</pre>`;
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>${safeTitle}</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: ${READER_BG};
    color: ${READER_FG};
    font-family: Georgia, 'Times New Roman', serif;
    -webkit-text-size-adjust: 100%;
  }
  /* The viewport provides ALL the page padding. Each CSS column inside
     #book ends up exactly viewport-width wide, so translateX(-N×width)
     lines pages up flush against the left edge. */
  #viewport {
    position: absolute;
    top: 32px;
    bottom: 64px;
    left: 28px;
    right: 28px;
    overflow: hidden;
  }
  #book {
    width: 100%;
    height: 100%;
    -webkit-column-width: 9999px;
    column-width: 9999px;
    -webkit-column-gap: 0;
    column-gap: 0;
    -webkit-column-fill: auto;
    column-fill: auto;
    font-size: 17px;
    line-height: 1.65;
    transform: translateX(0);
    will-change: transform;
  }
  img { max-width: 100%; height: auto; break-inside: avoid; }
  p { margin: 0 0 0.85em 0; }
  h1, h2, h3 { break-after: avoid; line-height: 1.25; }
  a { color: #c5a7ff; }
  div, section, article, table {
    max-width: 100% !important;
    width: auto !important;
  }
</style>
</head><body>
<div id="viewport"><div id="book">${inner}</div></div>
</body></html>`;
}
