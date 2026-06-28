# Cross-Spec 일관성 검토 결과

대상 문서: `spec/5-system/16-system-status-api.md`

---

### 발견사항

- **[WARNING]** `data-flow/9-observability.md` 의 큐 수 "16개" 가 target 선언(17개)과 불일치
  - target 위치: `spec/5-system/16-system-status-api.md` §1 QueueRegistry 표 (17행: execution-run, background-execution, execution-continuation, document-embedding, graph-extraction, notification-webhook, cafe24-token-refresh, makeshop-token-refresh, schedule-execution, login-history-pruner, workspace-invitations-pruner, notification-secret-rotator, terminal-revoke-reconcile, chat-channel-token-rotator, integration-expiry-scanner, alerts-evaluator, agent-memory-extraction)
  - 충돌 대상: `spec/data-flow/9-observability.md §1.4` — "QueueRegistry · 16개 BullMQ 큐" (flowchart 레이블 및 본문 "16개 큐")
  - 상세: `agent-memory-extraction` 큐가 target 의 QueueRegistry 표에 모니터링 대상으로 명시되면서 합계가 17개가 됐다. 그러나 observability spec 은 "16개" 를 여전히 하드코딩한 flowchart 레이블과 본문 문장으로 기술한다. `data-flow/0-overview.md §1.2` 는 이미 "17개" 로 갱신됐으므로, observability spec 의 수치만 구식 상태다. target 자체는 17개로 올바른 선언을 하고 있으나, observability spec 이 구 수치(16개)를 유지해 2개 문서가 서로 다른 숫자를 기술하게 됐다. (단, target 이 동시에 `agent-memory-extraction` 의 코드 미등재 구현 갭을 명시하므로, "선언상 17개, 실제 코드 레지스트리 아직 16개" 상황이다 — 이 갭은 target 이 스스로 노출하고 있어 모순 아님.)
  - 제안: `spec/data-flow/9-observability.md §1.4` flowchart 레이블(`QueueRegistry · 16개 BullMQ 큐`)과 본문 "16개 큐" 를 "17개 큐" 로 갱신한다. 구현 갭 해소(agent-memory-extraction 코드 등재) 시점에 함께 처리하거나, spec 선언 기준으로 먼저 갱신해도 무방하다.

- **[INFO]** `agent-memory-extraction` 큐의 그룹 배정 — `knowledge-base` vs 모듈 출처(`agent-memory.module.ts`)
  - target 위치: `spec/5-system/16-system-status-api.md` §1 QueueRegistry 표, `agent-memory-extraction` 행 `group = knowledge-base`
  - 충돌 대상: `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 — `agent-memory-extraction` 의 등록 모듈을 `agent-memory.module.ts` 로 기술. `spec/5-system/17-agent-memory.md` 는 agent_memory 를 KnowledgeBase 와 분리된 별도 테이블로 명시("KB 와는 분리된 별도 테이블", §1).
  - 상세: target 이 `agent-memory-extraction` 을 `knowledge-base` 그룹에 배치하는 것은 pgvector 인프라(EmbeddingService) 재사용에 근거한 분류로 보이나, 제품 영역(agent-memory.module)·데이터 모델 분리 관점에서는 `system` 또는 별도 그룹이 더 자연스럽다는 해석도 가능하다. 현재 다른 spec 이 이 그룹 배정을 직접 모순 기술하지 않으므로 CRITICAL 충돌은 아니다. UI 화면(spec/2-navigation/15-system-status.md §2.3) 은 4개 표시 그룹("실행 / 지식베이스 / 알림·통합 / 스케줄·시스템")을 정의하며 `agent-memory-extraction` 이 어느 UI 그룹에 들어가는지 명시하지 않아, `knowledge-base` API 그룹 → "지식베이스" UI 섹션 매핑이 의도인지 확인이 필요하다.
  - 제안: `spec/2-navigation/15-system-status.md §2.3` 에 `agent-memory-extraction` 이 "지식베이스" 표시 그룹에 속함을 명시하거나, 또는 그룹 배정 근거를 target Rationale 에 1문장 추가해 후속 리더가 의문을 갖지 않게 한다.

- **[INFO]** `QueueStatusDto.group` 열거값에 `notification` 미포함 — UI 표시 그룹명("알림·통합")과의 용어 비대칭
  - target 위치: `spec/5-system/16-system-status-api.md` §2 `QueueStatusDto.group: "execution" | "knowledge-base" | "integration" | "system"`
  - 충돌 대상: `spec/2-navigation/15-system-status.md §2.3` — UI 표시 섹션 레이블 "알림·통합"
  - 상세: API 의 `group` 값은 `integration` 만 존재하며 `notification` 은 없다. `notification-webhook` 큐가 `integration` 그룹에 속하고, UI 화면은 이를 "알림·통합"이라는 합성 섹션으로 묶어 표시한다. 직접 모순은 아니며 UI 가 API 의 `integration` 그룹을 알림 포함 개념으로 표시 변환하는 패턴이지만, 명칭 매핑이 두 문서에 명시적으로 기술되지 않아 후속 개발자 혼동 여지가 있다.
  - 제안: target §2 또는 `15-system-status.md §2.3` 에 "group='integration' 큐들이 UI에서 '알림·통합' 섹션에 함께 표시된다" 는 1문장 대응 설명을 추가한다.

---

### 요약

`spec/5-system/16-system-status-api.md` 는 다른 영역과 직접 모순되는 CRITICAL 충돌 없이 작성됐다. API 계약(`GET /api/system-status/overview`)은 `spec/5-system/2-api-convention.md §2.3` 의 시스템 전역 API 예외 테이블에 이미 정합 등재되어 있고, 응답 래핑(`{data}`)·JWT 인증·X-Workspace-Id 예외 처리 모두 API 컨벤션과 일치한다. 큐 목록의 단일 진실 역할은 `spec/data-flow/0-overview.md §4` 에 적절히 위임하고 있다. 다만 `spec/data-flow/9-observability.md §1.4` 가 큐 수를 "16개" 로 표기하는 구식 기술이 발견됐으며(data-flow/0-overview.md 는 이미 17개로 갱신됨), `agent-memory-extraction` 큐의 `knowledge-base` 그룹 배정 근거와 UI 표시 섹션 매핑에 대한 문서화 보강을 권장한다.

---

### 위험도

LOW
