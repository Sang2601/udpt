#!/usr/bin/env python3
"""
Distributed Hotel Booking - High Concurrency Load Testing & Benchmark Suite
Measures throughput, latency (Avg, P50, P95, P99), success/error rates,
and load balancing instance distribution (X-Served-By).
"""

import sys
import time
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

def run_single_request(url):
    start = time.perf_counter()
    served_by = "unknown"
    status_code = 0
    success = False
    error_msg = ""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DistributedBenchmark/1.0"})
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            status_code = resp.status
            served_by = resp.headers.get("X-Served-By", "unknown")
            resp.read() # consume body
            if 200 <= status_code < 300:
                success = True
    except urllib.error.HTTPError as e:
        status_code = e.code
        served_by = e.headers.get("X-Served-By", "unknown")
        error_msg = str(e)
    except Exception as e:
        status_code = 0
        error_msg = str(e)

    duration_ms = (time.perf_counter() - start) * 1000.0
    return {
        "success": success,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "served_by": served_by,
        "error": error_msg
    }

def run_benchmark(target_url, total_requests, concurrency, label="Benchmark"):
    print(f"\n=======================================================")
    print(f" [RUNNING] {label}")
    print(f" Target: {target_url} | Total: {total_requests} | Concurrency: {concurrency}")
    print(f"=======================================================")

    results = []
    wall_start = time.perf_counter()

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(run_single_request, target_url) for _ in range(total_requests)]
        for f in as_completed(futures):
            results.append(f.result())

    wall_duration = time.perf_counter() - wall_start
    success_count = sum(1 for r in results if r["success"])
    fail_count = total_requests - success_count
    latencies = sorted(r["duration_ms"] for r in results)

    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
    p50 = latencies[int(len(latencies) * 0.50)] if latencies else 0.0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0.0
    throughput = total_requests / wall_duration if wall_duration > 0 else 0.0

    # Instance distribution
    instance_counts = {}
    for r in results:
        sb = r["served_by"]
        instance_counts[sb] = instance_counts.get(sb, 0) + 1

    print(f"--- Results for: {label} ---")
    print(f"  Total Requests:     {total_requests}")
    print(f"  Successful:         {success_count} ({success_count/total_requests*100:.1f}%)")
    print(f"  Failed:             {fail_count} ({fail_count/total_requests*100:.1f}%)")
    print(f"  Wall-clock Time:    {wall_duration:.2f} s")
    print(f"  Throughput:         {throughput:.2f} req/s")
    print(f"  Avg Latency:        {avg_latency:.2f} ms")
    print(f"  P50 Latency:        {p50:.2f} ms")
    print(f"  P95 Latency:        {p95:.2f} ms")
    print(f"  P99 Latency:        {p99:.2f} ms")
    print(f"  Load Distribution across Instances (X-Served-By):")
    for inst, count in sorted(instance_counts.items()):
        pct = (count / total_requests) * 100.0
        print(f"    * {inst}: {count} requests ({pct:.1f}%)")

    return {
        "label": label,
        "concurrency": concurrency,
        "total": total_requests,
        "success": success_count,
        "failed": fail_count,
        "throughput": round(throughput, 2),
        "avg_ms": round(avg_latency, 2),
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
        "distribution": instance_counts
    }

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8088/api/rooms"
    concurrency_levels = [10, 50, 100]

    all_reports = []
    for c in concurrency_levels:
        tot = c * 4 # e.g. 40, 200, 400 requests
        rep = run_benchmark(target, total_requests=tot, concurrency=c, label=f"Concurrency Level {c}")
        all_reports.append(rep)
        time.sleep(1)

    print("\n\n=======================================================")
    print(" SUMMARY BENCHMARK COMPARISON TABLE (MARKDOWN)")
    print("=======================================================")
    print("| Scenario / Concurrency | Total Req | Success | Throughput (req/s) | Avg (ms) | P95 (ms) | P99 (ms) | Instance Distribution |")
    print("|:-----------------------|:----------|:--------|:-------------------|:---------|:---------|:---------|:----------------------|")
    for r in all_reports:
        dist_str = ", ".join([f"{k}: {v}" for k, v in r['distribution'].items()])
        print(f"| {r['label']:<22} | {r['total']:<9} | {r['success']:<7} | {r['throughput']:<18} | {r['avg_ms']:<8} | {r['p95_ms']:<8} | {r['p99_ms']:<8} | {dist_str} |")
