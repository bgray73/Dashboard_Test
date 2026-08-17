/**
 * Phase 20 + Phase 24: Server-side Configuration Generation
 * 
 * Phase 20: Server-side Configuration Generation and secret handling
 * Phase 24: Server-enforced SNMP secret non-persistence
 * 
 * This module provides server-enforced configuration generation.
 * All secret-bearing fields are processed server-side to prevent cleartext persistence.
 * Passwords are NEVER accepted from API clients - they are managed via server-side secret store.
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

  // Generic password patterns (not including already-redacted placeholders)
  const secretPatterns = [
    /password\s*[=:]\s*(?!<[^>]+>)[^\s<]+/gi,
    /password\s+(?!<[^>]+>)[^\s<]+/gi,
    /passphrase\s*[=:]\s*(?!<[^>]+>)[^\s<]+/gi,
    /secret\s+(?!<[^>]+>)[^\s<]+/gi,
    /auth_key\s+(?!<[^>]+>)[^\s<]+/gi,
    /priv_key\s+(?!<[^>]+>)[^\s<]+/gi,
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
 * Phase 24: Always redacts - never trusts input to be already redacted
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

  // Redact generic password/secret patterns
  // But preserve placeholders like <AUTH_PASSWORD>, <PRIV_PASSWORD>, <REDACTED>
  redacted = redacted.replace(
    /(password|passphrase|auth_key|priv_key|secret)\s*[=:]\s*\S+/gi,
    '$1=<REDACTED>'
  );
  redacted = redacted.replace(
    /(password|passphrase|auth_key|priv_key|secret)\s+\S+/gi,
    '$1=<REDACTED>'
  );
  
  // Normalize placeholder variations
  redacted = redacted.replace(
    /(<AUTH_PASSWORD>|<AUTH[_ -]?PASSWORD>|AUTH_PASSWORD|\[AUTH_PASSWORD\])/gi, 
    "<AUTH_PASSWORD>"
  );
  redacted = redacted.replace(
    /(<PRIV_PASSWORD>|<PRIV[_ -]?PASSWORD>|PRIV_PASSWORD|\[PRIV_PASSWORD\])/gi, 
    "<PRIV_PASSWORD>"
  );

  return redacted;
}

/**
 * Generate a safe configuration from input, redacting any secrets
 * Phase 24: Server-enforced - always redacts, never trusts client input
 */
export function generateSafeConfiguration(
  input: { generatedConfiguration: string }
): string {
  return redactSecrets(input.generatedConfiguration);
}

/**
 * Check if input contains forbidden password fields
 * Phase 24: Server-enforced non-persistence
 * Returns true if password fields are present (should be rejected)
 */
export function hasForbiddenPasswords(input: Record<string, unknown>): boolean {
  const forbiddenKeys = ['authPassword', 'privacyPassword', 'auth_password', 'privacy_password'];
  return forbiddenKeys.some(key => key in input);
}

/**
 * Validate that a configuration input is safe (no embedded secrets)
 * Phase 24: Strict server enforcement - rejects any cleartext secrets
 */
export function validateConfigurationInput(input: {
  generatedConfiguration?: string;
  authPassword?: string;
  privacyPassword?: string;
}): { valid: boolean; error?: string } {
  // Phase 24: Reject direct auth/password fields
  if (input.authPassword !== undefined) {
    return {
      valid: false,
      error: "auth password is not allowed in request; use server-side secret store"
    };
  }
  if (input.privacyPassword !== undefined) {
    return {
      valid: false,
      error: "privacy password is not allowed in request; use server-side secret store"
    };
  }
  
  // Check generated configuration for embedded secrets
  if (input.generatedConfiguration && input.generatedConfiguration.length > 0) {
    const { hasSecrets, patterns } = containsSecrets(input.generatedConfiguration);
    if (hasSecrets) {
      return {
        valid: false,
        error: `Configuration contains embedded secrets (${patterns.join(', ')}). These will be redacted server-side.`
      };
    }
  }
  
  return { valid: true };
}