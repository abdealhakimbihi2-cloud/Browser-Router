import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass,
  ExternalLink,
  ArrowRight,
  AlertTriangle,
  MoreHorizontal,
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

  // Validate TARGET_URL once
  const validation = useMemo(() => validateTargetUrl(TARGET_URL), []);

  // Dynamically constructed Android Chrome Intent
  const androidChromeIntent = useMemo(() => {
    return createAndroidChromeIntent(TARGET_URL);
  }, []);

  // Handler for manual external browser launch
  const handleOpenExternal = useCallback(() => {
    if (!environment) return;

    if (environment.isAndroid) {
      // Direct user action to open Chrome Intent
      try {
        window.location.href = androidChromeIntent;
      } catch {
        window.location.href = TARGET_URL;
      }
    } else {
      // iOS / other: attempt standard window navigation
      window.location.href = TARGET_URL;
    }
  }, [environment, androidChromeIntent]);

  // Handler for normal fallback navigation
  const handleContinueNormal = useCallback(() => {
    window.location.href = TARGET_URL;
  }, []);

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
      // We attempt a soft navigation once, then immediately provide clear manual instructions.
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
                className="text-sm text-slate-500 mb-8 leading-relaxed"
              >
                We're opening this page in your browser.
              </p>

              {/* Direct fallback link in case automatic navigation is delayed */}
              <button
                type="button"
                id="btn-manual-skip"
                onClick={handleContinueNormal}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 active:text-blue-800 transition-colors py-2 px-4 rounded-lg hover:bg-blue-50"
              >
                <span>Continue now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STATE: FALLBACK (When in-app browser blocks automatic handoff) */}
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

              {/* Platform-specific instruction guide */}
              {environment?.isIOS ? (
                <div
                  id="guide-ios-instructions"
                  className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-6 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div
                      id="badge-dots-icon"
                      className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </div>
                    <div className="text-xs text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-900">
                        How to open in Safari:
                      </p>
                      <p className="leading-relaxed">
                        Tap the <strong className="font-semibold text-slate-900">• • •</strong> menu in TikTok and choose <span className="font-medium text-blue-600">Open in Browser</span> or <span className="font-medium text-blue-600">Open in Safari</span>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* PRIMARY ACTION BUTTON */}
              <div id="actions-container" className="space-y-3">
                <button
                  type="button"
                  id="btn-primary-browser"
                  onClick={handleOpenExternal}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-base shadow-sm hover:shadow transition-all"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>
                    {environment?.isAndroid
                      ? 'Open in Chrome'
                      : environment?.isIOS
                      ? 'Open in Safari'
                      : 'Open in Browser'}
                  </span>
                </button>

                {/* SECONDARY FALLBACK BUTTON */}
                <button
                  type="button"
                  id="btn-secondary-continue"
                  onClick={handleContinueNormal}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-medium text-sm transition-colors"
                >
                  <span>Continue to Website</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
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
