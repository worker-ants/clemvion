# Rationale 연속성 검토 — impl-done, scope=spec/5-system/ (diff-base origin/main)

## 검토 범위에 대한 메모

`origin/main...HEAD` diff 는 `spec/**` 파일을 **한 줄도 바꾸지 않는다** (`git diff --stat origin/main...HEAD -- spec/` = 빈 결과). 실제 변경은:

- `codebase/backend/src/modules/websocket/websocket.service.ts`(+`.spec.ts`) — 외부 fanout `llmCalls` strip 을 depth-1 → 깊이 무관으로 강화 + `__proto__` 오염 방지 (커밋 `81f2c60d6`·`5df89cda6`·`b49ee4310`)
- `plan/in-progress/eia-terminal-payload.md` (신규) — developer 작업, `--impl-prep` CRITICAL 로 차단된 상태
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (신규) — project-planner 몫의 spec 초안. **이 파일이 향후 `spec/5-system/14-external-interaction-api.md` · `1-data-model.md` 를 직접 바꿀 예정**이라 Rationale 연속성 관점에서는 이 draft 의 "변경 제안" 을 target 의 실질 내용으로 취급했다.

아래 발견사항은 코드 diff 1건(문제 없음, 오히려 기존 spec 선언을 실제로 충족시키는 수정)과 spec draft 1건(미해결 충돌)으로 나뉜다.

## 발견사항

### [CRITICAL] §6.2 "실측 shape 으로 재작성" 제안이 명시적으로 기각된 "직접 재작성" 대안을 그대로 되살린다

- target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §"변경 제안 (1)" (L52-56) + (3) (L67-73) — 이 draft 는 project-planner 가 그대로 `spec/5-system/14-external-interaction-api.md` §6.2 에 반영할 예정인 초안이다.
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → `### §4.4 wire 필드 caveat — 직접 재작성 대신 caveat + 오너십 분리 (2026-07-14, PR #945 consistency 후속)` (직접 읽어 확인, 967-980행), 그리고 그 안에 있는 **(2026-08-13 갱신)** blockquote.
- 상세:
  - WS §Rationale 원문: "**직접 재작성 대신 caveat 채택**: §2.1/§2.2 가 이미 '논리 구조 표기 + 구현현실 caveat' 패턴을 쓰고, **EIA §6.2 도 동일하게** notification 추상 JSON + SSE wire caveat blockquote 로 처리했다. 논리 nested 구조가 가독성상 유리하므로 **JSON 전체를 실 wire 로 교체(가독성 저하 + 두 문서 불일치)하지 않고** caveat 로 통일했다." — §6.2 를 이 패턴의 실례로 **이름까지 명시**한다.
  - 2026-08-13 갱신 blockquote 는 하루 전(target 착수 하루 전) "위 두 결정은 **`waiting_for_input` 에 한정**해 그대로 유효하다" 고 재확인했다 — 즉 지금 target 이 재작성하려는 정확히 그 이벤트(`waiting_for_input` = §6.2)에 대해 caveat 패턴 유지가 방금 다시 확정된 상태다.
  - 현재 `spec/5-system/14-external-interaction-api.md` §6.2(645-689행, 직접 읽어 확인)는 이 패턴 그대로다: 추상 `node`/`interaction`/`context` JSON + 그 아래 `> **waiting_for_input 의 SSE 필드명 매핑**` blockquote(680-689행)가 필드명 화살표 매핑(`node.id → waitingNodeId` 등)을 제공하며, `6-websocket-protocol.md` §4.4 는 "외부 클라이언트가 소비하는 필드 매핑의 SoT 는 EIA §6.2 이 blockquote" 라고 명시적으로 소유권을 부여한다.
  - target 의 제안 (1)은 "안쪽을 위 실측 키(`waitingNodeId` 등)로 교체" = JSON 전체를 실 wire 로 바꾸는 것이고, (3)은 그 결과로 "매핑 화살표를 걷어내고 필드명은 채널 무관 동일, 봉투만 다르다" 로 정정 — 즉 blockquote 의 존재 이유(필드명 매핑) 자체를 없앤다. 이는 WS Rationale 이 이름까지 지목해 기각한 대안을 문자 그대로 재도입하는 것이다.
  - target 의 자체 `## Rationale`(193-202행)은 "왜 삭제가 아니라 Planned 인가" / "왜 예시를 실측으로 맞추나(문서에 코드를 맞추지 않고)" 두 항목만 다루고, **"왜 caveat 패턴을 버리고 직접 재작성으로 돌아가는가"** — 정확히 이 충돌을 정면으로 다루는 질문에는 답하지 않는다. 즉 결정을 번복하면서 그 번복에 대한 새 근거를 쓰지 않은 경우다(관점 3).
  - 주의: target 의 (1) 안에는 정당한 부분도 섞여 있다 — `payload:` 봉투 래퍼 추가는 `14-external-interaction-api.md` §"채널별 봉투 — 셋이 서로 다르다 (normative)"(580-598행, 직접 확인)가 "payload 래퍼는 webhook 전용" 이라 정의하는데 현재 §6.2 예시엔 이 래퍼가 없어 자기 문서의 normative 규칙을 어기는 실제 결함이다(`eia-terminal-payload.md` CRITICAL 과 일치). **문제는 래퍼 추가가 아니라, 그 김에 안쪽 내용까지 "실측 wire" 로 바꾸는 부분이다.**
