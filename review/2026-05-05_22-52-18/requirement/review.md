### 발견사항

---

**[WARNING] `WorkflowExecutor` 인터페이스 업데이트 미확인**
- 위치: `execution-engine.service.ts` — `implements WorkflowExecutor`
- 상세: `execute()` 3번째 파라미터가 `executedBy?: string` → `options?: { executedBy?; triggerId? }`로 변경됐는데, diff에 `WorkflowExecutor` 인터페이스 파일 수정이 없다. 인터페이스와 구현 시그니처가 불일치하면 TypeScript 컴파일 에러가 발생한다. 빌드 통과 여부로만 확인 가능하며, 현재 diff만으로는 인터페이스 갱신 여부를 판단할 수 없다.
- 제안: `WorkflowExecutor` 인터페이스 선언 파일을 직접 확인하여 3번째 파라미터가 일치하는지 검증

---

**[WARNING] `spec/2-navigation/3-schedule.md` 업데이트 누락**
- 위치: `plan/in-progress/execution-trigger-metadata-fix.md` 작업 항목
- 상세: plan 문서에 "spec/2-navigation/3-schedule.md (해당 시) — cron 자동 실행 시 triggerId 채움 명시"가 체크 항목으로 명시되어 있으나, 해당 스펙 파일 변경이 diff에 포함되지 않았다. `4-execution-engine.md`와 `5-webhook.md`는 갱신됐지만 schedule 스펙이 불일치 상태로 남을 수 있다.
- 제안: `spec/2-navigation/3-schedule.md`에 `ScheduleRunnerService.process()`가 `{ triggerId: schedule.triggerId }`를 전달하는 흐름 명시, 또는 해당 파일이 존재하지 않아 불필요하다면 plan 항목에서 명시적으로 제거

---

**[WARNING] 다른 `execute()` 호출 지점 누락 가능성**
- 위치: 전체 백엔드 코드베이스
- 상세: plan에서 호출자 4곳을 명시했지만, `WorkflowExecutor` 인터페이스를 통해 간접적으로 호출하는 경로(예: 서브워크플로우 실행, E2E 테스트 시드, 관리자 유틸리티 등)가 diff에 포함되지 않은 파일에 있을 수 있다. 구 시그니처 `execute(workflowId, input, executedByString)` 형태로 남아 있으면 TypeScript가 `string` → `{ executedBy?: string }` 타입 오류를 발생시키지 않으므로(3번째 인자는 optional), 런타임에 무시되는 `executedBy`가 생길 수 있다.
- 제안: `executionEngineService.execute(` 전체 grep으로 누락 호출자 없는지 최종 확인

---

**[INFO] `?? undefined` 패턴 중복**
- 위치: `execution-engine.service.ts:384-385`
- 상세: `options?.executedBy ?? undefined`는 `options?.executedBy`가 이미 `undefined`를 반환하므로 `?? undefined` 부분이 불필요하다. 기능적으로는 무해하나, 명시적 의도(null 방어)라면 타입이 `string | null`인 경우에만 의미가 있다.
- 제안: `executedBy: options?.executedBy, triggerId: options?.triggerId`로 단순화

---

**[INFO] `executedBy`와 `triggerId` 동시 전달 케이스 미테스트**
- 위치: `execution-engine.service.spec.ts` — `execute() — trigger metadata persistence`
- 상세: 세 가지 케이스(executedBy만, triggerId만, 둘 다 없음)가 테스트됐지만 둘 다 동시에 전달하는 케이스가 없다. 비즈니스 규칙상 `deriveExecutionTrigger`의 우선순위(subworkflow > manual > schedule > webhook)로 처리되겠지만, 어느 caller도 두 값을 동시에 보내면 안 된다는 규약이 명시적으로 검증되지 않는다.
- 제안: `{ executedBy: 'u1', triggerId: 't1' }` 동시 전달 시 두 값이 모두 저장됨을 명시하거나, 타입 레벨에서 XOR(`executedBy`만 또는 `triggerId`만) 강제를 고려

---

**[INFO] plan 문서 체크박스 미갱신**
- 위치: `plan/in-progress/execution-trigger-metadata-fix.md`
- 상세: 파일이 신규 생성되었고 현재 구현이 완료된 항목(시그니처 변경, 4개 호출자 마이그레이션, 테스트, 스펙 일부)이 모두 `[ ]`로 남아 있다. CLAUDE.md 규약상 작업 완료 시 plan 문서를 갱신하고 완료 항목을 체크해야 한다.
- 제안: 완료된 항목을 `[x]`로 갱신하고, 잔여 항목(TEST WORKFLOW, REVIEW WORKFLOW, schedule 스펙)이 남아있으면 `in-progress` 유지; 전부 완료 시 `complete/`로 `git mv`

---

### 요약

핵심 요구사항(스케줄/웹훅 실행의 `triggerId` 미기록 버그 수정)은 올바르게 구현되었다. `execute()` 시그니처 객체화, 4개 호출자 마이그레이션, 스펙 문서 갱신이 일관되게 이루어졌으며, 테스트도 각 출처별 저장 경로를 검증한다. 다만 `WorkflowExecutor` 인터페이스 파일의 갱신 여부가 diff에서 확인되지 않아 컴파일 안전성에 불확실성이 있고, plan에 명시된 `spec/2-navigation/3-schedule.md` 갱신이 누락되어 있으며, plan 문서 자체가 완료 항목을 반영하지 않은 상태다.

### 위험도

**MEDIUM** — `WorkflowExecutor` 인터페이스 미확인이 컴파일 오류 또는 다른 호출자의 silent regression으로 이어질 수 있으며, 스펙 불일치가 누적될 경우 향후 유지보수 오류를 유발할 수 있다.