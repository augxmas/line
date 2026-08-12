import 'dotenv/config';
import mysql from 'mysql2/promise';

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const host = requiredEnv('DB_ADMIN_HOST');
  const port = Number(process.env.DB_ADMIN_PORT ?? '3306');
  const rootPassword = requiredEnv('DB_ROOT_PASSWORD');
  const database = requiredEnv('DB_NAME');
  const accountUser = requiredEnv('DB_APP_USER');
  const accountPassword = requiredEnv('DB_APP_PASSWORD');
  const accountHost = process.env.DB_APP_HOST ?? '%';

  const connection = await mysql.createConnection({
    host,
    port,
    user: 'root',
    password: rootPassword,
    multipleStatements: true,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`CREATE USER IF NOT EXISTS '${accountUser}'@'${accountHost}' IDENTIFIED BY '${accountPassword}';`);
  await connection.query(`ALTER USER '${accountUser}'@'${accountHost}' IDENTIFIED BY '${accountPassword}';`);
  await connection.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${accountUser}'@'${accountHost}';`);
  await connection.query('FLUSH PRIVILEGES;');

  await connection.end();
  console.log(`Provisioned database ${database} and user ${accountUser}@${accountHost}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
