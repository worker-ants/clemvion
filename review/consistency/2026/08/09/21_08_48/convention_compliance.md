# 정식 규약 준수 검토 — `spec/data-flow/**`

## 검토 범위 메모

이번 diff(`origin/main...HEAD`) 는 `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` ·
`codebase/backend/src/common/utils/uuid.ts` 두 파일의 **docstring(주석) 정정**뿐이며, API 응답 포맷·
DTO·엔드포인트·식별자 어디에도 코드 변경이 없다. `spec/data-flow/**` 자체도 이번 PR 에서 수정되지
않았다 — bundle 은 표준 impl-done 절차상 대상 spec 영역 전체를 스냅샷한 것이다. 따라서 본 검토는
(1) diff 가 참조하는 spec 섹션의 정합성, (2) `spec/data-flow/**` 15개 도메인 문서 + `0-overview.md`
전체를 `spec/conventions/**` 대비 표본 검증한 결과다.

검증한 항목:
- `audit-actions.md` (`<resource>.<verb>` 구조·시제 3분류) vs `1-audit.md` §1.1 액션 표 30여 건 — 전건 일치.
- `error-codes.md` (`UPPER_SNAKE_CASE`·예외 레지스트리) vs 15개 도메인 문서 내 에러 코드 전수 grep — 위반 0건 (lower_snake_case 는 모두 §3 예외 레지스트리에 등재된 워크스페이스 초대·OAuth callback 모듈에 한정).
- `migrations.md` (`V<번호>__snake_case`, 단조 증가) vs 문서 내 인용 V번호(V001, V002, V023, V036, V040, V058, V088~V092, V107, V108 등) — 패턴 일치.
- `node-output.md` (5필드 invariant·`output.error` 표준 형태·`retryable`/`retryAfterSec`) vs `3-execution.md`/`11-workflow.md` 의 재개·에러 서술 — 일치.
- 문서 구조 규약(Overview/본문/Rationale) — `spec/data-flow/*.md` 16개 파일 전수 `## Overview` 1회·`## Rationale` 1회 보유 확인(grep -c 전건 1).
- 진입 문서 명명(CLAUDE.md `_product-overview.md` 또는 진입 문서 `## Overview`) — `0-overview.md` 가 `## Overview (제품 정의)` 섹션을 갖춰 후자 대안 충족.
- API 문서 규약(swagger.md 데코레이터 패턴) — `spec/data-flow/**` 에는 `@Api*` 데코레이터 언급이 아예 없어 해당 없음(N/A), 위반도 없음.
- diff 가 참조하는 `spec/data-flow/12-workspace.md §Rationale "X-Workspace-Id 헤더 vs :id 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)"` 섹션 실존 여부 및 diff 인용(테스트명 `uuid.spec.ts`/`workspace-context.util.spec.ts`, `roles.guard.spec.ts` 의 테스트 케이스명)이 실제 코드와 일치하는지 확인 — 전부 일치.

## 발견사항

없음. `spec/conventions/**` 위반으로 분류할 CRITICAL/WARNING 사항을 찾지 못했다.

### 참고 (비-CRITICAL, 정보 공유용 — 본 checker 의 판정 대상 밖)

`spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서" (라인 313~349 부근)는 부트
캐너리(`assertWorkspaceIdReflectionWorks`)를 설명하는 문단 바로 앞에 "2026-08-08 전수 실측 ... 73건"
수치를 인접 배치하고 있다. 반면 이번 diff 의 `workspace-reflection-canary.ts` docstring 은 캐너리가
실제로 세는 대상이 **142건**(전체 `@WorkspaceId()` 소비 라우트)이며 73건은 그중 `@Roles()` 가 없는
서브셋일 뿐 캐너리 대상이 아니라고 명시적으로 정정했다. `spec/5-system/1-auth.md` §"부트 캐너리" 는
수치를 아예 재인용하지 않아 문제가 없으나, `12-workspace.md` 쪽은 인접 배치로 인해 독자가 "캐너리
threshold = 73" 으로 오독할 여지가 남아 있다. 이는 **정식 규약(`spec/conventions/**`) 위반이 아니라**
spec-내부 서술 정합성 문제이므로 본 컨벤션 준수 리포트의 등급 대상에는 포함하지 않았다 — spec-impl
consistency 축 checker 가 다룰 사안으로 판단해 별도 등급 없이 참고로만 남긴다.

## 요약

이번 PR 의 실제 diff 는 두 backend 파일의 docstring 정정에 그치고, API 응답 포맷·엔드포인트 명명·
DTO·이벤트 페이로드 등 `spec/conventions/**` 가 규율하는 어떤 표면도 건드리지 않는다. diff 가 인용하는
`spec/data-flow/12-workspace.md` 의 Rationale 섹션과 테스트 파일·테스트 케이스명은 실제 코드와 정확히
일치해 새로 도입된 서술 불일치가 없다. `spec/data-flow/**` 대상 문서 15개 도메인 + 개요 문서 전체를
`audit-actions.md`·`error-codes.md`·`migrations.md`·`node-output.md`·문서 3섹션 구조 규약 대비 표본
검증한 결과에서도 위반을 발견하지 못했다 — 명명(`<resource>.<verb>`, `UPPER_SNAKE_CASE`, `V<n>` 마이그레이션
번호)·구조(Overview/Rationale)·API 문서 규약(해당 없음) 전부 규약과 일치한다.

## 위험도

NONE
