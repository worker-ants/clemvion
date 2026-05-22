# Cross-Spec 일관성 검토 결과

- 검토 대상 draft: `plan/in-progress/spec-draft-triggers-edit-delete.md`
- 검토 모드: `--spec`
- 검토 일시: 2026-05-22

---

## 발견사항

### 1. [WARNING] `PATCH /api/triggers/:id` 의 기존 API 표와 신규 fine-print 간 명세 중복·충돌 가능성

- **target 위치**: Change 4 — `spec/2-navigation/2-trigger-list.md §3` API 표 fine-print
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §3` (기존 PATCH 행), `spec/5-system/2-api-convention.md §3` (HTTP 메서드 표)
- **상세**: 기존 `§3` API 표의 `PATCH /api/triggers/:id` 행은 "트리거 수정" 한 줄만 기술한다. draft 의 Change 4 fine-print 는 허용 body 키 목록(`name`, `isActive`, `endpointPath`, `config` deep-merge)과 Schedule 타입 제한(name/isActive 만 허용, 그 외 400)을 추가한다. 이 내용은 기존 spec 에 없던 신규 제약이므로 충돌은 아니지만, fine-print 가 표 밖 자유 텍스트로 정의되면 구현자가 표만 읽고 오해할 수 있다. 또한 API 규약 `§3` 에서 PATCH 는 "부분 수정, 멱등성 O" 로 정의하는데, `config` 의 deep-merge 동작은 멱등성 O 이므로 규약과는 부합한다. 그러나 Schedule 타입 트리거에 대한 400 거부 응답이 기존 에러 처리 spec(`spec/5-system/3-error-handling.md §1.3`) 의 `VALIDATION_ERROR` (400) 또는 `INVALID_STATE` (422) 중 어느 것에 해당하는지 명시가 없다.
- **제안**: fine-print 에서 Schedule 타입 PATCH 거부 시 에러 코드를 `INVALID_STATE` (422) 또는 `VALIDATION_FAILED` (400) 중 하나로 명시하고, `spec/5-system/3-error-handling.md` 의 기존 코드 목록과 일치시킨다. draft 의 fine-print 에 등장하는 `400 VALIDATION_FAILED` 는 에러 처리 spec 에서는 `VALIDATION_ERROR` 라는 코드를 사용하므로 코드명 통일 필요.

---

### 2. [WARNING] 에러 코드 `VALIDATION_FAILED` vs. 기존 `VALIDATION_ERROR`

- **target 위치**: Change 4 fine-print — "길이/이름 검증 실패는 400 `VALIDATION_FAILED`"
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.3` — `VALIDATION_ERROR` (400)
- **상세**: 기존 에러 처리 spec 의 검증 실패 코드는 `VALIDATION_ERROR` 이다. draft 는 `VALIDATION_FAILED` 라는 다른 코드명을 사용한다. 이는 동일 개념을 서로 다른 코드로 표현하는 직접 모순이다.
- **제안**: `VALIDATION_FAILED` → `VALIDATION_ERROR` 로 정정해 `spec/5-system/3-error-handling.md §1.3` 과 통일한다.

---

### 3. [WARNING] 에러 코드 `TRIGGER_NOT_FOUND` vs. 기존 `RESOURCE_NOT_FOUND`

