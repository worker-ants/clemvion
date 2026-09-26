# 신규 식별자 충돌 검토 — workflow-version-creator (--impl-prep)

## 검토 범위 확인

`spec/3-workflow-editor/` 스코프로 요청됐으나, 실제 변경 대상은 `plan/in-progress/workflow-version-creator.md`
(`spec_impact: none`)이 서술하는 백엔드 리팩터 — `workflow-versions` 서비스·DTO 의 기존 §5.4 금지 조합
(`creator` optional+nullable → required) 정정과 두 조회(`findByWorkflow` / `findOne`)의 공유 `select` 6키를
상수로 추출하는 작업이다. `spec/3-workflow-editor/5-version-history.md`·`0-canvas.md` 등 번들에 포함된 spec
파일들은 이미 `origin/main` 에 병합된 기존 문서이며(`git diff origin/main` 결과 없음) 이번 plan 에서 신규로
도입되지 않는다. 따라서 신규 식별자 후보는 plan 본문이 명시하는 두 가지로 좁혀진다.

## 점검한 신규 식별자

1. **`VERSION_METADATA_SELECT`** (신규 상수, `workflow-versions.service.ts` 예정)
   - `grep -rn "VERSION_METADATA_SELECT" codebase/ spec/ plan/` → plan 문서 자신의 두 언급 외 0건.
   - 같은 파일에 이미 존재하는 `CREATOR_PROJECTION`(관계 `creator` 투영 전용)과 이름 접미사가 다르지만
     (`_SELECT` vs `_PROJECTION`), 대상이 다르다 — `CREATOR_PROJECTION` 은 관계 컬럼 하위 투영, 신규 상수는
     최상위 스칼라 6키의 `select` 객체 전체. 백엔드 전체에서 `_SELECT` 접미 상수 관례 자체가 없음
     (`grep "^export const [A-Z_]*_SELECT" codebase/backend/src` → 0건)이라 충돌은 아니고, 새 관례의
     첫 사례다.
2. **`workflow-version-response.dto.spec.ts`** (신규 테스트 파일, `dto/responses/workflow-version-response.dto.ts` 옆)
   - `find codebase -name "workflow-version-response.dto.spec.ts"` → 기존 파일 없음.
   - 같은 디렉터리 관례(`*-response.dto.ts` 옆 `*-response.dto.spec.ts`)는 이미 `workflows`·`executions`·
     `external-interaction` 모듈에 선례가 있어(`workflow-response.dto.spec.ts`, `execution-response.dto.spec.ts`,
     `execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts`) 명명 컨벤션과 일치한다.

## 참고로 확인한 기존 식별자 (재사용, 신규 아님)

- `WorkflowVersion` 엔티티·`workflow_version` 테이블: `spec/1-data-model.md §2.15`, `spec/data-flow/11-workflow.md`
  에 기존 정의와 일치 — 새 의미 충돌 없음.
- `CREATOR_PROJECTION`, `WorkflowVersionCreatorDto`, `WorkflowVersionListItemDto`, `EXPECTED_OPTIONAL_NULLABLE_DRIFT`:
  모두 기존 코드에 이미 존재하는 식별자를 그대로 참조/수정하는 것이며 새로 명명되지 않는다.
- API endpoint(`GET /workflows/:wfId/versions`, `GET /workflows/:wfId/versions/:versionId`,
  `POST /workflows/:id/versions/:versionId/restore`)는 이번 plan 에서 신규로 추가되지 않는다(응답 DTO 필드
  선언만 변경) — endpoint 충돌 점검 대상 아님.

## 발견사항

없음. 이번 plan 이 도입하는 두 신규 식별자(`VERSION_METADATA_SELECT` 상수, `workflow-version-response.dto.spec.ts`
파일)는 grep 전수 확인 결과 기존 사용처와 충돌하지 않으며, 후자는 기존 명명 컨벤션과 정확히 일치한다.

## 요약

이번 --impl-prep 대상은 `spec/3-workflow-editor/` 의 신규 spec 이 아니라 이미 병합된 버전 이력 기능의 좁은
DTO/select 리팩터(plan `workflow-version-creator`, `spec_impact: none`)다. 새로 도입되는 식별자는
`VERSION_METADATA_SELECT` 상수와 `workflow-version-response.dto.spec.ts` 테스트 파일 두 개뿐이며, 전수 grep
결과 기존 코드베이스·spec·plan 어디에도 동일 이름이 다른 의미로 쓰이고 있지 않다. 재사용되는 기존 식별자
(`WorkflowVersion`, `CREATOR_PROJECTION`, 관련 DTO 타입, API endpoint)들도 spec 정의와 일치해 신규 식별자
충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
