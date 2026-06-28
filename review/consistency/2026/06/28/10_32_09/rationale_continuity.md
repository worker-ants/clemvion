# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/12-webhook.md` (impl-done, diff-base=origin/main)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] UpdateTriggerDto 주석 수정 — endpointPath 가변성 정책 정합화
- **target 위치**: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` — `endpointPath` 필드 JSDoc 및 `@ApiPropertyOptional` description
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드-권한 매트릭스 Webhook Configuration 행 (`endpointPath` | edit), §3 API 노트 ("PATCH /api/triggers/:id 본문은 다음 부분 갱신 키를 top-level 로 받는다: ... endpointPath ..."), Rationale R-1·R-2 (workflowId v1 잠금, hmacSecret 분리)
- **상세**: origin/main 의 DTO 주석은 "단, 생성 후 endpointPath 변경은 service 가 거부한다"로 기술되어 있었다. 이는 spec 이 이미 명시한 동작(webhook 트리거에서 endpointPath 는 `edit` — `PATCH /api/triggers/:id { endpointPath }` 로 변경 가능, schedule 타입에만 거부)과 불일치하는 stale 주석이었다. diff 는 이를 올바른 정책(webhook 은 변경 가능, schedule 에만 거부)으로 수정했다. 이것은 기각된 Rationale 대안을 재도입한 것이 아니라, 코드 주석을 이미 합의된 spec 결정에 맞게 정정한 것이다.
- **제안**: 변경이 spec 에 이미 근거가 있으므로 별도 조치 불필요. 다만 `spec/5-system/12-webhook.md § Rationale` 에 "endpointPath 는 webhook 트리거에서 사용자 의도적 URL 교체(squatting 방지 목적)를 위해 가변, schedule 타입에만 동기화 보호를 위해 잠금" 한 줄을 추가하면 이후 유사 혼란을 방지할 수 있다(필수 아님).

---

### [INFO] DB CHECK 제약 NOT VALID 채택 — Rationale 내 forward-only/CLI 주입 결정과 정합
- **target 위치**: `codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql` 전체
- **과거 결정 출처**: `spec/0-overview.md` Rationale "DB 마이그레이션 도구로 Flyway 채택 (§2.8)" — forward-only 채택, `-- DOWN:` 주석 형식 규약; `spec/conventions/migrations.md` (참조됨)
- **상세**: V102 마이그레이션은 NOT VALID 로 CHECK 제약을 추가해 레거시 비-UUID row 와 공존하며 신규 INSERT/UPDATE 에만 강제한다. SQL 파일 하단에 `-- DOWN:` 주석을 포함해 forward-only 규약을 준수한다. Flyway `-- DOWN:` 주석 형식 + IF EXISTS 가드 패턴은 기존 결정과 충돌 없음. `NOT VALID` 채택 근거도 파일 내 주석으로 명시되어 있어 결정의 무근거 번복이 아님.
- **제안**: 적합. 추가 조치 불필요.

---

### [INFO] e2e 픽스처 endpointPath 슬러그 → UUID 전환 — WH-SC-01·WH-MG-02 적용
- **target 위치**: `codebase/backend/test/external-interaction.e2e-spec.ts`, `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts`
- **과거 결정 출처**: `spec/5-system/12-webhook.md` WH-SC-01 ("반드시 CSPRNG 로 발급한 v4 UUID"), WH-MG-02 ("서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제")
- **상세**: 픽스처가 `e2e-{triggerId.slice(0,8)}` / `${slug}-e2e-${randomBytes(6).toString('hex')}` 같은 슬러그 형식을 endpointPath 로 직접 INSERT 하던 것을 `randomUUID()` 로 교체했다. DB CHECK 제약(V102 NOT VALID)이 신규 INSERT 에 적용되므로 픽스처 수정은 필수 적합 변경이다. WH-SC-01 의 "CSPRNG v4 UUID" 원칙을 테스트 코드 레벨에서도 준수하는 것으로, 기각된 대안 재도입이 아님.
- **제안**: 적합.

---

### [INFO] system-status.e2e-spec.ts — 중복 큐 항목 제거
- **target 위치**: `codebase/backend/test/system-status.e2e-spec.ts` EXPECTED_QUEUE_NAMES 배열
- **과거 결정 출처**: `spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그 (workspace-invitations-pruner 포함 17개), `spec/data-flow/12-workspace.md` §1.2·§3.1
- **상세**: diff 가 제거한 3줄은 prior PR(web-chat sessionStorage 관련)이 임시 추가한 중복 엔트리(`'workspace-invitations-pruner'` + "stale 수정" 주석)였다. origin/main 에서 동일 큐명이 이미 38번째 줄에 존재하므로 제거는 중복 해소다. `workspace-invitations-pruner` 자체는 EXPECTED_QUEUE_NAMES 에 여전히 남아 있으며 spec 카탈로그와 정합 유지됨.
- **제안**: 적합.

---

## 요약

이번 변경(trigger endpointPath v4 UUID DB CHECK + DTO 주석 정정 + e2e 픽스처 UUID 전환)은 spec 의 기존 Rationale 결정과 전면 정합한다. DTO 주석의 "생성 후 변경 거부" 문구가 spec/2-navigation/2-trigger-list.md 에 이미 합의된 "webhook endpointPath 는 edit 가능, schedule 만 거부" 결정과 상충하고 있었는데, 이번 diff 가 이를 올바르게 정정했다. DB 마이그레이션(NOT VALID + forward-only + DOWN 주석)은 spec/0-overview.md Flyway 규약을 준수하고, 픽스처 UUID 전환은 WH-SC-01·WH-MG-02 원칙을 테스트 코드 레벨로 확장 적용한 것이다. 기각된 대안의 재도입, 합의된 invariant 직접 위반, 근거 없는 결정 번복은 발견되지 않았다.

## 위험도

NONE
