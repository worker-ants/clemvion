# 테스트(Testing) 코드 리뷰

## 발견사항

- **[WARNING]** `enclosingScopeName` 의 신규 "함수형 변수" 우선순위 분기가 뮤테이션 테스트로 무검증임을 확인 — 지워도 관련 스위트 24/24 GREEN
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:118-123` (`enclosingScopeName` 내부 `const isFn = ...` / `if (isFn && functionVar === null) ...`)
  - 상세: 이번 diff 는 `user-entity-exposure-guard.ts` 의 `enclosingName` 을 삭제하고 그 알고리즘을 `source-scan.ts` 의 `enclosingScopeName` 으로 승격하면서, 신규 헤더 주석이 "판정 순서" 2번 항목으로 **"초기자가 함수/화살표인 변수" 이름을 메서드 다음·일반 변수 앞에 두는 분기를 새로 추가**했다고 명시한다(`review/code/2026/09/08/13_34_28` W1 대응). 그런데 두 소비처(`endpoint-path-conflict-wrap-guard.ts`, `user-entity-exposure-guard.ts`)의 fixture(`endpoint-path-save.fixture.ts`, `user-relation-load.fixture.ts`) 어디에도 "변수 초기자가 함수/화살표 표현식"인 형태가 없다 — 모든 `save()`/`find()` 호출이 클래스 메서드 안에서 일어나거나(항상 분기 1 로 잡힘), 초기자가 함수가 아닌 plain 변수를 거친다(분기 3). 실제로 `const isFn = ...` 계산을 통째로 `const isFn = false;` 로 뮤테이션해 이 분기를 죽인 뒤 `endpoint-path-conflict-wrap.spec.ts` + `user-entity-exposure.spec.ts` 를 실행한 결과 **2 suites / 24 tests 전부 GREEN** 이었다(리뷰 종료 전 원본으로 정확히 복원, `git diff --stat` 로 무잔여 확인). 즉 이 분기는 현재 어떤 회귀도 못 잡는 죽은 코드로, 우선순위를 반대로 바꾸거나 조건을 깨도 아무도 모른다 — 정확히 이 저장소가 반복 경계하는 "설계 근거는 뮤턴트로 반증해야 한다" 케이스다.
  - 제안: `endpoint-path-save.fixture.ts` 또는 `user-relation-load.fixture.ts` 에 모듈 스코프의 `const helper = () => repo.save(...)` (또는 `function`) 형태를 하나 추가하고, 그 결과 키가 `#helper` 로 잡히는지(그리고 plain-var 분기가 아니라 function-var 분기가 이겼는지) 단언하는 케이스를 보태면 이 분기가 실제로 살아있는 코드임을 고정할 수 있다.

- **[INFO]** `endpoint-path-conflict-wrap-guard.ts` 의 리시버 매칭이 `this.triggerRepository` 형태만 인식 — 로컬 별칭(destructuring) 경유 호출은 조용히 스캔에서 빠진다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:140` (`if (isPropertyAccessNamed(receiver, TRIGGER_REPOSITORY))`)
  - 상세: `isPropertyAccessNamed(receiver, TRIGGER_REPOSITORY)` 는 receiver 자신이 `PropertyAccessExpression`(예: `this.triggerRepository`)일 때만 참이다. 만약 프로덕션 코드가 나중에 `const { triggerRepository } = this;` 로 구조분해한 뒤 `triggerRepository.save(...)` 를 부르면, receiver 는 bare `Identifier` 라 이 술어를 통과하지 못해 **그 save 호출이 스캔에서 완전히 빠진다** — 이 가드가 명시적으로 막으려는 "래핑을 빠뜨린 새 save() 가 조용히 통과" 케이스 그 자체다. 현재 `triggers.service.ts` 를 grep 한 결과 모든 호출이 `this.triggerRepository.save(...)` 형태라 지금 당장의 false negative 는 없다(가드가 정확 프로퍼티 매칭으로 좁힌 것 자체는 옳은 방향 — 부분 문자열 매칭이었던 이전 결함의 반대편 극단으로 넘어가지 않았다는 점은 긍정적이다). 다만 fixture 어디에도 이 별칭 경유 형태에 대한 양성/음성 대조군이 없어, 향후 이 형태가 등장해도 가드가 못 잡는다는 사실 자체를 아무도 테스트로 들고 있지 않다.
  - 제안: 지금 당장 필수는 아님. `endpoint-path-save.fixture.ts` 에 `const { triggerRepository } = this; await triggerRepository.save(...)` 형태를 "알려진 사각지대"로 명시적으로 추가해 두면(캐치하지 못함을 캐너리로 문서화하거나, 프로퍼티 접근 체인을 한 겹 더 따라가도록 확장), 다음에 실제로 이 패턴이 등장했을 때 "왜 안 잡혔는지"를 처음부터 다시 조사하지 않아도 된다.

- **[INFO]** 새 negative 테스트가 파일 전체의 `afterEach(jest.restoreAllMocks())` 관례를 두고 수동 `mockRestore()` 를 병행 — 일관성만의 문제
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts:149-159` (`it('raw 표면의 non-23505 는 409 로 새지 않는다', ...)` 안 `error.mockRestore()`)
  - 상세: 이 파일은 상단에 `afterEach(() => { jest.restoreAllMocks(); })` 를 "spy 복원을 통일(B-5) — 예외로 테스트가 중단돼도 spy 가 누설되지 않는다" 는 명시적 근거와 함께 두고 있고, 바로 위의 동형 테스트(`non-23505 QueryFailedError → 500 ...`)는 실제로 수동 restore 없이 그 관례에만 의존한다. 이번에 추가된 "raw 표면의 non-23505" 테스트만 `error.mockRestore()` 를 직접 부른다 — 동작에는 문제가 없으나(이중 restore 는 안전), 같은 파일 안에서 복원 책임 소재가 갈라져 다음 편집자가 "이 테스트만 특별한 이유가 있나"로 오독할 여지가 있다.
  - 제안: 파일 전체 관례(afterEach 단일 위임)에 맞춰 이 줄만 제거해도 무방하다. 급하지 않음.

