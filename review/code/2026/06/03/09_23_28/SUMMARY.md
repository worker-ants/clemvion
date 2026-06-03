# Code Review 통합 보고서

## 전체 위험도
**LOW** (조정) — reviewer 는 HIGH 로 봤으나 유일한 Critical(C-1)은 검증 결과 **false positive**. 실제로는 Warning 5건(테스트 갭·방어심층화·주석)뿐이며 핵심 strip 동작은 올바르다.

## Critical 발견사항

| # | 판정 | 발견사항 | 검증 |
|---|------|----------|------|
| C-1 | **FALSE POSITIVE (조치 불필요)** | "spec 본문이 구현보다 뒤처짐 — §4.4/EIA §6.5/CCH-MP-01 미갱신, open-item 잔존" 주장 | **반증**: spec 갱신은 커밋 `83d60340`(리뷰 range origin/main..HEAD 에 포함)에 적용됨. `6-websocket-protocol.md:488` §4.4 note = strip-only(open item 없음), `:961~` Rationale = strip-only 결정, `14-external-interaction-api.md:541` = "fanout seam 에서 제거되어 외부 수신자에 미전달", `15-chat-channel.md` CCH-MP-01 = strip 노트. 유일한 "open item" 문자열(`:963`)은 "직전 open item 을 확정·대체한다"는 의도된 supersede 문구. reviewer 가 리뷰 diff 에 포함된 `spec-draft-*.md` 의 "Before" 블록(옛 open-item 텍스트)을 현행 spec 으로 오인한 것. |

## 경고 (WARNING) — 조치 대상

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| W-1/W-4 | Testing/Req | `emitNodeEvent` fanout 에 strip 미적용 (현재 llmCalls 는 ai_message 전용이라 무해하나 미래 누출 경로) + 의도 미문서화 | emitNodeEvent fanout 에도 strip 적용(방어심층화) + 경계 명시 |
| W-2 | Testing | dispatcher `toChatChannelEvent` 가 llmCalls 미전달임을 검증하는 회귀 테스트 없음 | chat-channel.dispatcher.spec 에 회귀 테스트 추가 |
| W-3 | Testing | SSE egress 에 llmCalls 없음 검증 테스트 없음 | sse-adapter 단위 테스트(또는 강화) 추가 |
| W-5 | Maintainability | `nextFanoutEvent` 헬퍼가 두 describe 에 중복 정의 | 상위 describe 스코프로 이동 |

## 참고 (INFO) — 선별 채택
- I-2/I-9: `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` JSDoc 에 "top-level only strip" + "확장 시 spec §4.4·EiaAiMessageEvent 주석 동반 갱신" 명시.
- I-10: emitNodeEvent strip 적용 시 자연 해소.
- I-5: spec 갱신 완료(C-1 반증)로 자동 해소.

## 에이전트별 위험도
| 에이전트 | 위험도 |
|----------|--------|
| security | LOW |
| requirement | (HIGH→) LOW — C-1 false positive |
| scope | LOW |
| side_effect | NONE |
| maintainability | LOW |
| testing | MEDIUM→LOW (테스트 보강) |
| documentation | LOW |
