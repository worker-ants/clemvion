# 신규 식별자 충돌 검토 — workflow-version-creator (`--impl-done`)

## 검토 범위 확인

`spec/3-workflow-editor/` 스코프로 요청됐으나 실측(`git diff --stat origin/main...HEAD -- spec/`) 결과
해당 영역의 spec 델타는 **0개 파일**이다. 이 PR 은 `plan/in-progress/workflow-version-creator.md`
(`spec_impact: none`)가 서술하는 좁은 백엔드 리팩터 — `workflow-versions` 서비스·응답 DTO 의 기존
§5.4 금지 조합(`creator`/`changeSummary` optional+nullable) 정정과 두 조회(`findByWorkflow`/`findOne`)
공유 `select` 6키의 상수 추출 — 이며, 실제 구현 diff(`_code_diff.patch`, 6파일/297줄)를 기준으로
신규 식별자를 재확인했다.

## 점검한 신규 식별자 (구현 diff 기준)

1. **`VERSION_METADATA_SELECT`** (신규 module-private 상수, `workflow-versions.service.ts:109`)
   - `git grep -n "VERSION_METADATA_SELECT" -- codebase/` → 정의 1건(같은 파일) + 사용 2건(같은 파일) +
     주석 1건(형제 spec 파일) 뿐, export 되지 않음. 다른 모듈·타입과 충돌 없음.
   - 같은 파일의 기존 `CREATOR_PROJECTION`(관계 `creator` 하위 투영 전용)과 목적이 달라(스칼라 6키 최상위
     `select` 전체) 의미 중복 아님. 백엔드 전체에 `_SELECT` 접미 상수 관례가 이전엔 없었다
     (`git grep -n "^const [A-Z_]*_SELECT\|^export const [A-Z_]*_SELECT" -- codebase/backend/src` →
     이 PR 의 1건 외 0건) — 새 관례의 첫 사례이며 충돌 후보 자체가 없다.
2. **`workflow-version-response.dto.spec.ts`** (신규 테스트 파일)
   - 저장소 전체에 동일 경로/이름의 기존 파일 없음. 같은 디렉터리 관례(`*-response.dto.ts` 옆
     `*-response.dto.spec.ts`)는 `workflow-response.dto.spec.ts`·`execution-response.dto.spec.ts` 등
     선례와 정확히 일치.
3. **CHANGELOG 신규 섹션 헤딩** (`## Unreleased — OpenAPI 가 워크플로 버전 응답의 creator·changeSummary...`)
   — 문서 제목이라 식별자 충돌 대상 아님. 같은 파일의 바로 아래 기존 "Unreleased — OpenAPI 가 워크플로우
   export 응답의..." 항목과 제목이 겹치지 않는다.
4. 테스트 서술(`it.each` 타이틀, `describe` 블록명) — 다른 spec 파일과 이름이 겹치지 않으며 Jest 스코프상
   충돌 불가능(파일 단위 격리).

## 재사용된 기존 식별자 (신규 아님 — 확인만)

- `WorkflowVersionDto`, `WorkflowVersionListItemDto`, `WorkflowVersionCreatorDto`, `CREATOR_PROJECTION`,
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT` — 모두 기존 코드에 이미 정의된 이름을 그대로 참조/수정할 뿐 새로
  명명되지 않는다. 클래스명 변경 없음(`git grep -n "class WorkflowVersion" -- codebase/backend/src` 결과
  엔티티·DTO·서비스·컨트롤러·모듈 6개 클래스 전부 기존 그대로).
- API endpoint(`GET /workflows/:wfId/versions`, `GET /workflows/:wfId/versions/:versionId`) — 응답 DTO
  필드 선언(required/nullable)만 바뀌고 신규 endpoint 는 추가되지 않았다.
- 환경변수·config key, webhook/queue/SSE 이벤트명 — diff 전체(6파일)에 신규 도입 없음.
- spec 파일 경로 — 이 PR 은 `spec/` 을 건드리지 않으므로 신규 spec 경로 자체가 없다. (별도 트래커
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `5-version-history.md §7.2` 응답
  타입명 이격이 planner 항목으로 이미 등재돼 있으나, 이는 "이 PR 과 무관한 기존 상태"로 명시돼 있고
  이번 diff 가 새로 만든 식별자가 아니므로 본 검토 범위 밖이다.)

## 발견사항

없음. 직전 `--impl-prep` 검토(`review/consistency/2026/09/26/23_55_27/naming_collision.md`, 위험도 NONE)가
예측한 두 신규 식별자(`VERSION_METADATA_SELECT`, `workflow-version-response.dto.spec.ts`)와 실제 구현 diff가
정확히 일치하며, 추가로 도입된 식별자(CHANGELOG 섹션 헤딩, 테스트 서술)도 기존 사용처와 겹치지 않는다.

## 요약

이번 `--impl-done` 대상은 이미 병합된 워크플로 버전 이력 기능의 응답 DTO 필드 선언(§5.4 금지 조합 해소)과
내부 `select` 리팩터에 국한되며, `spec/3-workflow-editor/` 자체는 변경되지 않았다. 구현이 새로 도입한
식별자는 module-private 상수 `VERSION_METADATA_SELECT` 와 관례에 맞는 신규 테스트 파일
`workflow-version-response.dto.spec.ts` 뿐이고, 전수 grep 결과 기존 코드베이스·spec·plan 어디에도 동일
이름이 다른 의미로 쓰이지 않는다. 재사용되는 기존 식별자(엔티티·DTO·API endpoint)도 spec 정의와 일치해
신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
