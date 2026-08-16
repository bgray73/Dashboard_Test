/**
 * Phase 20: Server-side Configuration Generation
 *
 * This module provides server-enforced configuration generation and secret handling.
 * All secret-bearing fields are processed server-side to prevent cleartext persistence.
 */

/**
 * Check if a configuration contains embedded cleartext secrets
 * Covers SNMPv3 and other vendor configurations
 */
export function containsSecrets(config: string): { hasSecrets: boolean; patterns: string[] } {
  const patterns: string[] = [];
  
  // SNMPv3 auth: "auth md5|sha <password>" or "auth sha1|sha256|sha512 <password>"
  const authPasswordRegex = /auth\s+(md5|sha1|sha256|sha512|priv)\s+\S+/gi;
  if (authPasswordRegex.test(config)) patterns.push("auth_password");

  // SNMPv3 priv: "priv aes|des|3des <keylen?> <password>"
  const privPasswordRegex = /priv\s+(aes|des|3des)(\s+\d+)?\s+\S+/gi;
  if (privPasswordRegex.test(config)) patterns.push("priv_password");

  // Generic password patterns
  const secretPatterns = [
    /password\s*[=:]\s*\S+/gi,
    /password\s+\S+/gi,
    /passphrase\s*[=:]\s*\S+/gi,
    /secret\s+\S+/gi,
    /auth_key\s+\S+/gi,
    /priv_key\s+\S+/gi,
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
 * Handles Cisco, Arista, Juniper, and other vendor formats
 */
export function redactSecrets(config: string): string {
  let redacted = config;

  // Redact SNMPv3 auth: auth md5|sha <password>
  redacted = redacted.replace(
    /auth\s+(md5|sha1|sha256|sha512|priv)\s+\S+/gi,
    '$1=<AUTH_PASSWORD>'
  );

  // Redact SNMPv3 priv: priv aes|des|3des [256] <password>
  redacted = redacted.replace(
    /priv\s+(aes|des|3des)(\s+\d+)?\s+\S+/gi,
    '$1$2=<PRIV_PASSWORD>'
  );

  // Redact generic password patterns
  redacted = redacted.replace(
    /(password|passphrase|auth_key|priv_key|secret)\s*[=:]\s*\S+/gi,
    '$1=<REDACTED>'
  );
  
  redacted = redacted.replace(
    /(password|passphrase|auth_key|priv_key|secret)\s+\S+/gi,
    '$1=<REDACTED>'
  );

  return redacted;
}

/**
 * Generate a safe configuration from input, redacting any secrets
 */
export function generateSafeConfiguration(
  input: { generatedConfiguration: string }
): string {
  return redactSecrets(input.generatedConfiguration);
}

/**
 * Validate that a configuration input is safe (no embedded secrets)
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
    const { hasSecrets } = containsSecrets(input.generatedConfiguration);
    if (hasSecrets) {
      return {
        valid: false,
        error: "Configuration contains embedded secrets that will be redacted server-side"
      };
    }
  }
  
  return { valid: true };
}