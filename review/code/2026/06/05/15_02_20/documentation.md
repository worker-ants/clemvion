# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] continuation-execution.processor.ts — 클래스 JSDoc의 `applyCancellation` 서술이 Phase B 이전 시제로 잔존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` 클래스 JSDoc (L107–137 전체 블록)
- 상세: 클래스 레벨 JSDoc은 `applyCancellation` 의 동작 변경(void→async Promise<void>)을 별도 언급하지 않는다. diff에서 `applyCancellation` 관련 JSDoc은 메서드 직전 블록에 Phase B 양 갈래(`rejectPending` vs `cancelParkedExecution`)가 잘 기술됐으나, 클래스 JSDoc의 "처리 흐름" 목록과 "실패 처리" 항목에 cancel 의 새 동작(park-release 후 DB-직접 마감)에 대한 언급이 없다. 클래스 JSDoc은 resume 경로만 열거한다.
- 제안: 클래스 JSDoc의 처리 흐름 목록 또는 별도 단락에 "cancel — Phase B: 코루틴 생존 시 rejectPending, 코루틴 없는 WAITING 시 cancelParkedExecution(DB-직접 CANCELLED 마감)" 한 줄 추가.

### [INFO] `PARK_RELEASED` / `ParkMode` — 타입 정의가 모듈-레벨이나 JSDoc이 단일 블록에 압축됨
- 위치: `execution-engine.service.ts` L672–687
- 상세: `PARK_RELEASED` Symbol, `ParkSignal` 타입, `ParkMode` 타입 세 개가 L672–687에 함께 선언되며 단일 JSDoc 블록으로 설명된다. `ParkMode` 의 인라인 설명(`'release'` vs `'await'` 의 차이)은 한 줄 주석(`/** ... */`)으로 별도 기술돼 있는데, 충분히 명확하다. 다만 `ParkSignal = typeof PARK_RELEASED` 타입의 독립 JSDoc은 없다. 현행 수준은 내부 구현 식별자로서 허용 범위이나, 향후 `waitForFormSubmission`/`waitForButtonInteraction` 시그니처(`Promise<void | ParkSignal>`)를 읽는 독자가 `ParkSignal` 정의를 추적하기 번거로울 수 있다.
- 제안: `ParkSignal` 에도 한 줄 JSDoc(`/** PARK_RELEASED 의 타입 별칭. waitForX 반환값 타입 식별자. */`)을 추가하거나, `PARK_RELEASED` 블록 JSDoc에 "이 타입은 ParkSignal 참조" 크로스-링크 한 줄 삽입.

### [INFO] `waitForFormSubmission` / `waitForButtonInteraction` — 시그니처 변경이 함수 JSDoc에 미반영
- 위치: `execution-engine.service.ts` L3581–3584 (`waitForFormSubmission`), L6173–6175 (`waitForButtonInteraction`)
- 상세: 두 메서드의 시그니처가 `parkMode: ParkMode = 'await'` 파라미터 추가 + 반환 타입 `Promise<void | ParkSignal>` 로 변경됐다. diff에서 인라인 주석(Phase B 설명)은 추가됐지만, 메서드 JSDoc(함수 선두 `/** ... */` 블록)이 업데이트됐는지 diff에 포함되지 않았다. 만약 기존 JSDoc이 `@param` / `@returns` 를 갖고 있다면 누락된 `parkMode` 파라미터와 갱신되지 않은 `@returns void` 가 오래된 주석이 된다.
- 제안: 두 메서드 JSDoc에 `@param parkMode 'release'=fresh top-level park 즉시 반환(PARK_RELEASED), 'await'=입력 대기(중첩/resume 재진입)` 및 `@returns void | ParkSignal — parkMode==='release'이면 PARK_RELEASED, 아니면 void` 를 추가.

