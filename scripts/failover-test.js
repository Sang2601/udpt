/**
 * scripts/failover-test.js
 * Verification script for Zero-Downtime Failover & Circuit Breaker (Tính chịu lỗi).
 * Demonstrates how API Gateway seamlessly redirects traffic when a node goes down.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8088';

console.log(`\n======================================================`);
console.log(`🛡️ [Kiểm Thử Tính Chịu Lỗi & Failover Tự Động]`);
console.log(`   Gateway Target: ${GATEWAY_URL}`);
console.log(`======================================================\n`);

async function testGatewayRouting(stepName) {
  console.log(`📍 ${stepName}: Gửi 6 requests liên tiếp qua Gateway :8088...`);
  const nodes = [];

  for (let i = 1; i <= 6; i++) {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/hotels`, {
        headers: { 'Accept': 'application/json' }
      });
      const handledBy = res.headers.get('X-Handled-By') || 'Gateway';
      nodes.push(handledBy);
      console.log(`   Request #${i}: HTTP ${res.status} -> Xử lý bởi: ${handledBy}`);
    } catch (err) {
      console.log(`   Request #${i}: ❌ Lỗi kết nối: ${err.message}`);
    }
  }

  // Distribution
  const counts = {};
  nodes.forEach(n => counts[n] = (counts[n] || 0) + 1);
  console.log(`   => Thống kê điều phối:`, counts);
}

async function main() {
  await testGatewayRouting('GIAI ĐOẠN 1: TẤT CẢ CÁC NODE BÌNH THƯỜNG');

  console.log(`\n------------------------------------------------------`);
  console.log(`💡 HƯỚNG DẪN KIỂM THỬ TẮT NODE ĐỘC LẬP (FAILOVER TEST):`);
  console.log(`1. Mở một cửa sổ Terminal khác hoặc Task Manager.`);
  console.log(`2. Tắt tiến trình Room-service replica 1 (Cổng 8083).`);
  console.log(`3. Chạy lại script này: node scripts/failover-test.js`);
  console.log(`4. KẾT QUẢ QUAN SÁT:`);
  console.log(`   - Gateway phát hiện cổng 8083 bị tắt.`);
  console.log(`   - 100% request được tự động chuyển sang Cổng 8086 (Replica 2).`);
  console.log(`   - Website KHÔNG bị sập, người dùng không nhận mã lỗi 500!`);
  console.log(`------------------------------------------------------\n`);
}

main().catch(console.error);

