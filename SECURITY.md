# Security Policy

## Severity Policy

We categorize security findings into four severity levels based on CVSS scores and exploitability:

- **Critical**: CVSS score 9.0-10.0, or vulnerabilities with active exploits in the wild, remote code execution, or authentication bypass.
- **High**: CVSS score 7.0-8.9, or vulnerabilities that could lead to significant impact but require some user interaction or local access.
- **Medium**: CVSS score 4.0-6.9, or vulnerabilities with limited impact or requiring specific conditions to exploit.
- **Low**: CVSS score 0.0-3.9, or vulnerabilities with minimal impact or theoretical risk.

### Thresholds for CI Failure

The CI pipeline will fail if any of the following are detected:
- Any new Critical or High severity finding
- Any new Medium or Low severity finding that exceeds the baseline count by more than 10%
- Any finding that matches an active exception but has exceeded its expiration date

## Exception Process

To manage known issues that cannot be immediately fixed, we maintain an exception list with the following requirements:

1. **Owner**: Each exception must have a designated owner responsible for monitoring and resolving the issue.
2. **Expiration**: Each exception must have an expiration date (maximum 90 days from approval).
3. **Justification**: A detailed justification must be provided, including:
   - Why the issue cannot be fixed immediately
   - Impact if exploited
   - Mitigation steps in place
   - Plan for resolution

### Adding an Exception

1. Create an issue in the tracking system (e.g., GitHub Issue) labeled `security-exception`.
2. Fill in the exception template (see below).
3. Get approval from the security team or designated approver.
4. Add the exception to `SECURITY_EXCEPTIONS.yaml` in the repository root.
5. The exception will be automatically removed after the expiration date.

### Exception Template

```yaml
- id: EXC-<year>-<number>
  description: "Brief description of the issue"
  cve: "CVE-XXXX-XXXX (if applicable)"
  severity: critical|high|medium|low
  owner: "username or team name"
  expires: "YYYY-MM-DD"
  justification: |
    Detailed justification...
  mitigation: |
    Current mitigation steps...
```

## Known False Positives

The following are known false positives that are safely ignored by our security scans:

1. **Trivy**: 
   - CVE-2021-XXXX in `golang.org/x/text`: False positive due to vendored version not being used.
   - Secret scan: AWS keys in test files matching pattern `AKIA[0-9A-Z]{16}` but are actually test keys.

2. **Dependency Review**:
   - GHSA-abcd-1234-efgh: Fixed in a version not detected due to private registry.

3. **Secret Scanning**:
   - Generic API keys in example documentation: These are intentional examples and not real credentials.

### Updating the False Positive List

To add a new known false positive:
1. Document the false positive in this section with a clear explanation.
2. Update the security scan configuration to ignore the finding (if possible via configuration).
3. If the false positive is due to a signature update, note the scanner version from which it is fixed.