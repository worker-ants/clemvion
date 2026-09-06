# 보안(Security) 리뷰

## 개요

이 diff(`origin/main...HEAD`)는 이미 5~6차례의 `/ai-review`+`/consistency-check` 라운드
(`10_13_22`→`10_53_48`→`11_27_53`→`11_55_36`→`12_28_02`→`12_53_28`→`13_39_20`)를 거쳐
누적 수정된 최종 상태다. 핵심은 `WorkflowVersionsService.findOne` 이 `User` 엔티티 전
컬럼(`passwordHash`·`twoFactorSecret`·복구 코드·계정 탈취 토큰 등)을 투영 없이
`GET /api/workflows/:wfId/versions/:versionId` 응답으로 그대로 흘려보내던 **실제 Critical
유출**을 고치고, 같은 클래스의 결함(엔티티가 `User` 관계를 투영 없이 로드하는 자리, `User`
민감 컬럼이 응답 본문 어디에라도 실리는 형태)을 향후에도 잡도록 정적 스캔 가드 2축
(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)과 부수적으로
DTO JSDoc 인용 가드(`dto-jsdoc-citation-guard.ts`)를 신설한 것이다. 별도로
`.claude/hooks/_lib/review_guard.py` 는 spec frontmatter 의 `code:` 블록 리스트 파서가
YAML 주석/빈 줄에서 `break` 해 등재 항목을 조용히 떨구던 결함(리뷰 게이트 자체의 fail-open
결함)을 고쳤다.

## 발견사항

- **[INFO]** `WorkspacesService.listMembers` 는 DB 레벨 투영이 아니라 JS 단 수동 필드
  선택에 의존한다 — 유일한 안전망은 이름 기반 e2e 단언
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`,
    `relations: ['user']` 로 `User` 전체를 로드한 뒤 `m.user?.email`/`m.user?.name` 만
    수동으로 새 객체에 담는다)
  - 상세: 직접 코드를 열어 확인한 결과 서술 그대로다. `WorkflowVersionsService.findOne`
    과 달리 이 자리는 TypeORM `select` 로 컬럼 자체를 좁히지 않고 애플리케이션 코드가
    `User` 엔티티 전체를 메모리에 로드한 뒤 안전한 필드만 골라 새 객체를 만든다. 이번
    PR 이 신설한 구조 축 가드(`findUserRelationLoads`)는 "로드 형태"만 보고 반환 시점의
    필드 선택은 보지 않으므로, 이 매핑이 `{ ...m.user }` 스프레드나 필드 추가로 넓어져도
    구조 축 가드는 계속 초록이다 — 이 사실은 가드 spec 헤더(`user-entity-exposure.spec.ts`
    의 `EXPECTED_USER_RELATION_LOADS` 표)에도 명시적으로 disclose 되어 있고, 새 e2e
    (`workspace-rbac.e2e-spec.ts` `J.` 케이스)의 `expectNoUserSecrets(res.body)` 가 유일한
    안전망으로 배선되어 있다. 현재 상태는 안전하지만, 두 축(구조 축은 로드 시점, 이름 축은
    출력 시점) 중 하나에 의존하는 방어가 아니라 반환 매핑 자체가 언제든 넓어질 수 있는
    구조라는 점은 구조적 잔여 리스크다.
  - 제안: 조치 불요(이미 문서화·테스트로 커버됨). 장기적으로는 `listMembers` 도
    `WorkflowVersionsService` 처럼 DB 레벨 `select` 투영으로 전환하면 이 클래스의 엔드포인트
    전체가 같은 방어 강도를 갖게 된다.

- **[INFO]** (긍정적 확인) `WorkflowVersionsService` 의 실제 Critical 유출이 DB 레벨 투영 +
  이중 회귀 테스트로 닫혀 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    (`CREATOR_PROJECTION` 상수, `findOne`/`findByWorkflow` 의 `select.creator`),
    `codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts`
    (`CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto` OpenAPI 스키마 대조 + `select.creator`
    직접 단언), `codebase/backend/test/workflow-crud.e2e-spec.ts` (`H.` 케이스 —
    `expectNoUserSecrets` + `assertMatchesContract` + `creator` 키 3개 고정 단언)
  - 상세: `findOne`/`findByWorkflow` 둘 다 `relations: { creator: true }` 와 함께
    `select.creator: CREATOR_PROJECTION`(`{ id, name, email }`)을 명시해 DB 레벨에서 컬럼을
    좁혔다. 투영 상수와 DTO 선언이 갈리지 않도록 OpenAPI 스키마 프로퍼티와 코드로 대조하는
    테스트가 있고, e2e 는 이름 축·계약 축·양성 단언(3필드 고정) 세 그물을 동시에 건다 —
    감사 로그 유출(#1288) 때와 같은 재발 방지 패턴이 정확히 적용됐다. 새로 지적할 결함
    없음.

- **[INFO]** (긍정적 확인) 리뷰 게이트 자체의 fail-open 결함(`review_guard.py`)이 수정되고
  회귀 테스트로 고정됨
  - 위치: `.claude/hooks/_lib/review_guard.py:637-658` (`_parse_frontmatter_code` 블록
    리스트 루프), `.claude/tests/test_review_guard.py` (`test_parse_block_list_survives_*`,
    `test_parse_block_list_still_stops_at_next_key`)
  - 상세: 애플리케이션 런타임 취약점은 아니지만 SDLC 보안(리뷰/게이트 무결성) 관점에서
    유의미하다 — 종전 파서는 YAML 인라인 주석이나 빈 줄을 만나면 블록 리스트를 즉시 `break`
    해 그 뒤 등재된 `code:` 항목을 전부 유실시켰고, 그 결과 spec-linked 로 등재된 파일이
    `--impl-done` 등 강제 게이트 판정에서 조용히 빠지는 방향(게이트가 안 무는 쪽이 기본값)
    으로 실패했다. 실측 근거(spec 387개 중 7개 파일 41개 entry 유실, 그중 하나가 당시
    작업 중이던 PR 자신의 수정 파일을 덮고 있었음)가 커밋 이력과 `plan/`·spec 문서에 남아
    있고, "다음 키에서는 여전히 멈춘다"는 반대 방향 대조군 테스트까지 갖춰 술어가 과도하게
    넓어지는 것도 막는다. 새로 지적할 결함 없음.

- **[INFO]** DTO JSDoc 인용 가드는 정보 노출(internal path/타임스탬프의 공개 API 문서 유입)
  방지 목적으로 타당하나, 강제 범위가 응답 DTO 로 한정됨을 spec 이 명시적으로 disclose
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`,
    `spec/conventions/review-citations.md`(§3 표 — 컨트롤러 축은 미강제라고 명시)
  - 상세: `/** */` JSDoc 은 `introspectComments` 로 공개 OpenAPI `description` 이 되므로,
    내부 리뷰 산출물 경로(`review/code/2026/...`)나 타임스탬프가 JSDoc 에 남으면 Swagger
    문서를 통해 외부에 내부 저장소 구조·리뷰 이력이 노출될 수 있다. 이번 가드는 그 경로를
    `dto/responses/**` 로 한정해 막지만, 컨트롤러 JSDoc 경로는 여전히 사람 리뷰에 의존한다고
    spec 이 스스로 인정하고 있어 문서한 보장이 구현보다 넓지 않다. 조치 불요 — 이미 축
    단위로 정확히 scoping 되어 기록됨.

