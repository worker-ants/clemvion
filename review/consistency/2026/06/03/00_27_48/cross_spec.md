# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 대상: `spec/5-system/16-system-status-api.md` + `spec/2-navigation/15-system-status.md`

---

## 발견사항

### [WARNING] health 어휘 충돌 — `unhealthy` vs `down`

- **target 위치**: `spec/5-system/16-system-status-api.md` §3 health 파생 규칙, `QueueStatusDto.health` 및 `SystemStatusOverviewDto.overall` 타입 정의
- **충돌 대상**: `spec/5-system/3-error-handling.md` §7.2 헬스 체크 응답 (`/api/health`)
- **상세**: `3-error-handling.md` §7.2 의 `/api/health` 는 `{ "status": "healthy" | "degraded" | "unhealthy" }` 3값 체계를 정의한다. `16-system-status-api.md` 는 `"healthy" | "degraded" | "down"` 3값 체계를 사용하며, `"unhealthy"` 대신 `"down"` 을 도입한다. 두 체계는 `"degraded"` 와 `"healthy"` 를 공유하지만 최악 상태 값이 다르다 (`unhealthy` vs `down`). `16-system-status-api.md` Rationale R-4 에서 이 분기를 명시적으로 설명하고 있으나, `3-error-handling.md` §7 에는 이 분기가 반영되지 않아 두 spec 이 동일 시스템의 서로 다른 health 어휘를 정의하는 상태다. 클라이언트가 `/api/health` 와 `/api/system-status/overview` 를 함께 사용할 때 `unhealthy` 와 `down` 을 다른 엔드포인트에서 받으면 혼동이 생길 수 있다.
- **제안**: `spec/5-system/3-error-handling.md` §7.2 에 노트를 추가해 "큐 상태 API(`/api/system-status/overview`)는 별도 health 어휘(`healthy/degraded/down`)를 사용한다 — `spec/5-system/16-system-status-api.md` R-4 참조"를 명시하거나, 두 API 의 어휘 분기 근거를 `3-error-handling.md` §7 에 인라인 참조한다. target(16-system-status-api.md) 자체는 변경 불필요 — Rationale R-4 가 분기를 설명하고 있어 의도된 결정이다.

---

### [WARNING] RBAC 매트릭스에 System Status 리소스 미등록

- **target 위치**: `spec/5-system/16-system-status-api.md` §2 API 정의 — "admin role 가드 없음 — 집계 카운트만 반환하므로 워크스페이스·유저 식별 불가 (§4 보안)"
- **충돌 대상**: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스
- **상세**: auth spec §3.2 의 RBAC 매트릭스는 `Statistics | R | R | R | R` 을 마지막 공개 리소스로 열거하며, `System Status` 리소스가 존재하지 않는다. target spec 은 "모든 로그인 사용자에게 노출" (NAV-SS-06, §4 보안 절) 이라고 명시하지만, auth spec RBAC 에는 이 정책이 반영되어 있지 않다. 구현자가 RBAC 매트릭스만 보면 System Status API 에 대한 권한 정책을 파악하지 못한다.
- **제안**: `spec/5-system/1-auth.md` §3.2 의 RBAC 매트릭스에 `System Status | R | R | R | R` 항목을 추가하고 각주로 "워크스페이스 스코핑 예외 — 전역 집계만 반환, `spec/5-system/16-system-status-api.md` §4 참조"를 기술한다. target 변경 없이 auth spec 측 동기화로 해결.

---

### [WARNING] 워크스페이스 스코핑 예외가 API 컨벤션에 미반영

