# Cross-Spec 일관성 검토 — `spec/5-system/4-execution-engine.md` (impl-done)

## 검토 대상 요약

이번 diff 는 `ExecutionEngineService` 의 초기 세그먼트(`runExecution` catch)와 재개 세그먼트
(`finalizeResumedExecutionOutcome`) 에 중복돼 있던 FAILED 종결 처리(상태 마킹 · error 봉인 ·
`finishedAt`/`durationMs` · DB save · `EXECUTION_FAILED` WS emit · `execution_failed` 알림 dispatch)를
`finalizeFailedExecution()` 단일 private 헬퍼로 추출한 **behavior-preserving 리팩터링**이다
(`plan/in-progress/notif-followup-refactor.md` 에 明示). spec 본문 변경은
`spec/5-system/4-execution-engine.md` §4.4 "이벤트 발행 sink" 절의 순환 DI 해법 표 추가뿐이며, 이는
이전 PR #841 에서 이미 도입된 `ModuleRef.get(strict:false)` 패턴(`getNotificationsService`)을
사후 문서화한 것이다.

## 발견사항

특별한 CRITICAL/WARNING 없음. 다음은 확인 결과(문제 아님, 참고용 INFO):

- **[INFO] 헬퍼 추출 자체는 spec 본문에 별도 서술 없음 — 문제 아님**
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 신규 `finalizeFailedExecution` (라인 4399 부근)
  - 충돌 대상: `spec/data-flow/8-notifications.md` §1.1 `execution_failed` 행
  - 상세: notifications spec 은 이미 "초기 세그먼트 `runExecution` catch **및** 재개 세그먼트
    `finalizeResumedExecutionOutcome` **양쪽**에서 발사해야 누락이 없다" 고 명시하고 있고, 이번 diff
    는 정확히 이 요구사항을 두 호출부가 공유하는 단일 헬퍼로 구조적으로 보장하는 리팩터링이다.
    함수명(`finalizeResumedExecutionOutcome`, `dispatchExecutionFailedNotification`)도 spec 서술과
    일치해 spec-코드 매핑이 어긋나지 않는다. `finalizeFailedExecution` 이라는 새 private 헬퍼 이름
    자체는 spec 이 규정할 필요가 없는 구현 세부라 spec 미기재가 정합성 위반이 아니다.
  - 제안: 없음 (현행 유지로 충분).

- **[INFO] `Execution.error` shape (`{nodeId, code, message}`, `spec/1-data-model.md` §2.13) 과
  실제 저장 payload(`{message, code?}`, nodeId 없음) 의 불일치는 기존 존재 — 본 diff 가 새로 유발한
  회귀 아님**
  - target 위치: `finalizeFailedExecution` 내 `savedExecution.error = { message, ...(code?) }`
  - 충돌 대상: `spec/1-data-model.md` §2.13 Execution.error 설명(`{ nodeId: "uuid", code, message }`)
  - 상세: 이 shape 은 diff 이전에도 두 종결 경로(`runExecution` catch, `finalizeResumedExecutionOutcome`)
    각각에 동일하게 존재했던 패턴이며, 이번 커밋은 그 코드를 옮겼을 뿐 shape 을 바꾸지 않았다
    (`git diff` 상 `-`/`+` 라인이 로직 동일, opt 파라미터만 추가). 따라서 본 리팩터링 PR 의 범위에서
    새로 발생한 cross-spec 충돌이 아니다. 다만 데이터 모델 문서 자체의 selfconsistency 문제로는
    여전히 존재하므로, 별도 spec 정합화 작업(§2.13 Execution.error 문서를 `nodeId` 없는 top-level
    실패 케이스까지 포괄하도록 수정하거나, 코드에 nodeId 를 채우는 결정)을 이번 PR 과 무관하게
    백로그로 남길 것을 권고한다 (BLOCK 사유는 아님).
  - 제안: 이번 PR 범위 밖. 별도 spec-drift 정리 항목으로 트래킹 권장 (`plan/in-progress` 백로그 후보).

## 요약

이번 diff 는 실행 엔진의 FAILED 종결 로직을 공유 헬퍼로 통합하는 순수 내부 리팩터링으로, 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 새로운 모순을
만들지 않는다. `spec/data-flow/8-notifications.md` §1.1 이 이미 규정한 "두 세그먼트 모두 발사" 요구를
구조적으로 강화하는 방향이며, `spec/5-system/4-execution-engine.md` §4.4 에 반영된 spec 변경(순환 DI
해법 표)도 기존 PR #841 결정의 사후 문서화로 코드와 정합한다. 유일하게 언급할 만한 점은
`Execution.error` shape 관련 data-model 문서의 선재(pre-existing) 불일치이나, 이는 본 diff 가 유발한
것이 아니라 이전부터 있던 사안이라 이번 검토의 BLOCK 사유는 아니다.

## 위험도

NONE
