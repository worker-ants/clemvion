# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target: `spec/7-channel-web-chat/` (0-architecture · 1-widget-app · 2-sdk · 3-auth-session · 4-security · 5-admin-console · _product-overview)
관련 in-progress plan 전수: `plan/in-progress/*.md` (50여 개)

---

### 발견사항

- **[WARNING]** `2-sdk.md §3` 의 `localStorage` 명시가 backlog 의 `spec_impact` 목록에서 누락
  - target 위치: `spec/7-channel-web-chat/2-sdk.md §3` — `resetSession` 설명 "위젯이 SSE 연결을 닫고 저장 세션(localStorage)을 비운 뒤 새 execution 을 시작"
  - 관련 plan: `plan/in-progress/web-chat-quality-backlog.md` §A 항목 A.1 — "per_execution 토큰 저장 localStorage → sessionStorage" (미완료 `[ ]`)
  - 상세: backlog A.1 의 `spec_impact` 노트는 마이그레이션 시 갱신 대상으로 `4-security.md` · `3-auth-session.md` 를 명시하고 있으나, `2-sdk.md §3` 의 `localStorage` 명시 (resetSession 문맥)는 목록에서 빠져 있다. 마이그레이션이 실행될 때 이 파일이 누락 갱신될 가능성이 있다.
  - 제안: `web-chat-quality-backlog.md` §A.1 의 `spec_impact` 목록에 `spec/7-channel-web-chat/2-sdk.md §3 (resetSession)` 을 추가. target spec 자체는 현재 구현 상태(`localStorage`)를 정확히 반영하고 있으므로 즉시 변경 불요.

- **[INFO]** `spec-sync-external-interaction-api-gaps.md` 의 `replay_unavailable` 미구현과 target spec 의 로컬 시간 workaround — 정합 확인
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md §3.1` SSE 재연결 단락 — "EIA 의 버퍼 만료 신호(`replay_unavailable`)는 계획·미구현이라, 위젯은 버퍼 만료를 로컬 시간 기준(>5분)으로 판단한다(EIA-NF-03 연계 TODO)"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — "SSE 버퍼 만료 시 `execution.replay_unavailable` emit" (미완료)
  - 상세: target spec 이 EIA 미구현 사실을 인지하고 명시적 TODO + 현행 workaround 를 기술하고 있어 plan 과 정합. 충돌 없음.
  - 제안: 추적 메모로 보존. `replay_unavailable` 가 EIA 쪽에서 구현될 때 `1-widget-app.md §3.1` TODO 구문을 이벤트 기반 로직으로 교체하는 후속을 `web-chat-quality-backlog.md` 에 등재 고려.

- **[INFO]** `spec-sync-webhook-gaps.md` 의 WH-NF-02 (1MB 본문 크기 미결) — target spec 과 충돌 없음
  - target 위치: `spec/7-channel-web-chat/4-security.md §4` — "body 32KB: webhook gate(`PublicWebhookThrottleGuard`)에서 구현됨 v1"
  - 관련 plan: `plan/in-progress/spec-sync-webhook-gaps.md` — WH-NF-02 (`spec/5-system/12-webhook.md` 의 1MB 통일 임계 미결)
  - 상세: webhook gaps 의 미결 항목은 `spec/5-system/12-webhook.md`(인증 webhook 포함 전체 임계 결정)에 관한 것이고, 7-channel-web-chat `4-security.md` 는 공개 webhook 의 32KB 게이트(이미 구현 확정)만 명시한다. 두 영역은 scope 가 겹치지 않는다. 충돌 없음.
  - 제안: 추적 메모.

---

### 요약

`spec/7-channel-web-chat/` 6개 문서는 `plan/in-progress/` 내 진행 중 작업의 미해결 결정을 우회하거나 일방적으로 내리는 항목이 없다. 유일하게 주목할 점은 `web-chat-quality-backlog.md` §A.1 의 localStorage → sessionStorage 마이그레이션 backlog 항목이 갱신 대상 spec 목록에 `2-sdk.md §3` 를 빠뜨리고 있는 것이며, 이는 미래 마이그레이션 시 spec 누락 갱신 위험으로 이어질 수 있다. 나머지 in-progress plan(ai-agent-tool-connection-rewrite · discord-gateway · slack-socket-mode · cafe24-backlog 등)은 웹챗 영역과 scope 가 교차하지 않는다.

### 위험도

LOW
