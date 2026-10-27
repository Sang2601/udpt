/**
 * tests/worker_pool.test.js
 * Automated test suite for Bounded WorkerPool (Bài 2).
 */

import { WorkerPool } from '../services/booking/src/worker_pool/WorkerPool.js';

async function runWorkerPoolTests() {
  console.log('Running WorkerPool Automated Tests (Bài 2: Tiến trình và Luồng)...');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`  FAIL: ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
    passed++;
    console.log(`  PASS: ${message}`);
  }

  const pool = new WorkerPool({ poolSize: 2, maxQueueSize: 3 });

  try {
    const status = pool.getStatus();
    assert(status.poolSize === 2, 'Worker pool successfully initialized with 2 worker threads');
    assert(status.idleWorkers === 2, 'Initial idle workers count is 2');

    // Test 1: Successful execution of report job
    const sampleBookings = [
      { id: 'b1', status: 'confirmed', total_price: 1500000, check_in: '2026-11-01', check_out: '2026-11-03', rooms_count: 1, room_type_name: 'Deluxe' },
      { id: 'b2', status: 'confirmed', total_price: 3000000, check_in: '2026-11-02', check_out: '2026-11-05', rooms_count: 2, room_type_name: 'Suite' },
      { id: 'b3', status: 'cancelled', total_price: 1000000, check_in: '2026-11-04', check_out: '2026-11-05', rooms_count: 1, room_type_name: 'Standard' }
    ];

    const result = await pool.execute('job-1', { bookings: sampleBookings });
    assert(result.jobId === 'job-1', 'Job result matches submitted jobId');
    assert(result.metrics.totalBookings === 3, 'Total bookings count aggregated correctly');
    assert(result.metrics.confirmedBookings === 2, 'Confirmed bookings count is 2');
    assert(result.metrics.cancelledBookings === 1, 'Cancelled bookings count is 1');
    assert(result.metrics.totalEstimatedValue === 4500000, 'Total estimated value matches sum of confirmed bookings');
    assert(result.processedBy.threadId > 0, `Processed by worker thread with threadId=${result.processedBy.threadId}`);
    assert(result.processedBy.pid === process.pid, `Processed inside main process PID=${process.pid}`);

    // Test 2: Concurrent tasks dispatched across pool
    const jobs = [
      pool.execute('job-c1', { bookings: sampleBookings }),
      pool.execute('job-c2', { bookings: sampleBookings }),
      pool.execute('job-c3', { bookings: sampleBookings })
    ];
    const results = await Promise.all(jobs);
    assert(results.length === 3, 'All 3 concurrent jobs resolved successfully');

    // Test 3: Queue saturation (backpressure)
    // Fill up workers + queue (2 workers + 3 queue slots = 5 tasks in flight)
    const saturatedPool = new WorkerPool({ poolSize: 1, maxQueueSize: 2 });
    // Submit 1 executing + 2 queued + 1 overflow
    const p1 = saturatedPool.execute('slow-1', { bookings: sampleBookings });
    const p2 = saturatedPool.execute('slow-2', { bookings: sampleBookings });
    const p3 = saturatedPool.execute('slow-3', { bookings: sampleBookings });

    let rejected = false;
    try {
      await saturatedPool.execute('slow-overflow', { bookings: sampleBookings });
    } catch (err) {
      rejected = true;
      assert(err.message.includes('queue is saturated'), 'Over-capacity job rejected due to bounded queue limit');
    }
    assert(rejected, 'Task exceeding maxQueueSize was prevented from exhausting system memory');

    await Promise.all([p1, p2, p3]);
    await saturatedPool.destroy();

    console.log(`WorkerPool Tests Completed: ${passed}/${total} assertions passed.`);
  } finally {
    await pool.destroy();
  }
}

runWorkerPoolTests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
