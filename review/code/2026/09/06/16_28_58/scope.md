# 변경 범위(Scope) 리뷰

## 개요

`git diff --stat origin/main...HEAD`(`review/`, `plan/` 제외) 기준 26개 코드/spec 파일, 2,783줄
추가. 브랜치명(`user-entity-column-defense`)과 plan 항목("`User` 엔티티에 컬럼 수준 방어를
둘지 결정")이 가리키는 핵심 목표는 `user-entity-exposure-guard.ts`(구조 축)와
`user-secret-absence.ts`(이름 축) 신설 + e2e 배선(`audit-logs.e2e-spec.ts`,
`workspace-rbac.e2e-spec.ts` J 케이스, `workflow-crud.e2e-spec.ts` H 케이스) + 그 과정에서
찾은 실유출(`WorkflowVersionsService.findOne`) 수정이다. 이 핵심 부분은 CHANGELOG·plan 완료
노트에 실측(19곳/46곳/4곳 전수 열거, 뮤테이션 검증)과 근거가 촘촘히 남아 있고 범위가
명확하다.

다만 같은 브랜치의 12개 커밋 안에 이 핵심 목표와 **직접 관련 없는 세 갈래**가 함께
묶여 있다 — 각각 CHANGELOG/plan 에 원인이 투명하게 서술돼 있지만("이전 수정이 다음
문제를 드러냈다"는 연쇄), 스코프 리뷰 관점에서는 "하나의 이름 붙은 작업"이 다루기엔 넓다.

## 발견사항

- **[CRITICAL]** developer 가 쓰기 권한 밖(`.claude/**`)의 harness 코드를 수정하고, 그 사실을
  스스로 인지한 채 승인 없이 이미 커밋에 반영했다
  - 위치: `.claude/hooks/_lib/review_guard.py` (`_parse_frontmatter_code` 블록 리스트
    파서, `_strip_comment` 신설), `.claude/tests/test_review_guard.py` — 커밋
    `8b67300b5 fix(harness,spec): 게이트를 껐다가 그것이 이미 꺼져 있던 것을 발견했다`.
    자기 인지 기록: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    `- [ ] **`CLAUDE.md` 에 harness(`.claude/**`) 수정 권한 조항이 없다**` 항목(닫히지
    않은 체크박스).
  - 상세: `CLAUDE.md` Skill 체계 표는 `developer` 의 쓰기 권한을 `codebase/**`, `plan/**`,
    `review/**` (+ 좁은 spec 자기-반증 예외)로 명시한다. `.claude/**` 는 어느 역할의
    쓰기 범위에도 등재돼 있지 않다. 그런데 이 브랜치는 spec `code:` glob 등재 작업 중
    `review_guard._parse_frontmatter_code` 의 파싱 버그(주석/빈 줄에서 `break`)를 발견하고
    직접 harness 파일을 고쳐 커밋했다. plan 파일 자신이 "나는 스스로에게 권한을 부여할
    수 없으므로 판단 근거를 남긴다"고 적으며 **planner 의 명시적 결정을 기다리는 미결
    항목**으로 등재했지만, 코드 변경은 이미 `HEAD` 에 반영되어 이 리뷰 시점 기준으로
    실효 상태다. 즉 "권한이 있는지 모르겠다"는 자기 회의를 적어 두고도 결과물은 이미
    반영한 것 — 사후 승인을 기다리는 미완결 권한 문제가 diff 안에 그대로 살아 있다.
  - 제안: 이 리뷰의 fix 단계에서 되돌리지 말 것(plan 이 스스로 "되돌리려면 다른 처분이
    필요하다"고 적어 둠 — 임의로 revert 하면 41개 entry 유실이라는 이미 확인된 회귀가
    재발한다). 대신 이 발견을 그대로 승인 트랙(planner 턴)에 올려 `CLAUDE.md` Skill 표에
    harness 쓰기 권한 조항을 명시하는 결정을 이 PR 이 머지되기 전에 받도록 escalate.

- **[WARNING]** JSDoc 인용 유출 가드(`dto-jsdoc-citation-guard.ts`)는 "User 엔티티 컬럼
  방어"와 무관한 별개 관심사이며, CHANGELOG 는 이를 "검출 3축" 이라는 이름으로 같은
  절에 묶어 서술한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`,
    `dto-jsdoc-citation.spec.ts`, `fixtures/dto/responses/jsdoc-citation.fixture.ts`,
    `spec/conventions/review-citations.md`(§3 정정), `spec/conventions/spec-impl-evidence.md`
    (§2.1 선례 정정)
  - 상세: 이 가드가 잡는 것은 "응답 DTO 의 JSDoc 에 리뷰 산출물 인용문(`review/code/...`)이
    남아 공개 OpenAPI `description` 으로 새는가"이지, `User` 엔티티의 컬럼 노출과는
    무관하다. CHANGELOG 제목("검출 3축")과 plan 완료 노트가 이것을 User 컬럼 방어 작업의
    "3번째 축"으로 편입해 서술하지만, 실제로는 "이번 세션에서 반복적으로 같은 위반이
    나서 겸사겸사 가드를 만들었다"는 별개 계기(`review/code/2026/09/06/12_28_02` W2)다.
    spec 정정도 developer 권한 밖이라 planner 턴을 거친 것으로 절차는 올바르지만,
    "User 엔티티 컬럼 방어" 라는 이름의 작업 diff 안에 완전히 다른 방어 대상(주석 위생)이
    섞여 들어간 것은 리뷰어가 "이 PR 이 무엇을 바꾸는가"를 판단하기 어렵게 만든다.
  - 제안: 별도 plan 항목/커밋 계열로 분리해 리뷰 단위를 좁히거나, 최소한 CHANGELOG 절
    제목에서 "3축"으로 묶지 말고 두 개의 독립된 절(User 컬럼 검출 / DTO JSDoc 주석 위생
    검출)로 나눠 적는다.

- **[WARNING]** 트리거 `endpoint_path` UNIQUE 충돌 409 응답 상세화(`triggers.service.ts`,
  `pg-error.ts`)는 User 엔티티 방어와 무관한, 게이트 확장이 우연히 드러낸 별개 spec-impl
  갭 수정이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict` 신설 및
    `save()` 호출부 2곳에 `.catch()` 배선; `codebase/backend/src/common/db/pg-error.ts` —
    `pgErrorConstraint` 신설.
  - 상세: 이 수정의 계기는 CHANGELOG 서술대로 "harness 파서를 고치자
    `workspace-response.dto.ts` 가 처음으로 spec-linked 로 잡혀 `spec/2-navigation/` 가
    게이트 범위에 들어왔고, 그 영역 `--impl-done` 라운드가 `2-trigger-list.md §3` 의
    기존 미구현 계약(Critical)을 새로 냈다"는 것이다. 즉 User 컬럼 방어 작업이 harness
    를 고쳤고, harness 수정이 게이트 범위를 넓혔고, 넓어진 게이트가 트리거 계약 갭을
    찾아냈고, 그래서 트리거 서비스를 고쳤다 — 4단 연쇄로 원래 작업과 멀어진 변경이
    같은 브랜치/diff 에 실렸다. `pg-error.ts`/`pg-error-fixtures.ts`(두 wrap 표면 SoT)
    자체는 잘 만들어졌지만, 이 파일들이 존재하는 **이유**는 User 컬럼 방어가 아니라
    트리거 에러 계약 정합화다.
  - 제안: 이미 커밋된 것을 되돌릴 필요는 없으나(정당한 spec-impl 갭 수정이고 순수
    additive), 별도 plan 항목/커밋 계열로 분리했어야 할 성격임을 리뷰 기록에 남긴다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 핵심 작업의 부산물이지만 투명하게
  disclose 되어 있다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (신규 `joinedAt: string | null` 필드)
  - 상세: 신규 `workspace-rbac.e2e-spec.ts` J 케이스가 `assertMatchesContract` 를 처음
    배선하면서 실응답에는 있으나 DTO 에 미선언이던 `joinedAt` 이 드러나 함께 추가된
    것으로, CHANGELOG("곁가지")·DTO 인라인 주석·plan 완료 노트 세 곳 모두에서 명시
    disclose 됨. User 컬럼 방어 작업 범위 밖이지만 그 작업이 직접 유발한 파생 갭이고
    은폐되지 않았으므로 실질 리스크는 낮다.
  - 제안: 조치 불요.

## 요약

핵심 산출물(User 엔티티 컬럼 노출 검출 2축 + e2e 배선 + 발견된 실유출 수정)은 명확히
목적에 부합하고 실측 근거가 충실하다. 그러나 같은 브랜치/diff 안에 (1) developer 가
`CLAUDE.md` 상 쓰기 권한이 명시되지 않은 `.claude/**` harness 코드를 스스로 권한 불확실성을
인지한 채 이미 커밋해 반영했고 그 승인이 아직 미결이라는 점, (2) User 컬럼 방어와 무관한
DTO JSDoc 인용 가드 신설, (3) 마찬가지로 무관한 트리거 UNIQUE 충돌 409 상세화가 4단 연쇄
발견을 통해 섞여 들어왔다는 점에서, "하나의 이름 붙은 작업" 치고는 스코프가 상당히
넓어졌다. 각 갈래는 CHANGELOG/plan 에 인과관계가 투명하게 기록돼 있어 은폐성 스코프
크립은 아니지만, (1)번은 권한 경계 문제로 리뷰 승인 전에 반드시 짚어야 할 항목이다.

## 위험도

HIGH
