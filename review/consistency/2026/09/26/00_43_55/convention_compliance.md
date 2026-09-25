# 정식 규약 준수 검토 — convention_compliance

대상: `integration-personal-owner` 브랜치 (--impl-done, diff-base `origin/main`) — 코드 diff 27개 파일/4408줄
(핵심: `codebase/backend/src/modules/integrations/**`) + spec diff 4개 파일
(`spec/2-navigation/4-integration.md` · `spec/3-workflow-editor/4-ai-assistant.md` ·
`spec/4-nodes/4-integration/_product-overview.md` · `spec/5-system/3-error-handling.md`) + 신규 plan 2건.

## 발견사항

- **[WARNING] plan frontmatter `worktree` sentinel 을 번역해서 씀 — 다른 도구의 exact-match 를 깨뜨림**
  - target 위치: `plan/in-progress/integration-personal-owner-followup.md` frontmatter 5행 `worktree: (미착수)`
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4`("미착수 plan 은 명시 sentinel **`(unstarted)`** 를 쓴다")
    + 구현 SoT `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의
    `export const WORKTREE_SENTINEL = "(unstarted)";`(리터럴 영문 고정)
  - 상세: 이 저장소의 `plan/in-progress/*.md` 15개가 전부 `worktree: (unstarted)` 를 쓰는데, 이 파일만
    한국어 번역 `(미착수)` 를 썼다(저장소 전수 grep 1건 — 유일한 예외). `WORKTREE_PLACEHOLDER` 정규식
    (`/\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i`)이 "미착수" 를 잡지 못해 build 가드
    (`plan-frontmatter.test.ts`)는 통과하지만, 이 값을 **문자열로 그대로** 소비하는 두 다운스트림이
    깨진다 — ① `.claude/tools/plan-stale-audit.sh:134` 는
    `[[ "$wt_value" == "(unstarted)" ]]` 정확 일치로 "아직 미착수라 정상" 을 판정하는데 `(미착수)` 는
    이 비교에 실패해 다음 분기(`.claude/worktrees/(미착수)` 디렉토리 존재 확인)로 떨어져 **존재하지 않는
    worktree** 로 보여 stale/orphan 으로 오분류된다. ② §3 "연결 판정"(`.claude/docs/plan-lifecycle.md`)이
    현재 worktree 이름과 `worktree:` 값을 매칭하는 게이트도 이 값으로는 절대 매칭되지 않는다 — 이는
    바로 그 SoT 문서가 "placeholder 는 게이트에서 plan 이 사라지게 만든다" 고 명시적으로 경고하는
    실패 모드다. 즉 **의도는 정확히 sentinel 이지만 리터럴이 달라 그 sentinel 의 기능을 못 한다.**
  - 제안: `worktree: (unstarted)` (영문 리터럴 그대로)로 정정. 문서 톤이 한국어라는 점과 무관하게
    이 필드는 도구가 문자열 비교하는 **식별자 값**이라 번역 대상이 아니다(`plan-lifecycle.md §4` 예시도
    한국어 문서 안에서 영문 리터럴을 그대로 쓴다: "미착수 리서치는 `worktree: (unstarted)`").

## 준수 확인 (위반 아님 — 근거를 명시적으로 확인함)

- **spec frontmatter lifecycle** — `spec/2-navigation/4-integration.md` 가 `status: implemented` →
  `status: partial` + `pending_plans: [plan/in-progress/integration-personal-owner-followup.md]` 로
  전이한 것은 `spec-impl-evidence.md §3` 의 `partial` 정의(일부 구현·`pending_plans` 의무)를 만족한다.
  가리키는 plan 파일이 실존하고 `plan/in-progress/` 에 있다(§4 `spec-pending-plan-existence.test.ts`
  대상 통과). 단, §3.1 "전이 규칙" 목록은 `backlog→spec-only→partial→implemented→archived` 순방향만
  명시하고 "**이미 `implemented` 인 spec 이 새 미구현 약속을 얻어 `partial` 로 역행**" 하는 경우를
  별도로 적지 않는다 — 이번 사용은 §3 상태표의 정의에는 부합하지만, 규약 §3.1 이 이 역행 케이스를
  침묵하고 있다는 점은 INFO 로 남긴다(규약 갱신 후보 — target 위반은 아님).
