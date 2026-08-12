import mysql from 'mysql2/promise';

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
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
    connectionLimit: 10,
    enableKeepAlive: true,
  });
}
