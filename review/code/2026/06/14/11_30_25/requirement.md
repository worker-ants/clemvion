# 요구사항(Requirement) Review

## 발견사항

### [WARNING] [SPEC-DRIFT] `spec/5-system/4-execution-engine.md §7.5.2` 가 main 워크트리 spec 에 부재 — worktree spec 에만 반영됨

- 위치: `spec/5-system/4-execution-engine.md` (main 워크트리 기준)
- 상세: 코드 전반에서 참조하는 `spec §7.5.2`(`ExecutionError` typed error 계약·누출 차단 ack 정책)는 **worktree 의 spec 에는 정상 반영**돼 있으나(§7.5.2 신설 확인), 이 reviewer 가 읽을 수 있는 **main 워크트리의 `spec/5-system/4-execution-engine.md` 에는 §7.5.1 다음에 §7.5.2 가 없다**. 이는 PR 머지 전 상태이므로 worktree 가 권위이며 코드의 구현 방향은 올바르다. 단, spec 은 아직 main 에 없는 상태다.
- 제안: 코드 유지. spec 반영(§7.5.2 신설)은 이미 worktree 에 존재하고 본 PR 에 포함됐으므로 머지 시 자동 해결된다. `[SPEC-DRIFT]` 로 기록하되 blocking 아님.

---

### [INFO] 테스트에서 `continueAiConversation` 이 동일 입력으로 두 번 호출됨 — `mockBus.publish` 검증 불완전 가능성

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (diff 파일 1, +44~+55)
- 상세: 변경된 테스트는 `tooLong` 으로 `continueAiConversation` 을 **두 번 호출**한다. 첫 번째는 `rejects.toBeInstanceOf(MessageTooLongError)` 를, 두 번째는 `rejects.toThrow('Message exceeds the maximum allowed length.')` 를 검증한다. 이는 기능상 올바르나 `expect(mockBus.publish).not.toHaveBeenCalled()` 는 두 번의 호출 이후에 위치하므로 두 번 모두 publish 하지 않았음을 검증한다 — 의도와 일치한다. 다만, 두 번 호출은 중복이며 단일 호출로 `.toBeInstanceOf` + `.toThrow` 를 chaining 해 단순화할 수 있다. 기능 오류는 아님.
- 제안: 필요 시 단일 `expect` 체인으로 리팩터링. 현재 동작 오류 없으므로 INFO.

---

### [INFO] `ExecutionTimeLimitError` 는 아직 `ExecutionError` 기반으로 흡수되지 않음

- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (전체 컨텍스트)
- 상세: spec §7.5.2 는 "기존 `ExecutionTimeLimitError`·`InvalidExecutionStateError`·`RetryLastTurnError` 가 `ExecutionError` 기반 점진 흡수 대상" 이라고 명시한다. `InvalidExecutionStateError` 와 `RetryLastTurnError` 는 이번 변경으로 `ExecutionError` 를 상속하도록 변경됐으나, `ExecutionTimeLimitError` 는 여전히 `extends Error` 다. 단, `ExecutionTimeLimitError` 는 continuation ack 경로에 도달하지 않으므로 현재 누출 차단 목적과는 무관하고, spec 도 "점진적 흡수" 라고 표현해 이번 범위 내 완료를 요구하지 않는다.
- 제안: 후속 PR 에서 흡수 가능. 현재 spec 의 "점진적" 표현과 일치하므로 INFO.

---

### [INFO] `EXECUTION_MESSAGE_TOO_LONG` 의 EIA REST 진입점 에러 처리 미정의

- 위치: `spec/5-system/4-execution-engine.md §7.5.2`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: `continueAiConversation` 은 WS gateway 경로(`handleSubmitMessage`)로만 typed 에러를 surface 한다. EIA(`interaction.service.ts`) REST 경로가 동일 함수를 호출할 경우 `MessageTooLongError` 가 HTTP 응답에서 어떤 status/body 로 변환될지 미정의다. consistency-check 보고서의 I2 항목과 동일 관찰이다.
- 제안: EIA 경로에서 `MessageTooLongError` → 400/422 변환 처리 추가 또는 spec §14(EIA) 에 에러 표 추가. 현재 기능 범위 밖이므로 INFO.

---

## 요약

이번 변경은 continuation ack 경로의 내부 메시지 누출 차단이라는 보안 요구사항을 완전히 충족한다. `ExecutionError` 계층 구조, `MessageTooLongError` 신규 에러 클래스, `buildContinuationErrorAck` 재작성, 프론트엔드 code→i18n 매핑이 spec §7.5.2(worktree 기준)와 line-level 로 일치하며 기능 완전성·엣지 케이스·에러 시나리오·데이터 유효성·비즈니스 로직 전반에서 누락을 발견하지 못했다. SPEC-DRIFT 항목 하나(worktree spec vs main spec 의 상태 차이)는 PR 머지로 자연 해소되며 코드 수정 대상이 아니다. 잔여 INFO 3건은 EIA 경로 처리 미정의·`ExecutionTimeLimitError` 점진 흡수 미완·테스트 중복 호출로, 모두 현재 구현 범위 내 허용 수준이다. 기능 요구사항 충족 관점에서 차단 이유 없음.

---

## 위험도

LOW
