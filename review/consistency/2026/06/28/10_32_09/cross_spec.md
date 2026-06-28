# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (scope=`spec/5-system/12-webhook.md`, diff-base=`origin/main`)

---

## 발견사항

### 1. [INFO] UpdateTriggerDto JSDoc 변경이 spec 2-trigger-list 및 12-webhook 과 정합

- target 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` — `endpointPath` 필드 JSDoc
- 충돌 대상: `spec/2-navigation/2-trigger-list.md` §2.3.1 · `spec/5-system/12-webhook.md` WH-MG-02
- 상세: 이전 JSDoc("단, 생성 후 endpointPath 변경은 service 가 거부한다")이 실제 서비스 동작과 모순되었다. 현행 spec(`spec/2-navigation/2-trigger-list.md` line 94)은 `endpointPath` 를 `edit` 필드(변경 가능)로 명시하고, schedule 타입만 PATCH 금지(`endpointPath / config / authConfigId` 변경은 400 VALIDATION_ERROR — line 163)로 정의한다. 신규 JSDoc이 이 spec 정의와 일치한다.
- 제안: 충돌 없음. spec 과 구현이 정합 상태다.

### 2. [INFO] V102 마이그레이션(NOT VALID CHECK 제약) — spec 데이터 모델 §2.8 Flyway 정책과 정합

- target 위치: `codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql`
- 충돌 대상: `spec/0-overview.md` §2.8 (Flyway forward-only, `-- DOWN:` 주석 패턴)
- 상세: 마이그레이션이 `-- DOWN:` 주석 포함, IF EXISTS/IF NOT EXISTS 가드, NOT VALID 패턴을 사용한다. 이는 spec의 forward-only 정책 및 rollback SQL 주석 규약과 일치한다.
- 제안: 충돌 없음.

### 3. [INFO] system-status e2e EXPECTED_QUEUE_NAMES 중복 제거 — spec data-flow/0-overview.md 큐 목록과 정합 유지

- target 위치: `codebase/backend/test/system-status.e2e-spec.ts` — `EXPECTED_QUEUE_NAMES` 배열 끝 중복 항목 제거
- 충돌 대상: `spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그 (17개 큐 — `workspace-invitations-pruner` 포함)
- 상세: diff는 `EXPECTED_QUEUE_NAMES` 배열의 **끝**에 중복 추가되어 있던 `workspace-invitations-pruner` 항목(주석 포함)을 제거한다. 동일 항목이 배열 중간(line 36)에도 남아 있어 큐는 여전히 e2e 기대 목록에 포함된다. spec 큐 카탈로그(17개)와 중복 없는 상태가 된다.
- 제안: 충돌 없음. 단순 중복 제거다.

### 4. [INFO] WH-MG-02 UpdateTriggerDto 참조 — spec 12-webhook.md 정의와 일치

- target 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` line 136, `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- 충돌 대상: `spec/5-system/12-webhook.md` WH-MG-02, WH-SC-01
- 상세: `@IsUUID('4')` 검증이 생성·수정 DTO 양쪽에 적용되고, v5 UUID 거부 테스트가 추가되었다. WH-MG-02("서버가 생성/수정 DTO에서 v4 UUID 형식을 강제")와 정합한다. UpdateTriggerDto JSDoc의 "schedule 타입 트리거에 한해 service가 변경을 거부한다" 주석은 `spec/1-data-model.md` §2.9.1 Trigger↔Schedule 동기화 규칙 참조(`triggers.service.ts` update() 로직)를 정확히 인용한다.
- 제안: 충돌 없음.

### 5. [INFO] spec 12-webhook.md 에 DB-level CHECK 제약 명시 부재 — 동기화 권장

- target 위치: `codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql`
- 충돌 대상: `spec/5-system/12-webhook.md` §2.1 Trigger 엔티티 설명, WH-MG-02
- 상세: WH-MG-02는 DTO 레벨 `@IsUUID('4')` 강제를 명시하나, V102가 추가한 **DB 레벨 CHECK 제약** (`NOT VALID`)은 spec 어디에도 언급되지 않는다. 현재는 구현이 spec을 초과하는 이중 방어일 뿐이므로 기능적 모순은 없다. 그러나 spec이 DB 방어계층 존재를 기술하지 않아 향후 마이그레이션 작성자가 이 제약을 모를 수 있다.
- 제안: `spec/5-system/12-webhook.md` WH-MG-02에 "DB 레벨 CHECK 제약(NOT VALID, V102)으로 이중 방어" 문구를 선택적으로 추가하면 동기화 완료. 우선순위 낮음 — spec이 구현보다 상위 추상이므로 DB 구현 세부를 기술하지 않는 것도 정당하다.

---

## 요약

이번 diff는 (1) `endpoint_path` DB CHECK 제약 추가(V102), (2) UpdateTriggerDto JSDoc 정정(webhook 트리거의 endpointPath 변경 가능, schedule 전용 거부), (3) v5 UUID 거부 unit 테스트 추가, (4) e2e 픽스처의 endpoint_path를 UUID로 정정, (5) system-status e2e의 중복 큐 항목 제거로 구성된다. 이들 모두 `spec/5-system/12-webhook.md` WH-MG-02·WH-SC-01, `spec/2-navigation/2-trigger-list.md` §2.3.1, `spec/1-data-model.md` §2.9.1의 기존 정의와 충돌하지 않는다. 과거 JSDoc이 서비스 동작("생성 후 endpointPath 변경은 service가 거부한다")을 잘못 기술하고 있었던 것이 정정되었으며, spec은 endpointPath를 webhook 트리거에서 edit 가능 필드로 이미 정의하고 있었다. CRITICAL/WARNING 등급의 cross-spec 모순은 발견되지 않았다. spec에 DB CHECK 제약 언급이 없다는 점만 선택적 동기화 대상(INFO)으로 남는다.

---

## 위험도

NONE