### [INFO] `cancelParkedExecution` — private 메서드 JSDoc은 상세하나 `@throws` 불기술
- 위치: `execution-engine.service.ts` L725 `cancelParkedExecution` JSDoc
- 상세: JSDoc이 DB-레벨 멱등 동작과 종착점을 잘 설명한다. 단, try-catch 내부에서 `this.logger.error`로 소화하는 DB 오류의 흡수 정책(예외 전파 안 함)에 대한 언급이 없다. 호출자(`applyCancellation`)가 이 메서드 실패 시 undefined를 반환받아 조용히 실패함을 알 수 없다.
- 제안: JSDoc에 `@remarks DB 오류는 내부 흡수(logger.error) — 호출자에 예외 전파 없음. cancel 은 best-effort.` 한 줄 추가.

### [INFO] `runNodeDispatchLoop` — 반환 타입 변경이 JSDoc에 미반영
- 위치: `execution-engine.service.ts` L1771 `runNodeDispatchLoop` 시그니처 변경 (`Promise<void>` → `Promise<{ parked: boolean }>`)
- 상세: 반환 타입이 변경됐으나 이 메서드의 JSDoc `@returns` 가 업데이트됐는지 diff에 나타나지 않는다. 기존 JSDoc이 `@returns void` 또는 `@returns Promise<void>` 를 명시하고 있었다면 오래된 주석이 된다. 인라인 주석은 `{ parked: true }` / `{ parked: false }` 의 의미를 적절히 설명하지만 공식 JSDoc에는 없을 수 있다.
- 제안: JSDoc `@returns` 를 `Promise<{ parked: boolean }> — parked: true 이면 downstream top-level park 발생(세그먼트 종료), false 이면 자연 종결(completion 진행).` 으로 갱신.

### [INFO] e2e 테스트 파일 — 모듈 레벨 JSDoc이 검증 대상 spec 앵커를 충분히 커버하나 `@see` 링크 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/test/execution-park-resume.e2e-spec.ts` L994–1013
- 상세: 파일 상단 블록 주석이 검증 배경·핵심 불변식·검증 항목을 명확히 서술한다. 문서화 품질은 높은 편이다. 다만 참조하는 spec 앵커(`spec/5-system/4-execution-engine.md §4.x`, `§7.5`)에 대한 `@see` 또는 파일 경로 링크가 없어 spec 파일을 열지 않으면 앵커를 추적하기 어렵다. 이는 선호 사항이며 차단 수준 이슈는 아니다.
- 제안: 블록 주석에 `* @see spec/5-system/4-execution-engine.md §4.x, §7.5` 한 줄 추가.

### [INFO] `flushResumeDrive` 함수 — JSDoc이 새로 추가됐으나 타임아웃 기본값 근거가 주석에만 있음
- 위치: `execution-engine.service.spec.ts` L219–228 `flushResumeDrive` 함수 JSDoc
- 상세: JSDoc이 `ms=40` 기본값의 근거(`setTimeout(0) + 20ms 폴링 → 40ms 커버`)를 명시해 의도를 잘 전달한다. 품질 양호.
- 제안: 현행 수준 유지. 개선 여지 없음.

### [INFO] `armSlowPathResume` 헬퍼 — 인라인 주석 밀도가 높고 유용하나 함수 앞 JSDoc 블록이 없음
- 위치: `execution-engine.service.spec.ts` L259–311 `armSlowPathResume` const 함수
- 상세: 함수 선언 전 블록 주석(L247–258)이 역할·mock 전략·참조 패턴을 잘 설명한다. 다만 이 주석은 `const armSlowPathResume =` 선언 앞의 일반 블록 주석으로 JSDoc 스타일(`/** ... */`)이 아니다. 테스트 내부 헬퍼이므로 JSDoc 필수 요건은 아니지만, 매개변수(`waitingNodeId`, `nodeDef`) 설명이 주석에 없어 시그니처를 직접 읽어야 한다.
- 제안: 블록 주석을 JSDoc(`/** ... @param waitingNodeId ... @param nodeDef ... */`)으로 전환하거나 현행 유지. 블로킹 이슈 아님.

