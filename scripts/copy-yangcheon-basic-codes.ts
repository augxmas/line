import 'dotenv/config';
import mysql, { type RowDataPacket } from 'mysql2/promise';

type CodeRow = { id: number; code: string; name: string; sortOrder: number; isActive: number };
type TeamRow = CodeRow & { departmentName: string };

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 2,
  });
  const connection = await pool.getConnection();
  try {
    const [sources] = await connection.query<RowDataPacket[]>("SELECT seq,full_name AS fullName FROM korean_administrative_districts WHERE full_name='서울특별시 양천구' LIMIT 1");
    if (!sources.length) throw new Error('서울특별시 양천구를 찾을 수 없습니다.');
    const sourceSeq = Number(sources[0].seq);
    const [targets] = await connection.query<RowDataPacket[]>("SELECT seq,full_name AS fullName FROM korean_administrative_districts WHERE district_name LIKE '%구' AND seq<>? ORDER BY full_name", [sourceSeq]);
    const [departments] = await connection.query<RowDataPacket[]>('SELECT id,code,name,sort_order AS sortOrder,is_active AS isActive FROM organization_departments WHERE district_seq=? ORDER BY sort_order,id', [sourceSeq]);
    const [teams] = await connection.query<RowDataPacket[]>(`SELECT t.id,t.code,t.name,t.sort_order AS sortOrder,t.is_active AS isActive,d.name AS departmentName FROM organization_teams t JOIN organization_departments d ON d.id=t.department_id WHERE d.district_seq=? ORDER BY d.sort_order,t.sort_order,t.id`, [sourceSeq]);
    const [jobPositions] = await connection.query<RowDataPacket[]>('SELECT id,code,name,sort_order AS sortOrder,is_active AS isActive FROM organization_job_positions WHERE district_seq=? ORDER BY sort_order,id', [sourceSeq]);
    const [positions] = await connection.query<RowDataPacket[]>('SELECT id,code,name,sort_order AS sortOrder,is_active AS isActive FROM organization_positions WHERE district_seq=? ORDER BY sort_order,id', [sourceSeq]);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', source: sources[0].fullName, targets: targets.length, departments: departments.length, teams: teams.length, jobPositions: jobPositions.length, positions: positions.length }, null, 2));
    if (!apply) return;
    for (const target of targets) {
      await connection.beginTransaction();
      const districtSeq = Number(target.seq);
      const departmentIds = new Map<string, number>();
      for (const item of departments as unknown as CodeRow[]) {
        const [existing] = await connection.query<RowDataPacket[]>('SELECT id FROM organization_departments WHERE district_seq=? AND name=? LIMIT 1', [districtSeq,item.name]);
        let id = Number(existing[0]?.id ?? 0);
        if (!id) { const code=`YC_D_${item.id}`; await connection.query('INSERT IGNORE INTO organization_departments(district_seq,code,name,sort_order,is_active) VALUES(?,?,?,?,?)',[districtSeq,code,item.name,item.sortOrder,item.isActive]); const [created]=await connection.query<RowDataPacket[]>('SELECT id FROM organization_departments WHERE district_seq=? AND name=? LIMIT 1',[districtSeq,item.name]); id=Number(created[0]?.id??0); }
        departmentIds.set(item.name,id);
      }
      for (const item of teams as unknown as TeamRow[]) {
        const departmentId=departmentIds.get(item.departmentName); if(!departmentId)continue;
        const [existing]=await connection.query<RowDataPacket[]>('SELECT id FROM organization_teams WHERE department_id=? AND name=? LIMIT 1',[departmentId,item.name]);
        if(!existing.length){const code=`YC_T_${item.id}`;await connection.query('INSERT IGNORE INTO organization_teams(department_id,code,name,sort_order,is_active) VALUES(?,?,?,?,?)',[departmentId,code,item.name,item.sortOrder,item.isActive]);}
      }
      for (const [table,items] of [['organization_job_positions',jobPositions],['organization_positions',positions]] as const) {
        for (const item of items as unknown as CodeRow[]) {
          const [existing]=await connection.query<RowDataPacket[]>(`SELECT id FROM ${table} WHERE district_seq=? AND name=? LIMIT 1`,[districtSeq,item.name]);
          if(!existing.length){const prefix=table==='organization_job_positions'?'YC_J':'YC_P',code=`${prefix}_${item.id}`;await connection.query(`INSERT IGNORE INTO ${table}(district_seq,code,name,sort_order,is_active) VALUES(?,?,?,?,?)`,[districtSeq,code,item.name,item.sortOrder,item.isActive]);}
        }
      }
      await connection.commit();
    }
    console.log(`Copied Yangcheon basic codes to ${targets.length} districts.`);
  } catch (error) {
    if (apply) await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error)=>{console.error(error);process.exit(1)});
