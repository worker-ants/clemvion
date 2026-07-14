# Plan 정합성 검토 — spec/5-system/15-chat-channel.md (impl-done)

## 점검 배경

본 diff(origin/main...HEAD)는 `plan/in-progress/eia-command-waiting-surface-guard.md` 의
F-1(nodeId 일치 검사) · F-2(surfaceMismatch 안내) · F-4(control-plane 안내 구조 정리) ·
F-5(telegram raw-send MarkdownV2-safe DTO 검증) · F-6(WS nodeId forwarding) 구현이다.
사용자 요청에 따라 plan 문서를 직접 확인해 F-1~F-6 전부 완료 + 미채택 백로그만 잔존하는지
검증했다 (payload 의 "진행 중 plan 문서 모음" 에는 이 plan 파일이 포함되지 않아 절대경로로
직접 Read).

## 발견사항

- **[INFO]** plan 문서 자체는 완료 상태이나 `plan/in-progress/` 에 남아 있음
  - target 위치: (해당 없음 — plan 문서 자체)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md`
  - 상세: 메인 체크리스트 8항목·`spec 동기(S-1)` 5항목·F-1~F-6 각 세부 체크리스트가 전부
    `[x]` 이고, 남은 항목은 전부 "**미채택(백로그)**" 로 명시적으로 결정·사유가 붙은 비차단
    항목뿐이다 (F-6: `expectedNodeId` optional-positional→options 객체화, `/continue` nodeId
    파라미터 신설; F-4: `ChatChannelInboundService` 분리; F-5: defaults 의 telegram escape
    baked-in 잔여 갭). CHANGELOG 에도 F-1/F-2/F-4~F-6 전부 등재됨(`CHANGELOG.md` L3-31).
    사용자가 확인 요청한 "F-1~F-6 전부 완료·미채택 백로그만 잔존" 상태와 **일치**한다.
    다만 plan 문서가 여전히 `in-progress/` 에 있어, 향후 동일 target(`15-chat-channel.md`
    또는 `4-execution-engine.md`) 대상 plan-coherence 검토가 이 완료 plan 을 매번 재조회하게
    된다.
  - 제안: `.claude/docs/plan-lifecycle.md` 기준에 따라 `plan/complete/` 로 이동할지 개발자가
    판단(백로그 3건을 별도 잔여 plan 으로 분리 후 이관하는 `cafe24-backlog-residual.md` 선례
    참고). 정합성 자체를 막는 문제는 아니므로 비차단.

- **[INFO]** (target 범위 밖, 참고) `spec/5-system/4-execution-engine.md` §7.5.1 표 각주 문구가
  F-6 반영 후에도 "1곳" 으로 남아 있어 아래 커버리지 표와 문면상 어긋나 보임
  - target 위치: `spec/5-system/15-chat-channel.md` 자체가 아니라 인접 spec
    `spec/5-system/4-execution-engine.md` §7.5.1 (L1047)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` F-6 (완료로 표기)
  - 상세: L1047 "nodeId 불일치" 행 설명이 "현재 구현은 외부 EIA `/interact`(`InteractDto.nodeId`)
    진입점 **1곳이 지정한다**" 라고 서술하는데, 바로 아래(L1050-1057) "nodeId 검사 진입점별
    커버리지" 표는 F-6 반영으로 WS continuation 도 "적용 (nodeId 제공 시)" 라고 명시한다. 전자는
    F-1 시점(1개 진입점) 서술이 F-6 병합 후 그대로 남아 표와 다소 모순되는 인상을 준다(표 자체는
    정확함, 다만 L1047 요약 문장이 stale).
  - 제안: 이 파일은 이번 검토의 target(`15-chat-channel.md`)이 아니라 plan-coherence 범위 밖일
    수 있으나, F-6 이 "완료" 로 표기된 동일 plan 항목과 직접 연관되므로 참고용으로 남긴다.
    cross-spec-consistency 또는 다음 spec 갱신 시 L1047 문장을 "1곳(무조건) / WS(조건부)" 형태로
    정정 권장. target 문서(`15-chat-channel.md`) 자체의 정합성에는 영향 없음.

