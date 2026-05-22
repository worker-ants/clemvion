# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`, scope=`spec/2-navigation/`
검토 일시: 2026-05-22

---

## 발견사항

### [WARNING] `PATCH /api/triggers/:id/toggle` 전용 endpoint 유지 — API 규약 §12.1 위반

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §3 API 표 (`PATCH /api/triggers/:id/toggle`) 및 Rationale R-4
- **과거 결정 출처**: `spec/5-system/2-api-convention.md §12.1 상태 토글 패턴`
  - 규약 원문: "전용 endpoint 불필요 — `POST /:id/activate`, `POST /:id/deactivate` 등의 전용 엔드포인트를 만들지 않음. 패턴: `PATCH /:id { field: value }`"
  - 적용 대상 목록에 `is_active (Workflow, **Trigger**, Schedule)` 명시
- **상세**: API 규약 §12.1은 `is_active` 토글을 위한 전용 endpoint 생성을 명시적으로 금지하고 `PATCH /:id { isActive: value }` 만을 canonical 패턴으로 정의한다. 그러나 `2-trigger-list.md §3` 는 `PATCH /api/triggers/:id/toggle` 전용 endpoint를 API 표에 존속시키고, Rationale R-4는 "본문 없이 호출 가능(idempotent)", "클라이언트가 현재 상태를 모르는 케이스" 를 이유로 두 경로 병행 유지를 결정하고 있다. R-4 에서 새 Rationale을 작성한 점은 평가하나, 이 결정은 `api-convention §12.1` 이 기각한 패턴("전용 endpoint")을 명시적 이유 없이 번복한다. `spec/2-navigation/3-schedule.md §4 API` 도 같은 구조로 `PATCH /api/schedules/:id/toggle` 를 노출하고 있으나, schedule spec에는 이에 대한 Rationale 항목이 없다.
- **제안**:
  1. (권장) `api-convention §12.1` 을 갱신하여 "bodyless idempotent toggle" 용 예외 패턴을 정식 허용하고, 허용 조건("클라이언트가 현재 상태를 모르는 경우")을 명문화한다. 그 뒤 `2-trigger-list.md` R-4 가 해당 예외 패턴을 인용하도록 수정한다.
  2. (대안) `/toggle` endpoint를 제거하고 `PATCH /:id { isActive: true|false }` 만 사용한다. 클라이언트는 목록 캐시에 있는 `isActive` 값을 반전하여 본문에 채운다.
  3. 어느 경로를 선택하든, `3-schedule.md` 의 `PATCH /api/schedules/:id/toggle` 도 같은 결정을 동기 적용해야 한다.

---

### [INFO] `spec/2-navigation/3-schedule.md` — `/toggle` endpoint에 Rationale 없음

- **target 위치**: `spec/2-navigation/3-schedule.md §4 API` (`PATCH /api/schedules/:id/toggle`)
- **과거 결정 출처**: `spec/5-system/2-api-convention.md §12.1` (위 WARNING 동일)
- **상세**: `3-schedule.md` 는 `PATCH /api/schedules/:id/toggle` 를 API 표에 포함하지만 이 결정에 대한 Rationale 항목이 전혀 없다. `2-trigger-list.md` R-4 가 동일 패턴을 정당화하는 Rationale 을 작성했음에도, schedule spec에는 참조도 없이 암묵적으로 동일 패턴을 채택한 상태다. API 규약 §12.1 관점에서 이 endpoint도 같은 위반 가능성을 내재한다.
- **제안**: 위 WARNING 의 해소 방향에 맞춰 `3-schedule.md` 도 동일하게 처리한다. `2-trigger-list.md` R-4 를 상위 Rationale로 참조 인용하거나, schedule spec 자체에 동일 사유를 명시한다.

---

### [INFO] `오삭제 방지(이름 타이핑 confirm)` 패턴 — 상위 문서 상향 예고는 있으나 미이행

- **target 위치**: `spec/2-navigation/2-trigger-list.md §4.2 확인 다이얼로그`
  - 원문: "오삭제 방지: 사용자가 트리거 이름을 정확히 타이핑해야 "삭제" 버튼이 활성화된다 (본 spec 이 이 패턴을 최초 도입; 후속 spec 정비 PR 에서 `spec/2-navigation/_layout.md` 또는 별 convention 으로 끌어올린다)."
- **과거 결정 출처**: 없음 (신규 도입). 단, `spec/2-navigation/_layout.md` 또는 `spec/conventions/` 에는 현재 이 패턴이 정의되지 않은 상태.
- **상세**: spec 자체가 "최초 도입, 추후 상향" 을 명시했으므로 현 시점에서는 미이행 상태가 허용된다. 그러나 구현 착수 시점(--impl-prep 단계)에서 이 패턴이 다른 삭제 다이얼로그(workflow, schedule 등)와 일관성 없이 적용될 위험이 있다. 별 plan 이 없는 상태에서 후속 정비가 누락되면 점진적으로 convention drift 가 발생한다.
- **제안**: 구현 완료 직후 `plan/in-progress/` 에 "삭제 confirm 패턴 상향" 플랜 항목을 추가하거나, `spec/conventions/` 에 draft 항목으로 선제 등록하면 drift 예방이 가능하다.

---

## 요약

`spec/2-navigation/` 의 주요 문서들(대시보드, 워크플로우 목록, 인증 플로우, 실행 내역, 트리거 목록, 스케줄 관리)은 전반적으로 기존 Rationale 과의 연속성을 잘 유지하고 있다. `2-trigger-list.md` 의 R-1~R-3 은 새로운 결정마다 근거를 충분히 서술하고 있으며, 데이터 모델·EIA spec 과의 cross-reference 도 정확히 연결된다. 다만 R-4 에서 `PATCH /api/triggers/:id/toggle` 전용 endpoint를 유지하기로 결정한 부분은 `spec/5-system/2-api-convention.md §12.1` 이 명시적으로 기각한 "전용 토글 endpoint" 패턴을 재도입하는 것으로, api-convention 의 갱신 없이 번복이 이루어졌다. `3-schedule.md` 도 동일 패턴을 Rationale 없이 병행 사용하고 있어 일관성 확보가 필요하다. 나머지 발견사항은 미이행 상향 예고처럼 경미한 수준이다.

---

## 위험도

MEDIUM
