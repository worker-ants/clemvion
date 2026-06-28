# 요구사항(Requirement) Review

## 발견사항

### [CRITICAL] system-status.e2e-spec.ts — `workspace-invitations-pruner` 잔류로 e2e 실패 예상

- 위치: `codebase/backend/test/system-status.e2e-spec.ts` line 36 (변경 후 "전체 파일 컨텍스트" 기준)
- 상세: diff 는 `workspace-invitations-pruner` 관련 주석 3줄(주석 2 + 항목 1)을 제거하나, "전체 파일 컨텍스트"(적용 후 상태) 를 보면 line 36 에 `'workspace-invitations-pruner'` 가 여전히 남아 있다. 결과적으로 `EXPECTED_QUEUE_NAMES` 에 16개 항목이 존재한다. 반면 `/Volumes/project/private/clemvion/codebase/backend/src/modules/system-status/system-status.constants.ts` 의 `MONITORED_QUEUES` 에는 `workspace-invitations-pruner` 에 해당하는 상수·항목이 없고 총 15개 큐만 등록돼 있다. e2e 테스트의 `expect(names).toEqual([...EXPECTED_QUEUE_NAMES].sort())` 는 런타임 16개 vs 기대 16개(또는 런타임 15개 vs 기대 16개) 로 불일치해 실패할 것이다.
- plan (`plan/in-progress/trigger-endpoint-path-review-carryover.md`) 은 "중복(`workspace-invitations-pruner` 2회) 제거" 라고 기록하나, diff 에서 제거된 3줄은 PR #744 후속 설명 주석 + 1개 중복 항목이고 원래 항목 1개(line 36)는 여전히 파일에 존재한다.
- 제안: `EXPECTED_QUEUE_NAMES` 에서 `'workspace-invitations-pruner'` 를 완전히 제거(line 36 삭제). `MONITORED_QUEUES` 에 해당 큐가 없는 한 e2e 는 실패한다.

---

### [WARNING] [SPEC-DRIFT] WH-MG-02 spec 본문이 "생성 시" 자동 생성만 명시 — 수정 DTO v4 UUID 강제 누락

- 위치: `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md` line 90, `update-trigger.dto.ts` JSDoc
- 상세: `update-trigger.dto.ts` JSDoc 은 "WH-MG-02 가 서버가 **생성/수정 DTO** 에서 v4 UUID 형식을 강제 라고 명시" 라고 언급하나, spec 본문 WH-MG-02 는 "생성 시 endpoint_path **자동 생성** (랜덤 UUID 기반)" 만 기술한다. 수정(PATCH) DTO 에서도 v4 UUID 형식을 검증해야 한다는 요구사항이 spec 에 명시돼 있지 않다. 코드의 `@IsUUID('4')` 를 UpdateTriggerDto 에 두는 것 자체는 보안 관점에서 올바르고 WH-SC-01 취지에도 맞다. 따라서 **코드가 옳고 spec 이 낡은** SPEC-DRIFT 상황이다.
- 제안: 코드 유지. `spec/5-system/12-webhook.md` §3.4 WH-MG-02 행에 "수정 DTO 도 v4 UUID 형식을 강제한다" 내용을 project-planner 를 통해 추가 반영.

---

### [WARNING] UpdateTriggerDto 주석 — "WH-MG-02" 인용 언어 부정확

