# Rationale 연속성 검토 결과

**대상**: `plan/in-progress/multiturn-error-preserve.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-23

---

## 발견사항

### [INFO] `_retryState` 보존 — `stripControlFields()` 분기 추가 의도는 명시되었으나 Rationale 기술 범위가 좁다

- **target 위치**: Plan §C (작업 축), `_resumeState 보존 정책` 항목 (R1 채택 설명) + `## Rationale` "R1 채택 사유"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §1.3` (재개 state 직렬화 필드) + `spec/4-nodes/3-ai/1-ai-agent.md §12.1` Rationale
  - "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다" — 이것이 기존 strip 정책의 합의된 invariant.
  - `spec/4-nodes/3-ai/1-ai-agent.md §12.1` Rationale: "`stripControlFields()` 가 `_resumeState` 를 제거하므로 final response 텍스트만 전달" — strip 이 의도된 설계로 기록되어 있다.
- **상세**: Plan 이 R1 (retryable error 시 `_retryState` 를 `stripControlFields()` 예외로 보존)을 채택하면서 새 Rationale 을 함께 작성한 것은 긍정적이다. 다만 strip 예외의 보안·용량 영향을 기존 Rationale 에서 언급한 "credential 누락 등 보호 정책 동일 적용" 이라는 한 줄로만 처리하고 있어, `_resumeState` 전체 strip 이 보안(credential 노출 방지) 과 용량(JSONB 비대화) 두 목적을 동시에 달성하는 기존 합의를 어느 정도 우회하는지가 불분명하다. 특히 `_retryState` 에 포함될 데이터 범위(messages 배열 전체인지, cursor 정보인지 등)가 spec draft 에 정의되지 않아 "credential 동일 보호" 주장을 검증할 수 없다.
- **제안**: Plan 의 Rationale "R1 채택 사유" 항목에, `_retryState` 에 포함되는 필드 목록(또는 최소 범위 upper-bound)과 그 credential-free 보장을 한 줄 이상 명시하거나, 이를 spec/5-system/4-execution-engine.md §1.3 의 `_resumeState` strip invariant 본문에 예외 조항으로 함께 기록할 것.

---

### [INFO] `system_error` source 도입 — `system` source "예약(reserved)" 원칙과 연속성 명시 양호, 보충 권장

