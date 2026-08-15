# 요구사항(Requirement) Review — 종결 emit 타입 초크포인트 (`eia-terminal-emit-facade`)

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 가 스스로 선언한 "단일 진실 목록" 표는 갱신되지 않고, 동결하기로 선언한 옛 라운드별 체크박스만 바뀌었다
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:368` (`### 코드 — 우선순위 순` 표의 `| 2 | ... cancelledBy 추가 ... | P2 | 5R W1 |` 행)
  - 상세: 이 문서 358~361행은 "위 라운드별 섹션은 **발견 이력(증거)**이라 그대로 둔다 … 아래를 **단일 진실 목록**으로 삼는다"고 명시하고, 그 아래 "코드 — 우선순위 순" 표를 완료 판정의 SoT로 지정한다(선례: 표 1행이 이미 "**P1 완료**"로 갱신돼 있다). 그런데 이번 diff(파일 7)는 그 SoT 표의 #2 행을 건드리지 않고, "동결" 하기로 선언한 305~317행의 "5R 신규 등재 후속 → W1" 체크박스만 `[x]`로 바꿨다. `eia-terminal-emit-facade.md` 체크리스트는 "자매 plan #2 흡수"를 완료로 주장하지만(파일 6, `- [x] 정본 트래커 닫기 + 수치 정정 + 자매 plan #2 흡수 + spec §6 각주 해소`), 문서 자신이 지정한 SoT 표는 여전히 미완료로 읽힌다. 실제로 이 정확한 리스크(체크박스가 두 군데 흩어질 때 SoT 아닌 쪽만 갱신)는 이 PR 착수 전 consistency-check plan_coherence 가 이미 WARNING #1(`review/consistency/2026/08/15/17_20_28/plan_coherence.md`)로 예견했고, 제안은 "구현 완료 시 같은 커밋/턴에서 `retry-turn-terminal-guard.md` #2 체크 + target spec §6 각주 제거를 함께 수행"이었다. 코드/spec 각주 쪽은 반영됐으나(§6 행 갱신 확인, `spec/5-system/14-external-interaction-api.md:579`) plan 의 SoT 표 쪽 절반이 빠졌다.
  - 제안: `plan/in-progress/retry-turn-terminal-guard.md:368` 행에 1행과 동일한 패턴으로 "**P2 완료**"(+ 근거: `eia-terminal-emit-facade.md`) 를 추가해 SoT 표와 실제 상태를 일치시킬 것. 코드 자체의 수정은 불필요.

- **[INFO]** `TerminalEventPayload` 의 `cancelled` variant 가 spec §6.5 보다 `error.message` 를 더 엄격하게 강제한다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:48` (`error?: { code: string; message: string };`)
  - 상세: spec 본문(`spec/5-system/14-external-interaction-api.md` `### execution.cancelled 의 행동 계약 (normative)`, "시스템 취소는 `error?: { code, message? }` 를 동행한다")은 `message` 를 **optional** 로 적는다. 코드 타입은 `message: string` 을 필수로 강제해 spec 보다 엄격하다. 현재 시스템 취소 3개 호출부(`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`)는 전부 리터럴 `message` 를 채우므로 런타임 결함은 아니며, 오히려 §6.4 `TerminalErrorPayload.message: string`(필수)과 형태를 통일한 결과로 읽힌다. 다만 line-level 로는 spec 본문과 타입 정의가 다르다 — spec 이 명시적으로 "optional" 이라 적은 조건을 코드가 좁혔다.
  - 제안: 코드 유지(관측된 실사용과 일관되고 오히려 더 안전한 방향). 위 발견은 spec 이 코드보다 느슨한 케이스이므로 코드 fix 대상은 아니며, `project-planner` 가 §6.5 문구를 "( `message` 는 현재 전 경로 필수)" 로 갱신할지 여부만 재량.

## 검증한 것 (결함 없음 확인)

