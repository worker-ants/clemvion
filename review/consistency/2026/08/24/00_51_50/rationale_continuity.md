# Rationale 연속성 검토 — sse-nodeoutput-allowlist

## 검토 대상
- `spec/5-system/14-external-interaction-api.md` §R17 (`nodeOutput` allowlist 확대 — getStatus 전용 → SSE/fanout 포함)
- `spec/5-system/6-websocket-protocol.md` §4.4 wire caveat (nodeOutput 공유 범위 정정)
- `spec/conventions/conversation-thread.md` §8.4 소비처 갱신 문단 (2026-08-23 자기-반증형 소정정)
- 관련 코드: `codebase/backend/src/shared/utils/node-output-allowlist.ts`, `codebase/backend/src/modules/websocket/websocket.service.ts`, `websocket.service.spec.ts`

## 발견사항

- **[INFO]** 결정 번복(SSE/fanout 잔여 → 해소)이 모범적으로 처리됨 — 특이사항 아님, 기록 목적
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 표 3~4행 + "정정 (2026-08-23, `23_29_27` cross_spec CRITICAL)" 블록
  - 과거 결정 출처: 같은 §R17 (2026-08-23 오전) — "SSE/fanout emit (`toFanoutEnvelope`) | deny-list 유지 (**잔여**) | envelope 레벨에서 strip 하므로 그 안의 nodeOutput 에 도달하려면 별건 변경이 필요하다"
  - 상세: target 은 이 유예 결정을 같은 날 안에 번복해 SSE/fanout 의 `waiting_for_input` `nodeOutput`/`buttonConfig.nodeOutput` 도 fail-closed allowlist 로 닫았다. 이는 "결정의 무근거 번복"에 해당할 수 있으나, target 은 (a) 번복 사유를 실측으로 명시("emitExecutionEvent`/`emitNodeEvent` 두 emit 이 `toFanoutEnvelope` 한 함수를 공유하는 단일 chokepoint 라 호출부 변경 없이 닫혔다" — 원래 유예 근거였던 "별건 변경 필요"가 틀렸음을 코드로 확인), (b) 취소선으로 원 문장을 보존, (c) 잔여 범위를 `envelope.output`(execution.node.completed/.failed) 하나로 정확히 좁히고 `websocket.service.spec.ts` 의 `[잔여]` 캐너리 테스트로 고정했다. 코드 확인 결과(`node-output-allowlist.ts`, `websocket.service.ts:172-199`) 이 서술은 구현과 정확히 일치한다.
  - 제안: 조치 불요. 오히려 본 프로젝트가 요구하는 "번복 시 새 Rationale 동반" 패턴의 정본 사례.

- **[INFO]** `conversation-thread.md` 자기-반증형 소정정이 CLAUDE.md 예외 조건을 충족
  - target 위치: `spec/conventions/conversation-thread.md` §8.4, "정정 (2026-08-23, 자기-반증형 소정정)" 블록
  - 과거 결정 출처: 같은 파일 동일 문단의 "SSE·fanout 이 잔여다" (PR #1205 에서 developer 가 작성)
  - 상세: CLAUDE.md §"자기-반증형 소정정" 5조건 대조 — (1) `git blame` 상 developer 자신이 #1205 에서 작성한 문장(target 정정문에 명시), (2) 예고성 문장(제품 정의·API 계약 아님), (3) 같은 날 `sse-nodeoutput-allowlist` 작업의 실측이 반증, (4) 정정이 그 문장에 국한 — 원문은 취소선(`~~SSE·fanout 이 잔여다~~`)으로 보존, 인접 서술("park resume 전용" 등)은 무변경, (5) 실측치가 정정문 자체에 기록됨. 다섯 조건 전부 충족.
  - 제안: 조치 불요. `--impl-done` 게이트가 이 spec 파일을 scope 로 포함해 재확인했는지만 확인 권장(본 검토 범위 밖).

- **[INFO]** deny-list → allowlist 전환은 프로젝트 전역 원칙과 정합, 상충 아님
  - target 위치: `node-output-allowlist.ts` 헤더 주석 "왜 deny-list 로는 부족한가"
  - 과거 결정 출처: `spec/4-nodes/1-logic/2-switch.md` Rationale("블랙리스트 대신 화이트리스트를 쓰는 이유"), `spec/7-channel-web-chat/4-security.md` R4("마크다운 sanitize — deny-by-default allowlist, blacklist 기각")
  - 상세: 두 선례 모두 "신규 항목 추가 시 자동 통과(fail-open)를 막기 위해 deny-list 대신 allowlist 를 쓴다"는 동일 논리를 이미 확립해 두었다. target 의 `nodeOutput` allowlist 도입은 이 기존 원칙을 재확인·확장한 것이며 반박·회피가 아니다.
  - 제안: 조치 불요.

- **[INFO]** WS §4.4 "strip-only, 값-마스킹 아님(에디터 디버깅 가치 보존)" 원칙이 그대로 존중됨
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17, "내부 WS(에디터)는 대상이 아니다" 문단
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` Rationale "`llmCalls` 외부 수신자 strip" 항목 — "값-레벨 마스킹은 에디터 디버깅 가치를 훼손"
  - 상세: 신규 allowlist 는 `toFanoutEnvelope` 호출 시점(내부 WS broadcast 이후, 외부 clone 생성 시)에만 적용되도록 설계돼 내부 WS 는 원문 그대로 유지한다고 target 이 명시적으로 선언하고, 코드(`websocket.service.ts` `toFanoutEnvelope`)도 이를 따른다. 기존 합의 원칙과 충돌 없음.
  - 제안: 조치 불요.

CRITICAL/WARNING 등급 발견사항 없음. 기각된 대안의 무단 재도입, 합의 원칙 위반, 근거 없는 결정 번복, invariant 우회 사례를 찾지 못했다.

## 요약
`sse-nodeoutput-allowlist` 작업의 spec 변경분(`spec/5-system/14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.4, `spec/conventions/conversation-thread.md` §8.4)은 기존 Rationale 체계와 연속성을 유지한다. 유일한 실질적 "결정 번복"(SSE/fanout `nodeOutput` allowlist 유예 → 해소)은 이전 유예 근거가 실측으로 반증됐음을 명시하고, 취소선으로 원 문장을 보존하며, 잔여 범위(`envelope.output`)를 정확히 좁혀 캐너리 테스트로 고정하는 등 이 프로젝트가 요구하는 "번복 시 새 Rationale 동반" 패턴을 모범적으로 따른다. `conversation-thread.md` 의 자기-반증형 소정정도 CLAUDE.md 가 규정한 5조건(작성자 동일·예고성 문장·실측 반증·국소 정정·실측 기록)을 전부 충족한다. deny-list→allowlist 전환은 기존 확립된 "fail-open 방지를 위한 allowlist 선호" 원칙(switch.md, webchat 4-security.md)과 정합하며, WS §4.4 의 "내부 WS 는 strip-only, 값-마스킹 대상 아님" 원칙도 명시적으로 존중된다. 기각된 대안의 무단 재도입이나 invariant 우회는 발견되지 않았다.

## 위험도
NONE
