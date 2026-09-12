# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `ParseUUIDPipe` 추가는 런타임 오버헤드가 무시할 수준이며, 오히려 실패 경로 성능을 개선한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: 비-UUID `:id` 가 파이프 없이 `findById` 까지 흘러가면 Postgres 왕복(SQLSTATE 22P02) 후에야 거부됐다. 이제 파이프가 컨트롤러 진입 시점에 정규식 1회 매치로 즉시 400 을 반환하므로, 잘못된 입력에 대해 DB 라운드트립 1회가 통째로 제거된다. 정상 UUID 경로에는 정규식 매치 1회(O(1), 문자열 길이 상수)만 추가되어 측정 가능한 영향이 없다.
  - 제안: 없음 — 성능 관점에서 개선.

- **[INFO]** 신규 `param-uuid-pipe` repo-guard 는 테스트/CI 전용 정적 스캔이며 런타임 경로에 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:131` (`scanUuidParams`), 소비처 `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:54` (`collectTsFiles(SCAN_ROOT)`)
  - 상세: `.controller.ts` 파일마다 `fs.readFileSync`(동기 I/O) + `ts.createSourceFile` 로 AST 를 새로 만들고 `ts.forEachChild` 로 전체 순회한다. 동기 I/O·AST 풀 파싱이지만 대상이 `src/modules` 아래 `*.controller.ts` 35개로 스코프가 좁고(전수 `src/` 순회가 아님), Jest 스펙 실행 시 1회만 도는 빌드/테스트 타임 비용이라 프로덕션 요청 경로와 무관하다. 형제 가드들(`swagger-dto-contract` 등)도 동일 패턴을 이미 쓰고 있어 새로운 클래스의 비용이 아니다.
  - 제안: 없음 — 현재 스코프(35개 파일, 1회 실행)에서는 조치 불필요. 향후 스캔 루트가 `src/` 전체로 넓어지거나 파일 수가 크게 늘면 파일 읽기를 캐싱하는 형제 유틸(`source-scan`)과의 중복 파싱 여부만 재확인하면 된다.

- **[INFO]** `@ApiParam({ format: 'uuid' })` 추가는 Swagger 문서 메타데이터로, 부트스트랩 1회성 리플렉션 비용만 발생
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts:436` (`switchWorkspace`), `codebase/backend/src/modules/triggers/triggers.controller.ts:265`
  - 상세: 데코레이터 메타데이터는 Nest/Swagger 모듈 부트스트랩 시점에 리플렉션되어 OpenAPI 문서를 생성할 때만 쓰인다. 요청 처리 경로(hot path)에 어떤 추가 연산도 들어가지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 HTTP 왕복 테스트(`Test.createTestingModule` + `supertest`)는 `beforeAll` 에서 앱을 1회만 부트스트랩해 테스트 스위트 비용을 억제
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:229` (`describe('POST /triggers/:id/chat-channel/rotate-bot-token — :id 파이프 (HTTP)'`)
  - 상세: `app.init()` 을 `beforeAll` 에 두고 세 개의 `it` 가 공유하며, `TriggersService` 는 `useValue` mock 이라 DB/Redis 의존이 없다. 테스트당 앱 재기동이 없어 N+1 성 비용이 생기지 않는다.
  - 제안: 없음.

- **[INFO]** i18n 라벨 맵(`backend-labels.ts`)·문서(`*.mdx`) 변경은 주석/문자열 재배치뿐이며 자료구조·연산 변화 없음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:602`~`617` (`ERROR_KO` 객체 내 주석·키 순서 이동)
  - 상세: `Record<string, string>` 리터럴의 항목 순서·주석만 바뀌었고 런타임에 조회 방식(`ERROR_KO[code]`)은 그대로다. 성능 영향 없음.
  - 제안: 없음.

## 요약

이번 변경 셋은 성능에 실질적 영향이 없거나 오히려 소폭 개선(비-UUID `:id` 요청이 DB 왕복 없이 400 으로 즉시 종료)되는 방향이다. 신규로 추가된 `param-uuid-pipe` repo-guard 는 AST 전수 스캔을 수행하지만 대상이 `src/modules` 아래 컨트롤러 35개로 한정되고 테스트 실행 시 1회만 도는 빌드타임 비용이라 런타임 경로와 무관하다. `@ApiParam` 데코레이터 추가는 부트스트랩 시점 메타데이터일 뿐이고, 나머지(mdx 문서·i18n 라벨 주석·테스트)는 알고리즘·I/O·캐싱 관점에서 다룰 대상이 없다. N+1 호출, 불필요한 메모리 할당, 블로킹 I/O 신규 유입, O(n²) 누적 연산 등 우려되는 패턴은 발견되지 않았다.

## 위험도
NONE
