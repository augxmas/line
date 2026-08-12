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
  });

  await db.query('SELECT 1');
  await ensureSupervisorSchema(db);
  await ensureUserSchema(db);
  await ensureAdminSchema(db);

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));
  app.get('/favicon.ico', (_request, response) => {
    response.type('png').sendFile(path.join(process.cwd(), 'assets', 'report-approval-favicon.png'));
  });
  app.use((_request, response, next) => {
    const send = response.send.bind(response);
    response.send = ((body: unknown) => {
      if (typeof body === 'string' && body.includes('</body>') && !body.includes('/assets/grid-sort.js')) {
        body = body.replace('</body>', '<style>#managerSearchConditions [data-search],#managerSearchConditions [data-reset]{width:auto!important;min-width:68px!important;height:38px!important;min-height:38px!important;padding:0 14px!important;border-radius:8px!important;font-size:.76rem!important;font-weight:800!important;line-height:36px!important;box-shadow:none!important;cursor:pointer!important}#managerSearchConditions [data-search]{border:1px solid #26364d!important;background:#26364d!important;color:#fff!important}#managerSearchConditions [data-reset]{border:1px solid #ccd7e4!important;background:#fff!important;color:#26364d!important}</style><script src="/assets/grid-sort.js"></script><script src="/assets/request-realtime.js?v=20260809-2"></script><script src="/assets/secretary-workspace.js?v=20260809-14"></script></body>');
      }
      return send(body);
    }) as typeof response.send;
    next();
  });

  app.use((request, response, next) => {
    const changesRequest = ['POST','PUT','DELETE'].includes(request.method) && (
      request.path === '/app/api/requests' ||
      request.path === '/app/api/requests/upload' ||
      /^\/app\/api\/manager\/requests\/\d+\/(review|decision)$/.test(request.path) ||
      /^\/app\/api\/secretary\/requests\/\d+\/action$/.test(request.path)
    );
    if (changesRequest) response.once('finish', () => {
      if (response.statusCode >= 200 && response.statusCode < 400) publishRequestChanged();
    });
    next();
  });

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
  server.listen(port, () => {
    console.log(`Server listening on http://${process.env.BASE_URL ?? 'localhost'}:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
