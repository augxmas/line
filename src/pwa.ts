import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import webpush from 'web-push';
import type { Pool, RowDataPacket } from 'mysql2/promise';

const SESSION_COOKIE='user_auth';
const REMEMBER_COOKIE='report_pwa_remember';
const REMEMBER_DAYS=90;

function cookie(request:express.Request,name:string):string|null{
  const value=request.headers.cookie?.split(';').map(item=>item.trim()).find(item=>item.startsWith(name+'='))?.slice(name.length+1);
  return value?decodeURIComponent(value):null;
}
function digest(value:string):string{return crypto.createHash('sha256').update(value).digest('hex')}
async function sessionUser(db:Pool,request:express.Request):Promise<number|null>{
  const token=cookie(request,SESSION_COOKIE);if(!token)return null;
  const [rows]=await db.query('SELECT user_id AS userId FROM app_user_sessions WHERE token_hash=? AND expires_at>NOW() LIMIT 1',[digest(token)]);
  return Number((rows as Array<{userId:number}>)[0]?.userId)||null;
}

export async function ensurePwaSchema(db:Pool):Promise<void>{
  await db.query(`CREATE TABLE IF NOT EXISTS app_pwa_config (
    config_key VARCHAR(40) NOT NULL, config_value TEXT NOT NULL, PRIMARY KEY(config_key)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS app_pwa_remember_tokens (
    token_hash CHAR(64) NOT NULL,user_id INT NOT NULL,expires_at DATETIME NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(token_hash),KEY idx_pwa_remember_user(user_id),CONSTRAINT fk_pwa_remember_user FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS app_push_subscriptions (
    id BIGINT NOT NULL AUTO_INCREMENT,user_id INT NOT NULL,endpoint VARCHAR(1000) NOT NULL,p256dh VARCHAR(255) NOT NULL,auth_secret VARCHAR(255) NOT NULL,
    last_notification_id BIGINT NOT NULL DEFAULT 0,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),UNIQUE KEY uq_push_endpoint(endpoint(255)),KEY idx_push_user(user_id),CONSTRAINT fk_push_user FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const [rows]=await db.query("SELECT config_key AS configKey,config_value AS configValue FROM app_pwa_config WHERE config_key IN ('vapid_public','vapid_private')");
  const values=Object.fromEntries((rows as Array<{configKey:string;configValue:string}>).map(row=>[row.configKey,row.configValue]));
  if(!values.vapid_public||!values.vapid_private){const keys=webpush.generateVAPIDKeys();await db.query("INSERT INTO app_pwa_config(config_key,config_value) VALUES('vapid_public',?),('vapid_private',?) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)",[keys.publicKey,keys.privateKey])}
}

async function vapidKeys(db:Pool):Promise<{publicKey:string;privateKey:string}>{
  const [rows]=await db.query("SELECT config_key AS configKey,config_value AS configValue FROM app_pwa_config WHERE config_key IN ('vapid_public','vapid_private')");
  const values=Object.fromEntries((rows as Array<{configKey:string;configValue:string}>).map(row=>[row.configKey,row.configValue]));
  return {publicKey:values.vapid_public,privateKey:values.vapid_private};
}

export function registerPwaRoutes(app:express.Express,db:Pool):void{
  app.get('/manifest.webmanifest',(_request,response)=>response.sendFile(path.join(process.cwd(),'assets','manifest.webmanifest')));
  app.get('/sw.js',(_request,response)=>{response.setHeader('Service-Worker-Allowed','/');response.setHeader('Cache-Control','no-cache');response.type('application/javascript').sendFile(path.join(process.cwd(),'assets','sw.js'))});
  app.use(async(request,response,next)=>{
    if(request.method!=='GET'||request.path!=='/app'){next();return}
    if(await sessionUser(db,request)){next();return}
    const remember=cookie(request,REMEMBER_COOKIE);if(!remember){next();return}
    const [rows]=await db.query('SELECT user_id AS userId FROM app_pwa_remember_tokens WHERE token_hash=? AND expires_at>NOW() LIMIT 1',[digest(remember)]);
    const userId=Number((rows as Array<{userId:number}>)[0]?.userId);if(!userId){response.clearCookie(REMEMBER_COOKIE,{path:'/'});next();return}
    const token=crypto.randomBytes(32).toString('base64url'),history=await db.query('INSERT INTO app_login_history(user_id,login_ip) VALUES(?,?)',[userId,String(request.ip||'').slice(0,64)]),historyId=Number((history[0] as {insertId:number}).insertId);
    await db.query('INSERT INTO app_user_sessions(token_hash,user_id,history_id,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))',[digest(token),userId,historyId]);
    response.cookie(SESSION_COOKIE,token,{httpOnly:true,secure:true,sameSite:'lax',maxAge:10*60*1000,path:'/'});
    const otherCookies=(request.headers.cookie||'').split(';').map(value=>value.trim()).filter(value=>value&&!value.startsWith(SESSION_COOKIE+'='));request.headers.cookie=[...otherCookies,SESSION_COOKIE+'='+encodeURIComponent(token)].join('; ');next();
  });
  app.use(async(request,response,next)=>{if(request.method==='POST'&&request.path==='/app/logout'){const remember=cookie(request,REMEMBER_COOKIE);if(remember)await db.query('DELETE FROM app_pwa_remember_tokens WHERE token_hash=?',[digest(remember)]);response.clearCookie(REMEMBER_COOKIE,{path:'/'});}next()});
  app.get('/app/api/pwa/config',async(request,response)=>{const userId=await sessionUser(db,request);if(!userId){response.status(401).json({message:'로그인이 필요합니다.'});return}const keys=await vapidKeys(db);response.json({vapidPublicKey:keys.publicKey})});
  app.post('/app/api/pwa/remember',async(request,response)=>{const userId=await sessionUser(db,request);if(!userId){response.status(401).json({message:'로그인이 필요합니다.'});return}const token=crypto.randomBytes(32).toString('base64url');await db.query(`INSERT INTO app_pwa_remember_tokens(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL ${REMEMBER_DAYS} DAY))`,[digest(token),userId]);response.cookie(REMEMBER_COOKIE,token,{httpOnly:true,secure:true,sameSite:'lax',maxAge:REMEMBER_DAYS*86400000,path:'/'});response.json({message:'이 기기에서 자동 로그인이 설정되었습니다.'})});
  app.post('/app/api/pwa/subscribe',async(request,response)=>{const userId=await sessionUser(db,request);if(!userId){response.status(401).json({message:'로그인이 필요합니다.'});return}const subscription=request.body as {endpoint?:string;keys?:{p256dh?:string;auth?:string}};if(!subscription.endpoint||!subscription.keys?.p256dh||!subscription.keys.auth){response.status(400).json({message:'푸시 구독 정보가 올바르지 않습니다.'});return}const [maxRows]=await db.query('SELECT COALESCE(MAX(id),0) AS maxId FROM app_notifications WHERE user_id=?',[userId]);const maxId=Number((maxRows as RowDataPacket[])[0]?.maxId||0);await db.query('INSERT INTO app_push_subscriptions(user_id,endpoint,p256dh,auth_secret,last_notification_id) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),p256dh=VALUES(p256dh),auth_secret=VALUES(auth_secret),last_notification_id=GREATEST(last_notification_id,VALUES(last_notification_id))',[userId,subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth,maxId]);response.json({message:'푸시 알림이 연결되었습니다.'})});
}

export async function startPushDispatcher(db:Pool):Promise<NodeJS.Timeout>{
  const keys=await vapidKeys(db);webpush.setVapidDetails('mailto:admin@diwith.io',keys.publicKey,keys.privateKey);
  const dispatch=async()=>{const [rows]=await db.query(`SELECT s.id,s.endpoint,s.p256dh,s.auth_secret AS authSecret,s.last_notification_id AS lastId,n.id AS notificationId,n.title,n.message FROM app_push_subscriptions s JOIN app_notifications n ON n.user_id=s.user_id AND n.id>s.last_notification_id JOIN (SELECT user_id,MAX(id) AS id FROM app_notifications GROUP BY user_id) latest ON latest.user_id=n.user_id AND latest.id=n.id LIMIT 100`);for(const row of rows as Array<Record<string,string|number>>){try{await webpush.sendNotification({endpoint:String(row.endpoint),keys:{p256dh:String(row.p256dh),auth:String(row.authSecret)}},JSON.stringify({title:String(row.title),body:String(row.message||''),url:'/app',notificationId:Number(row.notificationId)}));await db.query('UPDATE app_push_subscriptions SET last_notification_id=? WHERE id=?',[row.notificationId,row.id])}catch(error){const status=(error as {statusCode?:number}).statusCode;if(status===404||status===410)await db.query('DELETE FROM app_push_subscriptions WHERE id=?',[row.id]);else console.error('Web Push 발송 실패',error)}}};
  const timer=setInterval(()=>void dispatch(),10000);timer.unref();void dispatch();return timer;
}
