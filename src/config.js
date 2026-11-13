import 'dotenv/config';
import dotenv from 'dotenv';
// Mantém PORT do .env existente e permite segredos em arquivo ignorado pelo Git.
dotenv.config({ path: '.env.local', quiet: true });

export const config = {
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || '127.0.0.1',
  origins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(v => v.trim()),
  sessionHours: 24,
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
  adminContas: (process.env.ADMIN_CONTAS || '').split(',').map(v => v.trim()).filter(Boolean),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'TCC_alimento',
    charset: 'utf8mb4', dateStrings: true, decimalNumbers: true, timezone: 'Z',
  },
};