- **target 위치**: Change 5 §4.4 — "두 번째는 `404 TRIGGER_NOT_FOUND`"
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.3` — `RESOURCE_NOT_FOUND` (404)
- **상세**: 기존 에러 처리 spec 에서 리소스 미발견은 `RESOURCE_NOT_FOUND` 로 통일되어 있다. draft 가 `TRIGGER_NOT_FOUND` 라는 리소스-특화 코드를 사용하면 에러 코드 일관성 규약과 어긋난다. 기존 EIA spec, Webhook spec 등 다른 영역에서도 리소스 미발견은 `RESOURCE_NOT_FOUND` 를 사용한다.
- **제안**: `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND` 로 정정하거나, spec/5-system/3-error-handling.md 에 리소스-특화 코드 허용 정책을 명시한다.

---

### 4. [INFO] `TRIGGER_ENDPOINT_PATH_CONFLICT` 에러 코드 신규 도입 — 기존 `RESOURCE_CONFLICT` 와의 관계 불명확

- **target 위치**: Change 3 §2.3.1 (endpointPath 행), Change 4 fine-print
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.3` — `RESOURCE_CONFLICT` (409)
- **상세**: 기존 에러 처리 spec 은 충돌을 `RESOURCE_CONFLICT` 한 코드로 통일한다. draft 는 `TRIGGER_ENDPOINT_PATH_CONFLICT` 라는 도메인-특화 409 코드를 사용한다. 직접 모순은 아니지만(409 상태코드는 일치), 기존 규약과의 명시적 관계(상위 코드 `RESOURCE_CONFLICT` 에 포함되는 세부 코드인지, 대체 코드인지)가 정의되지 않았다.
- **제안**: fine-print 에 "(409 `RESOURCE_CONFLICT` 의 세부 코드, code 필드에 `TRIGGER_ENDPOINT_PATH_CONFLICT` 사용)" 식으로 관계를 명시하거나, `spec/5-system/3-error-handling.md §1.3` 에 도메인-특화 세부 코드 허용 정책을 추가한다.

---

### 5. [WARNING] `trigger.delete` permission — 기존 RBAC 매트릭스에 미정의

- **target 위치**: Change 5 §4.1 — "API 게이트는 `trigger.delete` permission 으로 보호"
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스
- **상세**: 기존 RBAC 매트릭스(`spec/5-system/1-auth.md §3.2`)에서 Trigger 리소스는 `Owner/Admin/Editor: CRUD, Viewer: R` 로 명시되어 있다. 여기서 D(delete) 는 Editor+ 를 포함한다. draft §4.1 에서는 `editor` 이상이 삭제 가능하다고 기술해 RBAC 매트릭스의 내용과 실질적으로 일치하나, `trigger.delete` 라는 permission 이름은 기존 RBAC 매트릭스에 등장하지 않는다. Audit Log spec(`spec/5-system/1-auth.md §4.1`)에서는 `trigger.delete` 가 이미 예시로 나열되어 있어 이름 자체는 기존 관례와 일치한다.
- **제안**: permission 이름 `trigger.delete` 는 기존 audit log 예시와 일치하므로 별도 수정 불필요. 다만 RBAC 매트릭스에 명시적으로 "Editor+: trigger.delete 가능" 을 추가하면 일관성이 높아진다 — 정보성 제안.

---

### 6. [INFO] §4.1 viewer 삭제 불가 규칙 — RBAC 매트릭스와의 표현 방식 차이

- **target 위치**: Change 5 §4.1 권한 표
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` Trigger 행
- **상세**: 기존 RBAC 매트릭스의 Trigger 행에서 Viewer = R(읽기만) 이므로 삭제 불가는 당연히 포함된다. draft §4.1 은 같은 내용을 UI 레벨(⋮ 메뉴 미노출)로 재표현한 것이다. 모순은 없지만 동일 사실이 두 위치에 분산된다.
- **제안**: §4.1 표에 "(RBAC: `spec/5-system/1-auth.md §3.2` Trigger D 권한 준수)" 크로스링크를 추가하면 중복 유지 비용을 줄일 수 있다.

---

### 7. [INFO] `data-flow/10-triggers.md §2.1` CASCADE 동작과 draft §4.3 의 일치 여부 확인

- **target 위치**: Change 5 §4.3 cascade 동작 표
- **충돌 대상**: `spec/data-flow/10-triggers.md §2.1` Postgres schema 매핑 표
- **상세**: draft §4.3 은 schedule cascade, execution.trigger_id SET NULL, auth_config FK 끊김 세 항목을 기술한다. `data-flow/10-triggers.md §2.1` 의 `execution` 행은 "trigger_id FK SET NULL (트리거 삭제 시 실행 이력 보존)" 으로 명시하여 draft 와 일치한다. Schedule FK CASCADE 도 data-flow 동 문서 §1.4 와 일치한다. 모순은 발견되지 않는다 — 확인 완료.
- **제안**: 없음. 정보 제공 목적으로 기재.

---

### 8. [INFO] §2.3.1 hmacSecret rotate 액션 — EIA spec §7 의 `POST /api/triggers/:id/notification/rotate-secret` 와 다른 경로 신설

- **target 위치**: Change 3 §2.3.1 hmacSecret 행, Change 4 `POST /api/triggers/:id/auth/rotate-secret`
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §3.1 EIA-NX-12` — `POST /api/triggers/:id/notification/rotate-secret`
- **상세**: EIA spec 에는 이미 Outbound notification 의 HMAC secret rotation API 가 `/api/triggers/:id/notification/rotate-secret` 로 정의되어 있다 (EIA-NX-12). draft 는 Webhook 인증(inbound) 의 HMAC secret rotation API 로 별도로 `/api/triggers/:id/auth/rotate-secret` 을 신설한다. 두 경로는 다른 secret 을 rotate 하므로 기능 충돌은 없다. 그러나 같은 리소스(`trigger`) 에 두 개의 secret rotate API 가 존재하게 되어 사용자 혼동 가능성이 있다. API 규약 §2.2 의 RPC-style sub-channel action 허용 패턴과는 일치한다 (`/api/triggers/:id/{channel}/{action}` 형태).
- **제안**: Change 4 의 `POST /api/triggers/:id/auth/rotate-secret` 가 EIA spec 의 `/notification/rotate-secret` 와 별개 secret 임을 spec 본문에 명확히 구분하는 주석이나 fine-print 를 추가하면 구현 혼동을 막을 수 있다.

