# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 `ParseUUIDPipe` 추가는 성능상 개선이다 (fail-fast)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: 종전에는 비-UUID `:id` 가 그대로 `TriggersService.findById` → TypeORM 쿼리까지 흘러가 Postgres 라운드트립 후 SQLSTATE 22P02 로 거부당했다(연결 획득 · 쿼리 파싱 · 네트워크 왕복 비용 발생). 이제는 요청 파이프라인 단계에서 `ParseUUIDPipe` 가 정규식 검증만으로 즉시 400 을 반환해 DB 라운드트립 자체를 없앤다. 형제 엔드포인트 6곳과 동일한 형태로 통일된 것도 부가적으로 일관된 실행 경로를 만든다.
  - 제안: 없음 — 그대로 유지.

- **[INFO]** 신규 repo-guard(`param-uuid-pipe-guard.ts`)는 전체 컨트롤러 트리를 매 테스트 실행마다 AST 로 재파싱한다 — 테스트 시간에만 영향, 프로덕션 무관
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`scanUuidParams` 함수, `ts.createSourceFile` + 재귀 `visit`), 호출부는 `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`
  - 상세: `collectTsFiles(SCAN_ROOT)` 로 `modules/` 하위 파일 목록을 모은 뒤 `.controller.ts` 35개 전부를 `fs.readFileSync` + `ts.createSourceFile` 로 매번 새로 파싱한다. 이 저장소에는 이미 같은 패턴(`dto-class-name-collision`, `swagger-dto-contract` 등)의 다른 AST 기반 repo-guard 가 다수 있어, 전체 테스트 스위트 실행 시 같은 파일들을 가드마다 각각 독립적으로 재파싱하는 누적 비용이 존재할 수 있다. 다만 이는 이 PR 이 새로 만든 문제가 아니라 기존 아키텍처 패턴을 그대로 따른 것이고, `run-test-all.sh` 전체 스위트(백엔드 460 suites)가 이미 이 방식으로 통과하고 있어 실질적 병목으로 보이지 않는다.
  - 제안: 조치 불필요. 다만 향후 repo-guard 수가 더 늘어 테스트 스위트 시간이 눈에 띄게 증가하면, 파일별 `ts.SourceFile` 캐시를 여러 가드가 공유하는 것을 고려할 수 있다(지금 범위 밖).

- **[INFO]** HTTP 왕복 테스트가 Nest 애플리케이션을 부트스트랩하지만 `beforeAll`/`afterAll` 로 올바르게 상각한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:245-265` (`describe('POST /triggers/:id/chat-channel/rotate-bot-token — :id 파이프 (HTTP)')`)
  - 상세: `Test.createTestingModule(...).compile()` + `app.init()` 은 단순 `new TriggersController(...)` 대비 무거운 편이지만, 이 블록의 3개 `it` 이 앱을 공유(`beforeAll`)하고 `rotateBotToken.mockClear()` 로 mock 만 초기화하므로 테스트당 재부트스트랩은 없다. 실제 파이프라인을 검증하기 위한 의도된 트레이드오프이며 비효율적인 반복 초기화는 없다.
  - 제안: 없음.

나머지 변경(CHANGELOG.md, `auth.controller.ts` 의 `@ApiParam` 메타데이터 보강, MDX 문서 6개, `backend-labels.ts`/`.test.ts` 주석 재귀속, plan 문서, guard fixture)은 전부 문서·주석·Swagger 메타데이터·정적 테스트 자산이라 런타임 성능에 영향이 없다.

## 요약

이번 변경은 실질적으로 프로덕션 런타임에 영향을 주는 것이 `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 를 추가한 한 줄뿐이며, 이는 비-UUID 입력에 대해 DB 라운드트립 없이 즉시 400 을 반환하게 해 오히려 실패 경로의 지연시간과 DB 부하를 줄이는 개선이다. 나머지는 Swagger 문서화, 사용자 가이드 MDX, i18n 주석, 신규 정적 AST 기반 repo-guard(테스트 시점에만 실행)와 HTTP 왕복 통합 테스트로, 모두 프로덕션 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O 관점에서 특이사항이 없다. 신규 repo-guard 의 전수 AST 스캔은 테스트 스위트 실행 시간에만 관여하며 기존 저장소 관례와 일치해 문제로 보지 않는다.

## 위험도
NONE