### [INFO] `plan/in-progress/exec-park-durable-resume.md` — PR-B1 완료 표기와 실제 spec 갱신 현황 불일치 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/plan/in-progress/exec-park-durable-resume.md` L1261–1262 (Phase B 선행 완료 표기)
- 상세: `"[Phase B 선행 — 완료 2026-06-05] spec 모델 개정: ..."` 에서 완료 항목이 일괄 나열됐다. consistency check SUMMARY(W1/W2)에서 `data-flow/3-execution.md` 시퀀스 다이어그램과 `4-nodes/6-presentation/0-common.md` L413 의 fast-path 관련 서술이 Phase B 모델로 갱신되지 않았음이 WARNING 으로 남아 있다. 이는 "Phase B 착수 전 spec 갱신" 완료 표기와 상충한다. plan 문서가 완료 상태로 기록됐으나 실제 spec 파일 두 곳이 여전히 구 모델을 서술한다.
- 제안: plan 문서의 해당 완료 표기에 `(단, data-flow/3-execution.md W1·0-common.md W2 는 Phase B 구현 PR 에서 동기 갱신 예정 — consistency SUMMARY 참조)` 단서를 추가해 완료 범위를 명확화.

### [WARNING] `spec/data-flow/3-execution.md` — Phase B 변경이 반영되지 않은 시퀀스 다이어그램
- 위치: consistency check SUMMARY W1 참조 (`spec/data-flow/3-execution.md` L111 `alt 로컬 pendingContinuations hit` 분기)
- 상세: `execution-engine.service.ts` 의 `applyCancellation` async 전환, `waitForFormSubmission`/`waitForButtonInteraction` 의 PARK_RELEASED 반환, `runNodeDispatchLoop` 의 `{ parked }` 반환 등 핵심 동작 변경이 이미 구현 완료됐으나, `data-flow/3-execution.md` 의 시퀀스 다이어그램에서 `alt 로컬 pendingContinuations hit (fast path)` 분기가 삭제되지 않았다. 이 다이어그램을 읽는 개발자는 fast-path가 여전히 존재하는 것으로 오해할 수 있다.
- 제안: Phase B 구현 PR(현재 또는 PR-B2) 범위에 `spec/data-flow/3-execution.md` 다이어그램 갱신(fast-path `alt` 분기 제거, slow-path 단일 경로 기술)을 명시적으로 포함시킨다.

### [WARNING] `spec/4-nodes/6-presentation/0-common.md` L413 — `pendingContinuations` 기반 invariant 서술이 Phase B 모델과 충돌
- 위치: consistency check SUMMARY W2 참조 (`spec/4-nodes/6-presentation/0-common.md` L413)
- 상세: form/button 재개가 `pendingContinuations` 에 등록하지 않고 slow-path rehydration 으로 일원화됐음에도, `0-common.md` 의 해당 서술이 이를 반영하지 않는다. API 문서·spec 이 구현과 불일치한다.
- 제안: Phase B PR 또는 별도 spec 갱신 PR에서 `0-common.md` L413 의 invariant 서술을 rehydration 모델 기준으로 재작성. consistency SUMMARY 의 W2 권장 조치를 plan 체크박스에 추가.

---

## 요약

이번 변경은 `applyCancellation` 의 async 전환, `waitForFormSubmission`/`waitForButtonInteraction` 의 PARK_RELEASED sentinel 도입, `runNodeDispatchLoop` 의 `{ parked }` 반환 등 핵심 실행 엔진 인터페이스 변경을 포함한다. 인라인 주석과 Phase B 표기는 전반적으로 상세하고 의도를 잘 전달하나, 변경된 메서드 시그니처(`waitForFormSubmission`, `waitForButtonInteraction`, `runNodeDispatchLoop`) 의 JSDoc `@param`/`@returns` 갱신이 diff에 확인되지 않으며, 클래스 레벨 JSDoc에도 cancel의 새 동작이 누락돼 있다. 더 중요한 점은 구현이 완료됐음에도 `spec/data-flow/3-execution.md` 시퀀스 다이어그램과 `spec/4-nodes/6-presentation/0-common.md` L413 가 구 fast-path 모델을 여전히 기술하고 있어, spec과 구현 사이에 가시적 불일치가 발생하고 있다는 것이다. plan 문서의 "Phase B spec 갱신 완료" 표기도 이 두 파일을 커버하지 못한 채 완료로 기록돼 있어 범위 명확화가 필요하다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
