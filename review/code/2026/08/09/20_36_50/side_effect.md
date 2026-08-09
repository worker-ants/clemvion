# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 e2e 스펙이 실 Postgres 에 직접 INSERT/DELETE 를 수행한다 (의도된 부작용, 격리 양호)
  - 위치: `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts:56` (`beforeAll` — DB connect), `:68`(`beforeEach` — 네임스페이스 범위 DELETE 후 재삽입), `:61`(`afterAll` — cleanup)
  - 상세: `secret_store` 테이블에 실제로 행을 쓰고 지운다. 다른 스펙의 row 를 건드리지 않도록 `uniqueName('like')` 로 생성한 네임스페이스에 모든 `ref` 를 가두고, `beforeEach`/`afterAll` 양쪽에서 `DELETE FROM secret_store WHERE ref LIKE $1`(scope 패턴)로 정리한다. `workspace_id` 는 FK 가 없는 컬럼(`V063__secret_store.sql` 주석: "workspace_id FK 없음 — application-level cascade")이라 `randomUUID()` 삽입이 참조 무결성을 깨지 않는다. e2e 러너가 가리키는 DB 는 `clemvion_e2e`(`test/helpers/db.ts` 기본값)로 production 과 분리돼 있다. 실질적 위험은 낮지만, 이 리뷰 관점(파일시스템/외부 자원 부작용)에서는 "새로 도입된 실 DB write" 이므로 기록해 둔다.
  - 제안: 조치 불요 — 격리·정리 방식이 기존 e2e 컨벤션(`test/helpers/db.ts` 의 unique-prefix 권장)과 일치한다.

- **[INFO]** `SecretResolverService` 단위 스펙의 in-memory mock 이 새 관측점(`_lastDeleteQuery`)을 노출
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` — `createInMemoryRepository`/`InMemoryRepository` 타입 (약 17~29줄)
  - 상세: 테스트 전용 mock 객체에 `_lastDeleteQuery: { condition?, pattern? }` 필드를 추가하고 `where()` 호출 시 채운다. 프로덕션 `Repository<SecretStore>` 타입이나 `SecretResolverService` 의 공개 API 에는 영향이 없다 — mock 이 `Repository<SecretStore> & {...}` 로 캐스팅되는 테스트 전용 확장이다. 부작용 없음, 인터페이스 변경 아님.
  - 제안: 조치 불요.

- **[정보성 확인, 이상 없음]** `workspace-reflection-canary.ts` 는 JSDoc 주석만 변경됐고 `assertWorkspaceIdReflectionWorks`/`countWorkspaceIdConsumingRoutes` 의 시그니처·로직·부트 시퀀스(`main.ts` 호출 순서)는 diff 에 포함되지 않았다. 부팅 시 `app.get(DiscoveryService)`/`app.get(MetadataScanner)` 호출과 로그 출력(`logger.log`)은 기존 동작 그대로다 — 새 부작용 없음.

## 요약

이 변경 묶음(백엔드 hygiene follow-up: README 문서 구조 정리, 워크스페이스 UUID 테스트 픽스처 공용화, 캐너리 주석 수치 정정, `deleteByPrefix` LIKE 가드 e2e 고정, 죽은 테스트 스캐폴딩 제거, plan/consistency 리뷰 산출물 커밋)은 프로덕션 코드 경로·시그니처·전역 상태·환경 변수 읽기/쓰기·네트워크 호출을 실질적으로 건드리지 않는다. 유일한 실질적 "부작용"은 신규 e2e 스펙이 수행하는 실 Postgres INSERT/DELETE 인데, 이는 목적 그 자체(LIKE 와일드카드 과다삭제 위험을 실 DB 로 검증)이고 unique 네임스페이스 + beforeEach/afterAll cleanup 으로 격리돼 있어 위험이 낮다. 테스트 픽스처 통합(`workspace-id-fixtures.ts`)과 mock 확장(`_lastDeleteQuery`)은 테스트 전용 표면이라 호출자·공개 인터페이스에 영향이 없고, `http-request.handler.spec.ts` 의 죽은 스캐폴딩 제거는 순수 삭제라 부작용 표면을 오히려 줄인다. `review/consistency/**` 신규 파일들은 이전 세션이 생성한 정적 리포트 데이터일 뿐 코드가 아니다.

## 위험도

LOW
