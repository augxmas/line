import 'dotenv/config';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

function hashPassword(password:string):string{
  const salt=crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;
}

async function main(){
  const connection=await mysql.createConnection({
    host:process.env.DB_HOST,
    port:Number(process.env.DB_PORT??3306),
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
  });
  try{
    const [districtRows]=await connection.query('SELECT seq FROM korean_administrative_districts WHERE full_name=? LIMIT 1',['서울특별시 양천구']);
    const district=(districtRows as Array<{seq:number}>)[0];
    if(!district)throw new Error('서울특별시 양천구 지자체 정보를 찾을 수 없습니다.');
    const temporaryPassword='Temp@1234';
    const users=[
      {role:'requester',name:'김창호',email:'kimch@monorama.kr'},
      {role:'manager',name:'홍길동',email:'nitsuser@naver.com'},
      {role:'secretary',name:'차정숙',email:'wefuture@nate.com'},
      {role:'executive',name:'이기재',email:'augxmas@gmail.com'},
    ];
    await connection.beginTransaction();
    for(const user of users){
      const [existingRows]=await connection.query('SELECT id FROM app_users WHERE email=? LIMIT 1',[user.email]);
      const existing=(existingRows as Array<{id:number}>)[0];
      if(existing){
        await connection.query('UPDATE app_users SET district_seq=?,role=?,name=?,is_active=TRUE WHERE id=?',[district.seq,user.role,user.name,existing.id]);
      }else{
        await connection.query('INSERT INTO app_users(district_seq,role,name,email,password_hash,must_change_password,is_active) VALUES(?,?,?,?,?,TRUE,TRUE)',[district.seq,user.role,user.name,user.email,hashPassword(temporaryPassword)]);
      }
    }
    await connection.commit();
    console.log(JSON.stringify({district:'서울특별시 양천구',users:users.map(({role,name,email})=>({role,name,email})),temporaryPassword},null,2));
  }catch(error){
    await connection.rollback();
    throw error;
  }finally{
    await connection.end();
  }
}

main().catch(error=>{console.error(error);process.exit(1)});
