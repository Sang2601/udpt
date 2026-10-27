/**
 * tests/json_rpc.test.js
 * Automated test suite for JSON-RPC 2.0 communication (Bài 3).
 * Runs real HTTP server and client stub, testing success, error codes, and timeouts.
 */

import http from 'http';
import { JsonRpcServer, JSON_RPC_ERRORS } from '../services/hotel/src/rpc/jsonRpcHandler.js';
import { JsonRpcClient } from '../services/booking/src/rpc/jsonRpcClient.js';

async function runJsonRpcTests() {
  console.log('Running JSON-RPC 2.0 Automated Tests (Bài 3: Trao đổi thông tin)...');
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

  // Mock DB for Hotel Service
  const mockDb = {
    getRoomTypeById: async (id) => {
      if (id === 'deluxe-101') {
        return {
          id: 'deluxe-101',
          hotel_id: 'hotel-hn-01',
          name: 'Phòng Deluxe Hướng Biển',
          price: 1800000,
          total_rooms: 15
        };
      }
      return null;
    }
  };

  const rpcServer = new JsonRpcServer(mockDb);

  // Spin up temporary test HTTP server
  let simulateDelayMs = 0;
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/rpc') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        if (simulateDelayMs > 0) {
          await new Promise(r => setTimeout(r, simulateDelayMs));
        }
        try {
          const parsed = JSON.parse(body);
          const responsePayload = await rpcServer.handleRequest(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responsePayload));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: JSON_RPC_ERRORS.PARSE_ERROR }));
        }
      });
    } else {
      res.writeHead(404).end();
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const client = new JsonRpcClient(`http://127.0.0.1:${port}/rpc`, 1000);

  try {
    // Test 1: Authoritative room rate retrieval
    const rate = await client.getAuthoritativePrice('deluxe-101');
    assert(rate.roomTypeId === 'deluxe-101', 'RPC returned correct roomTypeId');
    assert(rate.pricePerNight === 1800000, 'Authoritative price matched catalog value (1,800,000 VND)');
    assert(rate.authoritativeSource === 'HotelService.catalog', 'Authoritative source tagged as HotelService');

    // Test 2: Room type not found (-32001)
    let notFoundCaught = false;
    try {
      await client.getAuthoritativePrice('non-existent-room');
    } catch (err) {
      notFoundCaught = true;
      assert(err.rpcCode === JSON_RPC_ERRORS.ROOM_TYPE_NOT_FOUND.code, 'Non-existent room returned RPC code -32001');
    }
    assert(notFoundCaught, 'Exception correctly thrown on non-existent room');

    // Test 3: Method not found (-32601)
    let methodNotFoundCaught = false;
    try {
      await client.call('hotel.unknownMethod', {});
    } catch (err) {
      methodNotFoundCaught = true;
      assert(err.rpcCode === JSON_RPC_ERRORS.METHOD_NOT_FOUND.code, 'Unknown method returned RPC code -32601');
    }
    assert(methodNotFoundCaught, 'Exception thrown on unknown method');

    // Test 4: Invalid parameters (-32602)
    let invalidParamsCaught = false;
    try {
      await client.call('hotel.getRoomTypeRate', {}); // Missing roomTypeId
    } catch (err) {
      invalidParamsCaught = true;
      assert(err.rpcCode === JSON_RPC_ERRORS.INVALID_PARAMS.code, 'Missing params returned RPC code -32602');
    }
    assert(invalidParamsCaught, 'Exception thrown on invalid params');

    // Test 5: Client Timeout handling
    simulateDelayMs = 1500; // Delay longer than client timeout (1000ms)
    let timeoutCaught = false;
    try {
      await client.getAuthoritativePrice('deluxe-101');
    } catch (err) {
      timeoutCaught = true;
      assert(err.isTimeout === true, 'Client correctly aborted and marked isTimeout=true when deadline expired');
    }
    assert(timeoutCaught, 'Timeout error thrown as expected');

    console.log(`JSON-RPC Tests Completed: ${passed}/${total} assertions passed.`);
  } finally {
    server.close();
  }
}

runJsonRpcTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
