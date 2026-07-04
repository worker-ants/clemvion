# 부작용(Side Effect) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit, 회귀 테스트 3건 추가)
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (e2e, 헬퍼 시그니처 확장 + 테스트 1건 추가)

TEST-ONLY 변경. 프로덕션 코드(`*.service.ts` 등) 변경 없음 — `git diff origin/main...HEAD --stat` 로 payload 와 실제 diff 일치 확인 완료 (동일 2개 코드 파일 + `review/consistency/**` 산출물만 변경).

## 발견사항

- **[INFO]** e2e 헬퍼 4종(`createCapWorkflow`/`execute`/`getStatus`/`poll`)에 optional 파라미터 추가 — 기존 2개 테스트 동작 불변 확인
  - 위치: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` L1779-1891 (신 시그니처), 기존 테스트 L1893-1933
  - 상세:
    - `createCapWorkflow(wsId = workspaceId, workflowCap: number | null = 1)` — 인자 없이 호출하는 기존 두 테스트(L1894, L1918)는 `wsId=workspaceId`, `workflowCap=1`로 이전과 동일한 `UPDATE workflow SET settings = ...maxConcurrentExecutions:1` 을 그대로 실행. 다만 이전엔 하드코딩 리터럴 `'{"maxConcurrentExecutions":1}'::jsonb` 였고 지금은 `$2::jsonb` 파라미터 바인딩(`JSON.stringify({maxConcurrentExecutions: workflowCap})`)으로 변경 — 값·타입 동일(`1`)하므로 실행 결과는 동일. `workflowCap=null`일 때만 UPDATE 문 자체를 skip(조건부 `if (workflowCap !== null)`) — 신규 workspace-cap 테스트만 이 경로를 타므로 기존 두 테스트에는 영향 없음.
    - `execute(workflowId, wsId = workspaceId)`, `getStatus(executionId, wsId = workspaceId)`, `poll(executionId, predicate, timeoutMs = 20_000, wsId = workspaceId)` — 모두 기존 호출부(`execute(workflowId)`, `getStatus(execId)`, `poll(execId, predicate, 20_000)`)가 인자 개수 그대로이므로 default 값(`workspaceId`, 즉 최상위 `beforeAll`에서 생성된 공용 workspace) 이 적용되어 이전과 동일한 X-Workspace-Id 헤더로 요청. 시그니처 확장이되 기존 3개 테스트(`cap 초과 → pending...`, `cap 초과 지속 → cancelled...`, 그리고 이 파일의 사전 테스트)의 관측 가능한 동작은 불변.
    - 결론: default 파라미터 추가는 순수 하위호환 확장이며, 두 기존 테스트는 동일하게 동작한다.
  - 제안: 없음 (확인 목적 항목).

- **[INFO]** 신규 워크스페이스 cap e2e 테스트가 `createTeamWorkspace` 로 별도 workspace(`wsCapId`)를 매 실행 생성
  - 위치: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` L1938-1975
  - 상세: DB에 새 workspace/workflow row(및 `insertRunningBlocker`로 running Execution row, 이후 completed 로 전환)를 남긴다. 이는 기존 e2e 스타일(각 테스트가 `uniqueName`/`createTeamWorkspace`로 격리된 리소스를 만듦)과 일관되며, "예상치 못한" 부작용이 아니라 이 파일의 기존 패턴을 그대로 재사용한 것. `afterAll` 은 `db.end()` 만 수행하고 생성된 workspace/workflow/execution row 는 정리(clean-up)하지 않음 — 다만 이는 같은 파일의 기존 두 테스트도 동일 패턴(정리 없음)이므로 새로 도입된 회귀가 아니라 기존 e2e 컨벤션.
  - 제안: 없음. 필요 시 별도 review(테스트 위생)에서 e2e DB 정리 정책 자체를 다룰 사안이며 이번 diff 범위 밖.

- **[INFO]** unit 테스트 3건의 mock 상태 격리
  - 위치: `execution-engine.service.spec.ts` L3189-3230(admission UPDATE 파라미터 순서 회귀), L3492-3660(admitStub 기반 3건)
  - 상세: `mockWorkflowRepo.findOne.mockResolvedValueOnce(...)`, `mockExecutionRepo.manager.transaction = jest.fn(...)` 재할당, `jest.spyOn(...).mockRestore()` 패턴 모두 test-local 이며 `beforeEach` 에서 매 테스트 새 모듈/mock 이 구성되므로(L412 `beforeEach`) 테스트 간 전역 상태 누수 없음. `admitStub` 헬퍼가 `admitExecutionOrDefer`/`runExecution` 을 spy 하지만 각 `it` 블록 끝에서 `mockRestore()` 호출 확인.
  - 제안: 없음.

- **[INFO]** 시그니처/공개 API 영향 없음
  - 위치: 전체
  - 상세: 두 파일 모두 테스트 스코프 로컬 헬퍼 함수(`describe` 블록 내부)만 변경되었고, 프로덕션 서비스의 공개 메서드 시그니처(`admitExecutionOrDefer`, `runExecutionFromQueue` 등)는 변경되지 않음(테스트가 이를 spy/stub 할 뿐). 외부 소비자(다른 모듈, API 클라이언트)에 영향 없음.
  - 제안: 없음.

## 요약

두 파일 모두 테스트 코드에 한정된 변경이며 프로덕션 소스는 건드리지 않았다(payload와 `git diff origin/main...HEAD` 일치 확인). e2e 헬퍼 4종에 추가된 optional 파라미터는 모두 default 값이 기존 호출 시의 암묵적 동작(공용 `workspaceId`, workflow cap=1)과 동일하게 설계되어 있어 기존 2개 e2e 테스트의 관측 가능한 동작(요청 헤더, DB UPDATE 값, polling 대상)은 완전히 동일하게 유지된다. 신규 workspace-cap e2e 테스트와 unit 회귀 테스트 3건은 격리된 리소스/모듈 인스턴스를 사용해 전역 상태·다른 테스트에 부작용을 전파하지 않으며, 파일시스템·환경변수·네트워크 호출·이벤트 콜백 계약 변경도 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
