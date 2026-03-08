/**
 * In-memory Metrics Collector (Prometheus format)
 */

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map(); // Simple non-bucketed for now

  // Increment a counter
  public inc(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.formatKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  // Observe a value for a histogram/summary
  public observe(name: string, labels: Record<string, string> = {}, value: number): void {
    const key = this.formatKey(name, labels);
    const current = this.histograms.get(key) || [];
    current.push(value);
    // Keep bounded in memory, e.g., last 1000 observations per labelset
    if (current.length > 1000) current.shift();
    this.histograms.set(key, current);
  }

  // Generate Prometheus-compatible text output
  public format(): string {
    let output = "";

    // Counters
    for (const [key, value] of this.counters.entries()) {
      output += `${key} ${value}\n`;
    }

    // Histograms (simplified to emit sum, count, and avg instead of actual buckets)
    for (const [key, values] of this.histograms.entries()) {
      if (values.length === 0) continue;
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / count;

      output += `${key}_sum ${sum}\n`;
      output += `${key}_count ${count}\n`;
      output += `${key}_avg ${avg.toFixed(2)}\n`;
    }

    return output;
  }

  private formatKey(name: string, labels: Record<string, string>): string {
    const labelKeys = Object.keys(labels);
    if (labelKeys.length === 0) return name;

    const labelStr = labelKeys
      .map((k) => `${k}="${labels[k]}"`)
      .join(",");
    
    return `${name}{${labelStr}}`;
  }
}

export const metrics = new MetricsCollector();
