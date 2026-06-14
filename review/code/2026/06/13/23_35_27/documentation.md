# Documentation Review

## 발견사항

### [INFO] .env.example — DB 커넥션 풀 환경변수 문서화 우수
- 위치: `codebase/backend/.env.example` 추가 블록 (L35–41)
- 상세: `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS` 세 변수에 대해 기본값·운영 주의사항(인스턴스 수 × poolMax < max_connections)·`0 = indefinite wait` 의미가 주석으로 상세히 기술됨. 설정 문서 기준 충족.
- 제안: 없음. 현행으로 충분.

### [INFO] database.config.ts — `nonNegativeIntEnv` 헬퍼 JSDoc 양호
- 위치: `/codebase/backend/src/common/config/database.config.ts` L888–891
- 상세: `/** Parse a non-negative integer env var … */` 형태로 함수 동작·엣지케이스(`connectionTimeoutMs=0` 유효값)·폴백 조건을 영문 JSDoc 으로 설명. 공개 함수가 아닌 파일-내 헬퍼이지만 역할이 명확히 기술됨.
- 제안: 없음.

### [INFO] migrations/README.md — 테이블-rewrite ALTER COLUMN TYPE 절 신규 추가
- 위치: `codebase/backend/migrations/README.md` §6 (L159–183)
- 상세: binary-coercible 판별·shadow column 3-step·CONCURRENTLY 인덱스 재생성 절차를 SQL 예제와 함께 문서화. 기배포 V021 소급 수정 금지 주의사항도 명시.
- 제안: 없음. 신규 마이그레이션 작성자에게 필요한 정보가 모두 포함됨.

### [INFO] V095 SQL — 인라인 주석 충분
- 위치: `codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql`
- 상세: 핫 경로 설명, partial 범위 선택 근거(refactor 05-database C-3), CONCURRENTLY 비-트랜잭션 실행 이유, INVALID 인덱스 잔존 대응법, DOWN 절 모두 포함. 관련 `.conf` 파일도 규약에 따라 동봉됨.
- 제안: 없음.

### [INFO] spec/1-data-model.md — NodeExecution 인덱스 표 업데이트
- 위치: `spec/1-data-model.md` L3505–3509
- 상세: V095(partial 복합), V034, V012, V048, V047 인덱스 행이 추가되어 data-model 인덱스 표가 구현과 동기화됨. 각 인덱스의 목적·마이그레이션 버전·CONCURRENTLY 여부가 기록됨.
- 제안: 없음.

### [INFO] spec/5-system/13-replay-rerun.md — computeChainDepth 설명 업데이트
- 위치: `spec/5-system/13-replay-rerun.md` L533
- 상세: 재귀 CTE 방식으로 변경된 구현을 반영해 spec 문서가 동기화됨. 사이클 방어 walk 상한도 명시.
- 제안: 없음.

### [INFO] spec/data-flow/3-execution.md — V095 인덱스 언급 추가
- 위치: `spec/data-flow/3-execution.md` L3557
- 상세: node_execution 노드 실행 시작 행의 인덱스 컬럼에 V095 partial 인덱스 설명이 추가됨.
- 제안: 없음.

### [WARNING] `updateExecutionStatus` JSDoc — `linkedNodeExec 분기는 항상 true` 설명이 구현 주석과 비대칭
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L9268–9276 (JSDoc)
- 상세: JSDoc `@returns` 에 "linkedNodeExec 분기(spec §1.2 짝 전이)는 항상 `true`" 라고 명시했으나, 실제 코드는 `linkedNodeExec` 경로에서 `return true` 를 명시적으로 반환한다. 이 점은 일치한다. 그러나 "else 분기에서만 false 발생"이라는 설명이 메서드 시그니처 레벨에서 전달되지 않아, 메서드 반환값의 의미 구분이 JSDoc 에만 의존한다. 향후 분기 추가 시 계약이 drift 할 수 있다.
- 제안: 반환 타입을 `Promise<boolean>` 유지하되, JSDoc 에 `@since M-3` 태그나 별도 타입 가드(예: 리터럴 유니언)를 검토하거나 현재 JSDoc 에 "분기별 반환값 표"를 추가해 명확성을 높이는 것을 권장. 현 상태는 기능적으로 안전하나 문서 유지보수 관점에서 취약.

### [INFO] `WorkflowVersionListItemDto` — 클래스 레벨 JSDoc 양호
- 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` L2767–2772
- 상세: 목록 vs 상세 엔드포인트 구분, `snapshot` 의도적 제외 이유(over-fetch 방지), spec 참조(§7.1/§7.2)가 모두 포함됨. 각 필드에도 JSDoc 인라인 주석 존재. Swagger `@ApiProperty` 도 정확히 기술됨.
- 제안: 없음.

### [INFO] `workflow-versions.controller.ts` — API 문서 설명 업데이트 완료
- 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts` L2937/L2941–2943
- 상세: `@ApiOperation` description 및 `@ApiOkWrappedArrayResponse` 가 `WorkflowVersionListItemDto` 와 `snapshot 비포함` 설명으로 동기화됨. API 문서 업데이트 기준 충족.
- 제안: 없음.