- **직접 호출 이관 완전성**: `codebase/backend/src/modules/execution-engine/` 및 `codebase/backend/src/` 전체에서 `ExecutionEventType.EXECUTION_COMPLETED`/`FAILED`/`CANCELLED` 리터럴 직접 참조는 `execution-event-emitter.service.ts`(파사드 내부) 와 `websocket.service.ts`(enum 정의처) 두 곳뿐 — 플랜이 주장한 "직접 호출 11곳 → 0곳"이 grep 으로 확인됨. `emitExecution` 잔존 직접 호출(9곳)은 전부 `WAITING_FOR_INPUT`/`RESUMED`/`USER_MESSAGE`/`AI_MESSAGE`/`STARTED`/`EXECUTION_MESSAGE` 등 종결 3종 밖 이벤트로, 플랜의 "범위 밖" 서술과 일치.
- **`retry-turn-terminal-guard.md` #2 실질 수정**: `retry-turn.service.ts:939` `failRetryExecution` 의 cancelled 분기가 이전엔 `{status, durationMs}` 만 emit(§6.5 `result.cancelledBy` 완전 누락 — spec 이 지목한 정확히 그 결함)했는데, 이번 diff 는 `type:'cancelled', cancelledBy:'user'` 를 명시적으로 채운다. 새 유닛 테스트(`retry-turn.service.spec.ts:678` `it('emits EXECUTION_CANCELLED (not FAILED) when re-entry throws ExecutionCancelledError'`)가 `cancelledBy: 'user'` 를 단언해 회귀를 잠근다. `cancelledBy:'user'` 선택 근거(트리거가 `ExecutionCancelledError` 로, 취소 주체를 알 수 없고 §6.5 규칙상 `error` 를 안 실으므로 자기정합적, 자매 `finalizeCancelledExecution` 도 동일값)도 spec §6.5 행동 계약과 모순 없음.
- **판별 union의 필드 강제**: `completed`(durationMs 필수) / `failed`(durationMs+error 필수, error 는 `TerminalErrorPayload | null`) / `cancelled`(durationMs+cancelledBy 필수, error 는 optional·`null` 불허) — 세 variant 필드가 spec §6.3/§6.4/§6.5 필드 집합과 line-level 로 일치. `cancelledBy` 닫힌 3값 union(`'user'|'system'|'timeout'`)도 spec §6.5 "행동 계약" 문구와 정확히 일치.
- **user cancel 의 `error` 키 부재**: `emitTerminalExecution` 이 `if (payload.error) wire.error = payload.error;` 로 조건부 할당해 `undefined` 를 명시적으로도 싣지 않는다(스프레드 아님). 신규 테스트(`execution-event-emitter.service.spec.ts` 신설 describe 블록, `'error' in wire` 를 `false` 로 직접 단언)가 `toHaveBeenCalledWith` 의 `{error: undefined}` 통과 허점을 피해 실제 키 부재를 검증 — spec §5.4 "null vs 키 생략" 규약과 일치.
- **순환 import 회피**: `emitTerminalExecution` 본문 내부에서 `type→eventType/status` 매핑 객체를 만들어(모듈 스코프 상수 금지) ws.service↔gateway↔event-emitter ES 모듈 순환에서 `ExecutionEventType` 미정의 문제를 피함 — JSDoc 근거(72 suites 붕괴 경험)와 실제 구현이 일치.
- **TODO/FIXME/HACK/XXX**: 본 diff 5개 코드 파일에 없음.
- **엔티티 미로드 5경로의 `durationMs`/`error` 리터럴**(`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`)은 모두 `code`/`message` 를 항상 채워 새 타입과 충돌 없음.

## 요약

핵심 변경(종결 이벤트 판별 union 파사드 도입 + 11개 직접 호출 이관 + `retry-turn.service.ts` 의 `cancelledBy` 누락 결함 흡수)은 spec §6/§6.3~§6.5 와 line-level 로 정합하고, 회귀 테스트가 wire 형태·키 부재·판별력(타입 에러)까지 실제로 잠그고 있어 기능적으로 완전하다. 유일한 실질 결함은 코드가 아니라 plan 문서 위생 — `retry-turn-terminal-guard.md` 가 스스로 지정한 "단일 진실" 완료 판정 표(#2 행)를 갱신하지 않아, `eia-terminal-emit-facade.md` 가 주장하는 "자매 plan 흡수 완료"가 그 SoT 상에서는 아직 미완료로 보인다(WARNING 1건). 그 외 하나의 INFO(§6.5 `error.message` optional 명시를 코드가 필수로 좁힘)는 관측된 실사용과 상충하지 않는 안전한 방향의 사소한 spec-코드 엄격도 차이다.

## 위험도
LOW
