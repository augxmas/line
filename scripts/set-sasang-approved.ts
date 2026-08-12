import 'dotenv/config';
import { createPool } from '../src/db';

async function main() {
  const db = createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? '3306'),
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'line',
  });
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [districtRows] = await connection.query(
      'SELECT seq, full_name AS fullName FROM korean_administrative_districts WHERE full_name = ? LIMIT 1 FOR UPDATE',
      ['부산광역시 사상구'],
    );
    const district = (districtRows as Array<{ seq: number; fullName: string }>)[0];
    if (!district) throw new Error('부산광역시 사상구 지자체를 찾을 수 없습니다.');

    await connection.query(
      `INSERT INTO supervisor_basic_settings (
        district_seq, district_unique_number, district_unique_number_copy,
        bank_name, account_number, contract_date, contract_from, contract_to,
        contract_status, manager_name, manager_email, manager_phone, manager_mobile,
        subscription_status, billing_cycle, image_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        district_unique_number=VALUES(district_unique_number),
        district_unique_number_copy=VALUES(district_unique_number_copy),
        bank_name=VALUES(bank_name), account_number=VALUES(account_number),
        contract_date=VALUES(contract_date), contract_from=VALUES(contract_from),
        contract_to=VALUES(contract_to), contract_status=VALUES(contract_status),
        manager_name=VALUES(manager_name), manager_email=VALUES(manager_email),
        manager_phone=VALUES(manager_phone), manager_mobile=VALUES(manager_mobile),
        subscription_status=VALUES(subscription_status), billing_cycle=VALUES(billing_cycle),
        image_path=VALUES(image_path)`,
      [
        district.seq, '202608110001', '202608110002', 'BNK부산은행', '1010123456789',
        '2026-08-11', '2026-08-11', '2027-08-10', '계약',
        '김봉관', 'bkkim@monorama.kr', '0511234567', '01012345678',
        '구독중', '월', null,
      ],
    );
    await connection.commit();

    const [resultRows] = await connection.query(
      `SELECT d.full_name AS districtName, s.contract_status AS contractStatus,
        s.subscription_status AS subscriptionStatus, s.manager_name AS managerName,
        s.manager_email AS managerEmail, s.billing_cycle AS billingCycle
       FROM supervisor_basic_settings s
       JOIN korean_administrative_districts d ON d.seq=s.district_seq
       WHERE s.district_seq=?`,
      [district.seq],
    );
    console.log(JSON.stringify((resultRows as unknown[])[0]));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
