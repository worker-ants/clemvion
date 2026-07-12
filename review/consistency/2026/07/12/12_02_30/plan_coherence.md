# plan-coherence checker

> Disk-write 갭으로 원 output 유실 → journal.jsonl(wf_87e63bdd-d95) result 복구.
> 위험도: NONE, BLOCK 사유 없음.

### 발견사항

- **[INFO]** Plan 페이로드 구성 누락 — 관련 plan 이 프롬프트에서 빠짐
  - target 위치: `review/consistency/2026/07/12/12_02_30/_prompts/plan_coherence.md` (`## 진행 중 plan 문서 모음` 섹션, size-cap truncation)
  - 관련 plan: `plan/in-progress/embed-config-dto-rename.md`(본 diff 를 직접 구동하는 plan), `eia-context-schema-followups.md`, `spec-draft-pr874-deferred-docs.md`, `spec-sync-external-interaction-api-gaps.md`, `webchat-widget-presentation-followups.md`
  - 상세: 프롬프트에 포함된 plan 5건(`ai-agent-tool-connection-rewrite`·`cafe24-backlog-residual`·`chat-channel-discord-gateway`·`chat-channel-slack-socket-mode`·`chat-channel-visual-ssr-png`)은 전부 `spec/7-channel-web-chat` 를 전혀 언급하지 않는다. 반면 실제로 `spec/7-channel-web-chat` 를 참조하는 plan 5건(위 목록)은 25000-토큰 cap 에 걸려 페이로드에서 잘려나갔다(파일 끝 `... (truncated due to size limit) ...`). 페이로드만 근거로 판단했다면 "관련 plan 없음 → 충돌 없음" 으로 오판했을 것이다.
  - 제안: 이번 검토는 실제 워크트리 파일(`plan/in-progress/*.md`)을 직접 Read 해 대체 검증했다(아래 결과 참조). 향후 plan-coherence payload 조립 시 target spec_area 로 filename/내용 사전 grep 해 관련 plan 을 우선 포함하도록 오케스트레이터 로직 개선을 권고(정보 제공 목적, target/plan 본문 수정 불요).

- **[INFO]** 직접 검증한 관련 plan 5건 — 모두 target 과 정합
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md §3.1·§R8·§R9`, `spec/7-channel-web-chat/4-security.md` frontmatter `code:`
  - 관련 plan: `plan/in-progress/embed-config-dto-rename.md`, `spec-sync-external-interaction-api-gaps.md`, `webchat-widget-presentation-followups.md`, `spec-draft-pr874-deferred-docs.md`, `eia-context-schema-followups.md`
  - 상세:
    - `embed-config-dto-rename.md` — 실제 diff(`git diff origin/main`: `embed-config.dto.ts`→`embed-config-response.dto.ts` rename + `4-security.md` frontmatter 경로 갱신)와 plan 의 "변경 범위" 가 1:1 일치. 이 리뷰 자체가 그 plan 의 마지막 체크리스트 항목(`/consistency-check --impl-done`)이다.
    - `spec-sync-external-interaction-api-gaps.md` 의 미해결 항목("web-chat 위젯 클라이언트 소비" — `execution.replay_unavailable` no-op, "getStatus 일반 nodeOutput 키-allowlist" 잔여)은 target §3.1 이 정확히 같은 미구현 상태("소비 분기는 아직 미배선(no-op)…이벤트 기반 감지로의 교체는 클라이언트 측 후속")로 정직하게 서술 — 완료로 과장하지 않음.
    - `webchat-widget-presentation-followups.md` 의 "carousel 잘림 배너 미구현" 항목은 target §2·§R8 이 동일하게 "carousel 은 잘림 배너 자체가 미구현이라 별도 후속으로 추적" 으로 반영. table 부분만 완료로 반영된 것도 plan 상태와 일치.
    - `spec-draft-pr874-deferred-docs.md` 의 내용(1-widget-app §R7 신설, conversation-thread §9 위젯 스코프 예외)은 target 에 정확한 최종 문구(`ai_assistant`·`ai_tool`·`system`→assistant 구체 열거, `system_error` 도달 불가 명시)로 이미 반영됨. 이 plan 파일 자체는 체크박스 2개(`doc-guard`·`commit+PR`)가 미완인 채 `plan/in-progress/` 에 남아 있으나, 이는 origin/main(merge-base 이후 커밋 `6e2bb0bae` PR #925)에서 이미 `plan/complete/` 로 정리된 **병렬 브랜치 상태**이고 본 워크트리 브랜치가 그 시점 이전에 분기된 것 — worktree/branch 동시성 이슈는 본 검토 범위 밖이므로 발견사항으로 등재하지 않음.
    - `eia-context-schema-followups.md` 의 유일한 미해결 항목(swagger.md §1-4 본문 보강, planner 트랙)은 `spec/7-channel-web-chat` 범위와 무관.

### 요약
프롬프트 페이로드에 포함된 5개 plan 문서는 target(`spec/7-channel-web-chat`)과 무관했고, 실제로 관련 있는 5개 plan(`embed-config-dto-rename`·`eia-context-schema-followups`·`spec-draft-pr874-deferred-docs`·`spec-sync-external-interaction-api-gaps`·`webchat-widget-presentation-followups`)은 크기 제한으로 페이로드에서 누락돼 있었다. 워크트리 파일을 직접 Read 해 재검증한 결과, 이번 diff(embed-config DTO 파일명 rename)는 그 자체가 `embed-config-dto-rename.md` plan 의 마지막 체크리스트 항목이며, target 문서가 참조·서술하는 다른 미해결 backlog 항목들(replay_unavailable 클라이언트 미소비, carousel 잘림 배너 미구현)도 모두 완료로 과장되지 않고 plan 상태와 정확히 일치하게 서술돼 있다. `spec-draft-pr874-deferred-docs.md` 의 잔여 체크박스는 병렬 브랜치(origin/main)에서 이미 정리된 상태로, 검토 범위인 동시 작업 충돌에 해당해 발견사항에서 제외했다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 중 어느 것도 발견되지 않았다.

### 위험도
NONE
