/**
 * scripts/restore-databases.js
 * Automated Database Recovery & Restore Tool (Chịu lỗi - Failover & Disaster Recovery).
 * Restores tables from the latest snapshot in the backups/ directory.
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.resolve(__dirname, '../backups');

console.log(`\n======================================================`);
console.log(`🔄 [Database Recovery] Bắt đầu tiến trình khôi phục CSDL...`);
console.log(`======================================================\n`);

async function restoreMySQLFromJSON(filepath, port) {
  const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const dbName = content.database;

  console.log(`  ➡️ Khôi phục ${dbName} từ ${path.basename(filepath)}...`);

  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(port, 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'rootpassword',
      database: dbName
    });

    for (const [table, rows] of Object.entries(content.tables)) {
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
      const placeholders = Object.keys(rows[0]).map(() => '?').join(', ');
      const sql = `REPLACE INTO \`${table}\` (${columns}) VALUES (${placeholders})`;

      for (const row of rows) {
        await conn.query(sql, Object.values(row));
      }
      console.log(`     - Bảng ${table}: Khôi phục ${rows.length} bản ghi`);
    }

    await conn.end();
    console.log(`  ✅ Khôi phục thành công CSDL ${dbName}!`);
  } catch (err) {
    console.error(`  ❌ Lỗi khôi phục ${dbName}:`, err.message);
  }
}

async function main() {
  if (!fs.existsSync(backupDir)) {
    console.error('Không tìm thấy thư mục backups!');
    return;
  }

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  if (!files.length) {
    console.log('Không có tệp sao lưu JSON nào để khôi phục.');
    return;
  }

  const portMap = {
    userdb: 33061,
    bookingdb: 33062,
    roomdb: 33063,
    paymentdb: 33064
  };

  for (const [dbName, port] of Object.entries(portMap)) {
    const dbFiles = files.filter(f => f.startsWith(`${dbName}_`)).sort().reverse();
    if (dbFiles.length) {
      const latest = path.join(backupDir, dbFiles[0]);
      await restoreMySQLFromJSON(latest, port);
    }
  }

  console.log(`\n🎉 [Database Recovery] Tiến trình khôi phục hoàn tất!\n`);
}

main().catch(console.error);

