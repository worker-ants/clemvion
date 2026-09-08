# 요구사항(Requirement) 코드 리뷰 — `spec-followups-batch-b` (5라운드째)

## 검토 방법

이번 diff 는 이미 4라운드의 `/ai-review` + 4라운드의 `--impl-done` consistency check 를
거친 배치(B-1~B-8, `plan/in-progress/spec-followups-batch-b.md`)의 fix 누적본이다. 프롬프트
번들 상당수(파일 26~136)는 그 라운드들의 `review/**` 산출물 자체라 "리뷰 대상 코드"라기보다
"이전 리뷰의 증빙"이다. 실질 코드 diff(파일 1~25)를 워킹트리에서 직접 `Read`/`grep` 으로
열어 아래를 실측 검증했다 — 리포지토리에는 어떤 파일도 쓰지 않았다(`git status --short` 로
확인, 뮤테이션 없음).

- `codebase/backend/src/common/db/pg-error.ts` — `isPostgresUniqueViolation`/`pgErrorConstraint`
  가 실제로 `err.code`/`err.driverError.code` 두 표면을 모두 흡수하는지
- `codebase/backend/src/common/filters/http-exception.filter.ts` — 분기 순서(HttpException →
  unique violation → generic Error)와 신설 테스트(raw 23505/23502)가 실제로 그 순서로
  통과·차단되는지 손으로 추적
- `spec/5-system/3-error-handling.md` §1.10 / `spec/1-data-model.md` §2.3 을 직접 열어 신설
  e2e(`webhook-trigger.e2e-spec.ts` B4)·`workspaces.service.ts::listMembers` 투영 필드가
  spec 문구와 line-level 로 일치하는지
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 의 판정
  로직을 실제 `triggers.service.ts` 의 모든 `triggerRepository.save()` 호출 지점(8곳: 392행대
  `create`, 454행대 `update`, 832/1163/1211/1445/1476/1527행)과 줄 단위로 대조 — spec(테스트)의
  `EXPECTED_WRAPPED_TRIGGER_SAVES`/`EXPECTED_UNWRAPPED_TRIGGER_SAVES` 8개 키가 실제 소스의
  8개 호출 지점과 정확히 1:1 대응함을 확인
- `common/__test-utils__/source-scan.ts` 의 `enclosingScopeName` — 직전 라운드가 지적한 죽은
  분기(`isFn`)가 실제로 삭제됐고, 지적된 두 미검증 갈래(변수 fallback·`'<module>'`)에
  `source-scan.spec.ts` `describe('enclosingScopeName')` 테스트가 실제로 추가됐는지 확인
- `plan/in-progress/spec-followups-batch-b.md` 의 `spec_impact` frontmatter가 이전
  consistency round(`13_22_38` WARNING#1)가 지적한 대로 `none` 으로 정정됐는지 확인

## 발견사항

- **[INFO]** `spec/1-data-model.md` `## Rationale` 표에 "쿼리 범위 DB-레벨 `select` 투영"
  패턴(`WorkflowVersionsService.findOne`에 이어 `WorkspacesService.listMembers`가 두 번째
  사례)이 아직 정식 행으로 등재되지 않았다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`,
    `select: { id, userId, role, joinedAt, user: {...} }` 블록) / `spec/1-data-model.md
    ## Rationale`
  - 상세: 코드 주석 자체가 "엔티티 전역 `select: false` 와는 다른 것"이라고 정확히
    구분하고 있어 기각된 대안의 재도입은 아니다. 다만 이 구분의 근거가 spec 본문이 아니라
    코드 주석에만 있어, 주석 이력을 못 본 미래 검토자가 오판할 여지가 남는다(이미 4라운드
    전부에서 동일하게 지적·확인된 항목).
  - 제안: 새로운 지적이 아니다 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 project-planner 담당 오픈 항목으로 이미 등재돼 있음을 확인했다(`review/consistency/
    2026/09/08/14_29_13` INFO#1 이 같은 결론). developer 턴 추가 조치 불요.

- **[INFO]** `production-build-devdep.spec.ts`/`endpoint-path-conflict-wrap-guard.ts` 등
  이전 라운드(2·3라운드) WARNING 으로 지적된 항목(orphan 주석, 중복 `it()`, fail-open 술어)이
  실제로 이번 diff 에 반영돼 있음을 직접 코드로 재확인했다 — 새 결함 아님, 확인만.

## 요약

핵심 동작 변경 6건(pg-error SoT 통합에 따른 raw-surface 23505→409 마스킹 수정, `listMembers`
DB 투영 전환, `WorkflowVersionDetail`→`…Projection` 개명, cafe24/makeshop constraint 추출
치환, 트리거 endpointPath 충돌 래핑 AST 래칫 신설, 타입체크 ratchet 을 `build` 단계로 편입)를
실제 소스 코드·관련 spec(`5-system/3-error-handling.md` §1.10, `1-data-model.md` §2.1.1/§2.3)과
line-level 로 직접 대조했으며, 함수 시그니처·에러 코드·기본값·검증 규칙 어디에서도 spec 과의
불일치를 발견하지 못했다. 신설 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)가 주장하는
"8개 저장 지점 전수 분류"는 실제 `triggers.service.ts` 소스 대조로 정확함을 확인했다(허위
캐너리 아님). `spec_impact` frontmatter 오기(WARNING, 3라운드 전 지적)도 이미 `none` 으로
정정된 상태를 확인했다. 이 배치는 이미 4라운드의 코드 리뷰 + 4라운드의 consistency check 를
거쳐 각 라운드가 발견한 결함의 성격이 "동작 결함(0건)"에서 "문서·주석 서술"로 수렴한 상태이며,
이번 5라운드 독립 검증에서도 신규 Critical/Warning 급 요구사항 불일치를 발견하지 못했다.
유일하게 남은 항목(spec Rationale 표 미등재)은 이미 상위 planner 트래커에 등재된 이월 항목이라
이번 배치의 조치 대상이 아니다.

## 위험도

NONE
