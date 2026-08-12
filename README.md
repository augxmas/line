# line-maria-app

TypeScript + Express application backed by MySQL/MariaDB.

## Setup

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Install dependencies with `npm install`.
3. Set the database administrator password in your shell, then provision the database and user:

```powershell
$env:DB_ROOT_PASSWORD='<your-database-admin-password>'; npm run provision-db
```

4. Start the app:

```powershell
npm run dev
```

The app exposes `GET /` and `GET /health`.