- **[INFO]** 긍정 평가 — cafe24/makeshop 두 표면(flat/wrapped) `it.each` 도입, `http-exception.filter.spec.ts` 의 raw-표면 양성+음성 짝 단언, `workspaces.service.spec.ts` 의 "쿼리가 select 로 좁혀 요청했는가" 별도 단언, `webhook-trigger.e2e-spec.ts` B4 의 실 DB UNIQUE 경로 커버리지는 모두 이 저장소가 반복 겪은 "vacuous 가드/mock 이 실제 형태와 괴리" 패턴을 정면으로 겨냥한 견고한 설계다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts` (`raceErrorSurfaces` + `it.each`), `codebase/backend/src/common/filters/http-exception.filter.spec.ts:127-159`, `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1177-1196`, `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213`
  - 상세: (1) cafe24/makeshop 테스트는 "헬퍼 유닛 테스트가 두 표면을 보장해도 호출부가 그 헬퍼를 실제로 통해 두 표면을 다 받는지는 별개 주장"이라는 정확한 근거로 `it.each` 를 도입해 flat/wrapped 둘 다 고정했다(`integrationRepo` 가 `beforeEach` 로 매번 재생성돼 두 파라미터화 케이스 간 격리도 확보됨). (2) 전역 필터 테스트는 wrap 된 `QueryFailedError` 케이스와 raw `err.code` 케이스를 **다른 것을 단언한다**고 명시적으로 구분하고, non-23505 negative control 로 판정이 과확대되지 않았음을 함께 고정했다 — 회귀 양방향 고정. (3) `listMembers` 테스트는 "반환 키 단언만 있으면 투영을 되돌려도 초록"이라는 정확한 이유로 `select` 절 자체를 검사하는 단언을 별도로 추가해 방어 계층(DB 레벨 vs JS 매핑)을 구분해 고정했다(직접 뮤테이션 확인까지 서술됨). (4) B4 e2e 는 단위 테스트가 mock 하던 드라이버 에러 형태가 실제 Postgres 반환 형태와 같은지 실 DB 로 검증하는 갭을 메운다. 모두 문서화된 "왜" 가 실제 뮤테이션/실측과 연결돼 있어 신뢰도가 높다.
  - 제안: 없음 — 참고 기록.

## 요약

이번 배치(B-1~B-8)의 테스트 변경은 전반적으로 이 저장소가 반복 겪어 온 "vacuous 가드"·"mock-실제 괴리"·"양방향 회귀 미고정" 문제를 정면으로 겨냥해 잘 설계됐다 — cafe24/makeshop 두 표면 파라미터화, 전역 예외 필터의 raw/wrapped 양성+음성 짝, `listMembers` 의 계층 분리 단언, 신규 AST 래칫(`endpoint-path-conflict-wrap-guard`)의 캐너리+대조군 fixture, 실 DB UNIQUE 경로 e2e 등은 모두 "지금 통과한다"가 아니라 "이 술어가 실제로 그 결함을 잡는가"를 뮤테이션/대조군으로 직접 확인하는 규율을 따른다. 다만 직접 뮤테이션 테스트로 확인한 결과, `source-scan.ts`(`enclosingScopeName`)에 새로 승격된 "함수형 변수" 우선순위 분기는 현재 두 소비 가드의 어떤 fixture 로도 관측되지 않는 죽은 코드다 — 지워도 24개 테스트가 전부 GREEN 이라, 이 저장소 자신의 "설계 근거는 뮤턴트로 반증하라" 규율을 이 신규 코드 자체가 어기고 있다. 그 외 `endpoint-path-conflict-wrap-guard.ts` 의 리시버 매칭이 별칭(destructuring) 경유 호출을 놓치는 잠재적 사각지대(현재는 미발현)와 `http-exception.filter.spec.ts` 의 사소한 restore 관례 불일치는 낮은 우선순위 INFO 로 남긴다. 테스트 격리(각 `beforeEach`/임시 디렉터리 `finally` 정리/`uniqueName`+`crypto.randomUUID()`)는 전반적으로 양호하고 회귀 테스트는 리네이밍(`WorkflowVersionDetailProjection`)이 타입 전용이라 런타임에 영향이 없음을 확인했다.

## 위험도

MEDIUM
