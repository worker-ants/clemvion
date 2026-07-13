# Plan 정합성 검토 — spec-draft-webchat-crossref-ws-wire-drift.md

## 검토 범위
- Target: `plan/in-progress/spec-draft-webchat-crossref-ws-wire-drift.md` (spec draft, `--spec` 모드)
- 대조 대상: `plan/in-progress/**` 전체 33개 항목(29개 top-level `.md` + `node-output-redesign/` 하위 29개)
- Target 의 spec_impact 4개 문서(`3-workflow-editor/4-ai-assistant.md`, `5-system/6-websocket-protocol.md`,
  `5-system/14-external-interaction-api.md`, `7-channel-web-chat/0-architecture.md`)를 키로 전수
  grep(`waitingNodeId`/`form-interaction.service`/`button-interaction.service`/`ai-turn-orchestrator.service`/
  `eia-events.ts`/`4-ai-assistant.md`/`markdown-renderer`/`4-security.md`/`6-websocket-protocol`/
  `14-external-interaction-api`/`0-architecture.md`)한 뒤 교집합 파일을 전문 대조.
- Target 이 인용하는 모든 line 번호·인용문(WS §4.4 intro line 380, EIA §6.2 line 585-593,
  architecture §3 line 82, 4-ai-assistant.md line 145, markdown-renderer.tsx 의 rehype-raw 미사용,
  `fix-webchat-sse-field-map.md` 의 이월 문구)을 실제 파일과 대조해 사실관계 100% 일치 확인.

## 발견사항

검토 결과 CRITICAL/WARNING 급 충돌을 발견하지 못했다. 이하는 확인 과정에서 정리된 INFO 성격 메모다.

- **[INFO]** node-output-redesign 과의 레이어 분리 확인 (충돌 아님, 참고용)
  - target 위치: 편집 2 (`spec/5-system/6-websocket-protocol.md §4.4` caveat), 편집 3 (`EIA §6.2`)
  - 관련 plan: `plan/in-progress/node-output-redesign/{ai-agent,information-extractor,form}.md` — 진행 중인
    대규모 노드별 `NodeHandlerOutput`(`output.result.*` 등) 구조 재설계
  - 상세: node-output-redesign 은 **노드 핸들러 레벨**(`output.*`) 구조를 다루고, target 은 **엔진 fanout
    envelope 레벨**(`waitingNodeId`/`nodeOutput`/`conversationConfig` 필드명)을 다룬다. `conversationConfig`
    문자열은 node-output-redesign 어느 파일에도 등장하지 않아(grep 0건) 두 트랙이 실제로 겹치지 않음을
    확인했다. target 의 캐비어트가 EIA §6.2 를 단일 SoT 로 가리키는 pointer 설계라, node-output-redesign 이
    추후 관련 필드를 바꾸더라도 EIA §6.2 갱신만으로 WS §4.4 캐비어트는 자동으로 최신 상태를 계속 가리킨다
    (target 의 "3중 복제 회피" 설계가 이 리스크를 이미 흡수).
  - 제안: 조치 불필요. 참고 기록만.

- **[INFO]** `eia-command-waiting-surface-guard.md` 완료 상태이나 `plan/in-progress/` 잔류
  - target 위치: 없음 (target 과 직접 상호작용 없음)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` — 체크리스트 전항목 `[x]`,
    "spec 동기 (S-1) — **완료**" 로 자체 종결 표기됐으나 `plan/complete/` 로 아직 이동되지 않음
  - 상세: target 의 편집 3(EIA §6.2 line 593 정정)과 파일 충돌은 없다 — 이 plan 이 손댄 §6.2 영역
    (`expectedCommands` 각주, line 595-602)과 target 이 손대는 영역(line 593 dangling 참조 문구)이
    서로 다른 문단이라 편집 경합 없음. 다만 두 plan 이 근접한 §6.2 영역을 최근에 반복 편집하고
    있어 line 번호 인용이 향후 stale 화되기 쉬운 지점이라는 점만 기록.
  - 제안: target 작업과 무관 — 별도로 plan lifecycle 정리(이동) 시점에 처리하면 됨.

## 요약

Target 문서는 PR #945 consistency-check 의 WARNING #1·#2 를 처분하는 spec draft로, (1) plan/in-progress
전체 33개 항목을 대상으로 target 의 spec_impact 4개 문서·관련 코드 심볼(waitingNodeId, form/button-interaction
service, ai-turn-orchestrator, eia-events.ts, markdown-renderer.tsx 등)을 키로 교차검색한 결과 어떤 진행 중
plan 도 target 이 다루는 영역(4-ai-assistant.md §3.2 메시지 리스트 행 cross-ref, WS §4.4/EIA §6.2 wire 필드
캐비어트)에 "결정 필요"로 남겨둔 미해결 항목을 두고 있지 않았고, target 이 그런 항목을 우회하거나 충돌하는
결정을 내리는 지점도 없었다. (2) target 이 전제하는 사실관계(line 번호·인용문·완료된 선행 plan
`fix-webchat-sse-field-map.md`·`eia-command-waiting-surface-guard.md` 의 EIA §6.2 기존 caveat 존재 등)는
전부 현재 spec/코드 상태와 실측 대조해 정확했다 — 선행 조건 미해소 사례 없음. (3) target 의 변경(spec-doc
caveat + dangling 참조 정정)이 다른 plan 의 후속 항목을 무효화하거나 신규 후속을 요구하는 지점도 발견되지
않았다 — node-output-redesign 은 레이어가 달라(노드 핸들러 output vs 엔진 fanout envelope) 실질적 교집합이
없음을 grep 으로 확인했다. 전반적으로 plan 정합성 관점에서 target 은 착수해도 안전하다.

## 위험도

NONE
