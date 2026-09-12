# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `param-uuid-pipe.spec.ts` 안에서 같은 입력에 대해 `scanUuidParams()`를 두 번 호출 — 컨트롤러 35개 전량의 TS AST 재파싱이 중복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:65`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:71`
  - 상세: `const files = collectTsFiles(SCAN_ROOT)`(파일 목록)는 describe 최상단에서 한 번만 계산되지만, 그 목록을 인자로 받는 `scanUuidParams(files, SRC_ROOT)`는 `it('스캔 대상이 비어 있지 않다…')`(65번 줄, `.scanned` 사용)와 `it("id-형 경로 파라미터는…")`(71번 줄, `.violations` 사용) 두 곳에서 각각 다시 호출된다. `scanUuidParams` 내부는 매 호출마다 대상 `*.controller.ts` 전부(현재 35개)를 `fs.readFileSync` + `ts.createSourceFile` + 전체 AST 순회로 다시 처리하므로(`param-uuid-pipe-guard.ts:130-177`), 사실상 같은 파싱 작업이 이 spec 파일 실행마다 두 번 일어난다. 아래 `[대조군]` describe 블록은 반대로 `found = scanUuidParams(fixtures, FIXTURE_DIR).violations`를 블록 최상단에서 한 번만 계산해 여러 `it`가 재사용하는 올바른 패턴을 이미 쓰고 있어, 위 블록과 비대칭이다.
  - 영향: 파일 수가 35개인 현재 규모에서는 CI 테스트 시간에 미치는 영향이 매우 작다(수십 ms 수준으로 추정). 다만 컨트롤러가 늘어날수록 이 중복 비용은 선형으로 커지고, "판정과 카운트를 같은 순회에서 낸다"는 이 가드의 설계 의도(스캔 결과가 갈리지 않도록 한 곳에서 계산)와도 어긋난다 — 같은 결과를 두 번 다른 시점에 재계산하면 사이에 파일이 바뀔 경우(로컬 워치 모드 등) 두 단언이 서로 다른 스냅샷을 볼 여지도 생긴다.
  - 제안: `beforeAll` 안에서 (또는 describe 최상단에서) `const scan = scanUuidParams(files, SRC_ROOT)` 를 한 번만 계산해 두 `it`가 `scan.scanned` / `scan.violations` 를 재사용하도록 한다. 이미 아래 대조군 블록에서 쓰는 패턴과 동일하게 맞추면 된다.

- **[INFO]** `scanUuidParams`가 id-형 `@Param`이 없는 메서드에도 `apiParamUuidFlags`/`isExcludedFromOpenApi`를 무조건 계산한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:139-144` (`visit` 함수 내 `ts.isMethodDeclaration(node)` 분기)
  - 상세: `visit`은 모든 `MethodDeclaration` 노드에 대해 `apiParamUuidFlags(node, sf)`(데코레이터 순회 + 객체 리터럴 파싱)와 `isExcludedFromOpenApi(node, sf)`를 먼저 계산한 뒤, 그 다음에야 파라미터를 순회하며 id-형 `@Param`이 있는지 확인한다. id-형 파라미터가 전혀 없는 메서드(예: body만 받는 POST 핸들러)에서도 이 두 계산이 매번 수행된다.
  - 영향: 메서드당 데코레이터 수가 적고(수 개), 컨트롤러당 메서드 수도 적어(현재 35개 파일 합쳐 136+9건 규모) 무시 가능한 수준이다. 결함이 아니라 사소한 비효율이다.
  - 제안: 우선순위는 낮음 — 다만 필요하면 파라미터 목록에 id-형 `@Param`이 하나라도 있는지 먼저 빠르게 확인한 뒤에만 `apiParamUuidFlags`/`isExcludedFromOpenApi`를 계산하도록 순서를 바꿀 수 있다. 가독성과 맞바꿀 정도의 이득은 아니라 지금 상태를 유지해도 무방하다.

- **[관찰 — 개선 방향, 조치 불요]** `rotateBotToken`에 `ParseUUIDPipe` 추가는 성능상 순증(net positive)이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken`, `@Param('id', ParseUUIDPipe)`)
  - 상세: 변경 전에는 비-UUID `:id`가 `TriggersService.findById` → DB 쿼리까지 흘러가 Postgres 가 SQLSTATE 22P02 로 거부하는 왕복(round-trip)이 발생한 뒤에야 (마스킹된 500 으로) 실패했다. `ParseUUIDPipe` 추가로 이제 컨트롤러 진입 시점에 동기적으로 거부되어 불필요한 DB 왕복 자체가 사라진다. 별도 조치 불필요, 참고로 기록.

## 요약

이번 변경의 실질 프로덕션 코드 변경은 `rotateBotToken`/`switchWorkspace`의 `@Param`·`@ApiParam` 데코레이터 추가뿐이며, 이는 런타임 경로에 별도 연산·메모리·I/O 부담을 추가하지 않고 오히려 잘못된 UUID 입력이 DB 왕복 없이 조기에 거부되도록 만들어 성능상 이득이다. 새로 추가된 `param-uuid-pipe` 가드(`param-uuid-pipe-guard.ts`)는 TypeScript AST 를 이용한 정적 스캔으로, 컨트롤러 35개 규모에서 시간/공간 복잡도상 문제가 없고 반복문 내 DB·API 호출(N+1)도 없다. 다만 `param-uuid-pipe.spec.ts`에서 동일한 스캔 결과를 두 개의 `it` 블록이 각각 재계산해 AST 파싱이 한 번 더 일어나는 중복 연산이 있는데, 이는 테스트/CI 실행 시간에만 영향을 미치는 사소한 사안이며 프로덕션 요청 경로와는 무관하다. 나머지 파일(CHANGELOG·MDX 문서·plan 트래커·i18n 라벨 주석)은 모두 문서/데이터 성격이라 성능 관점에서 특기할 사항이 없다.

## 위험도

LOW
