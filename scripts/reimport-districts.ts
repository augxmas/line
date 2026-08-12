import 'dotenv/config';
import fs from 'node:fs';
import iconv from 'iconv-lite';
import mysql from 'mysql2/promise';

type DistrictInput = {
  seq: number;
  metropolitanCity: string;
  upperCity: string;
  districtName: string;
  districtType: string;
  fullName: string;
};

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function decodeCsv(raw: Buffer): string {
  const utf8 = raw.toString('utf8');
  const utf8Header = utf8.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  if (utf8Header.includes('순번') && utf8Header.includes('전체행정구역명')) {
    return utf8;
  }

  const cp949 = iconv.decode(raw, 'cp949');
  const cp949Header = cp949.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  if (cp949Header.includes('순번') && cp949Header.includes('전체행정구역명')) {
    return cp949;
  }

  throw new Error('CSV 인코딩을 판별할 수 없습니다. UTF-8 또는 CP949 파일인지 확인해 주세요.');
}

function parseCsv(text: string): DistrictInput[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV 데이터가 비어 있습니다.');
  }

  const header = lines[0].split(',');
  if (header.length < 6) {
    throw new Error('CSV 헤더 형식이 올바르지 않습니다.');
  }

  const rows: DistrictInput[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const columns = lines[i].split(',');
    if (columns.length < 6) {
      throw new Error(`CSV ${i + 1}행의 컬럼 수가 부족합니다.`);
    }

    const seq = Number(columns[0]);
    if (!Number.isInteger(seq)) {
      throw new Error(`CSV ${i + 1}행의 순번 값이 올바르지 않습니다.`);
    }

    rows.push({
      seq,
      metropolitanCity: columns[1],
      upperCity: columns[2],
      districtName: columns[3],
      districtType: columns[4],
      fullName: columns[5],
    });
  }

  return rows;
}

async function main() {
  const csvPath = process.env.DISTRICT_CSV_PATH ?? 'C:/Users/augxm/Downloads/korean_all_districts_and_counties_183.csv';
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV 파일이 없습니다: ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath);
  const text = decodeCsv(raw);
  const rows = parseCsv(text);

  const connection = await mysql.createConnection({
    host: requiredEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? '3306'),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    database: requiredEnv('DB_NAME'),
    multipleStatements: true,
  });

  await connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS korean_administrative_districts (
      seq INT NOT NULL,
      metropolitan_city VARCHAR(50) NOT NULL,
      upper_city VARCHAR(50) NOT NULL,
      district_name VARCHAR(50) NOT NULL,
      district_type VARCHAR(30) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      PRIMARY KEY (seq)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
  const values = rows.flatMap((row) => [
    row.seq,
    row.metropolitanCity,
    row.upperCity,
    row.districtName,
    row.districtType,
    row.fullName,
  ]);

  await connection.query(
    `
      INSERT INTO korean_administrative_districts (
        seq,
        metropolitan_city,
        upper_city,
        district_name,
        district_type,
        full_name
      ) VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        metropolitan_city = VALUES(metropolitan_city),
        upper_city = VALUES(upper_city),
        district_name = VALUES(district_name),
        district_type = VALUES(district_type),
        full_name = VALUES(full_name)
    `,
    values,
  );

  const [countRows] = await connection.query('SELECT COUNT(*) AS count FROM korean_administrative_districts');
  const [brokenRows] = await connection.query("SELECT COUNT(*) AS brokenCount FROM korean_administrative_districts WHERE full_name LIKE '%?%'");
  const [sampleRows] = await connection.query(
    'SELECT seq, full_name FROM korean_administrative_districts ORDER BY seq LIMIT 5',
  );

  await connection.end();

  const count = (countRows as Array<{ count: number }>)[0]?.count ?? 0;
  const brokenCount = (brokenRows as Array<{ brokenCount: number }>)[0]?.brokenCount ?? 0;
  console.log(`Imported rows: ${count}`);
  console.log(`Rows containing '?': ${brokenCount}`);
  console.log('Sample rows:');
  for (const row of sampleRows as Array<{ seq: number; full_name: string }>) {
    console.log(`${row.seq}: ${row.full_name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
