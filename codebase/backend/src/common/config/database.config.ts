import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'workflow',
  password: process.env.DB_PASSWORD || 'workflow_dev',
  database: process.env.DB_DATABASE || 'workflow',
}));
