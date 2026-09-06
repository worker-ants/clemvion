# 요구사항(Requirement) 리뷰

## 검증 방법

`git diff origin/main...HEAD -- codebase/ .claude/ CHANGELOG.md spec/` (실질 코드/스펙 변경
25파일, 2,676줄)을 프롬프트 생략분까지 포함해 `Read`/`Bash`(git diff, grep)로 직접 열어
확인했다. `review/**` 하위 다수 파일(115개)은 이전 8회 `/ai-review`+`/consistency-check`
라운드(10:13→14:59, 2026-09-06)의 산출물이라 이번 diff 의 "코드"가 아니라 그 라운드들의
기록이므로, 그 문서들이 주장하는 수치·근거를 실제 소스와 대조하는 방식으로 검증했다(문서를
그대로 믿지 않고 재실측). 저장소 파일은 뮤테이션하지 않았다 — `git status --short` 로
확인한 대로 워크트리는 리뷰 산출물(`review/code/2026/09/06/15_30_59/**`,
`review/consistency/2026/09/06/15_31_00/**`) 외에 변경 없음.

## 발견사항

- **[INFO]** 신규 검출 2축(구조 축 `user-entity-exposure-guard.ts`, 이름 축
  `user-secret-absence.ts`)이 아직 `2-api-convention.md §5.4`/`swagger.md §5-1` 의 `code:`
  glob 어디에도 걸리지 않는다 — spec fidelity 관점의 실측 재확인
  - 위치: `spec/5-system/2-api-convention.md` §5.4 "검증 층", `spec/conventions/swagger.md`
    §5-1 (해당 절 자체는 이번 diff 대상 아님)
  - 상세: `review_guard._spec_linked_changes()` 로 직접 확인 결과(git diff 로 신규 4파일
    확인), 두 파일 모두 어떤 spec `code:` 패턴과도 매치되지 않는다. 즉 이 두 가드를
    약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 물지 않는다. 이미
    `review/consistency/2026/09/06/10_13_23` W1 이 이 사실을 5개 checker 중 4개 독립
    보고했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속
    항목("신규 검출 3축을 §5.4 「검증 층」과 `code:` 에 등재")으로 명시 등재돼 있어 조치가
    시작된 상태다(JSDoc 인용 축은 이미 `review-citations.md` 에 등재 완료, 남은 두 축만
    미등재). `spec/` 쓰기는 developer 권한 밖이라 이 브랜치에서 직접 닫을 수 없는 항목이며,
    이미 올바른 경로(planner 후속 등재)로 처리돼 있다.
  - 제안: 조치 불요 — 다음 planner 턴에서 등재 예정. 새 plan 항목 생성 불필요(이미 존재).

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 이 PR 의 핵심 목표(User 컬럼 방어)
  밖에서 파생된 계약 정정이며, spec 본문에는 필드 단위 정의가 없어 spec 불일치로 보기
  어렵다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: `spec/2-navigation/9-user-profile.md:375` 는 `GET /api/workspaces/:id/members` 를
    엔드포인트 표 한 줄로만 정의하고 응답 필드를 명시하지 않는다. 이번 PR 이 새로
    배선한 e2e(`workspace-rbac.e2e-spec.ts` `J.`)가 `assertMatchesContract` 로 실제 응답과
    DTO 를 대조하면서 미선언 필드 `joinedAt` 이 드러나 DTO 에 추가됐다.
    `WorkspacesService.listMembers`(`workspaces.service.ts:223`)가 실제로
    `joinedAt: m.joinedAt` 을 무조건 싣고, `workspace_member` 를 만드는 4개 지점
    (`workspaces.service.ts:65,184,262`, `workspace-invitations.service.ts:471`) 전부
    `new Date()` 로 즉시 채운다는 DTO 주석의 실측 수치를 직접 grep 으로 재확인해 정확함을
    검증했다. `nullable: true` 는 엔티티 컬럼 정의(`workspace-member.entity.ts:40`,
    `Date | null`, NOT NULL 없음)를 따른 것으로 코드와 일치한다.
  - 제안: 조치 불요 — spec 은 이 필드에 대해 침묵하므로 발견은 이번 리뷰의 기록 목적.

## 검증 완료(재확인) 사항 — 별도 조치 불요

아래는 이번 라운드에서 새로 발견한 결함이 아니라, 프롬프트에 제시된 diff 의 핵심 주장들을
소스 코드·spec·엔티티와 직접 대조해 **정확함을 확인**한 항목이다(요구사항 충족 여부의
근거로 기록):

