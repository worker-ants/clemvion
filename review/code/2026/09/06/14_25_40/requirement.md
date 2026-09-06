# 요구사항(Requirement) 리뷰

## 개요

이 diff 는 이미 8라운드 이상의 `/ai-review` + `/consistency-check` 사이클
(`10_13_22` → `10_53_48` → `11_27_53` → `11_55_36` → `12_28_02` → `12_53_28` →
`13_39_20` → consistency `13_18_59`/`13_39_25`/`13_52_23` → 최종 harness 수정)을 거쳐
누적된 최종 상태다. 핵심 변경은 세 갈래다.

1. **`User` 엔티티 노출 방어 3축 신설** — 구조 축(`user-entity-exposure-guard.ts`,
   관계 로드 형태를 AST 로 세는 래칫), JSDoc 인용 가드(`dto-jsdoc-citation-guard.ts`),
   이름 축(`user-secret-absence.ts`, 응답 본문을 깊이 훑어 7개 민감 컬럼 이름 부재를 단언).
2. **실유출 수정** — `WorkflowVersionsService.findOne` 이 `creator` 를 투영 없이
   로드해 `GET /api/workflows/:wfId/versions/:versionId` 로 `User` 전 컬럼(`passwordHash`
   등)을 내보내던 것을 `CREATOR_PROJECTION` 으로 닫음. `WorkspaceMemberDto.joinedAt`
   선언 누락도 함께 정정.
3. **harness 자체 결함 수정** — `review_guard._parse_frontmatter_code` 의 블록 리스트
   파서가 YAML 주석·빈 줄에서 `break` 해 `code:` entry 41개(spec 7개 파일)를 조용히
   유실시키던 것을 수정. 그 유실 중 하나가 바로 이 PR 이 고친
   `workspace-response.dto.ts` 를 감사망 밖에 두고 있었다는 점을 실측으로 확인.

핵심 로직을 직접 열어 대조한 결과(아래 상세), 이미 지적된 Critical/Warning 은 실제 코드에
반영돼 있고 회귀 테스트(양성/음성 fixture, 엔티티-DTO 스키마 대조, e2e 3건)도 실행 가능한
형태로 배선돼 있다. 새로 찾은 결함은 사소한 문서 drift 1건뿐이다.

## 확인한 내용 (요약)

- `.claude/hooks/_lib/review_guard.py` `_parse_frontmatter_code`: 수정된 블록 리스트
  루프를 실제로 `pytest`(4/4 PASS)와 대상 spec 파일(`review-citations.md`,
  `2-navigation/9-user-profile.md`)에 직접 실행해, 주석 뒤 항목이 더 이상 유실되지
  않고(`code:` entry 3개 모두 캡처) `workspaces/**` glob 이 이제 `workspace-response.dto.ts`
  변경을 spec-linked 로 잡는 것을 확인했다. 커밋 메시지가 주장한 "690→731, 파일 차이
  7→0" 수치까지 재현하지는 않았으나(범위 밖), 대표 사례 재현은 일치했다.
- `WorkflowVersionsService`: `ProjectedCreator`/`UnloadedRelations`/`WorkflowVersionListItem`/
  `WorkflowVersionDetail`/`CREATOR_PROJECTION` 타입·상수와 `findOne`/`findByWorkflow`
  의 `select` 를 대조 — 엔티티 실제 컬럼(`id/workflowId/workflow/version/snapshot/
  changeSummary/createdBy/creator/createdAt`)과 타입 정의가 정확히 들어맞는다(`workflow`
  는 `UnloadedRelations` 로 타입에서 제외되고 `select` 에도 없음 — 일관).
  `workflow-versions.service.spec.ts` 의 `CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto`
  OpenAPI 스키마 대조 테스트, `findOne` select 단언, `workflow-crud.e2e-spec.ts` H.
  (이름 축 + 계약 축 + `creator` 3필드 양성)까지 실행 경로를 확인했다.
- `USER_SECRET_KEYS` (7컬럼)를 `user.entity.ts` 전체 컬럼과 대조 — 누락·과다 없음.
  `findUserSecretLeaks`/`expectNoUserSecrets` 의 null/undefined/원시값/중첩·배열/
  snake_case/유사-이름-오탐 회피 케이스를 스펙 테스트에서 확인, 로직도 직접 추적해
  일치함을 확인.
- `WorkspaceMemberDto.joinedAt` — `WorkspacesService.listMembers`/`WorkspaceMember` 엔티티/
  `V001__initial_schema.sql` 을 대조: `joined_at TIMESTAMPTZ`(nullable) 스키마이지만
  실제로 행을 만드는 4개 지점(`workspaces.service.ts:65,184,262`,
  `workspace-invitations.service.ts:471`) 모두 `joinedAt: new Date()` 로 즉시 채운다는
  주석의 실측 수치가 정확함을 grep 으로 확인. DTO 의 `@ApiProperty`(required) +
  `nullable: true` 조합은 §5.4 "상시 존재 + null 허용" 기본형과 일치.
