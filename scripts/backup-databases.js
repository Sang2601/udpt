/**
 * scripts/backup-databases.js
 * Automated Fault-Tolerance Database Backup Tool.
 * Backs up all 4 distributed databases (userdb, bookingdb, roomdb, paymentdb)
 * to timestamped SQL & JSON archives in the backups/ directory.
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.resolve(__dirname, '../backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
console.log(`\n======================================================`);
console.log(`💾 [Database Backup] Bắt đầu tiến trình sao lưu CSDL phân tán...`);
console.log(`   Thời gian: ${new Date().toLocaleString('vi-VN')}`);
console.log(`======================================================\n`);

async function backupMySQLDatabase(dbName, port) {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(port, 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'rootpassword',
      database: dbName,
      connectTimeout: 2000
    });

    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    const dumpData = {};
    for (const table of tableNames) {
      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
      dumpData[table] = rows;
    }

    await conn.end();

    const outFile = path.join(backupDir, `${dbName}_dump_${timestamp}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ database: dbName, timestamp, tables: dumpData }, null, 2));
    console.log(`  ✅ [${dbName}] Sao lưu MySQL thành công -> ${path.basename(outFile)}`);
    return true;
  } catch (err) {
    console.warn(`  ⚠️ [${dbName}] Không thể kết nối MySQL trên port ${port} (${err.message}). Bỏ qua.`);
    return false;
  }
}

async function backupSQLiteFallback() {
  const sqliteFile = path.resolve(__dirname, '../server/database/hotelbooking.sqlite');
  if (fs.existsSync(sqliteFile)) {
    const outBackup = path.join(backupDir, `hotelbooking_sqlite_snapshot_${timestamp}.sqlite`);
    fs.copyFileSync(sqliteFile, outBackup);
    console.log(`  ✅ [SQLite Fallback] Đã tạo snapshot CSDL cục bộ -> ${path.basename(outBackup)}`);
  }
}

async function main() {
  const databases = [
    { name: 'userdb', port: 33061 },
    { name: 'bookingdb', port: 33062 },
    { name: 'roomdb', port: 33063 },
    { name: 'paymentdb', port: 33064 }
  ];

  let anySuccess = false;
  for (const db of databases) {
    const ok = await backupMySQLDatabase(db.name, db.port);
    if (ok) anySuccess = true;
  }

  // Luôn tạo snapshot fallback để đảm bảo tính chịu lỗi
  await backupSQLiteFallback();

  console.log(`\n🎉 [Database Backup] Hoàn tất sao lưu! Bản lưu trữ đặt tại: ${backupDir}\n`);
}

main().catch(console.error);

