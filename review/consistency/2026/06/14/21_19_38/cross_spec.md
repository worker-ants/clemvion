# Cross-Spec 일관성 검토 결과

대상: `spec/5-system/16-system-status-api.md` (draft)

---

## 발견사항

### 큐 그룹 분류 — `terminal-revoke-reconcile` 의 `system` group
- **[WARNING]** `terminal-revoke-reconcile` 을 `system` group 으로 분류했으나 같은 `external-interaction.module.ts` 의 다른 큐(`notification-webhook`)는 `integration` group
  - target 위치: `spec/5-system/16-system-status-api.md` §1 대상 큐 레지스트리 표 (draft L56)
  - 충돌 대상: `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` L199·L203
  - 상세: data-flow §4 는 `notification-webhook` 과 `terminal-revoke-reconcile` 을 모두 `external-interaction.module.ts` 에 귀속하지만, draft 는 두 큐를 서로 다른 group(`integration` vs `system`)으로 분류한다. 기능적 성격(outbound webhook 발송 vs repeatable reconciliation cron)의 차이에서 비롯된 판단이라 논리적 근거는 있다. 그러나 이 분류 기준이 spec 어디에도 명시되지 않아 후속 큐 추가 시 혼동 가능성이 있다.
  - 제안: §1 표의 `terminal-revoke-reconcile` 비고에 "(EIA reconciler cron — integration 도메인 모듈 소속이나 reconciliation cron 성격으로 system group 분류)" 등의 명시적 주석 추가. 또는 `spec/5-system/2-api-convention.md` 나 본 spec §1 에 group 분류 기준 한 줄 추가.

---

### 큐 수 불일치 — `spec/data-flow/9-observability.md` "13개" 잔존
- **[WARNING]** `spec/data-flow/9-observability.md` 가 "13개 BullMQ 큐" 를 2곳(mermaid 다이어그램 L142 · 본문 L147)에 명시하나 draft 채택 후 등록 큐는 16개가 됨
  - target 위치: 해당 없음 — target spec 자체의 문제 아님
  - 충돌 대상: `spec/data-flow/9-observability.md` L142 (mermaid 노드 라벨) / L147 (본문 설명)
  - 상세: data-flow/0-overview.md §4 SoT 는 이미 16개 큐를 열거한다. observability spec 의 "13개" 는 makeshop-token-refresh·terminal-revoke-reconcile·agent-memory-extraction 추가 이전 시점의 잔여 참조다. target draft 가 terminal-revoke-reconcile 을 레지스트리에 추가하므로 불일치가 더욱 두드러진다.
  - 제안: `spec/data-flow/9-observability.md` L142·L147 의 "13개" 를 "16개" 로 갱신. target spec 채택과 동반 수정 권장.

---

### API 계약 — 워크스페이스 스코핑 예외 정합
- **[INFO]** target §2 의 `X-Workspace-Id` 스코핑 예외 선언이 `spec/5-system/2-api-convention.md §2.3 시스템 전역 API 예외` 표와 일치
  - target 위치: `spec/5-system/16-system-status-api.md` §2
  - 충돌 대상: `spec/5-system/2-api-convention.md §2.3`
  - 상세: api-convention spec 의 예외 표에 `GET /api/system-status/overview` 가 이미 등재되어 있고 설명이 정렬됨. 충돌 없음.

---

### RBAC 모델 — 전원 노출 일관성
- **[INFO]** target §2·§4 의 "admin role 가드 없음 / 모든 로그인 사용자 노출" 이 내비게이션 PRD `NAV-SS-06` 및 `spec/2-navigation/15-system-status.md` 와 일치
  - target 위치: `spec/5-system/16-system-status-api.md` §2·§4
  - 충돌 대상: `spec/2-navigation/_product-overview.md` L156 (NAV-SS-06)
  - 상세: 충돌 없음.

---

### health 어휘 — `/api/health` binary 와 구분 명시
- **[INFO]** target §Rationale R-4 가 `/api/health` 의 `healthy|unhealthy` binary 와 본 API 의 3단계(`healthy|degraded|down`)를 명시적으로 구분하고 `data-flow/9-observability.md §1.1` 을 probe SoT 로 지정
  - target 위치: `spec/5-system/16-system-status-api.md` §Rationale R-4
  - 충돌 대상: `spec/data-flow/9-observability.md §1.1`
  - 상세: 두 어휘 체계가 `healthy` 값을 공유하지만 R-4 가 명시적으로 인지·설명한다. 충돌 없음.

---

### 큐 SoT 준수 선언 — target 이 data-flow §4 를 SoT 로 명시
- **[INFO]** target §1 서두가 "큐 목록의 단일 진실은 `spec/data-flow/0-overview.md §4`" 임을 명시하여 SoT 관계를 올바르게 선언함
  - target 위치: `spec/5-system/16-system-status-api.md` §1 SoT 주의 callout
  - 충돌 대상: 없음
  - 상세: 계층 책임이 명확히 선언되어 있어 향후 큐 추가 시 갱신 경로가 분명함. 충돌 없음.

---

## 요약

target spec draft(16-system-status-api.md)는 기존 spec 영역과 직접 모순되는 CRITICAL 항목이 없다. 핵심 확인 사항은 두 가지다. (1) `terminal-revoke-reconcile` 큐의 `system` group 분류가 같은 모듈의 `notification-webhook` 이 `integration` group 에 속하는 것과 표면적으로 불일치하지만 기능 성격(reconciliation cron) 기반의 의도적 분리이므로 WARNING 수준이다 — 분류 근거를 spec 에 명시하면 해소된다. (2) `spec/data-flow/9-observability.md` 의 "13개 큐" 표기가 draft 채택 후 실제 16개와 더 크게 어긋나므로 동반 갱신이 필요하다. API 계약·RBAC·health 어휘·SoT 선언 등 나머지 항목은 기존 spec 과 정렬되어 있다.

## 위험도

LOW
