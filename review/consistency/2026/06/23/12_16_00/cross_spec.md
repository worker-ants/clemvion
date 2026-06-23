# Cross-Spec 일관성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation)
검토 일시: 2026-06-23

---

## 발견사항

### [INFO] 대시보드 `activeWorkflows` 의미 부연 — "트리거 활성" 은 부가 설명, 실제는 `Workflow.is_active`

- **target 위치**: `spec/2-navigation/0-dashboard.md §3` — "Active | 활성 워크플로우 수 | `isActive = true` 인 워크플로우 개수 (트리거가 활성화된 워크플로우)"
- **충돌 대상**: `spec/1-data-model.md §2.4 Workflow` — `is_active` 는 Workflow 레벨 필드. `spec/1-data-model.md §2.8 Trigger` 의 `is_active` 는 Trigger 레벨 별도 필드.
- **상세**: 대시보드 §3 의 괄호 부연 "트리거가 활성화된 워크플로우" 는 `Workflow.is_active = true` 와 `Trigger.is_active = true` 의 관계를 혼동하게 만들 수 있다. 데이터 모델에서 두 `is_active` 는 독립 필드이며, `activeWorkflows` 카운트는 `Workflow.is_active = true` 를 직접 카운트한다. 실제 충돌은 아니나 명명 모호.
- **제안**: 괄호 부연을 "워크플로우 자체가 활성(`Workflow.is_active = true`) 상태인 수" 로 명확히 하면 Trigger.is_active 와의 혼동을 방지할 수 있다.

---

### [INFO] 실행 이력 목록 필터에서 `pending` 제외 — 대시보드 status 아이콘 매핑과 비대칭

- **target 위치**: `spec/2-navigation/14-execution-history.md §2.3` — "`pending` (큐 대기) 은 데이터 모델의 유효 상태지만 필터에서 의도적으로 제외"
- **충돌 대상**: `spec/2-navigation/0-dashboard.md §5` — "DTO 의 status enum 은 pending·running·completed·failed·cancelled·waiting_for_input — 6종"; `spec/1-data-model.md §2.13 Execution.status` — 동일 6종.
- **상세**: `pending` 이 필터에서 의도적으로 제외된다는 점은 §2.3 아래 주석에 명시되어 있다. 대시보드의 아이콘 매핑에는 `pending` 이 `⏳ running·pending` 로 묶여 있다. 두 spec 이 독립적으로 `pending` 을 다르게 처리하는 것은 의도적 차이지만, 대시보드 §5 의 `⏳ running·pending` 아이콘 묶음 표기가 `pending` 을 실제로 표시하지 않음을 명시하지 않아 구현자에게 혼란을 줄 수 있다.
- **제안**: 실질적 충돌 없음. 상호 참조 주석만 선택적으로 보강 가능.

---

### [INFO] 워크플로우 목록 기본 정렬(`created_at desc`)과 API 규약 `sort` 파라미터 기본값 일치 — 명시적 확인

- **target 위치**: `spec/2-navigation/1-workflow-list.md §2.4` — "기본값은 서버와 동일한 생성일 내림차순(`created_at` desc)"
- **충돌 대상**: `spec/5-system/2-api-convention.md §4.1` — `sort` 기본값 `created_at`, `order` 기본값 `desc`.
- **상세**: 양쪽 모두 `created_at` desc 를 기본값으로 지정하여 일치한다. 반면 `spec/2-navigation/14-execution-history.md §5` 의 실행 이력 API 는 기본 정렬을 `started_at` 으로 의도적으로 오버라이드하고 있으며, 이는 Rationale 에 명시되어 있다. 모순 없음, 참고 기록.

---

### [INFO] `triggerSource` 5종(응답 DTO) vs `__triggerSource` 3종(엔진 내부 마커) — 현행 spec 이 이미 명시, 구현 시 혼동 주의