- 제안: 다음 중 하나를 명시적으로 선택한다.
  1. **caveat 패턴 유지(권장)**: §6.2 예시는 현행 논리 구조(`node`/`interaction`/`context`)를 유지하되 `payload:` 래퍼(+ §6.3/§6.4 와 동일한 "webhook 봉투 기준" 주석)만 추가한다. "SSE 필드명 매핑" blockquote 는 그대로 두거나 실측 키로 내용만 검증·갱신한다(제목·구조는 유지). 안쪽 JSON 을 실측 shape 으로 바꾸는 부분은 철회.
  2. **caveat → 직접 재작성 전환(의도적 번복)**: 채택한다면 `spec/5-system/6-websocket-protocol.md` §Rationale 의 "§4.4 wire 필드 caveat" 항목에 새 날짜 addendum blockquote 를 추가해 "왜 §6.2 만은 이제 caveat 보다 직접 재작성이 나은가"(예: node/interaction/context 구조 자체가 재편돼 매핑만으로 감당 안 될 규모의 drift)를 명시하고, EIA §6.2 blockquote 의 "SoT" 선언 문구도 갱신한다. target 자신의 `## Rationale` 에도 이 caveat-vs-rewrite 결정을 정면으로 다루는 항목을 추가한다.

### [WARNING] §6.2 blockquote 내용 변경 시 `6-websocket-protocol.md` 쪽 Rationale 서술이 stale 해지고, `spec_impact` 에 그 파일이 빠져 있다