- e2e 라벨(`workspace-rbac.e2e-spec.ts` A~J, `workflow-crud.e2e-spec.ts` A~H) —
  중복·순서 역전 없음을 grep 으로 재확인(과거 라운드가 지적한 `F.` 중복은 `J.` 로 이미 해소).
- `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`
  정정 — CLAUDE.md의 "자기-반증형 소정정" 5조건(개발자 자신이 쓴 문장, 예고성 문장,
  실측 반증, 취소선으로 원문 보존, `--impl-done` 재확인)을 형식적으로 정확히 따르고 있다.

## 발견사항

- **[INFO]** 목록 조회(`findByWorkflow`)의 헤더 주석이 이 PR 이 바꾼 반환 타입 정의를
  반영하지 못해 낡았다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:119`
    (`// 반환 타입을 WorkflowVersionListItem(Omit<WorkflowVersion,'snapshot'>) 로 좁혀`)
  - 상세: 이 PR 은 `WorkflowVersionListItem` 을
    `Omit<WorkflowVersion, 'snapshot' | 'creator' | UnloadedRelations> & { creator: ProjectedCreator }`
    로 재정의했다(파일 41~44행) — `creator`/`workflow` 도 이제 원본 엔티티 타입이 아니라
    투영된 형태로 좁혀진다. 그런데 119행의 주석은 이 PR 이전 형태(`Omit<WorkflowVersion,'snapshot'>`,
    `creator` 는 그대로 `User`)를 그대로 인용하고 있어, 타입 정의를 옆에 두고 읽지 않으면
    "snapshot 만 제외한다" 는 잘못된 인상을 준다. 기능에는 영향이 없다(실제 타입은 올바르게
    좁혀져 있음) — 순수하게 주석과 구현 간 괴리(체크리스트 4항)다. 이전 7라운드 리뷰
    산출물(`review/code/2026/09/06/*/{requirement,documentation,maintainability}.md`)을
    grep 했으나 이 줄에 대한 지적은 없어 신규 발견으로 판단한다.
  - 제안: 주석을 `WorkflowVersionListItem(Omit<WorkflowVersion, 'snapshot'|'creator'|'workflow'> & { creator: ProjectedCreator })`
    형태로 갱신하거나, 타입 정의 자체를 SoT 로 남기고 이 줄에서는 "위 `WorkflowVersionListItem`
    참조" 정도로만 축약해 이중 유지 지점을 없앤다.

- **[INFO]** (검증 완료, 조치 불요) `_parse_frontmatter_code` 블록 리스트 수정에 대한
  회귀 테스트가 "리스트 첫 줄이 바로 주석인 경우"(즉 `code:` 다음 줄이 항목이 아니라
  주석부터 시작)를 명시적으로 커버하지 않는다
  - 위치: `.claude/hooks/_lib/review_guard.py:637-658` (`_parse_frontmatter_code` 블록
    리스트 루프), `.claude/tests/test_review_guard.py:329-374` (신규 3개 테스트)
  - 상세: 세 신규 테스트 모두 리스트의 **중간**에 주석/빈 줄이 오는 형태만 검증한다.
    실제로 이번 PR 이 `review-citations.md` frontmatter 에 쓴 형태(`code:` 바로 다음
    줄이 주석)는 로직상 안전함을 직접 실행해 확인했으나(본문 참조), 그 케이스를 고정하는
    회귀 테스트는 없다 — 다음에 루프 시작 인덱스(`j = i + 1`)를 건드리는 리팩터가 오면
    이 형태만 조용히 재발할 수 있다. 기능 결함은 아니고 테스트 커버리지의 사소한 틈이다.
  - 제안: (선택) `code:\n  # 주석\n  - a.ts\n` 형태의 테스트 1건 추가.

## 요약

핵심 요구사항(`User` 엔티티 컬럼 노출 검출 3축 신설, `WorkflowVersionsService.findOne` 실유출
수정, harness `code:` 파서 유실 버그 수정)은 모두 의도한 대로 구현돼 있고, 엣지 케이스(null/
undefined/원시값/중첩·배열/snake_case/블록 리스트의 주석·빈 줄·다음 키 경계)를 직접
읽고 실행해 확인한 결과 반환값·검증 규칙·spec 정합성 모두 일치한다. spec 본문
(`spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`)의
정정은 CLAUDE.md 의 자기-반증형 소정정 5조건을 그대로 준수하며 취소선 보존·실측 병기가
정확하다. `2-api-convention.md` §5.4 가 여전히 "두 검증자" 로만 서술해 신규 3축이 등재되지
않은 것은 확인했지만, 이는 developer 권한 밖(spec 쓰기)이라 planner 후속 항목으로 올바르게
분리돼 있어 결함이 아니다. 새로 찾은 것은 `workflow-versions.service.ts:119` 의 stale 주석
(타입 정의는 옳으나 주석이 이전 형태를 인용) 하나뿐이며 기능적 영향은 없다.

## 위험도

LOW
