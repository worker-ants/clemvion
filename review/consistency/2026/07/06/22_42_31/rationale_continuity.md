### 발견사항

- **[WARNING]** `background_failed` attribution 설계 번복이 target spec 의 Rationale/본문에 반영되지 않음
  - target 위치: `spec/data-flow/8-notifications.md` §2.1 (Schema 매핑, line 89) — `notification` "리소스 attribution 조회" 행이 여전히 `SELECT WHERE resource_type=? AND resource_id=?` / `NotificationsService.findByResource` 를 SoT 로 서술. §1.1 (line 67) `background_failed` 행도 resource_type/resource_id 매핑에 대한 서술이 없음(구 설계도 신 설계도 기술 안 됨).
  - 과거 결정 출처: 동일 spec 문서 §2.1 자체(코드와 1:1 대응하던 종전 서술) — 별도 `## Rationale` 항목은 아니지만, §2.1 표는 사실상 이 spec 의 "현재 유효한 스키마 계약"으로 다른 문서·주석이 참조하는 SoT다 (`spec/1-data-model.md §2.19` 도 동일 패턴을 그대로 인용).
  - 상세: 이번 구현(V107 마이그레이션 + `notifications.service.ts`)은 `NotificationsService.findByResource(resourceType, resourceId)` 를 완전히 삭제하고 `findByBackgroundRun(backgroundRunId)` 로 교체했으며, `background_failed` 알림의 `resource_type`/`resource_id` 를 `background_run`/backgroundRunId 에서 `workflow`/workflow.id 로 바꾸고 attribution 을 신규 컬럼 `background_run_id` 로 분리했다. 이 변경의 **근거(딥링크 404 버그 해소)는 마이그레이션 파일 주석에 상세히 기록**되어 있으나, 정작 그 근거가 인용하는 target spec 문서 자체는 이 diff-base(`origin/main`) 대비 **전혀 갱신되지 않았다** (`git diff origin/main...HEAD -- spec/data-flow/8-notifications.md` 결과 없음). 결과적으로 spec 을 읽는 사람은 (a) 존재하지 않는 메서드 `findByResource` 를 현재 계약으로 오인하고, (b) `background_failed` 의 딥링크가 여전히 `resource_type='background_run'` (실제로는 404 를 유발하던 옛 버그 상태)라고 오인할 수 있다. "결정의 무근거 번복"은 아니다(근거는 마이그레이션 주석에 충분히 기록) — 다만 그 근거가 spec 문서의 정식 `## Rationale` 항목/본문 갱신으로 옮겨지지 않아 **spec-코드 간 결정 기록의 연속성이 끊겼다**.
  - 제안: `spec/data-flow/8-notifications.md` §2.1 의 "리소스 attribution 조회" 행을 `findByBackgroundRun(backgroundRunId)` / `background_run_id` 컬럼으로 갱신하고, §1.1 `background_failed` 행에 `execution_failed`/`schedule_failed` 와 동일한 패턴으로 "resource_type='workflow' / resource_id=workflow.id (딥링크), background_run_id (attribution, REST 미노출)" 서술을 추가한다. 아울러 `## Rationale` 에 "딥링크와 attribution 의 분리 (V107)" 항목을 신설해 마이그레이션 주석의 배경(옛 `resource_type='background_run'` 이 딥링크 404 를 유발했다는 선존 결함)을 spec 에도 남긴다.

- **[WARNING]** `spec/1-data-model.md §2.19` Notification 필드 목록에 신규 `background_run_id` 컬럼 누락
  - target 위치: `spec/data-flow/8-notifications.md` (target) 가 영향을 주는 인접 spec — `spec/1-data-model.md §2.19` (Notification 엔티티 필드 표)
  - 과거 결정 출처: `spec/1-data-model.md §2.19` 자체 (필드 목록이 entity 의 SoT). 마이그레이션 V107 주석이 이 위치를 명시적으로 "갱신 대상"으로 인용(`-- spec/1-data-model.md §2.19 (Notification 엔티티 필드)`).
  - 상세: `Notification` 엔티티에 `background_run_id UUID NULL` (select:false, REST 미노출) 컬럼이 신규 추가됐으나 §2.19 필드 표에는 반영되지 않았다. 마이그레이션 파일이 스스로 "이 spec 위치를 갱신하겠다"고 선언한 상태에서 실제로 갱신되지 않아, 코드 주석의 약속과 spec 상태가 어긋난다.
  - 제안: §2.19 표에 `background_run_id | UUID? | Background 본문 실패(background_failed) 알림의 per-run attribution 전용 내부 컬럼. REST 미노출(select:false). 딥링크는 resource_type/resource_id 가 담당` 행을 추가.

- **[INFO]** e2e/unit 테스트의 "선존 결함" 서술은 근거로 타당하나 Rationale 정식 기록과 분리되어 있음
  - target 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql` 주석, `background-execution.processor.ts` 주석
  - 과거 결정 출처: 없음(신규 배경 서술)
  - 상세: 코드 주석 자체는 매우 상세하고 정확하게 배경·trade-off·안전성을 기록해 Rationale 작성 관례(spec 의 `## Rationale` 절 스타일)를 코드 주석에서 선취하고 있다. 다만 CLAUDE.md 의 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 원칙에 따르면 이 내용은 최종적으로 spec 에 이관되어야 한다.
  - 제안: 위 WARNING 두 건 반영 시 이 주석 내용을 거의 그대로 `## Rationale` 절로 옮기면 된다 — 별도 재작성 불필요.

### 요약

이번 변경은 `background_failed` 알림의 딥링크(workflow 라우팅)와 per-run attribution(background_run_id)을 분리하는 논리적으로 타당한 설계 개선이며, 기각된 대안의 재도입이나 합의 원칙 위반, invariant 우회는 발견되지 않았다. 다만 이 결정 번복(구 `resource_type='background_run'`/`findByResource` → 신 `background_run_id`/`findByBackgroundRun`)의 근거는 마이그레이션 파일 주석에만 기록되고, 정작 그 근거가 인용하는 target spec(`spec/data-flow/8-notifications.md` §2.1·§1.1)과 인접 spec(`spec/1-data-model.md §2.19`)에는 반영되지 않아 "새 Rationale 없는 번복"에 가까운 상태가 spec 레벨에서 발생했다. 코드 자체는 정합적이나 spec 이 옛 계약(`findByResource`, `resource_type='background_run'`)을 여전히 SoT 로 서술해 향후 이 spec 을 읽는 사람에게 오도 위험이 있다.

### 위험도
MEDIUM
