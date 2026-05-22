# Spec: 트리거 목록 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#32-trigger-list-트리거-목록) · [Spec 레이아웃](./_layout.md) · [데이터 모델 - Trigger](../1-data-model.md#28-trigger)

---

## 1. 화면 구조

```
┌─────────────────────────────────────────────────────────┐
│  Triggers                                               │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────┐       │
│  │ 🔍 Search...     │  │ Type: All ▼           │       │
│  └──────────────────┘  └────────────────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ● order-webhook          Webhook    Active          │ │
│  │   → Order Processing     POST /hooks/order  📋  ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ● daily-report  [Schedule] Schedule   Active          │ │
│  │   → Daily Report Gen     0 9 * * *  Next: 09:00 ⋮  │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ ○ manual-test            Manual     Inactive        │ │
│  │   → Test Workflow                             ⋮     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 트리거 목록 항목

| 요소 | 설명 |
|------|------|
| 상태 아이콘 | Active(●) / Inactive(○) |
| 트리거 이름 | 사용자가 지정한 트리거 이름 |
| 유형 뱃지 | Webhook / Schedule / Manual |
| 연결된 워크플로우 | "→ 워크플로우 이름" 형태로 표시. 클릭 시 해당 에디터로 이동 |
| 상세 정보 | Webhook: HTTP 메서드 + 경로, Schedule: Cron 표현식 |
| Schedule 태그 | Schedule 유형 트리거에 `[Schedule]` 태그 표시 + Cron 표현식 + 다음 실행 시각 |
| URL 복사 버튼(📋) | Webhook 트리거에만 표시. 전체 URL을 클립보드에 복사 |
| 더보기(⋮) | 4 항목 드롭다운: ① 상세 보기 (drawer 오픈, 모든 역할 가시 — 메타·인증·Schedule·EIA 카드 노출. **호출 이력은 본 drawer 에 포함되지 않음** — Rationale R-7), ② 활성/비활성 토글 (`editor`+), ③ 호출 이력 (**별도 Dialog** 로 Recent Calls **만** 표시 — 메타·인증·EIA·Schedule 카드는 노출되지 않음. 모든 역할 가시. Rationale R-6 참조), ④ 삭제 (`editor`+, [§4 확인 다이얼로그](#4-삭제-정책)). Schedule 타입은 추가로 "스케줄 관리에서 편집" 항목 표시 (→ `/schedules?triggerId=…` 딥링크). 트리거 "수정" 은 별도 항목이 아니라 ①의 drawer 안에서 [§2.3.1 필드 권한 매트릭스](#231-필드-권한-매트릭스) 의 카드별 edit 토글로 수행 |

### 2.2 필터

| 필터 | 옵션 |
|------|------|
| 유형 | 전체 / Webhook / Schedule / Manual |
| 상태 | 전체 / Active / Inactive |

### 2.3 트리거 상세 패널 (항목 클릭 시)

우측 슬라이드 패널로 상세 정보를 표시한다.

| 섹션 | 내용 |
|------|------|
| 기본 정보 | 이름, 유형, 상태, 연결된 워크플로우 |
| Webhook 상세 | 전체 URL, HTTP 메서드, 인증 방식, Content-Type |
| Schedule 상세 | Cron 표현식 (읽기 전용), 타임존, 다음 실행 예정 시각. "스케줄 관리에서 편집" 링크 → Schedule 화면으로 이동 |
| 인증 설정 | 연결된 AuthConfig 정보 |

> **호출 이력은 본 drawer 에 포함되지 않는다.** §2.1 의 ⋮ 메뉴 "호출 이력" 항목이 여는 별도 Dialog 가 동일 데이터를 더 가벼운 modal 로 제공한다 (Rationale R-6 / R-7).

### 2.3.1 필드 권한 매트릭스

상세 드로어는 카드별 "편집" 토글로 read 모드 ↔ edit 모드를 전환한다. `editor` 미만 역할은 edit 토글 자체가 노출되지 않는다.

| 카드 | 필드 | 모드 | 비고 |
|------|------|------|------|
| Overview | `name` | edit | `PATCH /api/triggers/:id { name }`. 1~120 자, 워크스페이스 내 unique 강제는 백엔드 (충돌 시 409) |
| Overview | `type` | read-only | 생성 후 변경 불가. 변경하려면 삭제·재생성 |
| Overview | `isActive` | edit (토글 버튼) | §2.1 행 액션과 동등 — 동일 API. PATCH body 와 `/toggle` 양쪽 모두 허용 (Rationale R-4) |
| Overview | `workflowId` | read-only (v1) | 변경 가능하게 만들 경우 cascading 영향 (실행 이력 trigger_id 보존, 새 workflow 의 input schema 불일치 가능) 검토 필요. v1 은 잠금 (Rationale R-1) |
| Webhook Configuration | `endpointPath` | edit | `PATCH /api/triggers/:id { endpointPath }`. 변경 시 옛 URL 은 즉시 404 — 다이얼로그 경고 후 진행. `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`) |
| Webhook Configuration | `httpMethod` | read-only | v1 은 POST 고정 |
| Webhook Configuration | `authType` | edit | `PATCH /api/triggers/:id { config: { authType, … } }`. none / hmac / bearer 전환 가능 |
| Webhook Configuration | `hmacHeader` | edit | `authType = hmac` 일 때만 표시. default = `X-Hub-Signature-256` |
| Webhook Configuration | `hmacSecret` | edit (입력) + rotate (v1.1 후속) | v1: 신규 secret 입력. v1.1: rotate 액션 — 패턴은 [Spec EIA §7](../5-system/14-external-interaction-api.md#7-시크릿-회전--token-revoke). Rationale R-2 의 TBD 참조 |
| Webhook Configuration | `bearerToken` | edit (입력) | 신규 token 입력. write-only — 응답에는 마스킹된 형태(`…last4`)만 노출 |
| Webhook Configuration | `contentType` | read-only | v1 은 `application/json` 고정 |
| Webhook Configuration | URL (전체) | read-only (자동 계산) | `endpointPath` 변경 시 자동 갱신, 직접 입력 불가 |
| Schedule Configuration | `cronExpression` | read-only | 편집은 Schedule 화면에서만 ([Spec Schedule](./3-schedule.md)). 본 카드는 "스케줄 관리에서 편집" 링크만 표시 |
| Schedule Configuration | `timezone` | read-only | 위 동일 |
| Schedule Configuration | `nextRunAt` | read-only (시스템 계산) | sweep 시점에 갱신 |
| External Interaction (Notification) | `url` / `events` / `signing` / `retry` | edit | [Spec EIA §4](../5-system/14-external-interaction-api.md#4-trigger-config) 참조 — 별 plan `eia-trigger-edit-ui` 가 구현 |
| External Interaction (Interaction) | `enabled` / `tokenStrategy` | edit | 동상 |
| Recent Calls | (목록) | read-only | 클릭 시 실행 상세로 이동 |
| Auth Config (외부 `auth_config` 연결) | `authConfigId` | edit (v1.1 후속) | v1 은 Webhook Configuration 의 인라인 `authType` 으로 충분. 외부 `auth_config` 엔티티와의 매핑은 [Authentication 메뉴](../5-system/1-auth.md) 에서. v1 표시 전용 |

권한 게이트: 각 edit 토글은 `editor` 이상에서만 노출. `viewer` 는 모든 카드가 read 모드로 보임. `admin`/`owner` 는 동작은 동일 (audit log 의 actor 식별만 다름).

### 2.4 Webhook URL 형식

```
{base_url}/hooks/{endpoint_path}
```

- `base_url`: SaaS의 경우 서비스 도메인, 셀프 호스팅의 경우 설정된 도메인
- `endpoint_path`: Trigger.endpoint_path 값

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/triggers | 목록 조회 (쿼리: type, status, search, page, limit, sort, order). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| GET | /api/triggers/:id | 트리거 상세 조회 |
| PATCH | /api/triggers/:id | 트리거 수정 |
| PATCH | /api/triggers/:id/toggle | 활성/비활성 토글 |
| GET | /api/triggers/:id/history | 호출 이력 조회 |
| DELETE | /api/triggers/:id | 트리거 삭제 — 자세한 권한·cascade·확인 UX 는 [§4 삭제 정책](#4-삭제-정책) |
| POST | /api/triggers/:id/auth/rotate-secret | **v1.1 예약 (실제 endpoint 신설은 별 spec PR)** — Webhook HMAC secret rotate. 응답 본문에 신규 secret 1회 노출 후 영구 폐기. 패턴은 [Spec EIA §7](../5-system/14-external-interaction-api.md#7-시크릿-회전--token-revoke). **경로명·grace 기간·응답 shape 는 TBD** — [`plan/in-progress/eia-secret-rotation-revoke-api.md`](../../plan/in-progress/eia-secret-rotation-revoke-api.md) 합의 후 확정. EIA `/notification/rotate-secret` 와 대상 secret 이 다름 (inbound webhook auth vs outbound notification HMAC) |

> `PATCH /api/triggers/:id` 본문은 다음 부분 갱신 키를 받는다 (모두 optional): `name`, `isActive`, `endpointPath`, `config` (Deep merge — `config.authType` / `config.hmacHeader` / `config.hmacSecret` / `config.bearerToken` / `config.notification` / `config.interaction` 등 서브 키 단위 부분 갱신).
> Schedule 타입 트리거에 대한 PATCH 는 `name`, `isActive` 만 허용한다 — `endpointPath` / `config` 변경은 400 `VALIDATION_ERROR` (`details.field='type'`, Schedule 동기화 [Spec 데이터 모델 §2.9.1](../1-data-model.md#291-trigger--schedule-동기화-규칙) 보호).
> `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`). 길이/이름 검증 실패는 400 `VALIDATION_ERROR` ([Spec 에러 처리](../5-system/3-error-handling.md)).
> write-only 필드 (`hmacSecret`, `bearerToken`) 는 응답 시 마스킹 (`…last4`).

> **참고**: 트리거 생성은 워크플로우 에디터에서 수행. 트리거 목록 화면에서는 관리(조회/수정/삭제)만 담당.
> **참고**: Schedule 유형 트리거는 Trigger 화면에서 직접 생성할 수 없다. Schedule 화면에서만 생성 가능하며, 생성 시 자동으로 Trigger가 등록된다. ([스케줄 관리](./3-schedule.md#3-trigger-자동-생성-규칙) 참조)

---

## 4. 삭제 정책

### 4.1 권한

| 역할 | 트리거 삭제 |
|------|------------|
| viewer | 불가 (⋮ 메뉴에 삭제 항목 미노출) |
| editor | 가능 (자신의 워크스페이스 한정) |
| admin / owner | 가능 |

API 게이트는 [Spec 인증 §3](../5-system/1-auth.md#3-rbac) 의 `trigger.delete` permission 으로 보호되며 audit log 의 `trigger.delete` action 항목으로 기록된다 ([Spec data-flow audit](../data-flow/1-audit.md)).

### 4.2 확인 다이얼로그

삭제 액션 클릭 시 모달을 띄운다. 모달은 트리거 type 에 따라 본문 텍스트가 분기된다.

| `Trigger.type` | 본문 텍스트 (i18n 키 `triggers.delete.confirm.*`) |
|---------------|--------------------------------------------------|
| `webhook` | "이 트리거를 삭제하면 `{url}` 로 들어오는 모든 호출이 즉시 404 가 됩니다." |
| `schedule` | "이 트리거를 삭제하면 연결된 스케줄도 함께 삭제됩니다 (cron `{{cron}}`). 다음 실행 예정 시각: `{{nextRunAt}}`." ([Spec 데이터 모델 §2.9.1](../1-data-model.md#291-trigger--schedule-동기화-규칙)). Rationale R-5 참조 |
| `manual` | "이 트리거에 연결된 워크플로 (`{workflowName}`) 는 보존되며, 트리거를 통한 외부 실행 진입점만 사라집니다." |

오삭제 방지: 사용자가 트리거 이름을 정확히 타이핑해야 "삭제" 버튼이 활성화된다 (본 spec 이 이 패턴을 최초 도입; 후속 spec 정비 PR 에서 [`spec/2-navigation/_layout.md`](./_layout.md) 또는 별 convention 으로 끌어올린다).

### 4.3 cascade 동작

| 연관 엔티티 | 동작 | 근거 |
|------------|------|------|
| `schedule` | trigger 가 schedule 타입이면 CASCADE 삭제 (FK CASCADE on `schedule.trigger_id`) | [data-flow/10-triggers.md §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) + [§2.1 Postgres](../data-flow/10-triggers.md#21-postgres) |
| `execution.trigger_id` | SET NULL (실행 이력은 보존) — 트리거 삭제로 과거 실행 통계·감사 추적이 끊기지 않게 함 | [data-flow/10-triggers.md §2.1](../data-flow/10-triggers.md#21-postgres) |
| `auth_config_id` | trigger 측 FK 만 끊김 — `auth_config` row 자체는 삭제 안 됨 (다른 트리거가 공유 가능) | [Spec 인증](../5-system/1-auth.md) |
| Outbound `notification.*` 채널 | 트리거에 종속이므로 다음 발송 시도가 중단된다 — `notificationHealth` 값은 row 가 없으므로 별도 cleanup 불필요 | [Spec EIA §7.1](../5-system/14-external-interaction-api.md#71-trigger-엔티티-확장) |
| Inbound interaction 토큰 (per_trigger) | 트리거 삭제로 즉시 무효 — 별도 revoke 호출 불필요 | 동상 |

### 4.4 결과·에러

- 성공: `204 No Content` (응답 본문 없음, 표준 패턴). 클라이언트는 목록·상세 query 를 invalidate.
- 동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND` — 클라이언트는 무시 가능 (사용자에게 토스트 1회).
- Schedule 타입을 schedule 화면이 아닌 trigger 화면에서 삭제: 본 §4.3 에 따라 schedule cascade 와 함께 삭제. (Schedule 화면에서 삭제하는 경로도 동일 결과 — [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 가 양방향 동기화 정의.)

---

## Rationale

### R-1. workflowId 를 v1 read-only 로 잠근 이유 (2026-05-22)

§2.3.1 매트릭스에서 `workflowId` 변경을 v1 에서 잠그는 이유:

1. 실행 이력은 `execution.trigger_id` FK 로 트리거를 가리킨다. 트리거의 workflowId 가 변하면 같은 trigger_id 의 이력이 둘 이상의 workflow 에 걸치게 되어 통계·필터링이 의미를 잃는다.
2. 새 workflow 의 Manual Trigger 노드 input schema 가 기존과 다르면 schedule.parameter_values 가 유효하지 않게 될 수 있다 ([Spec 데이터 모델 §2.9](../1-data-model.md#29-schedule)).
3. 사용자 흐름상 "트리거를 다른 워크플로에 옮기고 싶다" 는 요구는 빈도가 낮고, "이전 트리거 비활성 + 새 트리거 생성" 으로 우회 가능.

v1.1 이후 위 두 영향을 해소할 마이그레이션 계획이 마련되면 본 조항 해제. 사전 일관성 검토 세션: `review/consistency/2026/05/22/11_59_25/`.

### R-2. Webhook HMAC secret 입력 vs. rotate 분리 (2026-05-22)

§2.3.1 의 `hmacSecret` 행은 "입력 변경 (v1)" 과 "rotate 액션 (v1.1 후속)" 을 분리했다. 이유:

- EIA notification secret 은 외부 수신자가 보유한 키를 사전에 교체 동기화하기 위한 grace 기간이 필요 ([Spec EIA §7](../5-system/14-external-interaction-api.md#7-시크릿-회전--token-revoke)) — 단순 입력 교체는 grace 가 없어 즉시 단절.
- v1 은 secret 을 모르는 채로 분실·재발급 시나리오만 다룬다 (UX 가 단순). grace 패턴이 필요한 운영 환경은 v1.1 후속.
- API 도 동일 분리: `PATCH /api/triggers/:id { config.hmacSecret }` (v1) vs `POST /api/triggers/:id/auth/rotate-secret` (v1.1).

**TBD (의식적 미결정)**: v1.1 rotate 의 응답 shape (신규 secret 평문 반환 vs masked digest), grace 기간 (24h 표준 vs 가변), 경로 세그먼트 (`/auth/` vs `/webhook-auth/`) 는 본 spec PR 에서 확정하지 않는다. [`plan/in-progress/eia-secret-rotation-revoke-api.md`](../../plan/in-progress/eia-secret-rotation-revoke-api.md) 가 EIA outbound notification secret 의 rotate 응답 형식을 먼저 합의하면 본 spec 의 v1.1 행도 동일 패턴을 차용한다.

### R-3. 삭제 confirmation 텍스트를 type 별로 분기한 이유 (2026-05-22)

사용자가 "트리거 삭제" 의 부수 효과를 type 마다 다르게 인지해야 한다.

- webhook: 외부 호출자가 즉시 404 — 사용자에게 가시적인 영향.
- schedule: cascading 으로 schedule 도 사라짐 — `data-flow/10-triggers.md §1.4` 가 정의한 동작을 UX 로 노출.
- manual: workflow 자체는 살아남고 트리거 진입점만 사라짐 — 사용자 안심.

이 3 분기를 1 문구로 묶으면 schedule cascading 같은 중요한 사실이 묻히므로 분리.

### R-4. `isActive` 편집 경로를 PATCH body 와 `/toggle` 양쪽 모두 유지 (2026-05-22)

§2.3.1 의 `isActive` 행은 PATCH body 도 받고, §3 의 `PATCH /api/triggers/:id/toggle` 도 살아 있다. 둘 다 같은 결과 (단순 부울 토글) 이지만 분리 유지 이유:

- `/toggle` 은 단일 행 액션 (목록의 inline button) 용으로, 본문 없이 호출 가능 (idempotent — 매 호출마다 부정 토글이 아니라 백엔드가 현재 상태와 반대로 set) — 클라이언트가 현재 상태를 모르는 케이스에 적합.
- PATCH body `{ isActive: true|false }` 는 다른 필드와 함께 한 트랜잭션으로 갱신할 때 사용 (예: 이름·activation 동시 갱신).
- 양쪽 모두 audit log 를 emit 하며 action 동사는 호출한 endpoint 가 결정 (`/toggle` 은 `trigger.toggle`, PATCH 는 `trigger.update`).

향후 사용 통계에서 `/toggle` 호출이 의미 있게 감소하면 deprecate 검토. 현 시점에서는 단순성 우선.

### R-5. schedule 삭제 confirmation interp 변수: `{{scheduleId}}` → `{{cron}}` (2026-05-22)

§4.2 의 schedule 타입 본문 텍스트 interp 변수를 초기 draft 의 `{{scheduleId}}` 에서 `{{cron}}` 으로 변경. 이유:

- cron 표현식 (`0 9 * * *` 등) 은 사용자가 어떤 스케줄인지 즉시 식별 가능.
- scheduleId 는 내부 UUID 로 사용자에게 의미 없음.
- 양쪽 모두 동일한 schedule 행을 가리키나, confirmation UX 의 목적이 "이 작업이 무엇을 삭제하는지" 식별이므로 사람 가독성 우선.

발견 경로: Plan A 구현 후 `review/code/2026/05/22/12_36_58/` ai-review W6 (requirement-reviewer) 에서 spec ↔ 코드 불일치로 지적. 코드가 이미 `{{cron}}` 으로 구현되어 있어 spec 을 코드에 맞추는 것이 변경 최소.

### R-6. 호출 이력 진입을 별도 Dialog 로 분리 (2026-05-22)

§2.1 의 ⋮ 메뉴에서 "상세 보기" 와 "호출 이력" 이 초기 PR #265 (Plan A) 에서 둘 다 같은 drawer 를 열도록 임시 구현되어 사용자에게 동일 동작으로 보였다. 사용자 보고 후 분리 방식을 검토한 결과 **별도 Dialog** 채택:

- **상세 보기** — 메타 / Webhook 인증 / External Interaction / Schedule **카드** 가 한 화면에 보이는 풀 detail drawer (`SlideDrawer`, 우측 슬라이드). 편집·cron 확인·EIA 설정 등이 목적. Recent Calls 는 본 drawer 에 포함되지 않음 (Rationale R-7).
- **호출 이력** — Recent Calls **만** 빠르게 보고 닫는 가벼운 modal (`Dialog`, 중앙 정렬). 다른 메타·인증·EIA 정보가 시야에서 사라져 "이 트리거가 최근에 잘 호출되고 있는가" 만 빠르게 확인하는 시나리오에 부합. modal 안의 "전체 상세 보기" 버튼으로 detail drawer 로 승격 가능.

같은 drawer 의 anchor scroll 또는 focus 모드 (다른 카드 collapse) 도 검토했으나, 분리감이 약하고 사용자가 두 항목의 차이를 인지하기 어려워 거부.

발견 경로: PR #265 머지 후 사용자가 "두 항목이 동일 동작" 으로 보고. 분리 방식 옵션 3종 (별도 Dialog / Drawer focus / 항목 제거) 비교 후 시각 분리가 가장 명확한 별도 Dialog 채택. 본 정정 PR (`plan/in-progress/trigger-row-history-dialog.md`).

### R-7. detail drawer 에서 Recent Calls 카드 제거 (2026-05-22)

R-6 이 호출 이력 진입을 별도 Dialog 로 분리한 직후, drawer 안에도 Recent Calls 카드가 남아 있어 동일 데이터가 두 위치에 중복 표시되었다. 사용자가 PR #266 머지 후 "drawer 의 Recent Calls 는 별도 Dialog 와 중복이라 제거 가능해 보인다" 고 보고 — 본 PR 에서 drawer 의 Recent Calls 카드를 제거한다.

근거:

- §2.1 의 ⋮ 메뉴가 이미 "상세 보기 (drawer)" 와 "호출 이력 (Dialog)" 을 별도 진입점으로 노출 — 사용자가 어느 쪽이든 명시적으로 선택 가능. drawer 가 호출 이력을 추가로 노출할 가치가 적음.
- drawer 의 `GET /api/triggers/:id/history` 호출이 사라져 drawer 오픈 시 1회 round-trip 감소.
- 본 PR 머지 후 drawer 에서 호출 이력을 보고 싶은 사용자는 drawer 를 닫고 ⋮ 메뉴 → 호출 이력 으로 진입 (1 클릭 추가). 비용은 작고, drawer 가 "편집 가능한 메타" 에 집중하는 단순성이 더 크다.

또한 본 PR 에서 drawer 의 영문 하드코딩 라벨들 (`Trigger Details`, `Overview`, `Webhook Configuration`, `Schedule Configuration`, `External Interaction`, `Cron Expression`, `Timezone`, `Next Run`, `HTTP Method`, `URL`, `Active`/`Inactive`, EIA 카드의 `Notification (Outbound)` / `Interaction (Inbound REST + SSE)` / `Events` / `Algorithm` / `Retry attempts` / `Token strategy` / `Endpoints` 등) 을 i18n dict (`triggers.detail.*`, `triggers.externalInteraction.*`) 의 t() 호출로 일괄 교체한다. 본 정정 사이클의 사용자 보고 항목.
