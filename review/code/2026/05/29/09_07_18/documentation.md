# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `ContinuationDlqMonitorService` 클래스 독스트링 — 우수
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` L12–40
- 상세: 클래스 수준 JSDoc이 설계 의도(dead-letter 누적 구조, rehydration 회귀 탐지), 알람 동작(structured `logger.error`, cooldown 1회), 환경변수 4개와 기본값, OTel 미사용 이유까지 전부 포괄한다. `parsePositiveInt` 함수에도 짧은 독스트링이 있어 동작과 선례(`SHUTDOWN_GRACE_MS` W-2 fix)를 명시한다.
- 제안: 현 상태 양호, 추가 조치 불필요.

### [INFO] `checkOnce` 메서드 독스트링 — 양호
- 위치: `continuation-dlq-monitor.service.ts` L53–57
- 상세: "테스트 진입점" 역할(interval 없이 직접 호출 가능)과 실패 삼키기(워커 비차단) 정책이 주석에 명시돼 있다.
- 제안: 현 상태 양호.

### [INFO] `onFailed` 메서드 독스트링 — 양호
- 위치: `continuation-execution.processor.ts` L83–90 (diff 기준 추가 블록)
- 상세: Phase 3.1 태그, RETRY/DEAD-LETTER 분기 의미, spec §7.5 참조, DLQ 추세 관측은 `ContinuationDlqMonitorService`에서 별도 처리함을 명시하고 있다.
- 제안: 현 상태 양호.

### [INFO] `InvalidExecutionStateError` 클래스 독스트링 — 양호
- 위치: `execution-engine.service.ts` (diff 기준 신설 export 클래스 블록)
- 상세: spec §7.5.1 참조, 0건/다중 row 시나리오, WS/REST/EIA 각 surface 방식, `RehydrationError`와의 직교성 설명이 포함돼 있다.
- 제안: 현 상태 양호.

### [WARNING] WS gateway ack 응답에 신설된 `errorCode` 필드가 WebSocket 프로토콜 spec에 미반영
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L362, L444, L520, L595 (4개 handler 반환 타입에 `errorCode?: string` 추가)
- 상세: `spec/5-system/6-websocket-protocol.md`의 "공통 ack success payload shape" 표 및 예제 JSON에는 `error` 필드는 있으나 `errorCode` 필드가 명시돼 있지 않다. `INVALID_EXECUTION_STATE` 에러 코드 자체는 §7.5.1(execution-engine spec)과 §6-websocket-protocol.md 에러 코드 표에 등재돼 있지만, ack 실패 시 `error` (string) 외에 `errorCode`라는 별도 필드로 코드를 운반한다는 transport-shape 변경이 WebSocket 프로토콜 spec에는 기록되지 않았다. 프론트엔드 개발자가 `INVALID_EXECUTION_STATE`를 programmatic하게 처리하려면 이 필드를 알아야 한다.
- 제안: `spec/5-system/6-websocket-protocol.md`의 공통 ack error payload 설명(또는 에러 코드 표 하단 비고)에 "실패 ack에는 `error: string` 외에 `errorCode?: string` 필드가 포함될 수 있다(현재 값: `INVALID_EXECUTION_STATE`)" 를 추가한다.

### [WARNING] `resolveWaitingNodeExecutionId` JSDoc Phase 태그가 변경 이력과 불일치
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`의 `resolveWaitingNodeExecutionId` 메서드 주석 첫 줄
- 상세: diff에서 주석 본문은 새로운 동작(0건/다중 row → `InvalidExecutionStateError` throw, DB infra 실패 → 원본 에러 전파)으로 업데이트됐다. 그러나 주석 첫 줄 "Phase 2 (workflow-resumable-execution)" 태그가 그대로 유지되는 반면 실제 throw 동작 추가는 "변경 2.3 (Phase 3)"에 해당한다. 기능 이해를 방해하는 수준은 아니지만 이력 추적 시 혼란이 생길 수 있다.
- 제안: 주석 첫 줄을 "Phase 2 / 변경 2.3 (Phase 3) —" 형태로 조정하거나, 변경 2.3 동작 항목 앞에 인라인 태그를 추가한다.