### [INFO] `findAdminUserIdsByWorkspaces` — JSDoc 양호
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` L3458–3463
- 상세: 기존 `findAdminUserIds` 와의 관계(배치 변형), N+1 제거 동기(M-2), 빈 map 의미가 영문 JSDoc 으로 기술됨.
- 제안: 없음.

### [INFO] `integration-expiry-scanner.service.ts` — private 메서드 JSDoc 추가
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` L2273–2278, L2326–2330
- 상세: `processCandidateBatch`·`resolveRecipientsForBatch` 두 신규 private 메서드 모두 JSDoc 으로 목적·동작 기술됨.
- 제안: 없음.

### [INFO] `enqueueEmbedChunked` / `finalizeReembedIfDrained` — 충분한 JSDoc
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` L2604–2612, L2647–2654
- 상세: 두 private 헬퍼 모두 분할 이유, 실패 시 롤백 계약, 호출부 분기 책임, CAS 동작이 기술됨. `EMBED_CHUNK_SIZE` 상수에도 목적 주석 존재.
- 제안: 없음.

### [WARNING] `computeChainDepth` JSDoc — Rationale 언급이 부분적으로 부정확할 수 있음
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` L1979–1988
- 상세: JSDoc 에 "Rationale 이 기각한 것은 chain 전체 조회용 CTE 이지 깊이 검증 쿼리가 아니다"라고 설명하나, 해당 Rationale 문서(`spec/5-system/13-replay-rerun.md`)에서 이 구분을 명시적으로 확인할 수 없다. 코드 주석이 spec 문서에 없는 판단을 서술하고 있어, 나중에 spec 리뷰자가 혼동할 수 있다.
- 제안: 해당 JSDoc 설명을 "C-2 결정 당시 논의 참조: plan 또는 PR 설명" 수준으로 완화하거나, spec/5-system/13-replay-rerun.md Rationale 절에 "깊이 검증 쿼리에 CTE 사용은 허용됨" 문장을 추가해 코드 주석과 spec 간 일관성을 확보할 것을 권장.

### [INFO] `databaseConfig` 인라인 주석 — 풀 튜닝 우선순위 경고 포함
- 위치: `codebase/backend/src/common/config/database.config.ts` L908–913
- 상세: `max_connections` 역산 필수·음수/NaN 폴백·M-5 출처가 인라인 주석으로 기술됨. `app.module.ts` 에도 동일 취지 주석이 중복 포함되어 있으나 이는 독립 컨텍스트로 참조하는 사람이 달라 허용 범위.
- 제안: 없음.

### [INFO] `app.module.ts` — `extra` 풀 설정 주석
- 위치: `codebase/backend/src/app.module.ts` L614–616
- 상세: M-5 참조·기본값 배포 무변경·운영 상향 조건이 주석으로 간결하게 기술됨.
- 제안: 없음.

### [INFO] CHANGELOG 미존재 — 프로젝트 관례 확인 필요
- 위치: 리포지토리 루트 / `codebase/backend/`
- 상세: 이 PR 은 데이터베이스 최적화(M-1~M-5, C-2~C-3) 관련 다수 breaking-visible 변경(API 응답 shape 변경, 환경변수 추가, 마이그레이션 추가)을 포함한다. 리포지토리에 CHANGELOG.md 파일이 없으며 PR/spec 으로 대체하는 것이 프로젝트 관례로 보인다. spec 문서 업데이트로 충당된다면 별도 CHANGELOG 불필요.
- 제안: 현행 관례(spec 문서 + PR description)가 변경 이력 역할을 하고 있다면 이 항목은 INFO 수준으로 무시 가능. 운영팀이 별도 CHANGELOG 를 요구한다면 `DB_POOL_*` 환경변수 추가와 `GET /workflows/:wfId/versions` 응답 shape 변경(snapshot 필드 제거)을 항목으로 추가할 것을 권장.

### [WARNING] `GET /workflows/:wfId/versions` 응답 shape 변경 — 소비자 문서 업데이트 확인 필요
- 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts`
- 상세: 목록 응답이 기존 `WorkflowVersionDto`(snapshot 포함)에서 `WorkflowVersionListItemDto`(snapshot 제외)로 변경되었다. Swagger 문서는 업데이트되었으나, 프론트엔드 SDK 타입 생성이 OpenAPI 스펙에서 자동화된 경우 이 변경이 breaking change 로 간주될 수 있다. 프론트엔드 코드베이스(`codebase/frontend`)에서 이 엔드포인트 응답에서 `snapshot` 필드를 직접 소비하는 코드가 있다면 클라이언트 측 문서/타입 업데이트도 필요하다.
- 제안: `codebase/frontend` 에서 `workflow-version` 목록 응답의 `snapshot` 필드 접근 코드를 검색해 영향 범위를 확인할 것. 영향 없음이 확인되면 이 항목 해소.

## 요약

전반적으로 문서화 품질이 높다. 환경변수 추가(DB_POOL_*)는 `.env.example`에 즉시 반영되었고, 마이그레이션 README에 신규 ALTER COLUMN TYPE 절이 규약 수준으로 추가되었으며, 핵심 변경(M-1~M-5, C-2~C-3) 모두 인라인 주석·JSDoc·spec 문서 3곳에서 일관되게 추적된다. 특히 신규 private 헬퍼(`enqueueEmbedChunked`, `finalizeReembedIfDrained`, `resolveRecipientsForBatch`, `processCandidateBatch`)에 상세 JSDoc 이 붙어 있어 유지보수성이 양호하다. 두 가지 WARNING 은 기능적 결함이 아닌 미래 drift 위험이며, `GET /workflows/:wfId/versions` 응답 shape 변경은 프론트엔드 소비 여부 확인이 필요하다.

## 위험도

LOW
