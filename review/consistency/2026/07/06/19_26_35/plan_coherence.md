### 발견사항

- **[INFO]** payload 에 실제 관련 plan 2건 누락, 그러나 target 자체 정합성엔 영향 없음
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표 전체
  - 관련 plan: `plan/in-progress/spec-update-notifications-firing.md`, `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`
  - 상세: 이번 checker 호출 payload(`_prompts/plan_coherence.md`)에 실린 "진행 중 plan 문서 모음"에는 `ai-agent-tool-connection-rewrite` · `cafe24-backlog-residual` · `chat-channel-discord-gateway` · `chat-channel-slack-socket-mode` · `chat-channel-visual-ssr-png` 5건만 포함되어 있고, 실제로 이 diff/target 과 직접 관련된 `plan/in-progress/spec-update-notifications-firing.md`(target 의 flip 을 발주한 바로 그 plan) 와 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`(PR1/2/3 진행 트래커)는 목록에서 빠져 있다. orchestrator 의 plan 파일 선정(관련도 랭킹 또는 glob) 로직이 이 케이스에서 가장 관련성 높은 두 파일을 놓쳤다. 이번 검토는 실제 파일시스템에서 두 plan 을 직접 읽어 별도 확인했다.
  - 제안: 코드 수정 불필요. orchestrator 의 plan 후보 수집 로직이 target spec 경로(`spec/data-flow/8-notifications.md`)를 언급하는 in-progress plan 을 항상 포함하도록(grep 기반 backstop) 점검 권장.

- **[NONE]** OPEN 결정(team_invite 이메일 2통)과 target 의 관계 — 충돌 없음, 오히려 정합
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `team_invite` 행 ("⚠ 초대 링크 이메일과 별개라 기존 가입자는 이메일 2통 — UX 재검토 대기")
  - 관련 plan: `plan/in-progress/spec-update-notifications-firing.md` 항목 "team_invite 이메일 2통 (side-effect 재검토) — planner 결정 대기(OPEN)"
  - 상세: plan 은 (a) 현행 유지(2통) / (b) 초대링크 이메일 생략 / (c) channel=in_app 하향 3안을 놓고 아직 미결이라 명시한다. target 은 이 미결 사안을 **일방적으로 확정하지 않고** "spec-literal(현행 both 유지)"을 잠정 값으로 채택하면서 동일 plan 파일을 각주로 명시 cross-reference 했다. `git log` 확인 결과 이 spec 갱신 자체가 같은 워크트리의 별도 커밋(`79e61e8a9`, `b63c4de55`)으로 이미 반영되어 있고, plan 파일의 flip 체크박스(`execution_failed`/`schedule_failed`/`team_invite` flip 3건)도 `[x]` 완료, OPEN 항목만 미체크로 남아 있어 상태가 정확히 대응한다. 즉 target 은 미해결 결정을 우회하지 않고 정직하게 반영 중임.
  - 제안: 조치 불필요. 향후 (a)/(b)/(c) 중 하나가 결정되면 target §1.1 team_invite 행과 plan 체크박스를 동시 갱신할 것(이미 plan 문서에 그 지시가 있음).

- **[NONE]** 5건의 payload 포함 in-progress plan 과 target 간 교차 영향 없음
  - target 위치: `spec/data-flow/8-notifications.md` 전체
  - 관련 plan: `ai-agent-tool-connection-rewrite.md`, `cafe24-backlog-residual.md`, `chat-channel-discord-gateway.md`, `chat-channel-slack-socket-mode.md`, `chat-channel-visual-ssr-png.md`
  - 상세: 5건 모두 AI Agent 도구 연결, Cafe24 API 필드셋, Discord/Slack Gateway, 시각 노드 SSR PNG 등 알림 파이프라인과 무관한 영역이다. 이들의 미해결 결정(도구 등록 모델, WebSocket 인프라 도입, SSR 라이브러리 선정 등)은 target 이 다루는 `execution_failed`/`schedule_failed`/`team_invite` 알림 발사 로직과 교차하지 않는다.
  - 제안: 없음.

### 요약
target(`spec/data-flow/8-notifications.md`)의 `execution_failed`/`schedule_failed`/`team_invite` 발사 소스 반영은 이를 직접 발주한 `spec-update-notifications-firing.md` 및 진행 트래커 `spec-sync-data-flow-8-notifications-gaps.md`와 완전히 정합한다 — flip 대상 3건은 plan 에서 이미 완료 표시됐고, 유일하게 남은 OPEN 결정(team_invite 중복 이메일 UX)은 target 이 일방 확정하지 않고 spec-literal 값을 잠정 채택하면서 동일 plan 파일을 명시적으로 각주 처리해 추적을 이어가고 있다. 다만 이번 checker 호출에 전달된 payload 의 plan 후보 5건에는 정작 가장 관련도가 높은 위 두 plan 이 빠져 있어(무관한 plan 5건만 포함), orchestrator 의 plan 수집 로직에 개선 여지가 있다 — 이는 target 자체의 문제가 아니라 검토 파이프라인의 커버리지 이슈다.

### 위험도
NONE
