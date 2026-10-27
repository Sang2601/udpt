/**
 * reportWorker.js
 * Dedicated Worker Thread for CPU-intensive report aggregation (Bài 2 - Tiến trình và Luồng).
 * Receives raw booking records from main thread, computes statistical metrics,
 * and posts results back without blocking Node.js Event Loop.
 */

import { parentPort, threadId } from 'worker_threads';

if (parentPort) {
  parentPort.on('message', (message) => {
    const { jobId, bookings, roomTypes, generatedAt } = message;
    const pid = process.pid;

    console.log(`[WorkerThread] -> [START] PID: ${pid}, ThreadId: ${threadId}, JobId: ${jobId}, Records: ${bookings?.length || 0}`);

    try {
      // Perform CPU-bound statistical calculations
      let totalBookings = 0;
      let confirmedBookings = 0;
      let cancelledBookings = 0;
      let totalEstimatedValue = 0;
      let totalRoomNights = 0;
      const revenueByRoomType = {};
      const bookingsByDate = {};

      for (const b of (bookings || [])) {
        totalBookings++;
        if (b.status === 'confirmed') {
          confirmedBookings++;
          totalEstimatedValue += Number(b.total_price || 0);

          // Calculate nights
          const checkIn = new Date(b.check_in);
          const checkOut = new Date(b.check_out);
          const diffDays = Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
          totalRoomNights += diffDays * (b.rooms_count || 1);

          // Revenue by room type
          const rtName = b.room_type_name || b.room_type_id || 'Unknown';
          revenueByRoomType[rtName] = (revenueByRoomType[rtName] || 0) + Number(b.total_price || 0);

          // Distribution by check_in date
          const dateKey = b.check_in?.substring(0, 10) || 'unknown';
          bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;
        } else if (b.status === 'cancelled') {
          cancelledBookings++;
        }
      }

      const avgStayNights = confirmedBookings > 0
        ? Number((totalRoomNights / confirmedBookings).toFixed(1))
        : 0;

      const result = {
        jobId,
        processedBy: {
          pid,
          threadId,
          type: 'Node.js worker_threads'
        },
        metrics: {
          totalBookings,
          confirmedBookings,
          cancelledBookings,
          cancellationRate: totalBookings > 0 ? Number(((cancelledBookings / totalBookings) * 100).toFixed(1)) : 0,
          totalEstimatedValue, // Giải thích rõ: đây là tổng giá trị đơn đã xác nhận, chưa thanh toán thật
          totalRoomNights,
          avgStayNights,
          revenueByRoomType,
          bookingsByDate
        },
        computedAt: new Date().toISOString()
      };

      console.log(`[WorkerThread] <- [DONE] PID: ${pid}, ThreadId: ${threadId}, JobId: ${jobId}`);
      parentPort.postMessage({ success: true, jobId, data: result });
    } catch (err) {
      console.error(`[WorkerThread] <!> [ERROR] PID: ${pid}, ThreadId: ${threadId}, JobId: ${jobId}`, err);
      parentPort.postMessage({ success: false, jobId, error: err.message });
    }
  });
}
