import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig, databaseConfig, llmConfig } from '../../../common/config';
import { ROOT_ENTITIES } from '../../../database/root-entities';
import { LlmModule } from '../../llm/llm.module';
import { RerankConfigModule } from '../../rerank-config/rerank-config.module';
import { RerankClientFactory } from '../../llm/rerank/rerank-client.factory';
import { RagSearchService } from '../search/rag-search.service';
import { RerankService } from '../search/rerank.service';

/**
 * 평가 하베스 CLI 전용 경량 DI 모듈.
 *
 * `KnowledgeBaseModule` 은 `RagSearchService` 와 함께 BullMQ 큐·프로세서
 * (document-embedding / graph-extraction / stuck-recovery) 를 등록한다 →
 * `createApplicationContext(AppModule)` 로 부팅하면 워커가 실 작업 job 을
 * 소비한다. 본 모듈은 **큐·프로세서를 제외**하고 검색 경로(`RagSearchService`/
 * `RerankService`)와 `LlmService` 만 재구성해, CLI 스크립트가 운영 워커를
 * 깨우지 않고 DI 를 쓰게 한다(프로젝트의 "스크립트는 AppModule 미부팅" 관례 준수).
 *
 * `RagSearchService`/`RerankService` 는 raw SQL(DataSource) 와
 * `LlmModule`/`RerankConfigModule` 의 export 만 의존하므로 여기서 직접 provide 한다.
 * 엔티티 메타데이터는 app.module 과 공유하는 `ROOT_ENTITIES` 전체를 등록해 충족
 * (LlmConfig→Workspace 등 관계 타깃 누락 방지. 검색/생성의 document_chunk·
 * knowledge_base 직접 접근은 raw SQL 이라 별도 메타 불요).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, llmConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        // 명시 목록 재사용: 엔티티 간 관계(예: LlmConfig→Workspace) 메타데이터가
        // 모두 로드돼야 하므로 autoLoadEntities 로는 부족(관계 타깃 누락). app.module
        // 의 ROOT_ENTITIES 를 그대로 import — import 만으로 큐/프로세서가 기동되진
        // 않는다(해당 모듈이 본 모듈 DI 그래프에 없으므로 미인스턴스화).
        entities: [...ROOT_ENTITIES],
        synchronize: false,
        logging: false,
      }),
    }),
    LlmModule,
    RerankConfigModule,
  ],
  providers: [RagSearchService, RerankService, RerankClientFactory],
  exports: [RagSearchService, LlmModule],
})
export class EvalCliModule {}
