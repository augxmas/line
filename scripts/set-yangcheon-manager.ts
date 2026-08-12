import 'dotenv/config';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

function hashPassword(password:string):string{
  const salt=crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
}

async function main(){
  const managerPassword=process.env.MANAGER_PASSWORD;
  if(!managerPassword)throw new Error('Missing required environment variable: MANAGER_PASSWORD');
  const connection=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT??3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
  try{
    await connection.beginTransaction();
    const [districtRows]=await connection.query('SELECT seq FROM korean_administrative_districts WHERE full_name=? LIMIT 1',['서울특별시 양천구']);
    const district=(districtRows as Array<{seq:number}>)[0];
    if(!district)throw new Error('서울특별시 양천구를 찾을 수 없습니다.');
    const [departmentRows]=await connection.query('SELECT name FROM organization_departments WHERE district_seq=? AND name=? AND is_active=TRUE LIMIT 1',[district.seq,'복지정책과']);
    if(!(departmentRows as Array<unknown>).length)throw new Error('서울특별시 양천구의 활성 부서 복지정책과를 찾을 수 없습니다.');
    const [userRows]=await connection.query('SELECT id FROM app_users WHERE email=? LIMIT 1',['nitsuser@naver.com']);
    const user=(userRows as Array<{id:number}>)[0];
    if(!user)throw new Error('홍길동 계정을 찾을 수 없습니다.');
    await connection.query('UPDATE app_users SET district_seq=?,role=?,name=?,password_hash=?,must_change_password=FALSE,is_active=TRUE WHERE id=?',[district.seq,'manager','홍길동',hashPassword(managerPassword),user.id]);
    await connection.query(`INSERT INTO app_user_profiles(user_id,department,team,job_position,position_title) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE department=VALUES(department),team=VALUES(team),job_position=VALUES(job_position),position_title=VALUES(position_title)`,[user.id,'복지정책과',null,'과장','부서장']);
    await connection.commit();
    console.log(JSON.stringify({name:'홍길동',email:'nitsuser@naver.com',district:'서울특별시 양천구',department:'복지정책과',role:'manager'},null,2));
  }catch(error){await connection.rollback();throw error}finally{await connection.end()}
}

main().catch(error=>{console.error(error);process.exit(1)});