- 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` lines 985~987 (변경 후 JSDoc)
- 상세: JSDoc 내 "Spec Webhook WH-MG-02" 참조 문구가 "서버가 **생성/수정 DTO** 에서 v4 UUID 형식을 강제" 라고 기술하나, 현재 spec WH-MG-02 는 그렇게 명시하지 않는다(SPEC-DRIFT 위). 독자가 spec 과 코드를 교차 확인하면 불일치를 발견하게 되고, 리뷰어 오탐의 원인이 될 수 있다. 실제로 이번 이월 작업 자체가 이전 리뷰어 오탐(W3)에서 기인했다.
- 제안: spec 갱신 후 JSDoc 인용도 정확한 spec 언어를 반영하도록 조정하거나, spec 갱신 전까지는 "WH-SC-01 취지에 따라 서버가 DTO 레벨에서도 v4 UUID 형식을 강제" 처럼 spec 본문 현재 상태를 오인케 하지 않는 표현으로 수정.

---

### [INFO] v5 UUID 거부 테스트 벡터 — variant nibble 우연 일치

- 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` lines 132~140
- 상세: v5 UUID 테스트 벡터 `550e8400-e29b-51d4-a716-446655440000` 는 version nibble `5` 로 `4[0-9a-f]{3}` 패턴에서 올바르게 거부된다. 다만 variant nibble(4번째 그룹 첫 글자 `a`)은 우연히 `[89ab]` 에 포함돼 variant 검증은 통과 상태다. 테스트는 version nibble 거부를 확인하는 의도에 맞고 결과는 정확하므로 기능상 문제 없음. 주석("version nibble(3번째 그룹 첫 char) = 5") 도 정확함.
- 제안: 문서화 수준. 필요 시 variant nibble 이 범위 밖인 벡터(예: 첫 글자 `c`)를 추가할 수 있으나 현재 커버리지로 충분함.

---

### [INFO] migration V102 — `trigger` 가 예약어인 경우 따옴표 생략

- 위치: `codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql` lines 59, 61
- 상세: PostgreSQL 에서 `trigger` 는 예약어다. `ALTER TABLE trigger` 가 현재 schema 에서 정상 동작하고 있다면(V101 이전 마이그레이션들이 동일 방식을 사용) 문제 없으나, 일부 PostgreSQL 설정·버전에서 파서 오류를 낼 수 있다. 관례적으로 `"trigger"` 처럼 따옴표를 추가하는 것이 더 안전하다.
- 제안: 기존 마이그레이션 파일들이 `ALTER TABLE trigger` (따옴표 없이)를 사용하고 있는지 확인 후, 기존 패턴에 맞춰 통일. 만약 기존 파일들이 이미 따옴표 없이 동작 중이면 현재 코드도 무방하다.

---

### [INFO] e2e 픽스처 변경 — `randomBytes` import 제거 완전성

- 위치: `codebase/backend/test/helpers/e2e-chat-channel-fixture.ts` line 1 (diff)
- 상세: `randomBytes` import 를 제거하고 `randomUUID` 만 남겼다. `randomBytes` 사용처가 `endpointPath = \`${slug}-e2e-${randomBytes(6).toString('hex')}\`` 하나였고 이를 `randomUUID()` 로 대체했으므로 제거가 정확하다. 미사용 import 잔류 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경은 PR #738 의 ai-review 이월 4개 항목(W3 JSDoc 정정, INFO #3 DB CHECK migration, INFO #9 v5 UUID 단위 테스트, INFO #11 비-UUID e2e) 과 e2e 픽스처 보강을 목적으로 하며, 핵심 기능 의도를 대체로 정확히 구현하고 있다. 그러나 `system-status.e2e-spec.ts` 의 `workspace-invitations-pruner` 항목이 diff 후에도 잔류해 `MONITORED_QUEUES` 와 불일치하며, e2e 실행 시 큐 목록 검증(`expect(names).toEqual(...)`)이 실패할 것으로 예상된다. 이는 plan 의 "중복 2회 제거" 체크리스트 항목이 완전히 이행되지 않은 것이다. V102 migration 의 v4 UUID CHECK 제약, NOT VALID 선택, NULL 허용 정책은 모두 의도에 맞게 구현됐다. WH-MG-02 spec 이 수정 DTO 에서의 UUID 형식 강제를 명시하지 않은 것은 SPEC-DRIFT 로 코드 되돌리기가 아니라 spec 갱신으로 해결해야 한다.

## 위험도

HIGH
