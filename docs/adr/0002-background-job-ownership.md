# ADR-0002: Background Job Ownership

## Status
Proposed

## Context
LabOps runs multiple background processes (monitoring, webhook delivery, retention cleanup, collector operations) that need to:
- Run exactly once per lease across multiple API instances
- Survive restarts safely
- Have clear ownership and failure recovery

Currently, all API instances run the same scheduled jobs, leading to duplicate work and potential race conditions.

## Decision
Use PostgreSQL advisory locks for leadership acquisition with heartbeat-based lease management.

### Why PostgreSQL Advisory Locks?
1. **Existing infrastructure** - No new dependencies required
2. **Reliable** - Battle-tested in production environments
3. **Transactional** - Can be acquired/released within existing DB transactions
4. **No extra services** - Works with current PostgreSQL-only architecture

### Alternative Considered
- **Kubernetes Leader Election** - Rejected: would require K8s deployment
- **Redis-based locks** - Rejected: adds infrastructure complexity
- **Coordinated processes** - Rejected: doesn't scale, single point of failure

## Implementation Plan

### Leadership Acquisition
```
1. Request lease using pg_try_advisory_lock(key)
2. If granted: set isLeader = true, start heartbeat
3. If denied: another instance owns the job
```

### Heartbeat
```
1. Update `scheduled_jobs` table with `last_heartbeat_at`
2. Other instances poll this column to detect stalled leaders
3. Expired heartbeat = job can be claimed by new leader
```

### Lease Timeout
```
1. If heartbeat not updated within configured timeout (e.g., 30s)
2. Lease expires, job becomes claimable again
```

### Graceful Shutdown (`SIGTERM`)
```
1. Set `isLeader = false` in database
2. Stop accepting new work claims
3. Complete in-flight work (bounded duration)
4. Release advisory locks
5. Exit cleanly
```

## Job Types

| Job | Lock Key | Heartbeat | Timeout | Shutdown |
|-----|----------|-------------|---------|----------|
| Monitoring | 1001 | 15s | 45s | 5s |
| Webhook delivery | 1002 | 10s | 30s | 3s |
| Retention cleanup | 1003 | 60s | 5m | 10s |
| Collector ops | 1004 | 30s | 2m | 8s |

## Consequences

### Positive
- Exactly-once execution semantics
- Automatic recovery from leader death
- No duplicate work or lost jobs
- Works in current PostgreSQL-only environment

### Negative
- Requires PostgreSQL availability for leadership
- Network partition could cause false deadlock detection
- Lock contention under high write load

## Validation Criteria

1. Two API processes do not duplicate scheduled work
2. Forced leader termination results in bounded takeover
3. Shutdown exits within documented platform timeout
4. Work leaves recoverable state on forced termination
5. Database connectivity test verifies leadership acquisition

## References

- PostgreSQL Documentation: Advisory Locks
- "Designing Distributed Systems" (Circa 2020) - Chapter 8: Coordination