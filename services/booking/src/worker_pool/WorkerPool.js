/**
 * WorkerPool.js
 * Bounded Worker Thread Pool (Bài 2 - Tiến trình và Luồng).
 * Dispatches CPU-bound analytical tasks to a fixed set of worker threads.
 * Prevents thread exhaustion and Event Loop blockage under high concurrency.
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkerPath = path.resolve(__dirname, 'reportWorker.js');

export class WorkerPool {
  /**
   * @param {Object} options
   * @param {number} options.poolSize - Maximum number of worker threads (default 4)
   * @param {number} options.maxQueueSize - Max capacity of FIFO backlog queue (default 50)
   * @param {string} options.workerScript - Absolute path to worker JS file
   */
  constructor({ poolSize = 4, maxQueueSize = 50, workerScript = defaultWorkerPath } = {}) {
    this.poolSize = poolSize;
    this.maxQueueSize = maxQueueSize;
    this.workerScript = workerScript;

    this.workers = [];        // { worker, busy: boolean, currentJobId: string|null }
    this.queue = [];          // Array of { jobId, taskData, resolve, reject, timeoutId }
    this.isDestroyed = false;

    this._initPool();
  }

  _initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      this._spawnWorker();
    }
  }

  _spawnWorker() {
    const worker = new Worker(this.workerScript);
    const workerEntry = {
      worker,
      busy: false,
      currentJobId: null
    };

    worker.on('message', (res) => {
      workerEntry.busy = false;
      const currentJob = workerEntry.currentJob;
      workerEntry.currentJob = null;

      if (currentJob) {
        clearTimeout(currentJob.timeoutId);
        if (res.success) {
          currentJob.resolve(res.data);
        } else {
          currentJob.reject(new Error(res.error || 'Worker task failed'));
        }
      }

      // Check if queue has waiting tasks
      this._dispatchNext();
    });

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker encountered an error:`, err);
      const currentJob = workerEntry.currentJob;
      if (currentJob) {
        clearTimeout(currentJob.timeoutId);
        currentJob.reject(err);
      }

      // Remove and respawn replacement worker
      const index = this.workers.indexOf(workerEntry);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }
      if (!this.isDestroyed) {
        this._spawnWorker();
      }
    });

    worker.on('exit', (code) => {
      if (code !== 0 && !this.isDestroyed) {
        console.warn(`[WorkerPool] Worker exited unexpectedly with code ${code}. Respawning replacement...`);
        const index = this.workers.indexOf(workerEntry);
        if (index !== -1) {
          this.workers.splice(index, 1);
        }
        this._spawnWorker();
      }
    });

    this.workers.push(workerEntry);
  }

  /**
   * Submits a job to the worker pool.
   * Rejects immediately if the queue has reached maxQueueSize (backpressure).
   * @param {string} jobId
   * @param {any} taskData
   * @param {number} timeoutMs
   * @returns {Promise<any>}
   */
  execute(jobId, taskData, timeoutMs = 15000) {
    if (this.isDestroyed) {
      return Promise.reject(new Error('WorkerPool is shut down.'));
    }

    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.maxQueueSize) {
        return reject(new Error(`WorkerPool queue is saturated (${this.queue.length}/${this.maxQueueSize}). Request rejected.`));
      }

      const task = {
        jobId,
        taskData: { ...taskData, jobId },
        resolve,
        reject,
        timeoutId: null
      };

      task.timeoutId = setTimeout(() => {
        // Remove from queue if still waiting
        const qIdx = this.queue.indexOf(task);
        if (qIdx !== -1) {
          this.queue.splice(qIdx, 1);
        }
        reject(new Error(`WorkerPool task ${jobId} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      this.queue.push(task);
      this._dispatchNext();
    });
  }

  _dispatchNext() {
    if (this.queue.length === 0) return;

    // Find an idle worker
    const idleWorker = this.workers.find((w) => !w.busy);
    if (!idleWorker) return; // All workers are currently occupied

    const task = this.queue.shift();
    idleWorker.busy = true;
    idleWorker.currentJob = task;
    idleWorker.worker.postMessage(task.taskData);
  }

  /**
   * Returns current health/status metrics of the pool.
   */
  getStatus() {
    const activeCount = this.workers.filter((w) => w.busy).length;
    return {
      poolSize: this.workers.length,
      activeWorkers: activeCount,
      idleWorkers: this.workers.length - activeCount,
      queueLength: this.queue.length,
      maxQueueSize: this.maxQueueSize
    };
  }

  /**
   * Graceful shutdown of all worker threads.
   */
  async destroy() {
    this.isDestroyed = true;
    for (const item of this.queue) {
      clearTimeout(item.timeoutId);
      item.reject(new Error('WorkerPool is shutting down.'));
    }
    this.queue = [];

    const terminations = this.workers.map((w) => w.worker.terminate());
    await Promise.all(terminations);
    this.workers = [];
  }
}
