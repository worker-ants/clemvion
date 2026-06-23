# Cross-Spec 일관성 검토 결과

- **검토 모드**: 구현 착수 전 (--impl-prep)
- **Target 영역**: `spec/2-navigation` (전체)
- **검토일**: 2026-06-23

---

## 발견사항

### 1. INFO — `GET /api/triggers/:id/history` 응답 shape 이 spec 에 미정의

- **target 위치**: `spec/2-navigation/2-trigger-list.md §3 API` 표 — `GET /api/triggers/:id/history | 호출 이력 조회`
- **충돌 대상**: `spec/2-navigation/6-config.md §A.3` + `spec/1-data-model.md §2.13 (AuthConfig 호출 집계 경로 SoT)` + `spec/5-system/12-webhook.md WH-MG-05`
- **상세**: `GET /api/triggers/:id/history` 는 `2-trigger-list.md §3` API 표에 이름만 등재되고 **응답 shape(필드 목록·페이지네이션 형태·최대 건수)가 spec 에 기술되지 않았다**. 반면 `6-config.md §A.3` 의 `GET /api/auth-configs/:id/usage` 는 동일 `Execution` 소스에서 `recentCalls: [{ id, triggerName, status, sourceIp, responseCode, startedAt }]` 형태(최근 20건)를 명시한다. 코드(`trigger-history-dialog.tsx` / `triggers.ts getHistory`) 는 배열 또는 `{ items }` envelope 양쪽을 정규화하는 defensive 처리를 하고 있어 spec 외의 암묵 계약이 존재함을 암시한다. 두 endpoint 가 같은 데이터를 다른 shape 으로 돌려줄 가능성이 있고, spec 에서 `GET /api/triggers/:id/history` 응답 계약을 찾을 수 없다.
- **제안**: `2-trigger-list.md §3` 에 `GET /api/triggers/:id/history` 응답 예시(필드·최대 건수·정렬 기준)를 추가하거나, `6-config.md §A.3` 의 `recentCalls` shape 을 SoT 로 명시 참조한다. `executionId` 포함 여부(R-13 drill-down link 용) 도 spec 에 선언해야 한다.

---

### 2. INFO — 호출 이력 Dialog 의 `executionId` 필드가 spec 에 누락

- **target 위치**: `spec/2-navigation/2-trigger-list.md Rationale R-13`
- **충돌 대상**: `spec/2-navigation/6-config.md §A.3` (`recentCalls` 응답 shape) + `spec/1-data-model.md §2.13`
- **상세**: R-13 은 호출 이력 Dialog 각 항목을 `<Link href="/workflows/:workflowId/executions/:executionId">` 로 연결한다고 명시한다. 이 링크가 동작하려면 `GET /api/triggers/:id/history` 응답에 `executionId` 가 포함되어야 하지만, `6-config.md §A.3` 의 `recentCalls` shape 에는 `id` 필드만 있고 그것이 `executionId` 인지 불명확하다. `1-data-model.md §2.13` 의 `recentCalls` 예시도 `id`(`Execution.id` 혹은 다른 식별자?) + `triggerName`/`status`/`sourceIp`/`responseCode`/`startedAt` 이다.
- **제안**: `2-trigger-list.md §3` 의 `GET /api/triggers/:id/history` 응답 예시에 `executionId` 를 명시적으로 선언하거나, `6-config.md §A.3` 의 `recentCalls` 항목에서 `id` 가 `Execution.id` 임을 명기한다.

---

### 3. INFO — 트리거 목록 sort/order 미구현 사실이 spec API 표에만 있고 PRD 요구사항과의 명시적 연결 없음

- **target 위치**: `spec/2-navigation/2-trigger-list.md §3 API` — `⚠️ sort/order 반영은 미구현/Planned`
- **충돌 대상**: `spec/2-navigation/_product-overview.md` (NAV 요구사항 ID 목록) + `spec/5-system/2-api-convention.md §4.1`
- **상세**: trigger 목록 API 가 `PaginationQueryDto` 의 `sort`/`order` 를 무시하고 `created_at DESC` 고정으로 동작함을 spec 이 인지하고 있다. 그러나 이 gap 을 추적하는 plan 파일이나 PRD 요구사항 ID 를 참조하지 않아, M-8 2단계 구현 시 이 동작을 유지할지 수정할지 판단 근거가 없다. `spec/5-system/2-api-convention.md §4.1` 은 목록 조회에 `sort`/`order` 지원을 규약으로 정의한다.
- **제안**: `2-trigger-list.md §3` 의 해당 ⚠️ 주석에 `pending_plan` 링크(예: `plan/in-progress/spec-sync-webhook-gaps.md`)를 추가하거나, M-8 2단계 구현 범위에서 명시적으로 defer 표기한다.

---

### 4. INFO — 트리거 목록 화면 2.2 필터에 "상태" 필터 옵션이 있으나 API 표에서 `status` 쿼리 파라미터 의미가 `active`/`inactive` 인지 `boolean` 인지 불명확

- **target 위치**: `spec/2-navigation/2-trigger-list.md §2.2` (필터 표) + `§3 API` (`GET /api/triggers` 쿼리 파라미터 `status`)
- **충돌 대상**: `spec/2-navigation/1-workflow-list.md §2.3` (상태 필터 `status=active|inactive`) + `spec/2-navigation/14-execution-history.md §2.3` (상태 필터 `status=completed|failed|...`)
- **상세**: `2-trigger-list.md §2.2` 는 상태 필터를 "전체 / Active / Inactive" 로 정의하나, `§3 GET /api/triggers` API 표의 `status` 파라미터에 허용값이 명시되지 않았다. `1-workflow-list.md` 는 동일한 패턴에서 `?status=active|inactive` 로 값을 명시하고, 과거 `?isActive=` 불일치 수정 이력도 기술한다. 트리거 목록도 같은 규약을 따를 가능성이 높으나 명시가 없다.
- **제안**: `2-trigger-list.md §3` API 표의 `status` 파라미터에 `active` / `inactive` 허용값을 명시하여 `1-workflow-list.md` 패턴과 정렬한다.

---

## 요약

`spec/2-navigation` 전체를 다른 영역(데이터 모델, webhook spec, config spec, API 규약)과 대조한 결과, **직접 모순(CRITICAL/WARNING) 은 발견되지 않았다.** 기존 spec 과의 관계는 정합적으로 유지되어 있다. 발견된 항목은 모두 INFO 등급으로, `GET /api/triggers/:id/history` 응답 shape 미명세와 호출 이력 drill-down 에 필요한 `executionId` 필드 미선언이 가장 실질적인 갭이다. 이는 M-8 2단계(trigger-cards 리팩토링) 구현 범위 내에서 `trigger-history-dialog` 가 `executionId` 를 API 에서 받아야 하는 시점에 surface 될 수 있다. 필수 차단 사항 없이 착수 가능하다.

---

## 위험도

LOW

---

STATUS: OK
