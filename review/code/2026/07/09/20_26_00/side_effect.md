### 발견사항

- **[INFO]** 신규 unit 가드가 매 테스트 실행 시 파일시스템을 재귀 스캔
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` (`collectE2eFiles`, `findSubGlobalTimeouts`, `readGlobalExpectTimeout`)
  - 상세: `fs.readdirSync`/`fs.readFileSync` 로 `e2e/**` 전체와 `playwright.config.ts` 를 매 테스트 run 마다 읽는다. 파일시스템 쓰기·삭제는 없고 순수 read-only 이며, 저장소의 기존 build-time 가드들(`spec-frontmatter.test.ts` 등)과 동일한 패턴이라 신규 부작용 유형은 아니다. `playwright.config.ts` 의 `expect.timeout` 정규식 파싱이 실패하면 `throw` 로 fail-closed 하도록 설계되어 있어 가드 무력화(silent fail-open) 위험은 낮다.
  - 제안: 별도 조치 불필요. 향후 `playwright.config.ts` 의 `expect` 블록 포맷이 크게 바뀌면(예: 여러 줄에 걸친 중첩) 정규식 매칭이 깨질 수 있음을 인지만 해두면 됨.

- **[INFO]** 테스트 전용 변수 참조 수정 — 사전 존재 결함의 교정(부작용 없음)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:17005` (`reentryWorkflowInput` describe 블록, `NF-OB-07 BusinessMetrics 동작` 최상위 describe 안에 nested)
  - 상세: `service`(다른 최상위 `describe('ExecutionEngineService', ...)` 블록 안에서만 lexical scope 를 갖는 변수, 103~15915행)를 이 블록 고유의 `svcMetrics`(16639행, 자신의 `beforeEach` 가 만드는 별도 `TestingModule` 인스턴스)로 교체했다. git 이력(`git show 7887bfb93`)으로 확인한바, 수정 전 코드는 `ReferenceError: service is not defined` 로 결정적 실패하던 pre-existing 결함(#868 회귀)이었고, 이번 변경은 순수 교정이다. `reentryWorkflowInput` 이 `exec.inputData` 를 그대로 echo/기본값 반환하는 순수 로직이라 인스턴스가 바뀌어도 두 테스트의 기대값에는 영향이 없다. 프로덕션 코드·공개 API·전역 상태에는 어떤 영향도 없다.
  - 제안: 조치 불필요(이미 올바른 방향). 참고로 이런 "nested describe 안에서 sibling describe 의 스코프 밖 변수 오참조" 류는 ts-jest 설정이 `isolatedModules`(타입체크 스킵) 인 경우 컴파일 시점엔 안 잡히고 런타임에만 터지므로, 유사 패턴 재발 방지를 위해 private-method 접근용 헬퍼(`call`/`subject`)를 정의할 때 해당 describe 스코프의 인스턴스 변수명을 일관되게 쓰는 리뷰 관행을 유지하면 좋다.

- **[없음]** `PROJECT.md`, `plan/in-progress/e2e-retry-visibility-followup.md` 변경은 문서 전용(컨벤션 텍스트 추가, plan 완료 마킹)으로 side effect 관점에서 지적 사항 없음.

### 요약
4개 변경 파일 중 실제 런타임 부작용 소지가 있는 것은 신규 unit 가드 파일(`e2e-no-sub-global-timeout.test.ts`) 뿐이며, 이는 `e2e/**` 와 `playwright.config.ts` 를 읽기 전용으로 스캔하는 CI 가드로 기존 저장소의 다른 build-time 가드들과 동일한 안전한 패턴이다(쓰기·네트워크·환경변수 접근 없음, fail-closed 설계). backend spec 파일의 1줄 변경은 공개 API 나 프로덕션 코드에 영향 없는 테스트 전용 스코프 버그(`service`→`svcMetrics`) 교정으로, git 이력상 사전 존재하던 `ReferenceError` 를 바로잡은 것이며 신규 부작용을 만들지 않는다. `PROJECT.md`·plan 문서 변경은 순수 텍스트다. 전역 변수, 함수/API 시그니처, 환경 변수, 네트워크 호출, 이벤트/콜백 어느 관점에서도 의도치 않은 부작용은 발견되지 않았다.

### 위험도
NONE