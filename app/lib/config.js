// Pure config helpers, shared by server and browser (preview).
// The config itself lives in the theme editor block settings, never in our database.
// Keep these defaults the same as the block's {% schema %} defaults.

export const DEFAULT_CONFIG = {
  threshold: 5,
  messageSingular: "Only {count} left!",
  messagePlural: "Only {count} left!",
};

export const LIMITS = {
  thresholdMin: 1,
  thresholdMax: 100, // same as the block's range setting
  messageMaxLength: 80,
};

const PLACEHOLDER = "{count}";

function checkThreshold(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) return "Threshold must be a whole number";
  if (number < LIMITS.thresholdMin || number > LIMITS.thresholdMax) {
    return `Threshold must be between ${LIMITS.thresholdMin} and ${LIMITS.thresholdMax}`;
  }
  return null;
}

function checkMessage(value, { requireCount }) {
  if (typeof value !== "string" || value.trim() === "") {
    return "Message is required";
  }
  if (value.length > LIMITS.messageMaxLength) {
    return `Message must be ${LIMITS.messageMaxLength} characters or fewer`;
  }
  // No HTML or anything that looks like code.
  if (/[<>]/.test(value)) return "HTML is not allowed";
  // {count} is the only placeholder we understand.

  const tokens = value.match(/\{[^}]*\}/g) || [];
  if (tokens.some((token) => token !== PLACEHOLDER)) {
    return `Only the ${PLACEHOLDER} placeholder is allowed`;
  }
  if (requireCount && !tokens.includes(PLACEHOLDER)) {
    return `Must include ${PLACEHOLDER} so it reads correctly for any number`;
  }
  return null;
}

// Validate input from the settings form. Returns { config, errors }.
export function validateConfig(input) {
  const config = {
    threshold: Number(input.threshold),
    messageSingular: String(input.messageSingular ?? "").trim(),
    messagePlural: String(input.messagePlural ?? "").trim(),
  };

  const errors = {};
  const thresholdError = checkThreshold(input.threshold);
  // Singular ("1 left") may skip the number, e.g. "Last one left!".
  const singularError = checkMessage(config.messageSingular, {
    requireCount: false,
  });
  const pluralError = checkMessage(config.messagePlural, {
    requireCount: true,
  });
  if (thresholdError) errors.threshold = thresholdError;
  if (singularError) errors.messageSingular = singularError;
  if (pluralError) errors.messagePlural = pluralError;

  return { config, errors };
}

// Clean up whatever we read from the theme block settings.
// Missing or invalid fields fall back to defaults one by one, so the feature never switches off.

export function sanitizeConfig(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const { errors } = validateConfig(source);

  const config = {
    threshold: errors.threshold
      ? DEFAULT_CONFIG.threshold
      : Number(source.threshold),
    messageSingular: errors.messageSingular
      ? DEFAULT_CONFIG.messageSingular
      : source.messageSingular.trim(),
    messagePlural: errors.messagePlural
      ? DEFAULT_CONFIG.messagePlural
      : source.messagePlural.trim(),
  };
  return { config, isMissing: !raw, isInvalid: Boolean(raw) && Object.keys(errors).length > 0 };
}

// "Only {count} left!" + 3 -> "Only 3 left!" (singular text when count is 1).
export function formatMessage(config, count) {
  const template = count === 1 ? config.messageSingular : config.messagePlural;
  return template.replaceAll(PLACEHOLDER, String(count));
}

export function statusFor(totalInventory, threshold) {
  return totalInventory <= threshold ? "LOW" : "OK";
}
