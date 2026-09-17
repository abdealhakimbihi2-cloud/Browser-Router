import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { TARGET_URL, validateTargetUrl } from '../config.ts';
import {
  detectEnvironment,
  hasAttemptedRedirect,
  markRedirectAttempted,
  createAndroidChromeIntent,
  type EnvironmentInfo,
} from '../utils/browserDetection.ts';

type PageState = 'initializing' | 'redirecting' | 'fallback' | 'invalid_url';

export default function RouterLanding() {
  const [state, setState] = useState<PageState>('initializing');
  const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Validate TARGET_URL once
  const validation = useMemo(() => validateTargetUrl(TARGET_URL), []);

  // Dynamically constructed Android Chrome Intent
  const androidChromeIntent = useMemo(() => {
    return createAndroidChromeIntent(TARGET_URL);
  }, []);

  // Handler for clicking "Open in Chrome"
  const handleOpenChrome = useCallback(() => {
    // 1. Immediately reveal and play the video as requested
    setShowVideo(true);

    // Immediate playback trigger on user gesture
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }, 50);

    // 2. Attempt the legitimate Chrome external-browser navigation
    if (environment?.isAndroid) {
      try {
        window.location.href = androidChromeIntent;
      } catch {
        window.location.href = TARGET_URL;
      }
    } else {
      try {
        window.location.href = TARGET_URL;
      } catch {
        // Safe navigation fallback
      }
    }
  }, [environment, androidChromeIntent]);

  // Main automatic routing lifecycle
  useEffect(() => {
    // 1. Check TARGET_URL validity
    if (!validation.isValid) {
      setState('invalid_url');
      return;
    }

    // 2. Detect visitor environment
    const env = detectEnvironment();
    setEnvironment(env);

    // 3. Check if redirect was already attempted this session
    const alreadyAttempted = hasAttemptedRedirect();

    // 4. If visitor is already outside TikTok (normal browser):
    if (!env.isTikTok) {
      setState('redirecting');
      // Direct navigation to destination
      const timer = setTimeout(() => {
        try {
          window.location.replace(TARGET_URL);
        } catch {
          window.location.href = TARGET_URL;
        }
      }, 400);

      return () => clearTimeout(timer);
    }

    // 5. Visitor is inside TikTok
    if (alreadyAttempted) {
      // Redirect was already attempted in this session; show fallback UI directly
      setState('fallback');
      return;
    }

    // Mark that we are making our single permitted automatic attempt
    markRedirectAttempted();

    if (env.isAndroid) {
      // Attempt Android Chrome Intent
      setState('redirecting');

      try {
        window.location.href = androidChromeIntent;
      } catch {
        // If execution throws immediately, reveal fallback
        setState('fallback');
        return;
      }

      // If page is still visible after brief delay (intent blocked or app didn't background):
      const fallbackTimer = setTimeout(() => {
        setState('fallback');
      }, 1400);

      // Listen for page visibility change (if app went to background, intent succeeded)
      const handleVisibilityChange = () => {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
        } else {
          // If user comes back, show fallback options
          setState('fallback');
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearTimeout(fallbackTimer);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      // iOS / iPadOS inside TikTok:
      // Automatic external browser launching is strictly restricted by iOS WKWebView.
      // Transition to fallback interface
      setState('redirecting');

      const iosTimer = setTimeout(() => {
        setState('fallback');
      }, 900);

      return () => clearTimeout(iosTimer);
    }
  }, [validation.isValid, androidChromeIntent]);

  return (
    <main
      id="router-landing-container"
      className="min-h-screen flex flex-col justify-between items-center px-4 py-8 sm:py-16"
    >
      <div className="w-full max-w-md mx-auto my-auto">
        <AnimatePresence mode="wait">
          {/* STATE: INVALID URL */}
          {state === 'invalid_url' && (
            <motion.div
              key="invalid-url"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              id="card-invalid-url"
              className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-rose-100 text-center"
            >
              <div
                id="icon-invalid-url"
                className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-5"
              >
                <AlertTriangle className="w-7 h-7" />
              </div>

              <h1
                id="title-invalid-url"
                className="text-xl font-semibold text-slate-900 mb-2"
              >
                Configuration Required
              </h1>

              <p
                id="desc-invalid-url"
                className="text-sm text-slate-600 mb-4 leading-relaxed"
              >
                {validation.error || 'The target URL configuration is invalid.'}
              </p>

              <div
                id="box-invalid-url-code"
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 text-left overflow-x-auto break-all"
              >
                TARGET_URL: "{TARGET_URL}"
              </div>
            </motion.div>
          )}

          {/* STATE: REDIRECTING / INITIALIZING */}
          {(state === 'initializing' || state === 'redirecting') && (
            <motion.div
              key="redirecting"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              id="card-redirecting"
              className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 text-center"
            >
              <div
                id="icon-redirecting"
                className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-6 relative"
              >
                <Compass className="w-8 h-8 animate-pulse" />
                <span
                  id="spinner-ring"
                  className="absolute inset-0 rounded-2xl border-2 border-blue-600 border-t-transparent animate-spin"
                />
              </div>

              <h1
                id="title-redirecting"
                className="text-2xl font-semibold text-slate-900 tracking-tight mb-2"
              >
                Opening your browser...
              </h1>

              <p
                id="desc-redirecting"
                className="text-sm text-slate-500 mb-2 leading-relaxed"
              >
                We're opening this page in your browser.
              </p>
            </motion.div>
          )}

          {/* STATE: FALLBACK (When in-app browser blocks automatic handoff or manual launch) */}
          {state === 'fallback' && (
            <motion.div
              key="fallback"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              id="card-fallback"
              className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 text-center"
            >
              <div
                id="icon-fallback"
                className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center mx-auto mb-5"
              >
                <Compass className="w-8 h-8" />
              </div>

              <h1
                id="title-fallback"
                className="text-2xl font-semibold text-slate-900 tracking-tight mb-2"
              >
                Open in your browser
              </h1>

              <p
                id="desc-fallback"
                className="text-sm text-slate-500 mb-6 leading-relaxed"
              >
                For the best experience, open this link directly in your device's browser.
              </p>

              {/* PRIMARY ACTION BUTTON: OPEN IN CHROME */}
              <div id="actions-container" className="space-y-3">
                <button
                  type="button"
                  id="btn-open-in-chrome"
                  onClick={handleOpenChrome}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-base shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>Open in Chrome</span>
                </button>
              </div>

              {/* Subtle Trust Note */}
              <div
                id="safe-navigation-note"
                className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-400"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Verified secure external link</span>
              </div>

              {/* VIDEO SECTION - SHOWN ONLY AFTER CLICKING "OPEN IN CHROME" */}
              <AnimatePresence>
                {showVideo && (
                  <motion.div
                    key="video-guide-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    id="video-tutorial-container"
                    className="mt-6 pt-6 border-t border-slate-200"
                  >
                    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl shadow-sm border border-slate-200 bg-slate-950">
                      <video
                        ref={videoRef}
                        id="tutorial-video"
                        autoPlay
                        controls
                        playsInline
                        preload="auto"
                        className="w-full h-auto object-contain block mx-auto rounded-2xl"
                      >
                        <source src="/video.mp4" type="video/mp4" />
                        <source src="/assets/video.mp4" type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Clean Minimalist Footer */}
      <footer id="landing-footer" className="text-center text-xs text-slate-400 mt-6">
        <span>Protected browser redirection</span>
      </footer>
    </main>
  );
}
