import mysql from 'mysql2/promise';

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
};

export function createPool(config: DbConfig) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: config.connectionLimit ?? 3,
    maxIdle: Math.min(config.connectionLimit ?? 3, 2),
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
  });
}
