/**
 * Phase 20: Server-side Configuration Generation
 *
 * This module provides server-enforced configuration generation and secret handling.
 * All secret-bearing fields are processed server-side to prevent cleartext persistence.
 */

/**
 * Check if a configuration contains embedded cleartext secrets
 * Patterns for SNMPv3 credentials in Cisco/Arista/Juniper style configs
 */
export function containsSecrets(config: string): { hasSecrets: boolean; patterns: string[] } {
  const patterns: string[] = [];
  
  // Match SNMPv3 auth password patterns - case insensitive
  // Common formats: "auth md5 password", "auth sha password", "authPriv password", etc.
  const authPasswordRegex = /auth\s+(md5|sha1|sha256|sha512|priv)\s+[^\s]+/gi;
  const authPasswordMatches = config.match(authPasswordRegex);
  if (authPasswordMatches) patterns.push("auth_password");
  
  // Match SNMPv3 privacy password patterns
  const privPasswordRegex = /priv\s+(aes|des|3des)\s+[^\s]+/gi;
  const privPasswordMatches = config.match(privPasswordRegex);
  if (privPasswordMatches) patterns.push("priv_password");
  
  // Match generic secrets that look like passwords
  const secretPatterns = [
    /password\s*[=:]\s*\S+/gi,
    /passphrase\s*[=:]\s*\S+/gi,
    /secret\s+[=:]\s*\S+/gi,
    /key\s*[=:]\s*\S+/gi,
    /credential\s*[=:]\s*\S+/gi,
  ];
  
  for (const pattern of secretPatterns) {
    if (pattern.test(config)) patterns.push("credential");
  }

  return {
    hasSecrets: patterns.length > 0,
    patterns: Array.from(new Set(patterns)),
  };
}

/**
 * Redact all secret fields from a configuration string
 * Replaces secret values with placeholders
 */
export function redactSecrets(config: string): string {
  let redacted = config;

  // Redact SNMPv3 auth parameters - match the password value after auth method
  redacted = redacted.replace(
    /auth\s+(md5|sha1|sha256|sha512|priv)\s+\S+/gi,
    (match) => {
      const parts = match.split(/\s+/);
      return `${parts[0]} ${parts[1]}=<AUTH_PASSWORD>`;
    }
  );

  // Redact SNMPv3 priv parameters - match the key value after encryption method
  redacted = redacted.replace(
    /priv\s+(aes|des|3des)\s+\S+/gi,
    (match) => {
      const parts = match.split(/\s+/);
      return `${parts[0]} ${parts[1]}=<PRIV_PASSWORD>`;
    }
  );

  // Redact generic password patterns like "password=xyz" or "password xyz"
  redacted = redacted.replace(
    /(password|passphrase|secret|key|credential)\s*[=:]\s*\S+/gi,
    '$1=<REDACTED>'
  );

  return redacted;
}

/**
 * Generate a safe configuration from input, redacting any secrets
 * Returns the redacted configuration string
 */
export function generateSafeConfiguration(
  input: { generatedConfiguration: string }
): string {
  return redactSecrets(input.generatedConfiguration);
}

/**
 * Validate that a configuration input is safe (no embedded secrets)
 * Returns { valid: true } if safe, or { valid: false, error: string } if not
 */
export function validateConfigurationInput(input: {
  generatedConfiguration?: string;
  authPassword?: string;
  privacyPassword?: string;
}): { valid: boolean; error?: string } {
  // Reject direct password input from API clients
  if (input.authPassword && input.authPassword.length > 0) {
    return { valid: false, error: "auth password must not be provided through the API" };
  }
  
  if (input.privacyPassword && input.privacyPassword.length > 0) {
    return { valid: false, error: "privacy password must not be provided through the API" };
  }
  
  // Check generated configuration for embedded secrets
  if (input.generatedConfiguration && input.generatedConfiguration.length > 0) {
    const { hasSecrets, patterns } = containsSecrets(input.generatedConfiguration);
    if (hasSecrets) {
      return {
        valid: false,
        error: `Configuration contains embedded secrets (${patterns.join(", ")}) that will be redacted server-side`
      };
    }
  }
  
  return { valid: true };
}