- **target 위치**: Plan §B (에러를 conversation thread 의 system_error item 으로 인라인 표시), `## Rationale` "system_error vs system source 재사용" 항
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §1.1` — `system` source: "예약 (v1 자동 push 없음)", §9.1 표 — `system` 행: "v1 자동 push 없음"
- **상세**: target 이 "system 은 reserved 유지, v2 에서 매뉴얼 system note 도입 시 활성화" 라는 결론을 도출한 것은 기존 합의와 정합된다. `data.kind` discriminator 안을 기각하면서 "source enum 의 디스패치를 무력화" 를 사유로 든 것도 §9.1 1:1 매핑 원칙과 일치한다. 다만 §8.1 Rationale 의 "표현식 슈가 / Conversation Thread / messages 노출" 3안 비교 구조처럼, `system_error` 도입이 §8 Rationale 의 v1/v2 경계에 어떻게 위치하는지(v1 정식 source 확장 vs v2 로드맵 항목 당김)를 한 줄로 명시하면 향후 검토자가 판단 근거를 재구성할 수 있다.
- **제안**: spec/conventions/conversation-thread.md §10 CHANGELOG 2026-05-23 row 에 "v1 source 확장 — system_error 신설, system 예약 유지" 로 짧게 기록. 현재 Plan 의 Rationale 은 충분히 기술되어 있으므로 spec 반영 시 §8 Rationale 에 한 항목 추가로 마무리 가능.

---

### [INFO] CLEAR_WAITING 분리 — 기존 invariant 와 신규 Inv-6 간 SoT 귀속이 명확하나 교차 검토자용 cross-ref 누락

- **target 위치**: Plan §A (라이브 conversation snapshot 보존), §A 내 "이 정책은 spec/conventions/conversation-thread.md §9.7 에 단일 정의된다" 문장, Plan `## Rationale` "Inv-6 의 범위" 항
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §9.9` Inv-1~Inv-5 (현행 5 invariant), §9.7 WS 이벤트 → store 변환 계약
- **상세**: 신규 Inv-6 이 §9.9 의 "의무 강도" 와 동일하다고 명시한 것은 올바르다. 다만 현행 §9.9 에는 Inv-6 이 없고, Plan 은 "§9.7 의 CLEAR 분리가 정의, Inv-6 은 격상" 이라는 방향을 설명하지만 spec 수정 계획 표("영향 spec" 항)에 §9.9 가 포함되어 있지 않다. 영향 spec 표에 `spec/conventions/conversation-thread.md §9.9 — Inv-6 신설` 행이 빠져 있어 구현 turn 에서 Inv-6 추가가 누락될 위험이 있다.
- **제안**: Plan 의 "영향 spec" 표에 `spec/conventions/conversation-thread.md §9.9 | Inv-6 신설: "노드 실패 / 실행 실패 시 store conversationMessages 는 비워지지 않는다 — startExecution 만 클리어한다."` 행 추가.

---

### [WARNING] `execution.retry_last_turn` 신규 WS 명령 — 기존 WS 명령 패턴(§4.2) 의 reject 응답 형식이 다른 명령과 일관성 검토 없이 신설됨

- **target 위치**: Plan §C "새 WS 명령 execution.retry_last_turn" + "영향 spec" 표 `spec/5-system/6-websocket-protocol.md §4.2`
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §4.2` 현행 명령 표 — `execution.submit_form` 의 reject 규약: "`toolCallId` 미일치 시 reject" 한 줄로만 표기. 다른 명령(start/stop/continue/step)도 reject 상세 없음. §4.2 에는 명령별 에러 응답 형식의 통일 원칙이 현재 spec 에 없다.
- **상세**: Plan 이 `execution.retry_last_turn` 의 에러 코드 3종(`INVALID_RESUME_TOKEN`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`)을 신설하는 것은 기존 Rationale 에서 기각된 사항이 아니다. 다만 기존 §4.2 의 다른 명령들이 에러 응답 형식을 spec 수준으로 정의한 선례가 없어, 이번에만 에러 코드를 3종 명시하는 것이 비일관적이다. 이것이 확장인지 기존 정책 번복인지 명시하는 Rationale 이 없다. WS Rationale 에는 "메시지 origin 마커" 와 "KB 채널 단위 전환" 만 있어 명령 에러 응답 정책이 논의된 기록이 없다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.2` 에 에러 응답 형식을 추가할 때, 다른 명령(특히 `execution.submit_form` reject)과 동일한 응답 형식(ack + error code 구조)을 따르도록 표기하고, 그 이유를 해당 spec 의 Rationale 에 한 항 추가할 것. 또는 기존 명령들에도 에러 코드 표를 소급 적용할 계획임을 명시.

---

### [WARNING] `_resumeState` strip 정책의 예외로 `_retryState` 를 두는 것 — 기존 "최종 출력 저장 시 엔진이 제거한다" invariant 를 부분 번복하지만 Rationale 이 spec 문서에 기재되지 않고 plan 에만 존재함

- **target 위치**: Plan §C `_resumeState 보존 정책` R1 설명, Plan `## Rationale` "R1 채택 사유"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §1.3` — "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다." 이것은 단순 구현 메모가 아닌 spec 본문의 명시 규약이다.
- **상세**: 기존 §1.3 의 "제거한다" 는 표현은 조건 없는 invariant 로 읽힌다. Plan 은 R1 에서 retryable error 케이스에 한해 `_retryState` 를 strip 예외로 보존하기로 한다. 이것은 기존 invariant 의 조건부 번복이다. Plan 내 Rationale 에 R2 기각 사유와 R1 선택 사유가 서술되어 있는 것은 긍정적이지만, 이 Rationale 이 plan 문서에만 있고 `spec/5-system/4-execution-engine.md §1.3` 본문의 strip invariant 자체에 예외 조항이 반영되지 않는다면, spec 이 "제거한다" 규약과 코드가 실제로 `_retryState` 를 남기는 동작 사이의 모순을 영구히 품게 된다.
- **제안**: "영향 spec" 표에 `spec/5-system/4-execution-engine.md §1.3 — strip 예외 조항 추가: "retryable error 종결 시 `_retryState` 는 strip 대상에서 제외"` 행을 추가하고, 해당 spec 의 Rationale 절에 Plan 의 R1 채택 사유를 요약하여 기재할 것. 미기재 시 spec ↔ 코드 drift 발생.

---

### [INFO] `output.error.details.resumeToken` 신설 — Principle 3.2 `details` 의 "노드별 선택" 원칙과 정합

- **target 위치**: Plan §C R1 설명 — `output.error.details.resumeToken: string (opaque)` 신설
- **과거 결정 출처**: `spec/conventions/node-output.md Principle 3.2` — `details` 는 "선택적, 노드별 스키마"
- **상세**: `resumeToken` 을 `output.error.details` 안에 두는 것은 Principle 3.2 의 "노드별 선택 필드" 정의와 정합된다. 단, Plan 의 "영향 spec" 표에서 `spec/conventions/node-output.md Principle 3.2` 개정 항목으로 `resumeToken` 추가가 명시되어 있지 않다. `retryable` / `retryAfterSec` 는 명시되어 있으나 `resumeToken` 이 누락되어 있어 spec 개정 시 빠질 위험이 있다.
- **제안**: 영향 spec 표의 `spec/conventions/node-output.md Principle 3.2` 행에 `resumeToken?: string (opaque, retryable error 시 R1 보존 토큰)` 추가 명시.

---

## 요약

target 문서(`plan/in-progress/multiturn-error-preserve.md`)는 전반적으로 기존 Rationale 와의 연속성을 잘 유지하고 있다. `system_error` source 신설이 `system` reserved 정책을 침범하지 않도록 명시적으로 구분한 것, R2 (`waiting_for_retry` 신설) 기각 사유를 실행 엔진 §1.3 의 블로킹/재개 컨트랙트 확장 비용으로 논거한 것, Inv-6 이 §9.9 의 의무 강도와 동일임을 선언한 것은 Rationale 연속성 관점에서 적절하다. 두 가지 WARNING 이 발견된다. 첫째, `_retryState` 를 strip 예외로 두는 결정이 plan 의 Rationale 에는 서술되어 있으나 `spec/5-system/4-execution-engine.md §1.3` 의 "최종 출력 저장 시 제거한다" invariant 에 예외 조항이 반영되지 않으면 spec-코드 drift 가 발생한다. 둘째, `execution.retry_last_turn` 에러 코드 3종 신설이 기존 §4.2 의 다른 명령들과 일관성 없이 도입되는 점에 대한 Rationale 이 부재하다. 두 항목 모두 "영향 spec" 표 및 해당 spec Rationale 절에 예외·신설 사유를 명시함으로써 해소 가능하다.

---

## 위험도

MEDIUM
