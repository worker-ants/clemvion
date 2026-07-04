# 유지보수성(Maintainability) 리뷰

- 대상: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (TEST-ONLY, admission 회귀 보강)
- 그 외 diff 에 포함된 `review/consistency/2026/07/04/20_09_53/**` 는 consistency-check 산출 리포트(md/json)로 소스 코드가 아니므로 유지보수성 리뷰 범위에서 제외.

## 발견사항

- **[INFO]** 신규 admission 결과별 테스트 3종에서 `admitStub` 헬퍼로 중복 제거, 좋은 패턴
  - 위치: `execution-engine.service.spec.ts` L89-105 (admitStub), L107-164 (3개 it 블록)
  - 상세: `admitExecutionOrDefer`/`runExecution` 을 스텁하는 반복 보일러플레이트를 `admitStub(outcome)` 팩토리로 추출해 admitted/deferred/cancelled 세 케이스에서 재사용한다. 파일 내 기존 `armSlowPathResume` 같은 "공용 arrangement 헬퍼 추출" 컨벤션과 일치하며, 각 it 블록은 결과별 분기(assertion)에만 집중해 가독성이 좋다.
  - 제안: 없음. 유지 권장.

- **[INFO]** 원자 UPDATE 파라미터 순서 회귀 테스트의 매직 넘버는 주석으로 의미 부여됨
  - 위치: `execution-engine.service.spec.ts` L40-76
  - 상세: `wsCap=7`, `wfCap=2` 같은 숫자와 `$1~$5` 파라미터 위치가 인라인 주석(`// $3 wsCap (workspace.settings)` 등)으로 각각의 의미가 명시되어 있다. 회귀 테스트 목적(파라미터 순서·cap 교차 오염 차단)에 부합하는 의도적 하드코딩이며 매직 넘버로 보기 어렵다.
  - 제안: 없음.

- **[INFO]** e2e 헬퍼 함수들의 옵션 파라미터 확장이 하위 호환적으로 이뤄짐
  - 위치: `execution-concurrency-cap.e2e-spec.ts` L61-64 (`createCapWorkflow`), L133-136 (`execute`), L146-149 (`getStatus`), L159-163 (`poll`)
  - 상세: `wsId`/`workflowCap` 파라미터가 기본값(`= workspaceId`, `= 1`)을 가진 옵셔널 인자로 추가되어 기존 두 테스트(cap 초과 pending/timeout)의 호출부는 수정 없이 그대로 동작한다. 함수 시그니처가 순차적으로 파라미터를 누적하는 형태(workflowId, wsId, workflowCap 등 함수마다 순서 다름)이지만 각 함수의 책임이 좁고 헬퍼 함수 개수가 적어 현재로선 혼란 소지가 낮다.
  - 제안: 없음. 다만 향후 옵션이 하나 더 늘어난다면(예: timeout 커스터마이징까지 겹치면) `poll(executionId, predicate, { timeoutMs, wsId })` 형태의 options 객체로 전환하는 것을 고려할 만하다(현재는 이르다는 판단).

- **[INFO]** 신규 e2e 테스트가 기존 두 테스트와 구조·주석 스타일 일관성 유지
  - 위치: `execution-concurrency-cap.e2e-spec.ts` L213-255 (신규 `it('workspace-level cap 초과...')`)
  - 상세: 새 테스트는 기존 두 테스트와 동일하게 "설명 주석 → arrange(workflow/blocker 생성) → act(execute) → assert(pending) → 슬롯 해제 → assert(completed)" 패턴을 따른다. `createTeamWorkspace` 로 격리된 workspace 를 사용해 기존 테스트의 잔여 상태와 간섭하지 않도록 한 점도 e2e 테스트 격리 관례에 부합한다.
  - 제안: 없음.

- **[INFO]** 함수 길이·중첩 깊이·순환 복잡도
  - 위치: 두 파일 전반
  - 상세: 추가된 코드는 모두 단일 책임의 짧은 it 블록/헬퍼 함수이며, 조건 분기는 최대 1단계(`if (workflowCap !== null)`) 수준이다. 중첩이나 복잡도 문제는 발견되지 않았다.
  - 제안: 없음.

## 요약
이번 변경은 모두 테스트 코드(unit spec + e2e spec)이며 production 코드 변경이 없다. 신규 unit 테스트는 `admitStub` 팩토리로 반복 로직을 적절히 추출했고, e2e 테스트는 기존 헬퍼 함수들에 하위 호환적인 옵셔널 파라미터를 추가해 기존 테스트를 깨지 않으면서 workspace-level cap 시나리오를 새로 커버했다. 주석은 각 회귀 테스트가 무엇을, 왜 고정하는지(파라미터 순서·cap 교차 오염 차단, workspace COUNT join 이 다른 workflow 슬롯도 소비하는 사실 등) 명확히 설명하고 있어 가독성과 향후 유지보수에 도움이 된다. 매직 넘버·중복·과도한 중첩 등 구조적 문제는 발견되지 않았다.

## 위험도
NONE
