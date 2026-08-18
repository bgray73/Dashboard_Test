/**
 * Lightweight in-memory metrics for LabOps observability.
 *
 * Exposes counters and gauges that can be scraped at `/api/metrics`
 * in Prometheus text format. Designed for local / trusted-LAN deployment
 * without a dedicated metrics backend.
 */

export interface Metric {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
}

interface CounterValue {
  value: number;
}

interface HistogramValue {
  buckets: Record<string, number>;
  count: number;
  sum: number;
}

const metricDefs = new Map<string, Metric>();
const counters = new Map<string, CounterValue>();
const gauges = new Map<string, number>();
const histograms = new Map<string, HistogramValue>();

const DEFAULT_BUCKETS = ["5", "10", "25", "50", "100", "250", "500", "1000", "+Inf"];

export function registerMetric(metric: Metric): void {
  metricDefs.set(metric.name, metric);
  if (metric.type === "counter" && !counters.has(metric.name)) {
    counters.set(metric.name, { value: 0 });
  }
  if (metric.type === "gauge" && !gauges.has(metric.name)) {
    gauges.set(metric.name, 0);
  }
  if (metric.type === "histogram" && !histograms.has(metric.name)) {
    histograms.set(metric.name, {
      buckets: Object.fromEntries(DEFAULT_BUCKETS.map((b) => [b, 0])),
      count: 0,
      sum: 0,
    });
  }
}

export function incCounter(name: string, amount = 1): void {
  const existing = counters.get(name);
  if (existing) {
    existing.value += amount;
  } else {
    counters.set(name, { value: amount });
  }
}

export function setGauge(name: string, value: number): void {
  gauges.set(name, value);
}

export function observeHistogram(name: string, value: number): void {
  const existing = histograms.get(name);
  if (!existing) return;
  existing.count += 1;
  existing.sum += value;
  for (const bucket of DEFAULT_BUCKETS) {
    if (bucket === "+Inf" || value <= Number(bucket)) {
      existing.buckets[bucket] += 1;
    }
  }
}

export function renderMetrics(): string {
  const lines: string[] = [];

  for (const [name, metric] of metricDefs) {
    lines.push(`# HELP ${name} ${metric.help}`);
    lines.push(`# TYPE ${name} ${metric.type}`);

    if (metric.type === "counter") {
      lines.push(`${name} ${counters.get(name)?.value ?? 0}`);
    } else if (metric.type === "gauge") {
      lines.push(`${name} ${gauges.get(name) ?? 0}`);
    } else if (metric.type === "histogram") {
      const hist = histograms.get(name);
      if (hist) {
        for (const bucket of DEFAULT_BUCKETS) {
          lines.push(`${name}_bucket{le="${bucket}"} ${hist.buckets[bucket]}`);
        }
        lines.push(`${name}_count ${hist.count}`);
        lines.push(`${name}_sum ${hist.sum}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Register built-in metrics
registerMetric({
  name: "labops_http_requests_total",
  help: "Total number of HTTP requests received",
  type: "counter",
});
registerMetric({
  name: "labops_http_request_errors_total",
  help: "Total number of HTTP requests that resulted in an error",
  type: "counter",
});
registerMetric({
  name: "labops_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  type: "histogram",
});
registerMetric({
  name: "labops_db_pool_connections",
  help: "Current number of database pool connections",
  type: "gauge",
});
registerMetric({
  name: "labops_scheduler_leader",
  help: "1 if this instance is the scheduler leader, 0 otherwise",
  type: "gauge",
});
registerMetric({
  name: "labops_open_incidents",
  help: "Current number of open monitoring incidents",
  type: "gauge",
});
registerMetric({
  name: "labops_webhook_queue_depth",
  help: "Number of webhook deliveries waiting for retry",
  type: "gauge",
});
