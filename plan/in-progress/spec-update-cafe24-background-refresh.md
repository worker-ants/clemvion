---
worktree: prod-rereview-fix-a7c93f
started: 2026-05-16
owner: developer
---

# spec-update — §11 만료 스캐너에 cafe24 background refresh 흐름 추가

## 배경

`1f3cb79..HEAD` 누적 변경 재리뷰(2026-05-16) 결과, `IntegrationExpiryScannerService` 에 신설된 **`enqueueCafe24BackgroundRefresh`** 흐름과 그를 가속하는 **`V050__integration_cafe24_connected_rotated_idx`** 마이그레이션이 `spec/2-navigation/4-integration.md §11` 에 문서화되어 있지 않다.

## 사실 관계

- `backend/src/modules/integrations/integration-expiry-scanner.service.ts` 에 `enqueueCafe24BackgroundRefresh` 와 `JOB_CAFE24_BACKGROUND_REFRESH` 가 추가되어, `service_type='cafe24' AND status='connected' AND lastRotatedAt < cutoff` (또는 NULL) 행에 대해 BullMQ refresh job 을 enqueue 한다.
- `V049__integration_consecutive_network_failures` (3회 연속 실패 카운터) 와 `V050__integration_cafe24_connected_rotated_idx` (`CREATE INDEX CONCURRENTLY` 부분 인덱스) 가 함께 들어왔다.
- `spec/2-navigation/4-integration.md §11.1` 의 "스캐너 잡" 박스가 `connected-expiry` / `pending-install-ttl` / `usage-log-prune` 3개만 기술하고, neue `cafe24-background-refresh` job 은 빠져 있다.
- §6 "상태 전이" 의 `connected → error(network) | 노드 실행 중 커넥션 실패가 3회 연속` 항은 이미 있다 — 이 항이 V049 의 카운터·임계값과 정합. 추가 갱신 필요 없음.

## 제안 (project-planner 에게 위임)

`spec/2-navigation/4-integration.md` 의 다음 두 위치를 갱신한다.

1. **§11 상단 안내문** — 세 개 BullMQ job 목록을 **네 개** 로 정정 (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / **`cafe24-background-refresh`**).
2. **§11.x 신규 소절** — cafe24-background-refresh 의 책임 한 줄 + 대상 행 조건 (`service_type='cafe24' AND status='connected' AND (lastRotatedAt IS NULL OR lastRotatedAt < now() - <threshold>)`) + 결과(`Cafe24ApiClient.refreshAccessToken` 큐 위임).
3. **§11.1 스캐너 잡 박스** — `cafe24-background-refresh` 한 줄 추가 (의사코드 1–2줄).
4. Rationale 끝부분에 "왜 별도 job 으로 분리하는가" 메모: `connected-expiry` 의 일일 1회 알림 흐름과 분리해 retry/메트릭 격리, partial index(`V050`) 로 운영 부하 최소화.

위 4개 항목은 한 차례 `project-planner` 세션으로 묶어 처리할 수 있다.

## 영향

- 영역 문서 외부 영향 없음 (구현은 이미 main 에 있음).
- spec 만 최신화하면 onboarding · 운영자 안내 일관성 복구.

## 진행 상태

- [ ] project-planner 진입해 위 4개 항목 작성
- [ ] `/consistency-check --spec` 통과 확인
- [ ] PR merge 시 본 plan 을 `plan/complete/` 로 `git mv`
