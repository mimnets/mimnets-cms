// Event-loop delay probe for the load test (m1-050, D-DB-13 condition 2).
//
// Loaded only through NODE_OPTIONS in docker/litestream-poc/compose.load-test.yaml,
// never by the app itself. It is active only in the web process (`node app`
// with no task), so tasks and the load client stay unmeasured.
//
// On SIGUSR2 it writes the delay histogram since the last signal to
// /tmp/loop-delay.json (milliseconds) and resets it. `scripts/load-test.mjs run`
// sends the signal before and after each run.
import { writeFileSync } from 'node:fs';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const isWebProcess = process.argv.length === 2 && /[\\/]app(\.js)?$/.test(process.argv[1] || '');

if (isWebProcess) {
  // Same 10 ms resolution as the m1-048 P6 measurement, so the numbers compare.
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  const ms = (ns) => Math.round(ns / 1e5) / 10;
  process.on('SIGUSR2', () => {
    writeFileSync('/tmp/loop-delay.json', JSON.stringify({
      samples: histogram.count,
      p50: ms(histogram.percentile(50)),
      p90: ms(histogram.percentile(90)),
      p99: ms(histogram.percentile(99)),
      max: ms(histogram.max)
    }));
    histogram.reset();
  });
}
