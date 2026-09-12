# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** 신규 repo-guard 테스트가 같은 AST 전수 스캔을 캐싱 없이 두 번 수행한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:57-77` (특히 66번째 줄 `expect(scanUuidParams(files, SRC_ROOT).scanned).toBeGreaterThan(100);` 과 72번째 줄 `const violations = scanUuidParams(files, SRC_ROOT).violations.map(...)`)
  - 상세: `scanUuidParams(files, SRC_ROOT)` 는 `modules/` 하위 `*.controller.ts` 35개 전부를 `fs.readFileSync` + `ts.createSourceFile` 로 재파싱하고 전체 AST 를 재귀 순회(`ts.forEachChild`)하는 호출이다. 이 함수가 `it('스캔 대상이 비어 있지 않다 ...')` 와 `it('id-형 경로 파라미터는 ... ')` 두 테스트에서 **동일한 인자로 두 번** 호출되어 같은 결과(`scanned`/`violations`)를 위해 파싱·순회가 두 번 반복된다. 같은 파일의 대조군 블록(`[대조군] 판정 함수가 실제로 가른다`)은 `const found = scanUuidParams(fixtures, FIXTURE_DIR).violations;` 로 describe 스코프에서 한 번만 계산해 여러 `it` 이 재사용하는 올바른 패턴을 이미 쓰고 있어, 위 두 테스트만 대칭이 깨져 있다.
  - 제안: `describe` 블록 상단에서 `const scan = scanUuidParams(files, SRC_ROOT);` 를 한 번만 계산해 두 `it` 이 `scan.scanned` / `scan.violations` 를 재사용하도록 통합한다. 파일 35개 규모라 개별 실행 비용은 미미하지만, 저장소가 이미 460+ suite 규모(plan 상 "backend 460 suites")라 이런 사소한 중복이 누적되면 CI 시간에 영향을 준다.

- **[INFO]** `rotateBotToken` 에 `ParseUUIDPipe` 를 붙인 것은 오히려 성능을 개선하는 방향의 변경이다 (참고용, 결함 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (diff 게이트 291번째 줄, `@Param('id', ParseUUIDPipe) triggerId: string,`)
  - 상세: 종전에는 비-UUID `:id` 가 파이프 없이 그대로 `TriggersService.findById` → TypeORM 쿼리까지 흘러가 Postgres 가 SQLSTATE 22P02 로 거부한 뒤에야 실패했다(DB 왕복 + 예외 처리 비용 발생). 이번 변경으로 컨트롤러 계층에서 즉시 400 을 반환해 불필요한 DB 라운드트립을 없앤다 — fail-fast 로 인한 부하 감소.
  - 제안: 없음(긍정적 변경, 조치 불필요).

## 요약

이번 변경 세트는 대부분 문서(CHANGELOG·MDX·spec 트래커)·i18n 라벨 주석·테스트/가드 코드이고, 프로덕션 런타임 로직 변경은 `rotateBotToken` 핸들러에 `ParseUUIDPipe` 및 `@ApiParam` 데코레이터를 추가한 것 한 곳뿐이다. 이 변경은 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O 관점에서 영향이 없으며, 오히려 무효 입력에 대해 DB 왕복을 없애는 방향으로 fail-fast 를 강화해 성능에 긍정적이다. 신규 추가된 `param-uuid-pipe` AST 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`)는 빌드/테스트 전용 정적 분석 도구로, 컨트롤러 35개 파일에 대해 O(n) AST 순회를 수행하며 런타임 경로와 무관하다. 유일한 지적 사항은 그 가드의 테스트에서 동일한 전수 스캔이 두 `it` 블록에서 캐싱 없이 중복 호출된다는 점인데, 대상 파일 수가 작아(35개) 실질적 영향은 미미한 INFO 수준이다.

## 위험도
NONE