## target(spec/5-system/15-chat-channel.md) 확인 결과

- `surfaceMismatch` 키(§4.1.1 표·예제)·`SURFACE_MISMATCH_DEFAULTS` KO/EN 문구·F-5
  `LanguageHintsRawSendValidator`(raw-send 7키·telegram 한정·`UNSAFE_TELEGRAM_MARKDOWN`) 설명이
  모두 target 문서에 이미 반영되어 있음을 절대경로 grep 으로 직접 확인(L224-225, L257-265).
  diff 상 target spec 파일 자체의 변경 라인은 보이지 않았으나("구현 대상 spec 영역: (없음)"),
  이는 해당 spec 갱신이 이미 별도 커밋으로 반영되어 있어 이번 diff 범위에 없는 것일 뿐 —
  본문 확인 결과 plan F-2/F-5 의 "spec 등재" 체크박스 완료 주장과 실제 target 문서 내용이
  일치한다.

## 미해결 결정 충돌 / 선행 plan 미해소 / 후속 항목 누락 점검

- **미해결 결정과의 충돌**: 없음. plan 의 모든 결정(F-1 Approach B, F-3 "공지 불필요", 대기 표면
  매트릭스 등)이 이미 사용자 승인·확정 상태이며 target 문서·diff 가 이 결정과 상충하는 내용을
  담고 있지 않다.
- **선행 plan 미해소**: 없음. `plan/in-progress/` 전체(29개 문서 + `node-output-redesign/`
  서브폴더)를 grep 한 결과 `surfaceMismatch`/`expectedNodeId`/`STATE_MISMATCH`/
  `assertNodeId`/`resolveWaitingNodeExecutionId` 를 참조하는 다른 plan 은 없다. 관련
  `spec-sync-external-interaction-api-gaps.md`·`spec-sync-websocket-protocol-gaps.md` 도 항목
  전부 완료(`[x]`) 상태라 target 변경이 가정하는 선행 조건과 충돌하지 않는다.
- **후속 항목 누락**: 없음. `plan/in-progress/chat-channel-discord-gateway.md` ·
  `chat-channel-slack-socket-mode.md` · `chat-channel-visual-ssr-png.md` (모두 backlog,
  unstarted) 는 표면 가드/nodeId 검사와 무관한 트랙이라 이번 diff 로 무효화되거나 신규 후속
  항목이 필요한 부분이 없다.

## 요약

diff 는 `plan/in-progress/eia-command-waiting-surface-guard.md` 의 F-1·F-2·F-4·F-5·F-6 구현을
마무리하는 코드/spec/문서 변경이며, plan 파일을 직접 확인한 결과 메인 체크리스트·spec 동기(S-1)·
F-1~F-6 전부 `[x]` 완료로 표기되어 있고 잔존 항목은 모두 사유가 명시된 "미채택(백로그)" 뿐이라
사용자가 확인 요청한 상태와 정확히 일치한다. target 문서(`spec/5-system/15-chat-channel.md`)에는
`surfaceMismatch`/F-5 raw-send 검증이 이미 반영되어 있고, 다른 `plan/in-progress/**` 문서 중
이 변경과 충돌하거나 무효화되는 미해결 결정·선행조건·후속 항목은 발견되지 않았다. 유일한
관찰 사항은 (1) 완료된 plan 문서가 아직 `in-progress/` 에 남아 향후 검토 시 재조회 대상이 되는
점, (2) target 범위 밖인 인접 spec(`4-execution-engine.md` §7.5.1)의 요약 문장 하나가 F-6 반영
후 표와 살짝 어긋나는 점 — 둘 다 비차단 INFO.

## 위험도

LOW