### [INFO] `dispatchContinuation` 독스트링 — 양호
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` L266–275
- 상세: spec §7.5.1 참조, 에러 매핑 의미(`STATE_MISMATCH`), `assertWaiting` 선검증 후 race window 보강 역할이 주석에 명확히 기술돼 있다.
- 제안: 현 상태 양호.

### [INFO] REST `continueExecution` 핸들러의 인라인 주석 — 양호
- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` L154
- 상세: `spec §7.5.1` 참조, 422 INVALID_STATE 동기 surface 의미, WS gateway와의 일관성이 한 줄 주석으로 설명된다.
- 제안: 현 상태 양호.

### [INFO] spec `§9.3` Dead-letter 모니터링 섹션 신설 — 우수
- 위치: `spec/5-system/4-execution-engine.md` (diff 기준 추가 블록 "Dead-letter 모니터링 (Phase 3.1)")
- 상세: 환경변수 표, `ContinuationDlqMonitorService` 역할, worker `onFailed` 태그가 spec에 추가돼 코드와 spec이 일치한다.
- 제안: 현 상태 양호.

### [INFO] `spec §7.5.1` 구현 상태 노트 업데이트 — 양호
- 위치: `spec/5-system/4-execution-engine.md` `> **구현 상태**` 블록
- 상세: 이전의 "후속 PR 예정" 문구가 "적용 완료" + 각 진입점별 surface 방식으로 대체돼 stale 주석이 해소됐다.
- 제안: 현 상태 양호.

### [INFO] plan 파일 — 체크박스 및 설명 충실
- 위치: `plan/in-progress/workflow-resumable-execution.md`
- 상세: Phase 3.1 및 변경 2.3 태스크가 완료 처리됐고, 신규 env 변수 목록·서비스명·테스트 수까지 plan에 기록돼 변경 이력 추적이 용이하다.
- 제안: 현 상태 양호.

### [INFO] 신규 테스트 파일에 파일 수준 독스트링 부재 (LOW)
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.spec.ts` 파일 상단
- 상세: 기존 `continuation-execution.processor.spec.ts`는 파일 상단에 검증 범위를 열거하는 JSDoc("C5 — ContinuationExecutionProcessor 단위 테스트. 검증 범위: ...")이 있으나, 신규 `continuation-dlq-monitor.service.spec.ts`에는 파일 수준 주석이 없다. `describe`·`it` 명칭만으로 의도는 파악되나, 파일 수준 JSDoc이 있으면 검증 범위를 한눈에 확인하는 컨벤션이 일관되게 유지된다.
- 제안: `continuation-dlq-monitor.service.spec.ts` 상단에 간략한 파일 수준 JSDoc 추가를 권장하나 필수 아님.

### [INFO] CHANGELOG 별도 관리 없음 — 현 체계로 충분
- 위치: 프로젝트 루트
- 상세: 이 프로젝트는 `plan/` 파일로 변경 이력을 관리하며, plan 파일에 변경 사항이 충분히 기록돼 있다. 별도 CHANGELOG.md 필요 없음.
- 제안: 현 체계 유지.

---

## 요약

이번 변경(Phase 3.1 DLQ 모니터 신설 + 변경 2.3 `INVALID_EXECUTION_STATE` 동기 surface)은 전반적으로 문서화 품질이 높다. 클래스·메서드 수준 JSDoc이 설계 의도·spec 참조·환경변수까지 망라하고, spec `§9.3`과 `§7.5.1`도 코드 변경에 맞춰 갱신됐다. 한 가지 주목할 간극은 WebSocket gateway에 신설된 `errorCode?: string` ack 필드가 `spec/5-system/6-websocket-protocol.md`의 ack 페이로드 형식 설명에 반영되지 않아, 프론트엔드 개발자가 프로그래밍 방식으로 `INVALID_EXECUTION_STATE`를 처리할 때 필요한 transport-level 계약이 누락된 상태다. `resolveWaitingNodeExecutionId` 메서드 주석의 Phase 태그 표기도 소폭 불일치가 있으나 기능 이해를 방해하지는 않는다.

## 위험도

LOW
