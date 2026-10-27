/**
 * jsonRpcHandler.js
 * JSON-RPC 2.0 Server Handler for Hotel Service (Bài 3 - Trao đổi thông tin).
 * Implements authoritative pricing & room detail lookups over JSON-RPC 2.0 protocol.
 */

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  ROOM_TYPE_NOT_FOUND: { code: -32001, message: 'Room type not found in catalog' }
};

export class JsonRpcServer {
  /**
   * @param {Object} db - Database adapter or query interface
   */
  constructor(db) {
    this.db = db;
    this.methods = new Map();
    this._registerMethods();
  }

  _registerMethods() {
    /**
     * Method: hotel.getRoomTypeRate
     * Params: { roomTypeId: string }
     * Returns: Authoritative price per night, currency, name, max guests
     */
    this.methods.set('hotel.getRoomTypeRate', async (params) => {
      if (!params || !params.roomTypeId) {
        const err = new Error('Parameter "roomTypeId" is required');
        err.rpcCode = JSON_RPC_ERRORS.INVALID_PARAMS.code;
        throw err;
      }

      // Query database for authoritative room type info
      const roomType = await this.db.getRoomTypeById(params.roomTypeId);
      if (!roomType) {
        const err = new Error(`Room type "${params.roomTypeId}" does not exist`);
        err.rpcCode = JSON_RPC_ERRORS.ROOM_TYPE_NOT_FOUND.code;
        throw err;
      }

      return {
        roomTypeId: roomType.id,
        hotelId: roomType.hotel_id,
        roomTypeName: roomType.name,
        pricePerNight: Number(roomType.price),
        currency: 'VND',
        totalRoomsInHotel: Number(roomType.total_rooms || 10),
        authoritativeSource: 'HotelService.catalog',
        timestamp: new Date().toISOString()
      };
    });

    /**
     * Method: hotel.ping
     */
    this.methods.set('hotel.ping', async () => {
      return { status: 'pong', time: Date.now() };
    });
  }

  /**
   * Handles an incoming JSON-RPC 2.0 request payload.
   * @param {Object} body - Parsed JSON-RPC request
   * @returns {Promise<Object>} JSON-RPC 2.0 response
   */
  async handleRequest(body) {
    if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0' || !body.method) {
      return {
        jsonrpc: '2.0',
        id: body?.id ?? null,
        error: JSON_RPC_ERRORS.INVALID_REQUEST
      };
    }

    const { id, method, params } = body;
    const handler = this.methods.get(method);

    if (!handler) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: JSON_RPC_ERRORS.METHOD_NOT_FOUND.code,
          message: `Method "${method}" not found`
        }
      };
    }

    try {
      const result = await handler(params);
      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: err.rpcCode || JSON_RPC_ERRORS.INTERNAL_ERROR.code,
          message: err.message || JSON_RPC_ERRORS.INTERNAL_ERROR.message,
          data: err.data || null
        }
      };
    }
  }
}
