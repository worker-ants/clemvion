# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/12-webhook.md`
검토 모드: `--impl-done` (diff-base=`origin/main`)
검토 시각: 2026-06-28

---

## 발견사항

### [INFO] spec §5.2 400 응답 포맷이 API 규약 에러 봉투와 불일치
- **target 위치**: `spec/5-system/12-webhook.md` §5.2 「400 응답 형식」
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3 에러 응답` (SoT)
- **상세**: §5.2 가 제시하는 에러 바디는 `{ "statusCode": 400, "message": ..., "errors": [...] }` 구조다. 그러나 API 규약 §5.3 의 전역 에러 봉투는 `{ "error": { "code": "VALIDATION_ERROR", "message": ..., "requestId": ..., "details": [...] } }` 구조이며, `details` 항목도 `{ field, message, code: "INVALID_FIELD" }` 다. 현재 e2e 테스트(`webhook-trigger.e2e-spec.ts`)는 `res.body.error.code` 를 검사하는 실제 봉투 구조를 사용하고 있어, spec 예시가 실구현 봉투와 어긋나 있다. 이 불일치는 본 PR 이전부터 spec 에 존재하던 pre-existing 내용으로, 이번 diff 는 §5.2 를 수정하지 않았다.
- **제안**: `spec/5-system/12-webhook.md §5.2` 의 예시를 API 규약 §5.3 봉투 형식(`{ "error": { "code": "VALIDATION_ERROR", ... } }`)으로 교체. 단 이는 pre-existing 이슈이며 본 PR 변경 범위 밖이므로 `plan/in-progress/spec-sync-webhook-gaps.md` 에 추가 항목으로 기록하거나 별도 spec-fix plan 으로 처리 권장.

---

### [INFO] migration 설명자 소문자·snake_case 권장 집합 — 준수 확인 (이상 없음)
- **target 위치**: `codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql`
- **관련 규약**: `spec/conventions/migrations.md §1` 명명 규약
- **상세**: 파일명 `V102__trigger_endpoint_path_uuid_check.sql` 은 규약 권장 집합(영문 소문자 + 숫자 + `_`)을 완전히 준수하며, V번호는 기존 max(V101) + 1 = V102 로 단조 증가 원칙을 충족한다. `.conf` 페어 불필요 (표준 트랜잭션 모드). 위반 없음. 기록용 INFO.

---

### [INFO] DTO `example` UUID 값 — v4 형식 준수 확인 (이상 없음)
- **target 위치**: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` `@ApiPropertyOptional example`
- **관련 규약**: `spec/conventions/swagger.md §1-2` (`@ApiProperty` example 보강)
- **상세**: `example: '550e8400-e29b-41d4-a716-446655440000'` — 세 번째 그룹 선두 nibble `4`(v4 버전), 네 번째 그룹 선두 nibble `a`(variant 정상). 유효한 v4 UUID 예시. 단위 테스트용 invalid 케이스 `550e8400-e29b-51d4-a716-446655440000`(버전 nibble `5` = v5)는 의도적 무효값으로 명확히 주석이 달려 있다. 위반 없음. 기록용 INFO.

---

### [INFO] `system-status.e2e-spec.ts` `workspace-invitations-pruner` 제거 — spec 큐 카탈로그와 관계
- **target 위치**: `codebase/backend/test/system-status.e2e-spec.ts` `EXPECTED_QUEUE_NAMES`
- **관련 규약**: `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 (직접적 conventions 문서 아닌 spec SoT)
- **상세**: `workspace-invitations-pruner` 가 `EXPECTED_QUEUE_NAMES` 에서 제거됐다. `spec/data-flow/0-overview.md §4` 카탈로그에는 여전히 이 큐가 17개 목록에 포함되어 있다. diff 주석은 "pre-existing e2e drift 수정" 이라 기술하며, 이 큐가 실제로 MONITORED_QUEUES 에 등록돼 있지 않거나 제거된 상태임을 암시한다. spec 카탈로그 반영 여부를 확인할 필요가 있다 (본 PR 범위 밖이지만 spec·e2e 간 drift 가 발생했을 가능성).
- **제안**: `spec/data-flow/0-overview.md §4` 큐 목록에서 `workspace-invitations-pruner` 를 제거하거나, 큐가 여전히 등록된 경우 e2e 테스트 복원 여부를 확인. conventions 위반이라기보다 spec-impl drift 이슈로, `plan/in-progress/` 에 추적 항목으로 기록 권장.

---

## 요약

대상 PR(trigger endpoint immutable)의 구현 변경 사항은 정식 규약(`spec/conventions/`)을 직접 위반하는 항목이 없다. 마이그레이션 파일명·번호는 `migrations.md` 규약을 완전히 준수하고, DTO JSDoc·`@ApiPropertyOptional` 패턴은 `swagger.md` 규약 준수 수준이 유지된다. 발견된 사항은 모두 INFO 등급이며, 두 항목(§5.2 에러 봉투 불일치, `workspace-invitations-pruner` drift)은 본 PR 이전부터 존재하던 pre-existing 내용이거나 본 PR 범위 외 spec-impl 정합 문제다. spec 문서(`spec/5-system/12-webhook.md`) 자체는 이번 PR 에서 변경이 없으며(`구현 대상 spec 영역: (없음)`), 정식 규약 준수 관점의 직접 위반은 발견되지 않았다.

## 위험도

LOW
