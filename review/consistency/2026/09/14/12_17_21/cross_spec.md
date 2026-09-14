# Cross-Spec 일관성 검토 — trigger-canary-hardening

## 검토 범위 확인

- 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- 실측(`git diff origin/main...HEAD --stat -- codebase/ spec/`): **`spec/**` 변경 0개 파일**, `codebase/` 변경 6개 파일(357+/23-, 전량 테스트·가드 코드) — `plan/in-progress/trigger-canary-hardening.md` 의 `spec_impact: none` 선언과 일치한다. 프롬프트 번들 내 diff 섹션(`<git diff origin/main...HEAD -- code_areas>`)이 예산 절단으로 비어 있었기 때문에, 지시된 절차대로 워킹트리를 절대경로로 직접 열어 실제 diff 를 확인했다(6개 파일: `trigger-secret-columns-guard.ts`(신규) · `trigger-secret-columns.spec.ts`(신규) · `trigger-workflow-ref.spec.ts` · `chat-channel-trigger-create.e2e-spec.ts` · `schedule-trigger.e2e-spec.ts` · `trigger-workflow-ref.e2e-spec.ts`).
- 변경분은 **전부 테스트/가드 코드**이며 프로덕션 로직·API·엔티티·상태 머신·RBAC 정의를 바꾸지 않는다. 따라서 "target 문서가 다른 spec 영역과 충돌"할 표면 자체가 이번 diff 에는 없다.

## 교차 근거 검증 (diff 주석이 인용한 spec 조항의 정확성)

diff 주석이 다른 spec 조항을 직접 인용하므로, 그 인용이 실제 코드·spec 과 어긋나면 잠재적 cross-spec 오정보가 될 수 있어 개별 확인했다.

1. **`TriggerDto.workflow` 가 §5.4 키-생략형이라는 주장** (`schedule-trigger.e2e-spec.ts` 신규 주석) — `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:102` 에서 `workflow?: TriggerWorkflowRefDto` (물음표 optional, nullable 아님)로 선언되어 있어 [`spec/5-system/2-api-convention.md §5.4`](../../../../../spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략) 의 "키 생략" 표현과 일치. 모순 없음.
2. **`secret_store` 고아 row 가 `secret-store.md §R4` 와 충돌하지 않는다는 주장** (`trigger-workflow-ref.e2e-spec.ts` 재작성 주석) — [`spec/conventions/secret-store.md` §R4](../../../../../spec/conventions/secret-store.md#r4-trigger-fk-미설정) 는 "trigger 삭제 시 명시적 cleanup 책임은 `TriggersService.delete()`" 라고 규정. 실측: `TriggersService.remove()` (`codebase/backend/src/modules/triggers/triggers.service.ts:860`) 가 실제로 `this.secrets.deleteByPrefix(...)` 를 호출한 뒤 row 를 지운다. e2e 가 검증 편의상 raw `DELETE FROM trigger` 로 정리해 `secret_store` 고아 row 를 남기는 것은 **프로덕션 삭제 경로(R4 대상)가 아니라 테스트 fixture cleanup** 이므로 diff 주석의 "이것은 테스트 인프라 한정 판단이고 R4 와 충돌하지 않는다" 는 정확하다. R4 자체를 완화·재정의하지 않는다.
3. **`TRIGGER_RESPONSE_STRIP_COLUMNS`(정본) vs `TRIGGER_SECRET_COLUMNS`(사본 2개) 3중 사본 값** — 실측: 정본(`triggers.service.ts:104-107`, `as const satisfies readonly (keyof Trigger)[]`)과 두 사본(`schedule-trigger-ref.ts:24-27`, `trigger-workflow-ref.ts:45-48`, 둘 다 `as const`)이 `['notificationSecretV2', 'chatChannelTokenV2']` 로 값·순서 동일. 신규 가드(`trigger-secret-columns-guard.ts`/`.spec.ts`)가 이 3중 사본을 AST 로 대조하는 정적 가드로, 기존 유사 가드(`redis-fail-open-catalog-guard.ts`, `masked-reject-callers-guard.ts`)와 같은 "파서 로직/소비 spec 분리" 패턴을 그대로 따른다 — 계층 책임 분할 기존 결정과 일치.
4. **새 가드 파일 배치** — `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` + `trigger-secret-columns.spec.ts` 는 같은 디렉터리의 기존 `*-guard.ts`/`*.spec.ts` 쌍 명명·분리 관례(`masked-reject-callers-guard.ts`, `audit-action-binding-guard.ts` 등)와 동일 — 계층 책임 충돌 없음.

## 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 검토

- 신규/변경 파일 모두 assertion·가드 로직이며 엔티티 필드·DTO shape·endpoint·상태 머신·권한 규칙을 정의하거나 변경하지 않는다. `spec/conventions/audit-actions.md` 등 이번 검토용으로 함께 번들된 다른 conventions 문서들은 이번 diff 의 도메인(트리거 시크릿 컬럼·workflow 관계·e2e teardown)과 무관해 충돌 표면이 없다.
- `plan/in-progress/trigger-canary-hardening.md` 는 트래커(`spec-draft-nullable-notation-followups.md`) 잔여 4건을 닫는 작업이며, 본문에서 인용하는 `3-schedule.md §4` 계약("응답 형태 양성 3 + 생성 음성 대조 1")도 실제 `schedule-trigger.e2e-spec.ts` 의 기존 커버리지(`withWorkflow: true` 3회, `false` 1회)와 부합한다고 plan 이 자체 검증해 두었다.

## 요약

이번 diff 는 `spec/**` 를 전혀 변경하지 않는 순수 테스트/정적 가드 하드닝(트리거 비밀 컬럼 3중 사본 가드 신설, `TriggerDto.workflow` 양성 e2e 커버리지 추가, 캐너리 주석 표기 정리, e2e teardown 근거 정정)이며, 코드 주석이 인용하는 두 spec 조항(§5.4 키-생략, secret-store §R4)을 코드베이스에서 직접 대조한 결과 모두 정확하고 기존 결정과 어긋나지 않는다. 새 가드 파일의 배치·분리 패턴도 기존 `repo-guards/__tests__/` 관례를 그대로 따른다. Cross-Spec 관점에서 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 충돌이 발견되지 않았다.

## 위험도
NONE