- **에러 코드 명명** — 신규 `INTEGRATION_NAME_TAKEN`(기존 코드 소급 문서화) · 재사용 `ADMIN_REQUIRED`
  모두 `error-codes.md §1` 의 `<DOMAIN>_<CONDITION>` UPPER_SNAKE_CASE 원칙을 따른다. `ADMIN_REQUIRED`
  확장 시 새 코드를 신설하지 않고 기존 컨텍스트 특화 코드에 새 발행처(Organization 통합 판정)를
  추가한 것은 §2 "이름 정확성 향상만을 위한 rename 금지, 의미가 겹치면 기존 코드 재사용" 원칙에 부합.
- **audit 액션 명명** — 이 PR 은 새 `AuditLog.action` 값을 추가하지 않고 기존
  `AUDIT_ACTIONS.INTEGRATION_UPDATED` / `INTEGRATION_SCOPE_CHANGED` 를 재사용한다
  (`audit-actions.md` 위반 없음 — 인라인 문자열 신설 0건, `git diff` 확인).
- **Swagger/DTO 패턴** — `Cafe24PrecheckResultDto` 의 두 optional 필드는 `@ApiPropertyOptional` 유지,
  설명만 갱신(`swagger.md §1-3` 부합). 컨트롤러의 `@ApiForbiddenResponse`/`@ApiNotFoundResponse` 설명이
  공유 상수(`ROLE_REQUIRED.admin.code` 등)를 보간해 "코드명이 바뀌면 설명이 따라온다" 구조 — 설명 텍스트가
  실제 코드와 갈릴 위험을 구조적으로 차단한 점은 규약 취지에 부합하는 우수 사례.
- **review-citations.md** — 신규 Rationale 이 인용한 리뷰 산출물 경로는 모두 전체 경로 형식
  (`review/code/2026/09/20/18_09_24 requirement INFO 6`, `review/consistency/2026/09/25/21_33_10
  WARNING 1`)이라 §2 "bare `hh_mm_ss` 금지" 를 준수. 신규 DTO JSDoc 에는 review 세션 인용이 섞이지
  않아 §3 DTO 예외 규칙과도 충돌 없음.
- **i18n 사용자 가이드** — `integration-management.mdx`/`.en.mdx`, `workspaces-and-members.mdx`/`.en.mdx`
  KO/EN 쌍이 같은 커밋에서 함께 갱신됐고 기존 해요체 톤과 일관됨.
- **문서 구조** — `spec/2-navigation/4-integration.md` 의 변경은 기존 Overview/본문/API/Rationale
  구조를 유지한 채 본문·API 표·Rationale 에 새 절만 추가한 형태로, 3섹션 컨벤션을 깨지 않는다.

## 요약

이 PR 은 이미 4라운드의 `/ai-review` 를 거친 상태로, 에러 코드 명명·감사 액션 재사용·Swagger DTO
패턴·spec frontmatter lifecycle·리뷰 인용 형식 등 핵심 정식 규약을 전반적으로 잘 지키고 있다.
유일한 실제 위반은 신규 plan 파일 `integration-personal-owner-followup.md` 의 `worktree:` 필드가
정식 sentinel `(unstarted)` 대신 한국어 번역 `(미착수)` 를 써서, build 가드는 통과하지만
`plan-stale-audit.sh` 와 plan↔worktree 연결 판정이라는 두 다운스트림에서 "미착수" 라는 원래 의도와
반대로 "죽은/유령 worktree" 로 오분류될 수 있는 문제다. 이 외에는 spec `partial` 역행 전이가 §3.1
전이 규칙 목록에 명시되지 않은 점을 INFO 로 남기며, 이는 target 의 결함이라기보다 규약 문서의
사각지대에 가깝다.

## 위험도

LOW
