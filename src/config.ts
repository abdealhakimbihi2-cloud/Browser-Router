/**
 * Target Destination Configuration
 *
 * This is the ONLY configuration variable required for routing.
 * Modify this URL to point to your desired destination.
 */
export const TARGET_URL = "https://www.trendgame2026.site";

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  parsedUrl?: URL;
}

/**
 * Validates that the TARGET_URL is safe and correctly formatted:
 * - Must be a valid parseable URL
 * - Must use secure HTTPS protocol
 * - Must have a valid non-empty hostname
 * - Must strictly reject dangerous schemes (javascript:, data:, vbscript:, file:, etc.)
 */
export function validateTargetUrl(urlStr: string): UrlValidationResult {
  if (!urlStr || typeof urlStr !== 'string') {
    return {
      isValid: false,
      error: "TARGET_URL is missing or empty. Please set a valid HTTPS URL.",
    };
  }

  const trimmed = urlStr.trim();
  const lower = trimmed.toLowerCase();

  // Explicit safety checks against dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return {
      isValid: false,
      error: "TARGET_URL uses an unsafe scheme. Only secure HTTPS URLs are permitted.",
    };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'https:') {
      return {
        isValid: false,
        error: `TARGET_URL must use the secure 'https://' protocol (found '${parsed.protocol}').`,
      };
    }

    if (!parsed.hostname || parsed.hostname.trim().length === 0) {
      return {
        isValid: false,
        error: "TARGET_URL does not contain a valid hostname.",
      };
    }

    // Check for common malformed hostnames
    if (parsed.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
      // Allow during development, but warn/valid
    }

    return {
      isValid: true,
      parsedUrl: parsed,
    };
  } catch {
    return {
      isValid: false,
      error: `Invalid TARGET_URL format: "${urlStr}". Please ensure it starts with https://.`,
    };
  }
}
