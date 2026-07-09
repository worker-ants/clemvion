# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md

## 메모: payload 보강

`_prompts/plan_coherence.md` 에 첨부된 "진행 중 plan 문서 모음" 은 크기 캡으로 5개 plan
(`ai-agent-tool-connection-rewrite` · `cafe24-backlog-residual` · `chat-channel-discord-gateway` ·
`chat-channel-slack-socket-mode` · `chat-channel-visual-ssr-png`)만 포함했고, target frontmatter 가
직접 참조하는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 와 이번 작업의 구동 plan
`plan/in-progress/webchat-session-controls-history-restore.md` 는 **누락**돼 있었다. 두 plan 모두 이
target 과 가장 직접적으로 연관되므로, 파일시스템에서 직접 읽어 보강한 뒤 검토했다.

## 발견사항

이번 diff(`git diff origin/main -- spec/5-system/14-external-interaction-api.md`)는 §5.3 콜아웃 +
Rationale R17 에 `getStatus` 의 `context.conversationThread` 를 durable 스냅샷으로 노출하도록
문구를 갱신한 것으로, `plan/in-progress/webchat-session-controls-history-restore.md` §"작업 A. 스펙
재조정(planner)" 항목("`14-external-interaction-api.md` §5.3 + R17: getStatus 가 waiting_for_input
시 durable `Execution.conversation_thread` 를 `context.conversationThread` 로 노출")과 문면상
정확히 일치한다. 이 plan 의 "사용자 결정(2026-07-09)" 절은 이미 확정된 결정이며 "결정 필요"로 남은
항목이 없어 target 이 우회하는 미해결 결정은 없다.

target frontmatter `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 의
유일한 미해소 항목은 "분산(다중 인스턴스) SSE/notification fan-out"(§R10, Redis pub/sub 미구현)이며,
이는 in-memory per-instance 구독 관련 사안으로 이번 diff(DB 기반 durable thread 노출, 인스턴스 무관)와
겹치지 않는다 — 오히려 이번 diff 는 그 plan 이 지적한 "buffer 만료/재시작/인스턴스 스위치 시 복원 불가"
문제의 한 축(REST 단발 조회 경로)을 독립적으로 완화한다. 상충 없음.

- **[INFO]** 구동 plan 의 검증 체크박스 미갱신
  - target 위치: 없음(target 자체 이슈 아님) — `plan/in-progress/webchat-session-controls-history-restore.md` §검증
  - 관련 plan: `plan/in-progress/webchat-session-controls-history-restore.md` §검증 (`[ ] 백엔드 unit (getStatus thread)` 등 4항목 전부 미체크)
  - 상세: working tree 에 이미 `codebase/backend/src/modules/external-interaction/interaction.service.ts` 의 `getStatus()` 가 durable `conversationThread` 를 동봉하도록 수정돼 있고(§R17 서술과 일치), spec 쪽도 이번 diff 로 갱신됐다. 그러나 구동 plan 의 검증 체크박스(백엔드 unit·프런트 unit·ai-review·e2e)는 아직 전부 미체크 상태다. plan_coherence 관점의 "충돌"은 아니지만, 프로젝트 관례("plan 체크박스 = 실제 상태")상 구현·리뷰가 끝나는 시점에 같은 커밋으로 체크박스를 갱신해야 한다.
  - 제안: target 자체는 변경 불필요. `developer` 워크플로 완주 시(단위테스트·ai-review·e2e 확인 후) plan 체크박스를 함께 커밋할 것.

target 이 참조하는 다른 spec_impact 대상(`spec/7-channel-web-chat/1-widget-app.md` §3.1 의 "durable `conversationThread` 동봉" 문구, `spec/7-channel-web-chat/3-auth-session.md`)도 이번 diff 와 방향이 일치해 cross-spec 모순은 발견되지 않았다(단 이 두 문서는 이번 호출의 target 이 아니므로 별도 target 회차에서 재검증 필요).

그 외 plan/in-progress 중 EIA 를 언급하는 문서(`self-hosting-deployment.md` SSRF cross-ref, `merge-p2-async-fanin.md` seq 단조성 cross-ref, `node-output-redesign/README.md` P0 ai-agent `output.error` cross-ref, `ai-agent-tool-connection-rewrite.md` tool_call payload namespace cross-ref)는 모두 이번 diff 범위(§5.3/R17, `conversationThread` 노출)와 무관한 절을 가리켜 영향 없음. `chat-channel-*` 3개 backlog plan 도 무관.

## 요약

이번 target 변경은 그 자체를 구동한 `plan/in-progress/webchat-session-controls-history-restore.md` §A 작업 항목과 문면·의도가 정확히 일치하며, 이미 확정된 사용자 결정을 우회하지 않는다. target frontmatter 의 `pending_plans` (`spec-sync-external-interaction-api-gaps.md`)에 남은 유일한 미해소 항목(분산 SSE fan-out)과도 충돌하지 않고 오히려 그 항목이 지적한 문제의 일부(REST 경로의 새로고침 복원)를 독립적으로 완화한다. 다른 plan/in-progress 문서와의 선행조건 미해소나 후속 항목 누락도 발견되지 않았다. 유일한 참고 사항은 구동 plan 의 검증 체크박스가 아직 구현 상태를 반영하지 않는다는 프로세스 메모(INFO)뿐이다.

## 위험도
NONE
