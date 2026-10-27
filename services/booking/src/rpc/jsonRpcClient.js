/**
 * jsonRpcClient.js
 * JSON-RPC 2.0 Client Stub for Booking Service (Bài 3 - Trao đổi thông tin).
 * Encapsulates marshalling, network transmission, unmarshalling, and timeout handling.
 */

import { v4 as uuidv4 } from 'uuid';

export class JsonRpcClient {
  /**
   * @param {string} endpointUrl - URL to Hotel Service RPC endpoint (e.g., http://hotel-service:5002/rpc)
   * @param {number} timeoutMs - Timeout in milliseconds (default 5000ms)
   */
  constructor(endpointUrl, timeoutMs = 5000) {
    this.endpointUrl = endpointUrl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Invokes a remote procedure on the Hotel Service.
   * @param {string} method - e.g. 'hotel.getRoomTypeRate'
   * @param {Object} params - Procedure arguments
   * @returns {Promise<any>} Procedure result
   */
  async call(method, params = {}) {
    const requestId = uuidv4();
    const payload = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Id': requestId
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`JSON-RPC transport error: HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data || data.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC 2.0 response format');
      }

      if (data.error) {
        const err = new Error(data.error.message || 'Remote RPC error');
        err.rpcCode = data.error.code;
        err.data = data.error.data;
        throw err;
      }

      return data.result;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`JSON-RPC call to "${method}" timed out after ${this.timeoutMs}ms`);
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * High-level helper: Fetches authoritative price & hotel room info before booking creation.
   * Must be executed OUTSIDE retryable database transactions!
   * @param {string} roomTypeId
   */
  async getAuthoritativePrice(roomTypeId) {
    return this.call('hotel.getRoomTypeRate', { roomTypeId });
  }
}
