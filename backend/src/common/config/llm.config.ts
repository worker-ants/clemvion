import { registerAs } from '@nestjs/config';

export const llmConfig = registerAs('llm', () => ({
  encryptionKey: process.env.ENCRYPTION_KEY || '',
}));