- **target 위치**: `spec/5-system/16-system-status-api.md` §2 — "워크스페이스 스코핑 예외: 본 API는 시스템 전역 상태를 반환하므로 `X-Workspace-Id` 스코핑을 적용하지 않는다"
- **충돌 대상**: `spec/5-system/2-api-convention.md` §2.3 워크스페이스 스코핑 — "모든 리소스 API는 현재 워크스페이스 컨텍스트에서 동작한다"
- **상세**: `2-api-convention.md` §2.3 은 예외 없이 "모든 리소스 API"가 워크스페이스 컨텍스트에서 동작한다고 기술하고 있다. target spec 은 이 규칙의 예외임을 자체 문서에서 설명하고 있으나, `2-api-convention.md` 에는 예외 경로가 정의되어 있지 않다. 구현자가 컨벤션 문서만 보면 `/api/system-status/overview` 가 X-Workspace-Id 를 요구하는 것으로 오해할 수 있다.
- **제안**: `spec/5-system/2-api-convention.md` §2.3 에 예외 카테고리(시스템 전역 API 등)를 열거하고 `/api/system-status/overview` 를 첫 사례로 추가한다. target 변경 불필요.

---

### [INFO] data-flow/9-observability.md 의 도메인 커버리지에 System Status API 미포함

- **target 위치**: `spec/5-system/16-system-status-api.md` (전체)
- **충돌 대상**: `spec/data-flow/9-observability.md` — "Health check · Dashboard · Statistics · Alerts" 4개 도메인을 커버하나 System Status API(큐 상태 집계) 는 언급 없음
- **상세**: `data-flow/9-observability.md` 의 System role 절은 Health check / Dashboard / Statistics / Alerts evaluator 를 열거한다. 신규 `GET /api/system-status/overview` 는 관측성 도메인의 일부(큐 집계 뷰)이나 해당 data-flow 문서에 섹션이 없다. 직접 모순은 아니지만, 관측성 흐름을 추적하는 독자가 큐 상태 API 를 찾지 못할 수 있다.
- **제안**: `spec/data-flow/9-observability.md` 에 "1.4 System Status (큐 집계)" 섹션을 추가해 `GET /api/system-status/overview` → `QueueRegistry.enumerate()` → BullMQ `getJobCounts()` 흐름을 간략히 기술하고 `16-system-status-api.md` 를 링크한다. target 변경 불필요.

---

### [INFO] spec/0-overview.md §8 문서 맵에 16-system-status-api.md 및 15-system-status.md 미등록

- **target 위치**: `spec/5-system/16-system-status-api.md`, `spec/2-navigation/15-system-status.md` (신규 파일들)
- **충돌 대상**: `spec/0-overview.md` §8 문서 맵 테이블
- **상세**: `spec/0-overview.md` §8 의 문서 맵은 `12-webhook.md`, `10-graph-rag.md` 같은 주요 spec 파일을 개별 행으로 등록하고 있다. 신규 spec 파일들이 등록되어 있지 않아 overview 를 통한 탐색이 불완전하다. 또한 §6.3 로드맵/미구현 테이블에 System Status 항목이 없다.
- **제안**: `spec/0-overview.md` §8 테이블에 System Status 행을 추가하고, §6.3 로드맵 테이블에 항목을 추가한다. target 변경 불필요.

---

## 요약

`spec/5-system/16-system-status-api.md` 와 `spec/2-navigation/15-system-status.md` 는 서로 일관되며, 관련 spec(`spec/2-navigation/_product-overview.md` 의 NAV-SS-* 요구사항, `spec/data-flow/0-overview.md` 의 큐 카탈로그, `spec/5-system/_product-overview.md` 의 NF-OB-06)과도 직접 모순이 없다. 주요 concern 은 두 가지다. 첫째, `/api/health` 의 health 어휘(`unhealthy`)와 `/api/system-status/overview` 의 어휘(`down`)가 다른 값을 사용하는데, target spec Rationale R-4 는 이를 설명하지만 `3-error-handling.md` 에 해당 분기가 역참조되지 않아 구현자가 두 값을 혼용할 수 있다. 둘째, `1-auth.md` RBAC 매트릭스와 `2-api-convention.md` 워크스페이스 스코핑 규칙에 System Status API 예외가 반영되어 있지 않아, 구현자가 컨벤션·권한 문서만 보면 잘못된 가드를 달거나 X-Workspace-Id 의존 코드를 작성할 수 있다. 세 WARNING 은 모두 target 변경 없이 관련 spec 동기화로 해결 가능하며, 구현 착수 전 수정을 권장한다.

## 위험도

MEDIUM
