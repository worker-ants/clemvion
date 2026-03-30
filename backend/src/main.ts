import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Cookie parser
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl'),
    credentials: true,
  });

  const port = configService.get<number>('app.port') || 3001;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}
void bootstrap();
