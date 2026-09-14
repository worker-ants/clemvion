# 신규 식별자 충돌 검토 — naming_collision

## 스코프 판정

`--impl-prep` payload 의 `구현 대상 영역` 은 `spec/conventions/` 로 표시되어 있으나, 번들 말미에
포함된 실제 작업 plan(`plan/in-progress/trigger-canary-hardening.md`)의 frontmatter 는
`spec_impact: none` 이고 본문 "하지 않는 것" 절도 `spec/ 편집(권한 밖)` 을 명시적으로 배제한다.
즉 이번 세션이 실제로 도입하려는 항목(트리거 비밀 컬럼 3중 사본 repo-guard·schedule e2e 양성
커버리지·캐너리 주석 정리·teardown 처분)은 전부 `codebase/backend/**` 범위이며, `spec/conventions/`
에 **새로 부여되는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV 키·spec 파일 경로는 없다**.
따라서 spec 계층에서의 "신규 식별자" 충돌은 원천적으로 발생하지 않는다.

그럼에도 plan 이 예고하는 코드 수준 신규 식별자(신설 repo-guard 파일명)가 기존 명명 관례·기존
심볼과 충돌하는지는 점검 관점 2(엔티티/타입명 충돌)의 연장으로 실측했다.

## 발견사항

### INFO — 신설 예정 repo-guard 이름은 기존 27개 가드 명단과 충돌 없음 (실측)

- target 신규 식별자: (미확정) "트리거 비밀 컬럼 3중 사본 동일성" 을 강제할 신설 repo-guard —
  plan 은 이름을 특정하지 않고 "repo-guard 로 세 목록 동일성을 강제" 라고만 처방한다
  (`plan/in-progress/trigger-canary-hardening.md` §B-1, 및 그 출처인
  `plan/in-progress/spec-draft-nullable-notation-followups.md:3935-3945` 트래커 항목).
- 기존 사용처: `codebase/backend/src/repo-guards/__tests__/*-guard.ts` 27개 파일 전수
  (`audit-action-binding-guard.ts`, `dto-class-name-collision-guard.ts`,
  `dto-jsdoc-citation-guard.ts`, `endpoint-path-conflict-wrap-guard.ts`,
  `engine-error-code-anchor-guard.ts`, `eslint-unicorn-peer-guard.ts`,
  `masked-reject-callers-guard.ts`, `nullable-type-lie-cast-guard.ts`,
  `param-uuid-pipe-guard.ts`, `production-build-devdep-guard.ts`,
  `redis-fail-open-catalog-guard.ts`, `swagger-dto-contract-guard.ts`,
  `user-entity-exposure-guard.ts` 등) 를 `find`/`grep` 으로 전수 대조.
- 상세: 이 저장소의 repo-guard 명명 관례는 `<주제>-guard.ts` + `<주제>.spec.ts` 쌍이다. "trigger
  secret column" 계열 이름(`trigger-secret-column(s)-sync-guard` 등 자연스러운 후보)이 위 27개
  목록 어디에도 존재하지 않음을 확인했다 — 충돌 없음. 관련 기존 심볼(`TRIGGER_RESPONSE_STRIP_COLUMNS`
  `codebase/backend/src/modules/triggers/triggers.service.ts:104`,
  `TRIGGER_SECRET_COLUMNS` `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:24` 및
  `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:45`, `deleteSecretColumns`
  `triggers.service.ts:190`)도 서로 다른 이름으로 이미 공존하며 이번 plan 은 이 이름들을 그대로
  재사용할 뿐 새 이름을 얹지 않는다.
- 제안: 구현 시 신설 파일명을 위 27개 목록과 대조해 재확인하는 절차만 유지하면 된다 — 별도
  변경 불필요.

### INFO — plan 이 인용하는 e2e 헬퍼 옵션명(`present`/`expectedWorkflowId`)은 이미 구현·수출된 기존 API

- target 신규 식별자: plan §B-2 가 `schedule-trigger.e2e-spec.ts` 에 추가하려는
  `expectTriggerWorkflowRef(dto, { present: true, expectedWorkflowId })` 호출.
- 기존 사용처: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:106-140` 에 동일
  시그니처(`opts: { present: boolean; expectedWorkflowId?: string }`)가 이미 export 되어 있고,
  자매 헬퍼 `expectNarrowedScheduleTriggerRef` (`schedule-trigger-ref.ts`)는 의도적으로 다른
  옵션명(`withWorkflow`)을 쓴다 — 헬퍼 JSDoc 자체가 "접두어-only 충돌을 미리 막는다" 절에서 이
  구분을 명문화했다.
- 상세: plan 이 도입하는 것은 새 식별자가 아니라 **기존 export 의 신규 호출 지점 추가**다. 이름
  충돌 위험은 없다.
- 제안: 해당 없음 (참고용 확인).

### 감사 액션 레지스트리와의 정합 — 신규 audit action 미도입, 충돌 없음

- target 신규 식별자: 없음 — plan 은 `notificationSecretV2`/`chatChannelTokenV2` 컬럼을
  다루지만 새 `AUDIT_ACTIONS` 항목을 추가하지 않는다.
- 기존 사용처: `spec/conventions/audit-actions.md` §3 레지스트리가 이미 `trigger` resource 에
  `notification_secret_rotated` · `chat_channel_bot_token_rotated` · `interaction_token_revoked`
  세 액션을 등재해 두었다 (2026-08-11 구현).
- 상세: plan 의 하드닝 대상(응답 유출 방지 목록)과 감사 로그 액션명은 같은 도메인(트리거 비밀
  회전)을 가리키지만 서로 다른 레이어(응답 직렬화 vs 감사 기록)이며 이름 공간도 겹치지 않는다
  (`TRIGGER_SECRET_COLUMNS` 컬럼명 vs `*_rotated`/`*_revoked` 액션명). 충돌 아님, 참고 차원의
  cross-reference.
- 제안: 해당 없음.

## 요약

`--impl-prep` 대상 plan(`trigger-canary-hardening.md`)은 `spec_impact: none` 을 명시하고 실제
변경 범위를 `codebase/backend/**` 의 테스트·가드 코드로 한정한다. `spec/conventions/` 에 새로
부여되는 요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, 이벤트명, ENV/설정 키, spec 파일
경로는 하나도 없어 이 관점의 검토 대상 자체가 사실상 존재하지 않는다. plan 이 예고하는 유일한
코드 수준 신규 식별자(신설 repo-guard 파일)도 기존 27개 repo-guard 명명 관례·기존 27개 이름과
grep 대조 결과 충돌이 없고, 인용된 e2e 헬퍼 옵션명(`present`/`expectedWorkflowId`)은 이미
구현·export 된 기존 API 를 재사용할 뿐 새 이름을 만들지 않는다. `audit-actions.md` 의 기존
trigger 비밀 회전 액션 3종과도 이름공간이 겹치지 않는다.

## 위험도

NONE