## 관측된 워킹트리 이상 상태 (내가 만든 변경 아님)

리뷰 도중 `git status --short` 를 확인한 결과 `.claude/hooks/_lib/review_guard.py` 가
**unstaged 로 수정된 상태**였다. `git diff` 로 보면 이번 커밋이 추가한 빈 줄/`#` 주석
skip 로직(위 발견사항에서 "긍정적으로 확인"한 바로 그 fix) 5줄이 **제거되어 있다** — 즉
파일이 로컬에서 수정 전 상태로 되돌려져 있다. 나는 이 파일을 읽기만 했고 수정하지 않았다
(뮤테이션 검증 규약에 따라 저장소 파일에 쓰지 않았다). 병렬로 도는 다른 reviewer 가 뮤테이션
테스트 중일 가능성이 높아 보이지만, 원복 여부를 내가 확인/보장할 수 없으므로 그대로
보고한다 — 이 세션 종료 시점에 이 파일이 여전히 수정된 채라면 위 "review_guard.py fix" 발견
사항은 **현재 디스크 상태와 불일치**할 수 있다. `review/consistency/2026/09/06/14_26_32/`
도 내가 만들지 않은 새 디렉터리로 함께 관측됐다.

## 요약

이번 diff 는 새로운 취약점을 도입하지 않았고, 오히려 직전 라운드들에서 발견된 실제
Critical(민감 `User` 컬럼 26/전체 컬럼 유출 계열)을 DB 레벨 투영 + 다층 회귀 테스트로 닫고,
같은 결함 클래스가 재발하지 않도록 구조 기반·이름 기반 두 축의 정적/런타임 검출 가드를
신설한 방어 강화 커밋이다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 안전하지 않은
암호화 사용은 발견되지 않았다. 유일한 구조적 잔여 리스크는 `WorkspacesService.listMembers`
가 DB 레벨 투영이 아니라 애플리케이션 코드의 수동 필드 선택에 의존한다는 점인데, 이는 이번
PR 이 새로 만든 것이 아니라 기존 상태이며 이미 이름 기반 e2e 단언으로 커버되고 문서에도
명시적으로 disclose 되어 있다. 부수적으로 리뷰 게이트 자체의 fail-open 파싱 버그를 고쳐
spec-linked 등재 무결성을 회복한 점도 SDLC 보안 관점에서 긍정적이다. 다만 리뷰 도중 그
수정 파일(`review_guard.py`) 자체가 워킹트리에서 원복된 상태로 관측됐다는 점은 별도
섹션에 그대로 기록해 둔다(내가 만든 변경이 아님).

## 위험도

LOW
