# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-done)

## 검토 범위 확인

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이 브랜치는 이 spec 영역을 바꾸지 않았다.
  코드 diff 는 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 1개
  파일·58줄(테스트 2건 추가) 뿐이며, `workspaces.service.ts` 본체(운영 코드)·DTO·컨트롤러·
  라우트·에러코드·감사 액션 상수는 이번 diff 에서 **하나도 바뀌지 않았다**. 절대경로 워킹트리
  (`git -C .../remove-member-order-coverage diff --stat origin/main...HEAD`) 로 재확인함.
- 대응 plan(`plan/in-progress/remove-member-order-coverage.md`) frontmatter: `spec_impact: none`
  (bare `none`) — 리스트 형태 오형식(`- none` 등) 아님. Gate C 규약과 일치.
- 신규 식별자(에러 코드·API endpoint·DTO 필드·감사 액션·Redis 키 등) **없음** — 추가된 두
  테스트가 참조하는 `MEMBER_NOT_FOUND`·`ADMIN_REQUIRED` 는 `workspaces.service.ts` 에 이미
  존재하던 코드이고(`throwMemberNotFound()`/`throwAdminRequired()`, 각각 344·770·921행), 이번
  PR 은 그 기존 동작(판정 순서)에 대한 unit-test 커버리지만 추가했다.
- 추가된 테스트 파일은 `spec/2-navigation/9-user-profile.md` frontmatter `code:` 의
  `codebase/backend/src/modules/workspaces/**` glob 범위 안에 있다 — spec-impl-evidence 상
  spec-linked 상태 유지, 별도 `code:` 갱신 불요.

## 발견사항

없음.

점검한 다섯 관점 모두 이번 diff·target 문서 범위에서 위반을 찾지 못했다.

- **명명 규약**: 신규 식별자가 없어 해당 사항 없음. 기존 `MEMBER_NOT_FOUND`/`ADMIN_REQUIRED`
  는 `error-codes.md` §1 이 요구하는 `UPPER_SNAKE_CASE` 를 따른다(단, `ADMIN_REQUIRED` 만
  `spec/5-system/3-error-handling.md` 카탈로그에 등재돼 있고 `MEMBER_NOT_FOUND` 는 그 문서에
  없음을 확인했다 — 이는 **이번 diff 가 만든 갭이 아니라 기존 상태**이고, target scope(spec/2-
  navigation) 밖의 문서(`5-system/3-error-handling.md`)에 대한 지적이라 본 검토의 범위 밖으로
  적어 둔다. cross-spec/coverage 축 검토자에게 넘길 사안이지 convention 위반은 아니다).
- **출력 포맷 규약**: API 응답·에러 바디 포맷 변경 없음(테스트만 추가, `NotFoundException`/
  `ForbiddenException` 의 `{code, message}` 바디 형태는 기존 관례 그대로).
- **문서 구조 규약**: `spec/2-navigation/` 번들 내 확인 가능한 문서(`9-user-profile.md`,
  `1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`, `4-integration.md`,
  `5-knowledge-base.md`, `6-config.md`, `8-marketplace.md`, `_product-overview.md`)는 모두
  `id/status/code` frontmatter + 본문 + `## Rationale` 구조를 유지하고 있고, `_product-overview.md`
  파일명·번호 prefix(`1-`~`9-`) 관례도 CLAUDE.md 명명 컨벤션과 일치한다. 이 디렉토리는 이번
  diff 로 변경되지 않았으므로 새로 어긋난 곳이 없다.
- **API 문서 규약**: OpenAPI/Swagger 데코레이터·DTO 변경 없음(`swagger.md` 대상 파일 무변경).
- **금지 항목**: 추가된 두 테스트의 doc-comment 는 `review-citations.md` 가 규정하는 세션 인용
  형식(bare `hh_mm_ss` 금지 등)을 아예 쓰지 않는다 — 인용 자체가 없어 위반 여지가 없다.

## 요약

이번 PR 의 실제 diff 는 `workspaces.service.spec.ts` 에 unit test 2건을 추가한 것이 전부이고,
`spec/2-navigation/` 은 델타 0(변경 없음)이다. 신규 API·DTO·에러 코드·감사 액션·문서 구조
변경이 없어 명명·출력 포맷·문서 구조·API 문서·금지 패턴의 다섯 관점 모두에서 정식 규약
(`spec/conventions/**`) 위반을 발견하지 못했다. 대응 plan 의 `spec_impact: none` 표기도 형식
규약(bare `none`)에 맞고, 새 테스트 파일도 기존 `code:` glob 범위 안에 있어 spec-impl-evidence
링크가 깨지지 않았다. `MEMBER_NOT_FOUND` 가 `5-system/3-error-handling.md` 카탈로그에
미등재인 점은 실재하는 문서 갭이지만 이번 diff 가 만든 것이 아니고 target scope(`spec/2-
navigation/`) 밖의 사안이라 CRITICAL/WARNING 으로 올리지 않았다.

## 위험도

NONE