- **target 위치**: `spec/2-navigation/14-execution-history.md §2.4 Trigger 출처 분류 Rationale R-2`
- **충돌 대상**: `spec/data-flow/10-triggers.md` — `__triggerSource:'manual'` / `'webhook'` / `'schedule'` 3종 내부 마커.
- **상세**: 실행 이력 spec §2.4 의 Rationale R-2 가 이미 "응답 DTO 의 `triggerSource`(5종)는 엔진 내부 마커 `__triggerSource`(3종)와 별개" 라고 명시한다. 충돌은 아니나, 구현 시 두 식별자 집합을 혼동하지 않도록 주의가 필요하다. 특히 `subworkflow` 출처는 엔진 내부 마커에는 없고 `parent_execution_id` 판정으로만 DTO 에서 도출된다.
- **제안**: 현행 spec 명시로 충분. 구현 착수 시 `ExecutionsService` 의 `triggerSource` 정규화 로직이 `parent_execution_id != null` 을 최우선 판정한다는 점을 확인하면 된다.

---

### [INFO] `spec/2-navigation/2-trigger-list.md §3` GET /api/triggers sort/order 미반영 — spec 과 구현 간 known gap

- **target 위치**: `spec/2-navigation/2-trigger-list.md §3 GET /api/triggers` 주석 — "`PaginationQueryDto` 가 `sort`/`order` 를 받긴 하나 `findAll` 은 이를 무시하고 `created_at DESC` 로 고정 정렬한다 (triggers.service.ts:99). sort/order 반영은 미구현/Planned"
- **충돌 대상**: `spec/5-system/2-api-convention.md §4.1` — `sort`/`order` 파라미터는 목록 조회 표준 쿼리 파라미터.
- **상세**: 트리거 목록 API 가 `sort`/`order` 파라미터를 수신하지만 무시하는 현황이 spec 내 주석으로 명시되어 있다. API 규약상 정렬을 지원한다고 선언하면서 실제로는 무시하는 것은 계약 위반이나, `미구현/Planned` 로 현황 문서화가 되어 있어 known gap 이다. cross-spec 충돌보다는 구현 착수 시 이 동작을 그대로 유지할지 아니면 실제 정렬을 구현할지 결정이 필요하다.
- **제안**: 구현 착수 시 `GET /api/triggers` 의 정렬 파라미터 미반영 여부를 명시적으로 수용할지 결정. spec 주석 그대로 유지한다면 모순 없음.

---

### [INFO] `spec/2-navigation/2-trigger-list.md §2.1` 더보기 메뉴 — "호출 이력 Dialog" 항목 vs `GET /api/triggers/:id/history` 공개 계약

- **target 위치**: `spec/2-navigation/2-trigger-list.md §2.1` ⋮ 메뉴 ③ "호출 이력 → 별도 Dialog 로 Recent Calls 만 표시"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §3` — `GET /api/triggers/:id/history` API 가 공식 엔드포인트로 정의됨.
- **상세**: 호출 이력 Dialog 가 `GET /api/triggers/:id/history` 를 사용하는 것이 자연스럽다. spec 에서 이 API 가 Dialog 에서 사용된다는 것이 명시적으로 연결되어 있지 않으나, 같은 파일 내이므로 구현 착수 시 혼동 없을 것. Rationale R-7 (drawer 에서 history API 미호출 → round-trip 감소) 과 일관적으로, Dialog 가 해당 API 를 호출하는 구조는 명확하다.
- **제안**: 실질적 충돌 없음.

---

## 요약

`spec/2-navigation` 의 영역 내부 문서들이 `spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/data-flow/10-triggers.md` 등 다른 spec 영역들과 교차 비교했을 때, **Critical 또는 Warning 수준의 직접 모순은 발견되지 않는다.** 발견된 항목 전체가 INFO 등급이며, 대부분은 이미 target spec 문서 내 Rationale 또는 주석으로 의도가 명시된 설계 결정들이다. `Workflow.is_active` 와 `Trigger.is_active` 의 혼동 가능성 부연, 트리거 목록 API 정렬 미반영 known gap, `triggerSource` 이중 네임스페이스 주의 등이 구현 착수 시 확인 사항으로 남는다. 전반적으로 `spec/2-navigation` 영역은 다른 spec 영역과 데이터 모델·API 계약·RBAC·상태 전이 축 모두에서 일관성을 유지하고 있다.

---

## 위험도

NONE
