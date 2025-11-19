import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getMySQLPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password: '',
      database: 'citizen_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
  }
  return pool;
}