1. **트리거 endpoint_path 충돌 계약** — `TriggersService.rethrowEndpointPathConflict` 이
   던지는 `{ code: 'RESOURCE_CONFLICT', details: { field: 'endpoint_path', code:
   'TRIGGER_ENDPOINT_PATH_CONFLICT' } }` 는 `spec/2-navigation/2-trigger-list.md:164` 의
   *"409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`,
   `details.field='endpoint_path'`)"* 와 필드명·값 모두 정확히 일치한다. 인덱스 이름
   상수 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'` 도
   `migrations/V002__indexes.sql:26` 의 실제 인덱스명과 일치한다. `create`/`update` 양쪽
   경로 모두 `.catch()` 로 배선돼 있고, 다른 UNIQUE 위반·비-UNIQUE 에러는 그대로
   흘려보내는 반대 방향 테스트도 존재한다.
2. **`User` 관계 노출 방어 3축** — `collectUserRelationNames` 가 엔티티에서 파생한 관계
   이름 집합(`creator`/`executor`/`owner`/`user`)을 실제 `grep -rn "relations"
   src/modules` 결과와 대조해 일치를 확인했다. `findUserRelationLoads` 의
   `EXPECTED_USER_RELATION_LOADS`(3곳: `auth.service.ts#logout`/`#refresh`,
   `workspaces.service.ts#listMembers`)가 실제 저장소의 투영-없는 `User` 관계 로드 지점과
   정확히 일치하며, `workflow-versions.service.ts` 의 두 곳은 `select: CREATOR_PROJECTION`
   투영이 있어 목록에서 정당하게 빠진다.
3. **`USER_SECRET_KEYS` 7컬럼** — `user.entity.ts` 를 직접 열어 `passwordHash`·
   `twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·
   `passwordResetToken`·`emailChangeToken` 7개가 실제 `@Column` 데코레이터를 가진
   컬럼임을 확인했고, `@Column` 총수(23)도 카나리아 테스트의 기대값과 일치했다.
4. **`WorkflowVersionsService.findOne` 수정** — `Critical`(구 라운드에서 지적)로 지목된
   `relations: ['creator']` 투영 누락이 이번 diff 에서 `select: { …, creator:
   CREATOR_PROJECTION }` 로 닫혔고, `CREATOR_PROJECTION` ↔ `WorkflowVersionCreatorDto`
   OpenAPI 스키마 일치를 강제하는 테스트가 실제로 스키마에서 프로퍼티를 추출해 대조한다
   (손으로 나열한 두 목록을 맞대는 취약한 방식이 아니다).
5. **`review_guard._parse_frontmatter_code` 파서 수정** — 블록 리스트의 빈 줄·`#` 주석
   skip, 트레일링 주석 제거(인용/비인용 스칼라 분기), "다음 키에서는 멈춘다" 회귀
   방지까지 10개 신규 단위 테스트가 각 분기(양성/반대 방향 대조군)를 개별로 문다. 코드
   경로를 직접 추적한 결과 로직이 설명과 일치한다.
6. **`dto-jsdoc-citation-guard`** — `review-citations.md §2` 가 정의한 세 인용 형태(전체
   경로/날짜+시각/bare 시각)의 정규식이 실제 저장소의 인용 관례(백틱으로 감싼 bare
   시각)와 일치하고, 동결된 베이스라인 2건(`ScheduleTriggerWorkflowRefDto`,
   `TriggerWorkflowRefDto`)이 실제 소스 JSDoc 안에 그대로 존재함을 확인했다.
7. **spec 자기-반증형 소정정** (`review-citations.md`, `spec-impl-evidence.md`) —
   CLAUDE.md 의 5조건 예외 절차(취소선 보존, 실측 동반, 국소 정정)를 그대로 따랐고,
   원 문장이 developer 가 아니라 planner 턴(`90c1751e8`)이 쓴 것으로 확인되자
   자기-반증형 예외를 쓰지 않고 별도 planner 턴을 거쳤다는 CHANGELOG 서술도 논리적으로
   일관된다.

## 요약

이번 diff(`User` 엔티티 컬럼 노출 검출 3축 신설 + 트리거 `endpoint_path` 충돌 계약 이행 +
`WorkflowVersionsService.findOne` 의 실제 `User` 컬럼 유출 수정 + `review_guard` 프런트매터
파서 정확성 수정)는 이미 8회의 `/ai-review`+`/consistency-check` 라운드를 거치며 조밀하게
다듬어진 상태다. 이번 리뷰에서 핵심 주장(관계 이름 파생 집합, 투영 없는 로드 지점, 비밀
컬럼 목록, 트리거 충돌 응답 필드, 파서 회귀 테스트, spec 문장 일치)을 소스·spec·마이그레이션
파일과 직접 대조해 전부 정확함을 확인했으며, 새로운 Critical/Warning 급 요구사항 결함은
발견하지 못했다. 유일하게 남은 것은 이미 plan 에 planner 후속 항목으로 등재된 두 가지
(구조·이름 축의 `code:` 미등재, `joinedAt` spec 필드 정의 부재)로, 둘 다 developer 권한
밖이거나 spec 이 침묵하는 영역이라 INFO 로 기록한다.

## 위험도

LOW
