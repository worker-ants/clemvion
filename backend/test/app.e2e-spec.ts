import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Nest scaffold 의 placeholder e2e — 실제 AppModule 에는 `GET /` 라우트가 없고
 * 본 프로젝트의 e2e 는 DB / Redis 가 떠 있는 통합 환경을 전제로 한다. 인프라
 * 셋업이 정비되기 전까지 스킵하되, jest 설정 회귀 (transformIgnorePatterns
 * 누락 등) 는 jest-e2e.json 자체의 정합성으로 가드된다.
 */
describe.skip('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
