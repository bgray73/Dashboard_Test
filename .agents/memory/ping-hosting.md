---
name: Hosted ICMP behavior
description: Environment constraint affecting manual ping checks in hosted API containers.
---

Hosted API containers may not have the permissions or socket support required for ICMP. The application should treat those failures as an explicit `unknown` capability result rather than claiming the target is offline.

**Why:** A failed ping can mean either an unreachable target or an execution environment that cannot open ICMP sockets.

**How to apply:** Keep ping isolated behind the backend function so a local collector with network permissions can replace it later.