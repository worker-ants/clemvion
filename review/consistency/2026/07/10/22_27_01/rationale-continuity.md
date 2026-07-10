# Rationale 연속성 검토 — spec-draft-pr874-deferred-docs

검토 대상: `plan/in-progress/spec-draft-pr874-deferred-docs.md` (변경안 1·2·3)
대조 Rationale: `spec/7-channel-web-chat/{0-architecture,1-widget-app,2-sdk,3-auth-session,4-security}.md` §R*,
`spec/conventions/conversation-thread.md` §8.1~§8.4·§9

## 발견사항

- **[WARNING]** R7 의 "기각된 대안" 서술 2건이 실제 PR #874 결정 이력에 없는 사후 구성 — draft 의 "신규 결정 없음(산문 승격)" 자기규정과 불일치
  - target 위치: `plan/in-progress/spec-draft-pr874-deferred-docs.md` 변경안 (1) — 신설 `### R7` 본문 중 다음 두 문장:
    - "대안 'booting 에도 노출하고 시작 완료까지 큐잉' 은 기각 — 사용자가 취소 의도를 표명한 뒤 세션이 뒤늦게 확립되는 역전이 생기고, 큐 드레인 상태기계가 §3 전이표에 없는 중간 상태를 추가한다."
    - "단일 명령으로 통일하는 안은 기각 — `cancel` 로만 통일하면 AI 대화 정상 종료 시에도 후속 노드가 유실되고, `end_conversation` 으로만 통일하면 비-AI 대기 표면에서 서버가 거부(409)해 종료가 실패한다."
  - 과거 결정 출처(대조 확인한 실제 이력): `plan/complete/webchat-session-controls-history-restore.md` (사용자 결정 2026-07-09, 검증 로그) + `review/code/2026/07/09/19_06_55/SUMMARY.md` (fresh review, WARNING #1·#3) + `review/code/2026/07/09/18_44_10/SUMMARY.md` (WARNING #7, graceful/cancel 경계 테스트) + EIA `spec/5-system/14-external-interaction-api.md` EIA-IN-02(`end_conversation`/`cancel` 은 애초 별개 명령으로 이미 존재).
  - 상세:
    1. **booting 큐잉 대안**: 실제 리뷰 기록(19_06_55)은 "`booting` 에서 `endConversation` 호출 시 `sessionRef` 가 null 이라 cancel 이 미발사되고, `resetSessionRefs()` 가 `startedRef` 를 재개방해 중복 webhook 이 발사된다"는 **버그**를 발견했고, 수정은 "`isActiveConversationPhase` 에서 booting 제외" 였다. 리뷰·plan 어디에도 "booting 에도 노출하되 시작 완료까지 요청을 큐잉한다"는 대안이 제안되거나 검토된 흔적이 없다. 즉 draft 가 사후에 만들어낸 가상의 대안이며, R6("초기 결정(기각): 첫 입력 시 lazy 시작")처럼 실제로 존재했다가 대체된 과거 설계가 아니다.
    2. **명령 단일화 대안**: `end_conversation`/`cancel` 은 PR #874 이전부터 EIA 레벨에서 이미 별개 명령으로 정의돼 있었다(EIA-IN-02 — `end_conversation` 은 특정 nodeId 대상, `cancel` 은 execution 전체). 위젯이 상태에 따라 둘 중 하나를 선택하는 것은 EIA 기존 계약을 그대로 매핑한 것이지, "위젯이 자체적으로 단일 명령 통일안을 제안했다가 기각"한 이력이 아니다. `webchat-session-controls-history-restore.md` 의 작업 목록에도 이 대안 검토 기록이 없다.
    3. 이 저장소의 기존 "기각" Rationale 관행(예: 본 문서 R6, `0-architecture.md` §R1·§R5, `4-security.md` §R4·§R6)은 모두 **실제로 제안되었거나 실제 이전 버전으로 존재했던** 대안을 날짜·PR·구체적 실패 사유와 함께 기록한다. R7 의 두 "기각" 문장은 이 관행과 형식은 같지만 실증 근거가 없는 사후 정당화라는 점에서 다르다 — 이 자체가 "산문 승격, 신규 결정 아님"이라는 draft 의 명시적 자기규정과 모순된다(§Rationale "R7 을 신규 결정이 아니라 산문 승격으로 둔 이유": "PR #874 에서 이미 구현·리뷰·머지된 동작이며, Rationale 부재는 탐색성 문제일 뿐이다").
    4. 다만 R7 의 나머지 서술(booting 게이팅의 (a)(b) 이유, optimistic 종료 선차단 문단)은 기존 §2·§3.1 산문과 문장 단위로 사실상 동일해 순수 승격이 맞다 — 문제는 "기각된 대안" 두 문장에 한정된다.
  - 제안: 두 "기각" 문장을 다음 중 하나로 조정
    - (a) "기각" 대신 "채택하지 않는 이유"로 표현을 낮추고, 실제 검토 이력이 아님을 밝힌다 (예: "다음 대안은 설계상 배제된다 — 실제 리뷰에서 개별 제안된 것은 아니며 이하는 사후 설명이다").
    - (b) 또는 실제로 이런 대안이 사람 간 논의에서 나온 적이 있다면 그 근거(날짜/PR/논의)를 명시해 R6·§R4 등과 동일한 격을 갖추게 한다.
    - (c) 최소한, 두 문장을 유지하려면 이 발견을 근거로 plan 의 자기규정("신규 결정 없음")을 "일부는 산문 승격, 일부(기각 대안 서술)는 신규 해설 추가"로 정정한다.

- **[INFO]** `conversation-thread.md` §9 스코프 예외는 §8.1/§8.2 결정의 번복이 아니라 이미 존재하던 암묵적 범위 분리의 명문화 — 단 §8 쪽 cross-ref 보강 권고
  - target 위치: 변경안 (2), `conversation-thread.md` §9 서두 신설 blockquote
  - 과거 결정 출처: `conversation-thread.md` §8.1("chip 표시 '권장→필수' 격상 이유", 3중 신호 강제 근거) · §8.2("UI 계약 SoT 격상" 결정) · §9 본문("Conversation Preview / history view가 conversationThread snapshot 을 source 별로 렌더하는 강제 규약")
  - 상세: §8.1·§8.2 는 **AI Agent 노드 run-results 패널의 conversation Preview 탭 / 좌측 실행 트리 timeline / 실행 이력 상세** — 즉 에디터·콘솔의 디버깅 surface — 를 대상으로 한 결정이다(§8.2 배경 문단, §9.6 "적용 surface" 목록도 이 두 surface 만 열거). 임베드 위젯(`codebase/channel-web-chat`)은 애초 이 문서의 `code:` frontmatter 목록에도 없고, `1-widget-app.md` 는 이미 (이번 draft 이전부터) 문서 상단에서 `Convention Conversation Thread §9.4·§9.5` 만 인용하며 §9.1(6-way 시각 매핑)·§9.2(3중 신호)는 인용하지 않는다 — 즉 위젯이 §9.1/§9.2 를 따르지 않는 2-way 축약 렌더(`presentation_user`·`ai_user`→user, 그 외→assistant)는 PR #874 이전부터 실질적으로 이미 시행 중이던 사실이며, 이번 변경은 그 기존 상태를 convention 문서 쪽에 명문화하는 것이지 §8.1/§8.2 의 결정을 되돌리는 것이 아니다.
  - §8.1 의 "3중 신호 강제" 근거("사용자 오인 0% 목표")는 구체적으로 **진짜 user 발화 vs 다른 source(assistant/tool/system) 간의 오인**을 막기 위함이었다 — 위젯의 2-way 축약도 `presentation_user`/`ai_user`(사용자 발화)를 여전히 user 로, 나머지(assistant/tool/system)는 assistant 로만 묶어 "사용자 발화 오인" 이라는 §8.1 의 핵심 위험은 그대로 회피한다(tool 결과를 assistant 로 뭉뚱그리는 것은 §8.1 이 막으려던 위험과 다른 차원). 따라서 정신(spirit) 차원에서도 번복이 아니라 적용 범위 분리로 본다.
  - 그럼에도 §8.1·§8.2 본문 자체에는 위젯이라는 별도 표면이 존재한다는 언급이 전혀 없어, 이번에 §9 서두에 추가하는 스코프 예외가 "어디서 유래한 결정인지"에 대한 역참조가 없다. Rationale 완결성 관점에서, §8.1 끝 또는 §8.2 끝에 1줄 cross-ref(예: "임베드 위젯의 §9.1/§9.2 제외 스코프는 §9 서두 blockquote 및 [7-channel-web-chat §2](../7-channel-web-chat/1-widget-app.md) 참조")를 추가하면 §8 인덱스만 보고도 예외 존재를 알 수 있어 향후 drift 재발(누군가 §8.1 만 보고 위젯도 3중 신호 대상이라 오판)을 막을 수 있다.
  - 제안: (2) 변경은 그대로 반영하되, §8.1 또는 §8.2 말미에 위젯 스코프 예외로의 1줄 cross-ref 추가를 권고(필수 아님, INFO).

- **[INFO]** frontmatter `code:` 추가 + §4 표 비고 보강 (변경안 3) — Rationale 연속성 이슈 없음
  - target 위치: 변경안 (3)
  - 상세: §8.4 "소비처 갱신(2026-07-09)" 이 이미 3-소비처(rehydration/SSE emit/getStatus REST) 확장을 결정·서술해 두었고, frontmatter `code:`·§4 표 비고는 그 결정을 다른 위치에 정합화하는 순수 미러링이다. 새 결정도, 기존 결정의 번복도 없다.
  - 제안: 없음 (그대로 반영 가능).

- **[INFO]** R 번호 부여(R4→R5→R6→R7)는 저장소 관행과 정합
  - target 위치: 변경안 (1) 헤더
  - 상세: 이 저장소의 R 번호는 문서-로컬 연속(`0-architecture.md` R1~R5, `2-sdk.md` R2~R5, `3-auth-session.md` R3~R6, `4-security.md` R1~R6 — 문서마다 시작 번호·개수가 다름, 즉 전역 번호가 아니라 각 문서 독립 카운터)이며, `1-widget-app.md` 는 이미 R4~R6 이 존재하므로 R7 이 다음 번호로 맞다. 다른 문서에도 R7 이 있어 전역 충돌 우려도 없다(각 문서 scope 로 앵커링됨, 예: `#r7-...`).
  - 제안: 없음.

## 요약

변경안 (2)·(3)은 Rationale 연속성 관점에서 문제가 없다 — (2)는 §8.1/§8.2 결정의 번복이 아니라 PR #874 이전부터 실질적으로 존재하던 위젯 2-way 축약과 §9.1/§9.2 강제 규약 사이의 암묵적 범위 분리를 명문화하는 것이고, (3)은 §8.4 기존 결정의 순수 미러링이다. 다만 (1)의 신설 `### R7` 은 대부분 기존 §2·§3.1 산문의 문장 단위 승격이 맞지만, "기각된 대안" 으로 명시한 두 문장(booting 큐잉 대안, 종료 명령 단일화 대안)은 실제 PR #874 코드리뷰 기록·plan 이력에서 검토된 흔적이 없는 사후 구성 서술이며, 이는 draft 자신이 명시한 "신규 결정 없음(산문 승격)" 원칙과 부분적으로 모순된다. 이 저장소의 기존 "기각" Rationale 관행(R6, §R4/§R6 등)은 모두 실제 이력을 근거로 하므로, 이 두 문장만 표현을 낮추거나 근거를 보강하는 조정을 권고한다. 그 외 R7 나머지 내용·R 번호 부여는 정합적이다.

## 위험도

MEDIUM

STATUS: DONE
