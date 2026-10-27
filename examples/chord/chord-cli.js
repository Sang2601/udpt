/**
 * chord-cli.js
 * CLI Demonstration of Chord DHT Algorithm (Bài 4 - Định danh)
 * Matches exact numbers, finger table, key placement, and node joining from lecture slides.
 *
 * Usage:
 *   node examples/chord/chord-cli.js
 */

import { ChordRing } from './ChordRing.js';

console.log('='.repeat(72));
console.log('  CHORD DISTRIBUTED HASH TABLE (DHT) SIMULATION - BÀI 4: ĐỊNH DANH');
console.log('  Mô phỏng thuật toán Chord theo slide DS_Lec 4 - Dinh danh');
console.log('  Lưu ý: Đây là mô phỏng thuật toán học thuật, không phải database lưu trữ');
console.log('='.repeat(72));

const m = 6;
const ring = new ChordRing(m);

// 1. Initial nodes from lecture slide
const initialNodes = [1, 8, 14, 21, 32, 38, 42, 48, 51, 56];
console.log(`\n[Bước 1] Khởi tạo vòng Chord m = ${m} (Không gian định danh 0 .. ${Math.pow(2, m) - 1}):`);
console.log(`         Các node tham gia: [${initialNodes.join(', ')}]`);

for (const id of initialNodes) {
  ring.addNode(id);
}

// 2. Display Finger Table of Node 8 (as in lecture slide)
const node8 = ring.getNode(8);
console.log('\n[Bước 2] Bảng Finger Table tại Node 8 (Đối chiếu trực tiếp với slide bài giảng):');
console.log('---------------------------------------------------------------------');
console.log('| i | (p + 2^i) mod 2^m | Điểm bắt đầu (Start) | Successor (Node đích) |');
console.log('---------------------------------------------------------------------');
for (const entry of node8.fingerTable.getTable()) {
  const formula = `(8 + 2^${entry.i}) mod 64`;
  console.log(`| ${entry.i} | ${formula.padEnd(17)} | ${String(entry.start).padEnd(20)} | Node ${String(entry.successor).padEnd(17)} |`);
}
console.log('---------------------------------------------------------------------');

// 3. Insert keys from lecture
const lectureKeys = [
  { key: 10, value: 'Dữ liệu khóa 10' },
  { key: 24, value: 'Dữ liệu khóa 24' },
  { key: 30, value: 'Dữ liệu khóa 30' },
  { key: 38, value: 'Dữ liệu khóa 38' },
  { key: 54, value: 'Dữ liệu khóa 54' }
];

console.log('\n[Bước 3] Thêm các khóa theo bảng trong slide bài giảng:');
for (const item of lectureKeys) {
  const result = ring.putKey(item.key, item.value, 1);
  console.log(`  - Khóa ${String(item.key).padStart(2)} -> Phân bổ vào Node ${String(result.responsibleNodeId).padStart(2)}`);
}

// 4. Test Lookups with hop logging
console.log('\n[Bước 4] Tra cứu khóa kèm vết đường đi (Hop Tracing):');
const testLookups = [
  { startNode: 8, key: 54 },
  { startNode: 1, key: 30 },
  { startNode: 38, key: 10 }
];

for (const query of testLookups) {
  console.log(`\n  * Tra cứu khóa ${query.key} bắt đầu từ Node ${query.startNode}:`);
  const res = ring.lookupKey(query.key, query.startNode);
  console.log(`    Đường đi (${res.trace.length} chặng):`);
  res.trace.forEach((step, idx) => {
    console.log(`      Chặng ${idx + 1}: Tại Node ${step.fromNode} (successor hiện tại: Node ${step.successor}) -> tìm kiếm khóa ${step.lookingFor}`);
  });
  console.log(`    => Kết quả: Tìm thấy tại Node ${res.responsibleNodeId} với giá trị: "${res.value}"`);
}

// 5. Node 26 joins the ring
console.log('\n[Bước 5] Node 26 tham gia vào vòng (Node Join & Key Migration):');
console.log('  Trước khi Node 26 tham gia:');
console.log(`    - Node 32 đang quản lý các khóa: [${Array.from(ring.getNode(32).keys.keys()).join(', ')}]`);

console.log('  -> Tiến hành thêm Node 26 vào vòng Chord...');
ring.addNode(26);

console.log('  Sau khi Node 26 tham gia:');
console.log(`    - Node 26 tiếp nhận các khóa:    [${Array.from(ring.getNode(26).keys.keys()).join(', ')}]  <-- Khóa 24 đã di chuyển từ Node 32 sang 26!`);
console.log(`    - Node 32 còn lại các khóa:      [${Array.from(ring.getNode(32).keys.keys()).join(', ')}]`);

// 6. Verification
const verifyKey24 = ring.lookupKey(24, 8);
console.log(`\n[Bước 6] Tra cứu lại khóa 24 sau khi Node 26 tham gia:`);
console.log(`  - Điểm xuất phát: Node 8`);
console.log(`  - Node chịu trách nhiệm: Node ${verifyKey24.responsibleNodeId} (Kỳ vọng: 26)`);
console.log(`  - Khớp slide bài giảng 100%: ${verifyKey24.responsibleNodeId === 26 ? 'CHÍNH XÁC (PASS)' : 'SAI (FAIL)'}`);

console.log('\n' + '='.repeat(72));
console.log('  KẾT THÚC DEMO CHORD DHT');
console.log('='.repeat(72));