---

### 9. [INFO] NAV-TR-09 / NAV-TR-10 ID — `_product-overview.md §3.2` 마지막 기존 ID 확인

- **target 위치**: Change 1 — NAV-TR-09, NAV-TR-10 신설
- **충돌 대상**: `spec/2-navigation/_product-overview.md §3.2`
- **상세**: 현재 `_product-overview.md §3.2` 의 Trigger List 요구사항은 NAV-TR-01 ~ NAV-TR-08 까지만 존재한다. draft 는 NAV-TR-09 와 NAV-TR-10 을 추가한다. ID 중복이 없으므로 직접 충돌은 없다. 다른 영역(NAV-SC-*, NAV-IN-* 등)에서도 TR 인덱스는 사용하지 않는다.
- **제안**: 없음. 확인 완료.

---

### 10. [WARNING] schedule 타입 트리거의 Trigger 화면 내 직접 삭제 허용 — `spec/1-data-model.md §2.9.1` 제약과의 명시적 조화 필요

- **target 위치**: Change 5 §4.3, §4.4 — "Schedule 타입을 schedule 화면이 아닌 trigger 화면에서 삭제: §4.3 에 따라 schedule cascade 와 함께 삭제"
- **충돌 대상**: `spec/1-data-model.md §2.9.1` — "Trigger(type=schedule) 직접 생성: 금지 — Schedule 화면에서만 생성 가능"
- **상세**: 데이터 모델 §2.9.1 은 생성 방향만 제한("Schedule 화면에서만 생성")하고 삭제 방향은 제한하지 않는다. 따라서 Trigger 화면에서의 schedule 타입 트리거 삭제 허용은 모순이 아니다. 그러나 `data-flow/10-triggers.md §1.4` 의 동기화 규칙 표에서 "Trigger(type='schedule') 직접 생성: 금지" 만 있고 삭제 경로에 대한 명시가 없어, 구현자가 양방향 삭제 허용 여부를 오해할 수 있다.
- **제안**: draft 의 §4.3 / §4.4 내용이 data-flow/10-triggers.md §1.4 와 정합함을 cross-link 로 명시하거나, data-flow spec 의 동기화 규칙 표에 "Trigger(type=schedule) 화면에서 삭제: CASCADE 허용" 행을 추가해 생성-제한/삭제-양방향-허용 비대칭을 문서화한다.

---

### 11. [INFO] `spec/2-navigation/_layout.md` 에서 워크플로우 삭제 이름 confirm 패턴 참조 — 실제 패턴이 동 spec 에 없음

