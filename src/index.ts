import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { createPool } from './db';
import { ensureSupervisorSchema, registerSupervisorRoutes } from './supervisor';
import { ensureUserSchema, registerUserRoutes } from './user';
import { ensureAdminSchema, registerAdminRoutes } from './admin';
import { attachRealtimeServer, publishRequestChanged } from './realtime';
import { renderHomePage } from './home';
import { ensurePwaSchema, registerPwaRoutes, startPushDispatcher } from './pwa';

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const port = Number(process.env.PORT ?? '3000');
  const db = createPool({
    host: requiredEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? '3306'),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    database: requiredEnv('DB_NAME'),
    connectionLimit: Math.max(1,Number(process.env.DB_CONNECTION_LIMIT??3)),
  });

  await db.query('SELECT 1');
  await ensureSupervisorSchema(db);
  await ensureUserSchema(db);
  await ensurePwaSchema(db);
  await ensureAdminSchema(db);

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/assets', express.static(path.join(process.cwd(), 'assets'), { etag: false, maxAge: 0 }));
  app.get('/favicon.ico', (_request, response) => {
    response.setHeader('Cache-Control','no-store, max-age=0');
    response.type('png').sendFile(path.join(process.cwd(), 'assets', 'report-approval-favicon.png'));
  });
  app.use((request, response, next) => {
    const send = response.send.bind(response);
    response.send = ((body: unknown) => {
      if (typeof body === 'string' && body.includes('</body>') && !body.includes('/assets/grid-sort.js')) {
        body = body.replace('</body>', '<style>#managerSearchConditions [data-search],#managerSearchConditions [data-reset]{width:auto!important;min-width:68px!important;height:38px!important;min-height:38px!important;padding:0 14px!important;border-radius:8px!important;font-size:.76rem!important;font-weight:800!important;line-height:36px!important;box-shadow:none!important;cursor:pointer!important}#managerSearchConditions [data-search]{border:1px solid #26364d!important;background:#26364d!important;color:#fff!important}#managerSearchConditions [data-reset]{border:1px solid #ccd7e4!important;background:#fff!important;color:#26364d!important}</style><script src="/assets/grid-sort.js"></script><script src="/assets/request-realtime.js?v=20260816-6"></script><script src="/assets/secretary-workspace.js?v=20260816-5"></script></body>');
      }
      if (typeof body === 'string') body = body.replace('/assets/request-realtime.js?v=20260816-6', '/assets/request-realtime.js?v=20260816-18');
      if (typeof body === 'string' && request.path.startsWith('/app') && body.includes('</head>') && !body.includes('manifest.webmanifest')) body = body.replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#1c2d4a"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="apple-touch-icon" href="/assets/pwa-icon-192.png"></head>');
      if (typeof body === 'string' && request.path.startsWith('/app') && body.includes('</body>') && !body.includes('/assets/pwa-install.js')) body = body.replace('</body>', '<script src="/assets/pwa-install.js?v=20260816-2"></script></body>');
      return send(body);
    }) as typeof response.send;
    next();
  });

  app.use((request, response, next) => {
    const changesRequest = ['POST','PUT','DELETE'].includes(request.method) && (
      request.path === '/app/api/requests' ||
      request.path === '/app/api/requests/upload' ||
      /^\/app\/api\/manager\/requests\/\d+\/(review|decision)$/.test(request.path) ||
      /^\/app\/api\/secretary\/requests\/\d+\/action$/.test(request.path) ||
      request.path === '/app/api/secretary/requests/reorder'
    );
    if (changesRequest) response.once('finish', () => {
      if (response.statusCode >= 200 && response.statusCode < 400) publishRequestChanged();
    });
    next();
  });

  registerPwaRoutes(app,db);
  registerSupervisorRoutes(app, db);
  registerUserRoutes(app, db);
  registerAdminRoutes(app, db);

  app.get('/', (_request, response) => {
    response.type('html').send(renderHomePage());
  });

  app.get('/health', async (_request, response) => {
    try {
      const [rows] = await db.query('SELECT NOW() AS serverTime');
      response.json({ status: 'ok', database: rows });
    } catch (error) {
      response.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Database check failed' });
    }
  });

  const server = createServer(app);
  attachRealtimeServer(server);
  await startPushDispatcher(db);
  server.listen(port, () => {
    console.log(`Server listening on http://${process.env.BASE_URL ?? 'localhost'}:${port}`);
  });

  let shuttingDown=false;
  const shutdown=async(signal:string)=>{
    if(shuttingDown)return;
    shuttingDown=true;
    console.log(`${signal} received; closing HTTP server and database pool.`);
    const forceTimer=setTimeout(()=>process.exit(1),10_000);
    forceTimer.unref();
    server.close(async()=>{
      try{await db.end();process.exit(0)}catch(error){console.error('Database pool shutdown failed',error);process.exit(1)}
    });
  };
  process.once('SIGINT',()=>{void shutdown('SIGINT')});
  process.once('SIGTERM',()=>{void shutdown('SIGTERM')});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
