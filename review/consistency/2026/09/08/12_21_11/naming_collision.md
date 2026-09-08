# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

`meta.json` 상 모드는 `--impl-prep, scope=spec/5-system/`이며, bundling된 target 은
`spec/5-system/*.md` 전체(1-auth·2-api-convention·3-error-handling 은 전문, 나머지는
헤더/포인터)다. 그러나 실제 착수 대상은 `plan/in-progress/spec-followups-batch-b.md`
(B-1~B-8)이고, 이 plan 은 **spec 문서를 신규 작성/수정하지 않는 순수 코드·harness
수정 배치**다(`spec_impact: spec/2-navigation/2-trigger-list.md` 1건뿐이고 그마저
체크리스트 변경 없음). 따라서 "target 이 새로 도입하는 요구사항 ID·엔티티·endpoint·
이벤트·env var·spec 파일 경로"에 해당하는 항목이 원천적으로 거의 없다. 코드 레벨에서
새로 등장하는 식별자 후보만 실측 대조했다.

## 실측 대조

- **B-8 (`WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명)**
  - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:61` 의
    기존 JSDoc 이 이미 "같은 이름의 손-미러가 프런트에 있어 grep 이 두 자리를 같은 것으로
    보여준다"는 **기존 충돌**을 명시적으로 기록하고 있었다(review/consistency/2026/09/06
    13_39_25 W3 인용). B-8 은 이 기존 충돌을 해소하는 방향의 변경이다.
  - `WorkflowVersionDetailProjection` 문자열을 `codebase/`, `spec/` 전체에서 검색 —
    **일치 0건**. 신규 개명 대상 이름이 다른 의미로 선점되어 있지 않음을 확인.
  - `spec/3-workflow-editor/5-version-history.md:95,108` 은 목록 응답을
    `WorkflowVersionListItemDto[]`로, 상세 응답은 타입명 없이 `WorkflowVersion 단건 +
    snapshot`으로만 서술한다 — spec 쪽에 `WorkflowVersionDetail(Dto)`라는 확정 이름이
    없으므로 백엔드 내부 타입 개명이 spec 표기와 충돌하지 않는다.
  - `Projection` 접미사는 `src/repo-guards/__tests__/user-entity-exposure-guard.ts:302`
    (`hasProjectionFor`)·같은 파일 fixture 의 `compliantNamedConstProjection`에서 이미
    "TypeORM select 투영" 의미로 쓰이고 있으나, 대상 모듈이 다르고 의미도 동일 계열
    (DB 투영)이라 혼동 소지가 낮다 — 지적 대상 아님.

- **B-3/B-5 (`isPostgresUniqueViolation`, `pgErrorConstraint()` 로 치환)** — 둘 다 기존
  SoT 함수를 재사용할 뿐 신규 식별자가 아니다. 충돌 대상 없음.

- **B-1 (타입체크 ratchet 을 `cmd_build()` 로 이동)** — 이동 대상은 기존
  `scripts/check-backend-typecheck-ratchet.py`/`check-frontend-typecheck-ratchet.py`
  (PROJECT.md:40-41) 이미 존재하는 스크립트이고, `.claude/test-stages.sh` 의
  `cmd_lint/cmd_unit/cmd_build/cmd_e2e` 명명 컨벤션과도 부딪히지 않는다. 신규 식별자
  없음.

- **B-2 (`tsconfig.build.json` exclude 에 `**/__test-utils__/**` 추가)** — 현재 exclude
  는 `node_modules`·`test`·`dist`·`**/*spec.ts`·`src/repo-guards/**`·
  `src/shared/testing/**` 다섯 항목뿐이고 `__test-utils__` 이름이 이미 다른 의미로 쓰인
  곳은 없다. 실제 대상 디렉터리 `codebase/backend/src/common/__test-utils__`·
  `.../modules/integrations/__test-utils__` 도 확인 — 충돌 없음.

- **B-6 (`endpointPath` save() AST 래칫)** / **B-7 (트리거 409 e2e)** — plan 이 아직
  구체적 파일명·함수명을 확정하지 않았다(설계 의도만 서술). 신규 파일이 생기면 기존
  컨벤션 — 가드는 `src/repo-guards/__tests__/*-guard.ts`, e2e 는
  `codebase/backend/test/*.e2e-spec.ts`(`webhook-trigger.e2e-spec.ts` 등 기존 트리거
  계열과 동일 패턴) — 를 따르는 한 충돌 위험은 낮다. 이름이 확정되지 않아 지금 시점엔
  검증 대상이 없다(제안만 아래 기록).

## 발견사항

- **[INFO]** B-6/B-7 신규 파일명 미확정 — 착수 시 기존 컨벤션 재확인 권고
  - target 신규 식별자: (아직 미확정) `endpointPath` save() AST 가드, 409 충돌 e2e 파일
  - 기존 사용처: `codebase/backend/src/repo-guards/__tests__/*-guard.ts` (가드 컨벤션),
    `codebase/backend/test/webhook-trigger.e2e-spec.ts` 등 트리거 e2e 컨벤션
  - 상세: 두 항목 다 plan 단계에서 파일·식별자명이 정해지지 않아 이번 시점엔 실제 충돌
    여부를 판정할 대상이 없다. 다만 기존 트리거 e2e 파일군(`*-trigger*.e2e-spec.ts`,
    `webhook-trigger.e2e-spec.ts`)과 겹치는 이름을 쓰면 파일 단위 혼동 가능.
  - 제안: 구현 시 `endpoint-path-save-wrap-guard.ts`류(가드) / 기존 트리거 e2e 파일에
    케이스 추가하거나 `trigger-endpoint-path-conflict.e2e-spec.ts`류의 신규 파일로
    명명해 기존 `*-trigger*.e2e-spec.ts` 군과 구분한다. Blocking 은 아님.

## 요약

이번 배치(B-1~B-8)는 spec 문서에 새 요구사항 ID·엔티티·API endpoint·이벤트명·env
var·spec 파일 경로를 하나도 도입하지 않는 순수 코드/harness 수정이다. 유일하게 새
식별자를 만드는 항목은 B-8 의 백엔드 타입 개명(`WorkflowVersionDetailProjection`)인데,
이는 오히려 기존에 문서화돼 있던 동명 충돌(백엔드/프런트 손-미러 `WorkflowVersionDetail`)
을 해소하는 방향이며 신규 이름이 codebase·spec 어디에서도 다른 의미로 선점돼 있지
않음을 확인했다. B-6/B-7 은 파일명이 아직 미확정이라 컨벤션 준수를 권고하는 INFO 1건
외에는 지적할 충돌이 없다.

## 위험도

NONE
