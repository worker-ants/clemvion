# Plan 정합성 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 검토 방법

target 이 참조·전제하는 plan 을 실제 저장소 파일(번들이 아니라 `plan/in-progress/**` 원본)로
대조했다. 핵심 대조 대상:

- `plan/in-progress/spec-sync-websocket-protocol-gaps.md` (target 착수 근거 tracker)
- `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` (같은 tracker 의 형제 항목 2종을 종결한 draft)
- `spec/5-system/6-websocket-protocol.md` 실제 본문 (§1.2·§1.3·§4.6·§5·§6.1·§9.2·Rationale)
- `plan/in-progress/**` 전수에서 `ws-client.ts`·`token_expired`·`use-execution-events`·`§6.1` 언급 grep

## 발견사항

- **[INFO]** target 문서에 실행 상태를 추적하는 `## 체크리스트` 섹션이 없다
  - target 위치: 문서 전체 (149줄, `## Rationale` 로 종료)
  - 관련 plan: 같은 세션에서 나온 형제 draft `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 는
    `실측 → --spec BLOCK:NO → spec 반영 → --impl-done` 체크박스 트랙을 갖는 관례를 보인다
  - 상세: target 은 "사용자 결정 2026-09-02 — (a) 채택" 이라 선언만 하고, 이 draft 자신이
    `/consistency-check --spec` 게이트를 통과했는지 표시할 자리가 없다. 지금 이 검토가 그
    게이트의 일부이므로 당장 결함은 아니지만, 이 라운드 결과를 기록할 체크리스트가 문서에
    없으면 다음 세션이 "이 draft 가 승인됐는지" 를 다시 처음부터 판단해야 한다
  - 제안: target 하단에 `## 체크리스트` 를 추가해 `--spec` 결과·spec 반영 커밋·tracker 동시
    갱신 여부를 기록할 것 (spec 반영 커밋 시점에 해도 된다 — 지금 당장 차단 사유는 아님)

- **[INFO]** 형제 draft `spec-draft-ws-wontdo-maintenance-appping.md` 의 spec 변경이 이미
  실제로 landed 됐는데 plan 파일 자체는 미체크 상태로 `in-progress/` 에 남아 있다
  - target 위치: 없음 (target 자신의 결함이 아니라 인접 plan 의 상태)
  - 관련 plan: `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` (체크리스트 없음,
    `started: 2026-09-02`) vs `spec/5-system/6-websocket-protocol.md:1109-1123`
    (`R-wontdo-maintenance-appping` Rationale 본문 — 두 텍스트를 직접 대조한 결과 **완전
    일치**), `spec/5-system/6-websocket-protocol.md:868` (`system.maintenance` 행이 이미
    `_(비채택 won't-do)_`), tracker `spec-sync-websocket-protocol-gaps.md:72-73` (해당 두 항목
    `[x]` 로 이미 체크됨)
  - 상세: spec 과 tracker 는 이미 "완료" 상태로 정합한데, 그 변경을 만든 draft 파일 자신만
    완료 표시가 없다. target 문서가 같은 tracker·같은 spec 파일을 이어서 편집하므로, 다음
    세션이 이 draft 를 "아직 미완료" 로 오독하고 §4.6 `system.maintenance` 행을 다시 손댈
    잠재 위험이 있다 (직접적인 target 결함은 아님)
  - 제안: target 을 착수하는 것과 별개로, `spec-draft-ws-wontdo-maintenance-appping.md` 에
    체크리스트를 채우고 `plan/complete/` 로 이동하는 마무리 커밋을 이번 세션 어딘가에서 수행할 것

## 정합성 확인 (충돌 없음으로 판정한 항목)

- **미해결 결정과의 충돌 없음**: tracker `spec-sync-websocket-protocol-gaps.md:87-90` 이 남긴
  정확한 두 미해결 축(ⓐ 소켓 수명이 토큰 수명에 종속되는가, ⓑ 사전 통지 lead time 을 두는가)을
  target 이 각각 "예(종속)"·"예(60초)" 로 답한다 — placeholder 를 우회한 것이 아니라 그
  placeholder 가 요구한 결정 그 자체를 내리는 문서다. tracker·형제 won't-do draft(이미 landed)
  양쪽 모두 "`auth.token_expired` 는 제품 결정 대기 — 별도 planner 턴" 이라 명시적으로 이 target
  으로 위임하고 있어 방향이 일치한다.
- **선행 plan 미해소 없음**: target 이 전제하는 유일한 선행 사실(3종 중 2종 won't-do 종결)은
  spec·tracker 양쪽에 이미 `[x]`/본문 반영으로 완료돼 있다 — 확인 완료.
  `auth.refreshed.expiresAt` (§1.3, won't-do 인 in-band 갱신 예시)를 명명 선례로 인용한 것도
  기능 의존이 아니라 표기 형식 선례 인용이라 문제 없다.
- **후속 항목 누락 없음(범위 내)**: `ws-client.ts` 를 참조하는 다른 `plan/in-progress/**` 문서는
  없다(전수 grep). WS §6.1·§9.2 를 동시에 건드리는 다른 진행 중 plan도 없다. `EIA` 의
  `per_execution` 토큰 만료/갱신(§5.5, `TOKEN_EXPIRED`)은 완전히 별개 인증 계층이라 이 결정과
  네임스페이스가 겹치지 않는다(target 문서 자신도 이를 실측으로 확인해 뒀다). target 이 계획한
  tracker 갱신 항목(#9·#10)이 tracker 의 미해결 서술을 정확히 덮는다.

## 요약

target 은 `spec-sync-websocket-protocol-gaps.md` 가 명시적으로 남겨 둔 "결정 필요" 두 항목을
정확히 겨냥해 답하는 문서이고, 그 tracker·형제 draft(이미 spec 에 landed)와 방향·근거·인용
모두 일치한다. 이번 세션에서 새로 발견된 plan 충돌·선행 미해소·후속 누락은 없다. 다만 인접한
형제 draft(`spec-draft-ws-wontdo-maintenance-appping.md`)가 이미 완료된 변경을 미체크 상태로
남겨 둔 것은 target 과 같은 spec 파일·같은 tracker 를 공유하므로 세션 마무리 시 함께 정리하는
것이 안전하다.

## 위험도
NONE