- **target 위치**: Change 5 §4.2 — "(spec/2-navigation/_layout.md 참고 — 동일 패턴이 Workflow 삭제에 이미 사용 중)"
- **충돌 대상**: `spec/2-navigation/_layout.md` (전체), `spec/2-navigation/1-workflow-list.md §2.6`
- **상세**: `_layout.md` 는 레이아웃 구조, 사이드바, 사용자 영역만 기술하며 삭제 confirmation 패턴이 없다. `1-workflow-list.md §2.6` 의 "삭제" 항목도 "확인 다이얼로그 후 삭제" 만 있고 이름 입력 confirm 패턴은 명시되어 있지 않다. draft 의 참조(`_layout.md` 에 이미 사용 중이라는 주장)가 실제 spec 내용과 다르다. 이름 입력 confirm 패턴은 기존 spec 어디에도 canonical 정의가 없는 것으로 보인다.
- **제안**: "동일 패턴이 Workflow 삭제에 이미 사용 중" 이라는 주장은 기존 spec 에 근거가 없으므로 제거하거나, 실제 구현 패턴을 확인하여 `_layout.md` 또는 `0-overview.md` cross-cutting 위치에 canonical 정의를 신설한 후 cross-link 하는 방향으로 수정한다. 이 패턴을 본 draft 에서 최초 도입하는 것으로 명확히 표현하는 것이 바람직하다.

---

### 12. [INFO] `workflowId` read-only lock — 데이터 모델 `Trigger.workflow_id` FK 와의 관계

- **target 위치**: Change 3 §2.3.1 workflowId 행 (read-only v1)
- **충돌 대상**: `spec/1-data-model.md §2.8` Trigger 엔티티
- **상세**: 데이터 모델은 `Trigger.workflow_id` 를 `UUID | FK → Workflow` 로 정의하며 수정 가능 여부에 대한 제약을 두지 않는다. draft 는 v1 에서 UI 레벨 lock(편집 불가)을 명시한다. 데이터 모델과 모순되지 않는다(DB 레벨 immutable constraint 가 아닌 UI/API 레벨 lock). 다만 Rationale R-1 에서 서술한 "실행 이력 trigger_id FK 보존" 근거는 `Execution.trigger_id` 가 `SET NULL` (트리거 삭제 시) 이지 "트리거가 살아있는 동안 변경 불가" 와는 별개 논점이므로 Rationale 의 논리 전개가 약간 불정확하다. schedule.parameter_values 와 관련된 R-1.2 근거가 더 강력하다.
- **제안**: spec 충돌 없음. Rationale R-1 의 논리 강화는 품질 개선 사항이므로 필수는 아니다.

---

## 요약

target draft 는 전반적으로 기존 spec 과 구조적 충돌 없이 결손을 보강하는 방향이다. 주요 위험은 에러 코드 명명 비일관성 두 건(`VALIDATION_FAILED` vs `VALIDATION_ERROR`, `TRIGGER_NOT_FOUND` vs `RESOURCE_NOT_FOUND`)으로, 이 중 `VALIDATION_FAILED` 는 기존 에러 처리 spec 과 직접 모순되어 구현자가 다른 에러 코드를 emit 할 가능성이 있다. RBAC 측면에서 draft §4.1 의 `editor+` 삭제 권한은 기존 RBAC 매트릭스(Trigger D = Editor+)와 일치하나 `trigger.delete` permission 명은 매트릭스에 미등록 상태다. Schedule 타입 트리거의 Trigger 화면 삭제 허용은 데이터 모델 §2.9.1 의 생성 방향 제한과는 비대칭이지만 모순은 아니며, 양방향 삭제 허용임을 data-flow spec 에 명시하면 구현 혼동을 방지할 수 있다. `_layout.md` 의 이름 confirm 패턴 참조 오류는 혼선을 줄 수 있으므로 수정을 권장한다.

---

## 위험도

**MEDIUM**

에러 코드 명명 불일치 2건(WARNING)이 구현 시 다른 코드를 사용하는 직접 원인이 될 수 있으며, schedule 타입 삭제 정책의 data-flow spec 미반영(WARNING)도 구현 누락을 유발할 수 있다. CRITICAL 수준의 모순(데이터 모델 정의 충돌, API endpoint 중복, 요구사항 ID 충돌)은 발견되지 않았다.
