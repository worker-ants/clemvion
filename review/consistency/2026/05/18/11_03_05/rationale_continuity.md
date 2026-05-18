### 발견사항

- **[WARNING]** Item B — `ensureFreshToken` 직접 호출이 BullMQ 큐 우회 가능성
  - target 위치: `plan/in-progress/cafe24-expired-self-healing.md` §B "Cafe24McpToolProvider.buildTools() 의 expired refresh-then-include" 1번 항목 (`cafe24ApiClient.ensureFreshToken` (또는 동등한 큐 경로 `refreshViaQueue`) 1회 호출)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)" — "production wiring 은 항상 큐 경유", 기각된 대안 in-memory mutex 유지만은 "옛 single-pod 한계 그대로. 멀티 pod 배포 시 race 미해소"
  - 상세: `ensureFreshToken` 을 buildTools 에서 직접 호출하면 BullMQ `jobId = integrationId` dedup 이 작동하지 않아 여러 AI Agent 노드가 동시에 동일 통합의 tool catalog 를 빌드할 때 refresh race 가 재발한다. plan 본문이 "또는 동등한 큐 경로 `refreshViaQueue`" 를 병기하고 있으나 둘 중 어느 경로를 택할지 확정하지 않아, 구현 시 큐 우회가 선택될 여지를 남긴다. 큐 우회는 Rationale 에서 명시적으로 기각된 in-memory mutex 단독 의존과 동일한 문제를 초래한다.
  - 제안: Item B 의 1번 항목을 "`Cafe24ApiClient` 의 `refreshViaQueue` (또는 `cafe24-token-refresh` 큐 enqueue + waitUntilFinished) 경로만 사용하며 `ensureFreshToken` 직접 호출을 금지"로 확정 명시. spec 정정(Item C) 시 §B 구현 지침에도 "큐 경유 강제" 한 줄 추가.

- **[WARNING]** Item B — buildTools 단계 refresh 트리거가 기존 Rationale 의 허용 진입점 외의 제3 경로
  - target 위치: `plan/in-progress/cafe24-expired-self-healing.md` §B 전체
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)" — "proactive (API 호출 직전) + background (일일 스캐너) 양쪽 진입점이 동일 큐를 사용"
  - 상세: Rationale 이 명시한 큐 진입점은 (1) `Cafe24ApiClient.ensureFreshToken` proactive (API 호출 직전), (2) `cafe24-background-refresh` 일일 스캐너 두 가지다. Item B 는 LLM tool catalog 빌드(`buildTools`) 시점이라는 제3 진입점을 추가한다. 이 자체는 Rationale 을 직접 위반하지는 않으나, 해당 Rationale 에 새 진입점이 등록되지 않아 향후 refresh 경로 목록을 파악하는 데 blind spot 이 생긴다. 또한 buildTools 는 매 LLM inference 마다 호출될 수 있어, idle 통합에 대해 일일 스캐너보다 훨씬 빈번한 refresh 가 큐에 쌓일 수 있다 — 이는 "더 짧게(예: 매일) 잡으면 Cafe24 leaky bucket 에 불필요한 부담"이라는 `cafe24-background-refresh` 10일 임계 근거와 의미적으로 충돌한다.
  - 제안: Item C 의 spec 정정에 "buildTools 시점 refresh 시도는 expired + refresh_token 보유 행에 한정, dedup 큐 경유이므로 leaky bucket 부담 최소화" 근거 한 줄을 Rationale 갱신 항으로 추가. spec/4-nodes/4-integration/4-cafe24.md §9.6 또는 해당 섹션에 buildTools 진입점을 기존 두 진입점과 함께 명시.

- **[INFO]** Item A — spec `connected-expiry` 행 정정이 "refresh 실패 시 status_reason 통일 (2026-05-16)" 결정과의 정합 명시 누락
  - target 위치: `plan/in-progress/cafe24-expired-self-healing.md` §C 첫 번째 항목 (`spec/data-flow/5-integration.md` connected-expiry 행 정정)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)" — "`expired` 는 두 경로로 한정 — (1) refresh_token 없는 일반 OAuth provider의 token_expires_at 만료, (2) Cafe24 Private 의 pending_install → expired (install_timeout)"
  - 상세: plan Item C 의 spec 정정 기술이 "옛 0d 일률 격하 흐름은 폐기"만 언급하고, 해당 정정이 "refresh 실패 시 status_reason 통일" Rationale 의 `expired` 경로 한정 결정과 직접 연계되는 사항임을 명시하지 않는다. spec 편집자가 두 결정의 관계를 모르면 정정 범위를 좁게 해석할 수 있다.
  - 제안: Item C spec 정정 항에 "2026-05-16 'refresh 실패 시 status_reason 통일' Rationale 의 `expired` 경로 한정과 정합" 참조 한 줄 추가. spec/data-flow/5-integration.md 정정 커밋 메시지에도 동일 연계 명시.

- **[INFO]** Item B — `status === 'error'` 제외 근거가 MCP Client §8.4 참조로만 기술되어 통합 Rationale 연결 미약
  - target 위치: `plan/in-progress/cafe24-expired-self-healing.md` §B 3번 항목 (`status === 'error'` 는 본 경로 적용 외)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Cafe24 Private 의 `connected → error(auth_failed)` 복구 경로 (2026-05-14, 2026-05-16 갱신)" — "만약 refresh 가 실패해 `error(auth_failed)` 로 떨어지면 복구 유일 경로는 삭제 후 재등록"
  - 상세: `status === 'error'` 제외 이유로 MCP Client §8.4 외부 MCP 정책만 인용했으나, 핵심 근거는 통합 Rationale 의 "error(auth_failed) 복구 경로는 사용자 재인증(삭제 후 재등록)만 정식"이라는 결정이다. 해당 Rationale 연결이 없으면 미래 독자가 error 제외 이유를 MCP 외부 정책의 파생으로만 이해할 수 있다.
  - 제안: §B 3번 항목에 "4-integration.md Rationale '`connected → error(auth_failed)` 복구 경로' — error 상태의 유일 복구는 reauth(삭제+재등록)이므로 buildTools 에서 자동 refresh 시도 부적절" 인용 추가.

### 요약

Target 문서(cafe24 expired self-healing plan)가 채택한 핵심 설계 방향 — scanner 0d 분기에서 cafe24+refresh_token 보유 행을 `expired` 격하 대신 BullMQ 큐 enqueue 로 교체(Item A), 기존 `expired` 통합을 buildTools 에서 1회 refresh 후 회복 시 포함(Item B) — 은 "refresh 실패 시 status_reason 통일(2026-05-16)", "BullMQ cafe24-token-refresh 큐 race 해소(2026-05-16)" 등 기존 Rationale 결정과 방향이 일치하며, 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 부분은 없다. 다만 Item B 에서 `ensureFreshToken` 직접 호출 경로와 큐 경유 경로를 양자택일로 열어 둔 점이 "production wiring 은 항상 큐 경유" 원칙과 충돌 여지를 남기며, buildTools 라는 새 refresh 진입점이 기존 Rationale 의 진입점 목록에 등록되지 않아 leaky bucket 영향과 진입점 문서화 측면에서 보완이 필요하다. 전반적으로 기존 결정의 논리를 올바르게 연장하고 있으며 WARNING 수준의 정합 보완으로 해소 가능한 범위다.

### 위험도
LOW
