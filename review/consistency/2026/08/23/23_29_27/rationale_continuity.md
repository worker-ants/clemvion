# Rationale 연속성 검토 — SSE/fanout `nodeOutput` allowlist 확장 (재검토, `23_29_27`)

## 검토 대상

- target: `spec/5-system/` (diff-base `origin/main`, 실제 변경 파일은
  `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.4 caveat 1곳)
- 실제 코드 변경: `codebase/backend/src/shared/utils/node-output-allowlist.ts`,
  `codebase/backend/src/modules/websocket/websocket.service.ts` (`toFanoutEnvelope` 에
  `allowlistFanoutNodeOutput` 배선), 대응 spec/plan 문서
- 참조한 과거 Rationale: `spec/5-system/14-external-interaction-api.md` §R17 전체(특히
  "`nodeOutput` 일반 키 allowlist" 항목과 "`llmCalls` strip" 하위 항목), `spec/5-system/6-websocket-protocol.md`
  ## Rationale "`llmCalls` 외부 수신자 strip" 항목, `spec/conventions/node-output.md` Principle 0/1.1.4
- 이전 라운드 산출물: `review/consistency/2026/08/23/22_26_33/rationale_continuity.md` (WARNING 2건 + INFO 1건),
  `plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

## 결론 먼저

이번 diff 는 §R17 이 스스로 예고·등재해 둔 "SSE/fanout 은 여전히 fail-open deny-list" 잔여 항목을 닫는
계획된 후속 작업이며, 과거 Rationale 이 명시적으로 기각한 대안을 재도입하거나 합의된 원칙을 무단으로
우회하는 지점은 발견되지 않았다. 특히 (1) WS §Rationale 의 `llmCalls` strip-only 결정은 이번 변경의
대상이 아님을 spec·코드 양쪽에서 명시적으로 재확인했고, (2) REST/SSE 방어 강도 비대칭을 기록했던 이전
서술("이 시점부터 강도가 다르다")을 취소선으로 보존한 채 정정문을 덧붙였으며, (3) 직전 라운드
(`22_26_33`)가 지적한 WARNING 2건(§R17 표·JSDoc 표의 2-그룹/3-그룹 불일치)은 이번 diff 에서 실제로
해소됐다.

## 발견사항

없음 (CRITICAL/WARNING 급 발견 없음).

### [INFO] `node-output.md` Principle 0 닫힌 레지스트리와의 거리감이 이번 diff 로 4→8키 확대됨 — 이미 추적 중, 재확인만

- target 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` L47-L48 (JSDoc 표),
  L73-L89 (`NODE_OUTPUT_ALLOWED_KEYS` wire 전용 그룹)
- 과거 결정 출처: `spec/conventions/node-output.md` Principle 0 (`NodeHandlerOutput` 5필드 +
  `_resumeState`/`_resumeCheckpoint`/`_retryState` 3예외로 닫힌 레지스트리) — 이 원칙과의 간극은
  이전 라운드에서도 이미 `20_09_38` convention_compliance W3 로 등재돼 있었다(당시는 위젯 파서
  4키 한정).
- 상세: 이번 diff 는 그 wire-only 카브아웃을 chat-channel 렌더러용 4키(`payload`/`title`/`rendered`/
  `nodeType`)로 확장해 Principle 0 의 닫힌 목록과 실제 allowlist 사이 거리를 넓힌다. 다만 이것은
  "새로 발견된 위반"이 아니라 기존에 이미 식별·기록된 간극의 연장이며, `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md` 가 "wire-only 키가 Principle 0 의 닫힌 레지스트리
  밖이다 (~~4키~~ → **8키**)" 항목으로 갱신해 owner=planner 로 명시적으로 추적하고 있다(각주 신설
  제안까지 적혀 있음). 즉 무근거 번복이 아니라 **의도적으로 유예된, 근거가 기록된 gap**이다.
- 제안: 현재 처리(투명한 추적 + planner 소관 명시)로 충분하다. 다음 planner 턴에서 이 항목을
  처리할 때 `node-output.md` Principle 0 에 "EIA/chat-channel wire 조립 레이어가 얹는 wire-only
  필드는 `NodeHandlerOutput` 계약 밖" 각주를 추가하면 이 거리감이 해소된다.

## 개별 검증 메모 (근거)

- **`llmCalls` strip-only 결정 불훼손**: `spec/5-system/14-external-interaction-api.md` R17 은
  "단 `llmCalls` 는 wire 에서 제외 … 그 결정은 번복되지 않았다" 로 명시하고, `websocket.service.ts`
  의 `toFanoutEnvelope` JSDoc 도 "`nodeOutput` 은 deny-list 가 아니라 allowlist 로 좁힌다"
  섹션에서 이 두 정책이 병존함을 재확인한다. deny-list(`EXTERNAL_STRIPPED_FIELDS`)와
  allowlist(`allowlistNodeOutputKeys`)가 순서대로(strip → allowlist → routing) 적용돼 서로
  대체가 아니라 계층으로 쌓인다.
- **내부 WS(에디터) 불변식 유지**: `spec/5-system/6-websocket-protocol.md` §4.4 caveat 는 "내부
  WS 는 원문 그대로다" 를 명시하고, `toFanoutEnvelope` 는 `broadcastToChannel` 로 이미 나간 뒤
  새 clone 에만 allowlist 를 건다(copy-on-change). plan 의 검증 기준도 "내부 WS 는 안 바뀐다"를
  캐너리로 고정했다고 기록한다.
- **REST/SSE 강도 비대칭 서술의 정정**: 이전 판(#1205, PR 이전 상태)의 "이 시점부터 REST 와 SSE 의
  `nodeOutput` 방어 강도가 다르다" 문장은 삭제가 아니라 취소선으로 보존한 채 "같은 날 SSE 를 닫아
  그 서술은 폐기했다" 는 정정문이 추가됐다 — 결정 번복 시 새 Rationale 을 남기는 이 프로젝트의
  관례(§자기-반증형 소정정과 유사한 패턴)를 따른다. `CHANGELOG.md` 도 동일한 취소선+정정 패턴과
  함께 "외부 수신자에게는 동작 변경" 캐비엇(제3자 webhook 구독자 영향 가능성)을 명시했다.
- **직전 라운드 WARNING 해소 확인**: `22_26_33` rationale_continuity.md 가 지적한 두 WARNING —
  (1) §R17 allowlist 서술이 chat-channel 4키를 반영하지 못함, (2)
  `node-output-allowlist.ts` JSDoc 표가 2-그룹으로 배열의 3-그룹 구성과 어긋남 — 은 이번 diff 에서
  각각 §R17 표에 "SSE/fanout emit" 행 갱신 + 3-그룹 표, JSDoc 표의 3번째 행(`wire 전용
  (chat-channel)`) 추가로 실측 해소됐다. 같은 라운드의 INFO(carve-out 명문화 제안)는 코드 주석에
  "§R17 이 정의한 '렌더에 필요한 키'" 문구가 그대로 남아 완전히 반영되진 않았으나, 등급이 INFO였고
  이번 판정에 영향을 줄 CRITICAL/WARNING 요소는 아니다.
- **legacy 판별자 필드(`nodeOutput.nodeType`)는 재도입이 아니라 기존 사용의 추인**: `node-output.md`
  §4.2 는 과거 `output.type: 'carousel'|'table'|...` 판별자를 Principle 1.1.4 사유로 폐기했으나,
  이번 diff 가 allowlist 에 추가한 `nodeOutput.nodeType` 은 그와 다른 필드다 — Discord/Telegram/Slack
  렌더러(`discord-message.renderer.ts` 등)가 **이번 PR 이전부터** 읽어 온 legacy flat shape 이고,
  이번 diff 는 그 필드를 새로 설계해 넣은 것이 아니라 REST 에만 걸려 있던 allowlist 를 SSE/fanout
  으로 확장하면서 기존에 이미 쓰이던 필드가 걸러지지 않게 목록에 추가한 것이다(코드·spec 모두
  "legacy" 로 명시). 새 대안 재도입이 아니다.

## 요약

`spec/5-system/14-external-interaction-api.md` §R17 과 `spec/5-system/6-websocket-protocol.md` §4.4
의 이번 변경은 §R17 자신이 예고해 둔 SSE/fanout 잔여 항목을 닫는 계획된 후속 작업이며, WS §Rationale
의 `llmCalls` strip-only 결정을 건드리지 않고, 이전 REST/SSE 비대칭 서술을 취소선+정정문으로 투명하게
번복했다. 직전 라운드(`22_26_33`)가 지적한 WARNING 2건은 이번 diff 에서 실측 해소가 확인됐다. 유일한
잔존 거리감(`node-output.md` Principle 0 닫힌 레지스트리 vs wire-only 8키)은 이미 별도 트래커에
owner=planner 로 명시 추적 중인 기존 gap 의 연장이라 INFO 로만 남긴다.

## 위험도

NONE
