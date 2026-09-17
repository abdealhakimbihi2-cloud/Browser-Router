/**
 * Browser, Device, and In-App Detection Utilities
 * Provides conservative, safe environment detection and Android Chrome Intent construction.
 */

export interface EnvironmentInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isDesktop: boolean;
  isTikTok: boolean;
  browserName: string;
}

const REDIRECT_STORAGE_KEY = 'browserRedirectAttempted';

/**
 * Checks whether an automatic redirect has already been attempted in this browser session.
 * Protects against infinite redirect loops.
 */
export function hasAttemptedRedirect(): boolean {
  try {
    return sessionStorage.getItem(REDIRECT_STORAGE_KEY) === 'true';
  } catch {
    // If sessionStorage is unavailable or throws (e.g. restricted sandboxes), fail safe
    return false;
  }
}

/**
 * Marks that an automatic external browser attempt has taken place for this session.
 */
export function markRedirectAttempted(): void {
  try {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, 'true');
  } catch {
    // Gracefully handle storage errors
  }
}

/**
 * Detects whether the visitor is currently navigating inside the TikTok in-app browser.
 * Uses conservative checks across userAgent, userAgentData (if available), and referrer.
 */
export function detectTikTok(ua: string): boolean {
  const lowerUA = ua.toLowerCase();

  // Primary known TikTok in-app browser identifiers
  const tikTokKeywords = [
    'tiktok',
    'musical_ly',
    'bytedance',
    'bytedancewebview',
    'trill',
    'aweme',
  ];

  for (const keyword of tikTokKeywords) {
    if (lowerUA.includes(keyword)) {
      return true;
    }
  }

  // Check document referrer if available
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const refUrl = new URL(document.referrer);
      if (
        refUrl.hostname.includes('tiktok.com') ||
        refUrl.hostname.includes('musical.ly')
      ) {
        // Only consider as candidate if it's accompanied by webview signs
        if (
          lowerUA.includes('wv') ||
          lowerUA.includes('version/') ||
          lowerUA.includes('mobile')
        ) {
          return true;
        }
      }
    } catch {
      // Ignore invalid referrer URLs
    }
  }

  // Client Hints API check (modern Chromium browsers)
  if (typeof navigator !== 'undefined' && 'userAgentData' in navigator) {
    const uaData = (navigator as unknown as { userAgentData?: { brands?: Array<{ brand: string }> } }).userAgentData;
    if (uaData && Array.isArray(uaData.brands)) {
      const hasTikTokBrand = uaData.brands.some(b =>
        b.brand.toLowerCase().includes('tiktok') ||
        b.brand.toLowerCase().includes('bytedance')
      );
      if (hasTikTokBrand) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detects the client platform and primary browser identity.
 */
export function detectEnvironment(): EnvironmentInfo {
  if (typeof window === 'undefined') {
    return {
      isAndroid: false,
      isIOS: false,
      isDesktop: true,
      isTikTok: false,
      browserName: 'Unknown',
    };
  }

  const ua = navigator.userAgent || '';
  const lowerUA = ua.toLowerCase();

  // Detect Android
  const isAndroid = /android/i.test(ua);

  // Detect iOS (iPhone, iPad, iPod, or iPadOS desktop emulation)
  const isIOS =
    /iphone|ipod|ipad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isDesktop = !isAndroid && !isIOS;
  const isTikTok = detectTikTok(ua);

  // Determine standard browser name if not in TikTok
  let browserName = 'Browser';
  if (lowerUA.includes('edg/') || lowerUA.includes('edge/')) {
    browserName = 'Microsoft Edge';
  } else if (lowerUA.includes('samsungbrowser')) {
    browserName = 'Samsung Internet';
  } else if (lowerUA.includes('chrome') && !lowerUA.includes('chromium')) {
    browserName = 'Google Chrome';
  } else if (lowerUA.includes('firefox') || lowerUA.includes('fxios')) {
    browserName = 'Mozilla Firefox';
  } else if (lowerUA.includes('safari') && !lowerUA.includes('chrome')) {
    browserName = 'Apple Safari';
  }

  return {
    isAndroid,
    isIOS,
    isDesktop,
    isTikTok,
    browserName,
  };
}

/**
 * Dynamically constructs an Android Chrome Intent URL from a target HTTPS URL.
 * 
 * Target concept format:
 * intent://HOST/PATH#Intent;scheme=https;package=com.android.chrome;end
 *
 * Preserves query strings, hashes, and pathname safely without hard-coding.
 */
export function createAndroidChromeIntent(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl);
    
    // Ensure host is valid
    const host = parsed.host;
    
    // Path, query, and hash
    // Standard URL pathname always starts with '/' or is empty
    let pathAndQuery = parsed.pathname;
    if (parsed.search) {
      pathAndQuery += parsed.search;
    }
    if (parsed.hash) {
      pathAndQuery += parsed.hash;
    }

    // Strip leading slash if needed or keep standard host/path format:
    // Chrome intents look like: intent://host/path...
    // If pathname starts with '/', host + pathAndQuery creates 'example.com/path'
    const fullPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
    const uriWithoutScheme = `${host}${fullPath}`;

    // Standard Android Chrome Intent
    return `intent://${uriWithoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
  } catch {
    // Fallback directly to original URL if parsing fails
    return targetUrl;
  }
}