- target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` frontmatter `spec_impact`(8-10행) + §"변경 제안 (3)"(67-73행) + §"변경 제안 (7)"(92-109행)
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → "§4.4 wire 필드 caveat" 항목의 2026-08-13 갱신 blockquote — "§6.2 blockquote 에는 `waiting_for_input` 고유의 **필드명 매핑**만 남았다" 라고 그 blockquote 의 현재 역할을 정확히 서술한다.
- 상세: target 의 (3)이 그 blockquote 를 "필드명 매핑" 에서 "봉투만 다르다" 는 다른 내용으로 바꾸면, WS 문서의 위 서술 자체가 실제와 어긋나는 새 drift 가 된다 — 이 draft 가 애초에 고치려는 것과 같은 종류의 문제를 다른 문서에 만드는 셈이다. 동시에 (7)은 WS §4.4 Rationale 의 "strip-only 결정" 제목·본문을 넓히고 addendum 을 붙이자고 제안하는데, **이 역시 `6-websocket-protocol.md` 편집이 필요**하다. 두 항목 모두 `6-websocket-protocol.md` 를 건드려야 하는데 frontmatter `spec_impact` 목록엔 `14-external-interaction-api.md` 와 `1-data-model.md` 두 개뿐이고 `6-websocket-protocol.md` 가 없다.
- 제안: 위 CRITICAL 의 어느 선택지를 따르든, `spec_impact` 에 `spec/5-system/6-websocket-protocol.md` 를 추가한다. (3)을 유지한다면 WS §Rationale 의 대응 문단도 같은 턴에 갱신한다(선례: 문서 자신의 "(2026-08-13 갱신)" 관용구).

### [INFO] 코드 diff(`websocket.service.ts` strip 강화)는 Rationale 연속성 위반이 아니라 오히려 기존 spec 선언을 실제로 충족시키는 수정이다

- target 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `stripDeep`/`stripExternalOnlyFields` (커밋 `81f2c60d6`·`5df89cda6`·`b49ee4310`)
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` §4.4 표 아래 blockquote(직접 확인, 1013행 상당) — "**모든 외부 fanout 수신자 — external-interaction SSE 스트림 · notification webhook · chat-channel 아웃바운드 — 에서는 strip 된다**" (깊이 제한 없는 절대적 서술). 그리고 `## Rationale` → `### ai_message.llmCalls[] 외부 수신자 strip (strip-only 결정)` — "**결정 (strip-only)**: `llmCalls`(및 그 안의 `requestPayload`/`responsePayload`)는 인증된 내부 WS 채널에만 포함하고, fanout(외부) 경로에서는 strip 한다."
- 상세: 종전 구현(depth-1 shallow delete)은 이 스펙 선언보다 **더 좁게** 동작해 `turnDebug.llmCalls.llmCalls[]` · `nodeOutput.meta.turnDebug[].llmCalls[]` 두 중첩 경로가 raw LLM 프롬프트/응답을 외부로 흘렸다(CHANGELOG 항목이 자인: "WS §4.4 는 이 필드가 '모든 외부 수신자에서 strip 된다' 고 선언하고 있었다 — 선언이 참이 아니었다"). 즉 **버그가 있던 쪽은 종전 구현이지 spec 이 아니다.** 이번 diff 는 strip 을 깊이 무관으로 바꿔 실제 동작을 기존 spec 선언에 맞춘다 — "기각된 대안의 재도입" 도 아니고 "무근거 번복" 도 아니다.
- `__proto__` 오염 방지(스프레드 우선 + `Object.defineProperty`)와 깊이 상한 경계 연산자를 형제 함수 `sanitizePayloadForWs`(`depth > MAX_SANITIZE_DEPTH`)와 통일한 것도 기존 설계 원칙("형제와 같은 상한을 쓴다")과 정합하며, 4~5라운드에 걸친 리뷰 이력(`10_32_27`·`11_02_16`)이 각 결정의 근거를 JSDoc/커밋 메시지에 충실히 남겨 두었다.
- 판단: 조치 불필요. 다만 (7)에서 다루듯 WS §4.4 Rationale 텍스트 자체가 아직 "위치·이벤트 무관" 을 명시하지 않아 코드가 spec 서술보다 앞서 있는 상태 — 위 WARNING 과 동일 계열이라 별도 항목으로 세지 않는다.

## 요약

이번 diff 의 코드 변경(WS fanout `llmCalls` 깊이 무관 strip)은 Rationale 연속성 관점에서 문제가 없다 — 오히려 `spec/5-system/6-websocket-protocol.md` §4.4 가 이미 선언했던 "모든 외부 수신자에서 strip" 이라는 절대적 invariant를 실제 구현이 위반하고 있던 것을 바로잡은 수정이다. 반면 같은 diff 에 포함된 project-planner 몫의 spec 초안(`plan/in-progress/spec-draft-eia-62-waiting-payload.md`)은 §6.2 예시를 "실측 wire shape 으로 직접 재작성" 하자고 제안하는데, 이는 `6-websocket-protocol.md` Rationale 이 2026-07-14(PR #945)에 §6.2 를 실례로 들어 명시적으로 기각하고 2026-08-13 에 `waiting_for_input` 범위로 재확인한 "직접 재작성" 대안을 그대로 되살리는 것이며, target 은 이 충돌을 인지·해명하지 않는다(같은 결함이 이미 오전 09:38 `--spec` 세션에서 CRITICAL 로 지적됐고, 이후 4번의 커밋에서 다른 항목들은 정리됐지만 이 항목은 그대로 남아 있다). `payload:` 봉투 래퍼를 추가하는 부분 자체는 §6 도입부 normative 규칙 위반을 바로잡는 정당한 수정이므로, 재작성 제안 중 "안쪽 내용을 실측 키로 교체" 하는 부분만 분리해 caveat 유지 또는 명시적 번복(WS Rationale addendum 동반) 중 하나로 결정해야 한다.

## 위험도
HIGH
