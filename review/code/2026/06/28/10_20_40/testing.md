# Testing Review

## 발견사항

### **[INFO]** `triggers.service.spec.ts` 내 `endpointPath` 픽스처 값이 여전히 non-UUID 슬러그 사용
- 위치: `/codebase/backend/src/modules/triggers/triggers.service.spec.ts` 라인 489, 512, 797, 1127, 1253, 1391, 1561
- 상세: `endpointPath: 'hook-abc'`, `endpointPath: '/new-path'` 등 슬러그 형식 값이 mock 픽스처에 쓰이고 있다. 본 PR 이 강제하는 v4 UUID 형식과 불일치하며, `@IsUUID('4')` 데코레이터 동작을 전제로 하는 유닛 테스트에서 잘못된 형식이 "정상 경로"로 암묵적으로 쓰인다. 서비스 단위 테스트는 ValidationPipe 레이어를 거치지 않으므로 실제로 런타임 오류를 유발하진 않으나, 픽스처 값이 규약과 어긋나면 미래에 DB-level CHECK 제약(`V102`)이 서비스 유닛 테스트에도 적용되는 통합 경로로 확장될 때 혼란을 초래할 수 있다. DB constraint 테스트가 추가될 경우 이 픽스처들이 그대로 복제돼 체계적 회귀를 일으킬 수 있다.
- 제안: 서비스 스펙 내 `endpointPath` 픽스처를 `crypto.randomUUID()`나 고정 v4 UUID 상수로 교체해 코드베이스 전반에서 일관성을 확보한다.

### **[INFO]** `V102` 마이그레이션 SQL에 대한 DB 레벨 단위 테스트 없음
- 위치: `/codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql`
- 상세: CHECK 제약의 정규식이 의도한 대로 동작하는지(변형 nibble `[89ab]`, 대소문자 무관 `~*`, NULL 허용 등) 검증하는 DB-level 테스트가 없다. `migrations.spec.ts`는 파일명 컨벤션만 검사하며, V102 제약의 실제 수락·거절 동작은 테스트되지 않는다. NOT VALID 이므로 기존 row 에 대해 적용되지 않는다는 점과 신규 INSERT/UPDATE 에만 적용된다는 점이 e2e 환경에서도 암묵적으로만 검증된다.
- 제안: e2e DB 환경에서 (a) 유효한 v4 UUID INSERT 통과, (b) 슬러그 형식 INSERT 거절, (c) NULL 통과의 3가지를 직접 `db.query`로 검증하는 최소 SQL 통합 테스트 케이스를 추가하면 정규식 회귀를 명시적으로 차단할 수 있다. 단, 현 프로젝트 구조상 migration 단위 테스트가 관례화되어 있지 않다면 INFO 수준으로 유지.

### **[INFO]** `UpdateTriggerDto.endpointPath` v4 UUID 형식 강제에 대한 e2e 검증이 `PATCH` 경로 누락
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` (B2 테스트)
- 상세: 새로 추가된 B2 케이스는 `POST /api/triggers`(생성) 시 비-UUID endpointPath → 400 을 검증한다. 그러나 `PATCH /api/triggers/:id`(수정) 경로에서 비-UUID `endpointPath` 를 보낼 때 UpdateTriggerDto의 `@IsUUID('4')` 가 실제 파이프라인에서 400 을 반환하는지 검증하는 e2e 케이스가 없다. DTO unit 테스트(trigger-dto-validation.spec.ts)는 이미 UpdateTriggerDto 에 대해 거부를 확인하지만, 실 파이프라인 회귀 가드가 POST 에만 추가됐다.
- 제안: webhook-trigger.e2e-spec.ts 에 `PATCH /api/triggers/:id` + 비-UUID endpointPath → 400 VALIDATION_ERROR 케이스를 추가한다(예: B3 또는 C 이후 삽입). 우선순위: INFO(DTO unit 커버 있음).

### **[INFO]** `v5 UUID` 거부 단위 테스트 추가 — v5 UUID 예시값의 variant nibble 이 실제 v5 RFC 규약과 상이
- 위치: `/codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` 라인 135 (신규 추가 테스트)
- 상세: 추가된 v5 UUID 예시 값 `550e8400-e29b-51d4-a716-446655440000`은 version nibble(3번째 그룹 첫 char)=5 로 올바르나, variant nibble(4번째 그룹 첫 char) `a716`의 첫 nibble `a`는 RFC 4122 v5 에서 유효한 variant(8, 9, a, b 중 하나)에 해당해 기술적으로는 valid v5 UUID 처럼 보인다. 그러나 `@IsUUID('4')` 가 version nibble=4 만 허용하므로 이 값은 당연히 거부된다. 테스트 의도는 명확하며 실제 동작에는 문제없다. 다만 코드 주석에서 `@IsUUID('4') 는 v5 도 거부한다`는 설명이 모든 가이드를 제공하므로 혼란 가능성은 낮다.
- 제안: 현재 수준에서 유효. 선택적으로 variant nibble 이 실제 v5 RFC 규약에 맞지 않는 예시(예: `550e8400-e29b-51d4-c716-446655440000`) 로 교체해 더 엄밀한 v5 사례를 표현할 수 있으나 테스트 목적에는 불필요.

### **[INFO]** `system-status.e2e-spec.ts`의 `workspace-invitations-pruner` 항목 제거가 회귀 위험을 가짐
- 위치: `/codebase/backend/test/system-status.e2e-spec.ts` 라인 28-31 (삭제)
- 상세: `workspace-invitations-pruner` 항목이 EXPECTED_QUEUE_NAMES 에서 제거됐으나, 전체 파일 컨텍스트를 보면 해당 큐 항목은 여전히 목록 라인 1575(`'workspace-invitations-pruner'`)에 남아 있다. 즉 diff 는 중복 주석 제거를 보여주며, 실제 EXPECTED_QUEUE_NAMES 배열에서 삭제된 것이 아니다. e2e 테스트가 실제 등록 큐 수와 불일치하면 `names` equal 검사에서 실패한다. PR 체크리스트에 "중복 2회 제거" 로 기록되어 있어 의도적 행위이며, 현재 목록이 실제 서비스 큐와 정합한지 확인이 필요하다. 회귀 방지를 위해 EXPECTED_QUEUE_NAMES 와 `system-status.constants.ts` 의 MONITORED_QUEUES 가 동기화됨을 보증하는 메커니즘이 없다.
- 제안: 블랙박스 e2e 특성상 constants import 가 어렵다면, EXPECTED_QUEUE_NAMES 변경 시 MONITORED_QUEUES 를 함께 확인하는 체크리스트 주석을 유지한다.

## 요약

이번 변경은 테스트 관점에서 전반적으로 양호하다. v5 UUID 거부 단위 테스트 추가(B), 비-UUID endpointPath 생성 e2e 가드(B2), e2e 픽스처 두 곳의 UUID 교체로 DB CHECK 제약과의 정합성을 확보했으며 테스트 의도도 명확히 주석 처리되어 있다. 주된 커버리지 갭은 (1) `PATCH /api/triggers/:id` 경로에서 비-UUID endpointPath 에 대한 e2e 검증 누락, (2) V102 마이그레이션 CHECK 제약 동작 자체를 직접 검증하는 DB 통합 테스트 부재, (3) 서비스 스펙 내 픽스처 값이 여전히 슬러그 형식으로 남아 있어 코드베이스 일관성이 완전하지 않다는 점이다. 이 중 CRITICAL 또는 WARNING 수준 문제는 없으며, 모두 INFO 등급의 개선 권고사항이다.

## 위험도

LOW
