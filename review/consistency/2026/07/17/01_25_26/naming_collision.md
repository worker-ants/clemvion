# 신규 식별자 충돌 검토 결과

## 검토 대상 정리

`prompt_file` 의 "Target 문서" 절은 `spec/2-navigation/` 전체 파일 덤프이나, 실제로 이번 세션(impl-done,
diff-base=`origin/main`)에서 `spec/2-navigation/**` 자체의 텍스트 변경은 **없다**
(`git diff origin/main --stat` 확인 — 변경 파일은 코드·plan·review 산출물뿐, `spec/2-navigation/*.md`
는 포함되지 않음). 실질 target 은 다음 세 문서로 재구성했다:

- `plan/in-progress/user-guide-routing-loop-fix.md` (developer, 구현 완료·`status: in-progress`,
  worktree = 본 세션 worktree 일치)
- `plan/in-progress/spec-update-catch-all-terminal-contract.md` (project-planner 위임용 spec 보강
  draft — 아직 `spec/` 본문 미반영)
- 실제 diff: `codebase/frontend/src/lib/workspace/href.ts` · `.../components/layout/sidebar.tsx` ·
  `.../app/(main)/[...rest]/page.tsx`

동일 target 에 대한 이전 두 세션(`review/consistency/2026/07/17/00_21_55`, `00_32_57`, 둘 다
`--impl-prep`)이 이미 `workspaceScoped` 단독을 검증해 충돌 없음(NONE)으로 결론지었다. 본 세션은
`--impl-done` 이므로 **구현 완료 후 실제 코드에 추가된 식별자**(`00_21_55`/`00_32_57` 시점엔 아직
코드에 없던 `WORKSPACE_ROUTE_SEGMENT` 상수 포함)를 실측 재검증했다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌 — 해당 없음
신규 요구사항 ID(`NAV-*` 등) 부여 없음. `_layout.md:85` / `9-user-profile.md:158` 의 기존 규정을
구현이 준수하도록 정렬할 뿐이다.

### 2. 엔티티/타입명 충돌 — 없음 (신규 식별자 2건 실측 검증)

- **`workspaceScoped`** (`sidebar.tsx` `navItems` 각 항목의 boolean 필드, 구현됨: L132 등):
  `git -C <worktree> grep -n "workspaceScoped"` → `sidebar.tsx`(정의+13회 사용) 와 본 plan 문서만
  매치. 기존 코드에 동명 필드 없음. 충돌 없음(이전 두 세션과 결론 동일).
- **`WORKSPACE_ROUTE_SEGMENT`** (`href.ts:10` 신규 export, 값 `"w"`) — impl-done 시점에 처음 등장한
  식별자이므로 신규 검증:
  - `grep -rn "_SEGMENT\b" codebase/frontend/src codebase/backend/src` → `href.ts`(정의) ·
    `(main)/[...rest]/page.tsx`(사용) 2곳만 매치. 동명 상수·타입 없음.
  - 값 `"w"` 자체는 이미 존재하는 라우트 디렉토리 `(main)/w/[slug]`·`(editor)/w/[slug]` 와 정확히
    일치 — 상수가 기존 관례를 사후 명문화한 것이라 오히려 충돌 방지 방향. `(editor)` 그룹엔 대응
    catch-all 이 없어(디렉토리 실측: `[...rest]` 없음) 동일 결함 클래스도 없음(plan I#7 과 일치).
  - `docs/[...slug]` catch-all 은 별도 세그먼트 스킴(locale 접두)이라 이름·값 모두 무관, 충돌 없음.

### 3. API endpoint 충돌 — 해당 없음
프론트엔드 라우팅(사이드바 href 생성, `(main)/[...rest]` catch-all)만 변경. 신규 REST endpoint
없음.

### 4. 이벤트/메시지명 충돌 — 해당 없음
webhook·queue·SSE 이벤트 무관.

### 5. 환경변수·설정키 충돌 — 해당 없음
신규 ENV var/config key 없음.

### 6. 파일 경로 충돌 — 해당 없음
신규 spec 파일도(§본 세션 diff 무포함), 신규 코드 파일도 없음 — 기존 3개 파일(`href.ts`·
`sidebar.tsx`·`[...rest]/page.tsx`) 수정만. `spec-update-catch-all-terminal-contract.md` 는
`plan/` 영역이지 `spec/` 파일 신설이 아니다.

### INFO — "terminal" 용어의 도메인 교차 재사용 (신규 충돌 아님, 참고용)

- **target 신규 용법**: `plan/in-progress/spec-update-catch-all-terminal-contract.md` 제안 1이
  `_layout.md` 에 추가할 문구 — "catch-all 은 `/w/` 접두 경로를 흡수하지 않는다(**terminal**)"
  (라우팅 도메인: "더 이상 forward 하지 않고 종결한다"는 뜻).
- **기존 사용처**: `spec/5-system/4-execution-engine.md`·`14-external-interaction-api.md`·
  `3-error-handling.md` 전역에 걸쳐 **"terminal"이 실행(Execution) 상태 라이프사이클의 formal
  용어**로 100회 이상 쓰인다 (`completed`/`failed`/`cancelled` = terminal status, `RESUME_*
  terminal`, `terminal-revoke-reconciler` 등).
- **상세**: 동일 단어가 완전히 다른 두 도메인(라우팅 종결 vs. 실행 상태 종료)에서 formal 어휘로
  쓰인다. 다만 (a) 파일·섹션이 분리돼 있고 (b) 두 용법 모두 영어 원의미("더 이상 전이하지 않음")를
  그대로 따르는 자연스러운 사용이라 실질적 혼동 가능성은 낮다. 오히려 draft 의 "종결(terminal)"
  표기 스타일은 execution-engine 쪽 "종료(terminal)"(`_product-overview.md:83`) 관례와 형식이
  일치해 저장소 전반의 서술 관례를 따른 것으로 보인다.
- **제안**: 등급 상향 불요. project-planner 가 draft 를 `_layout.md` 에 반영할 때, 원한다면
  괄호에 "(catch-all 종결, 실행 상태의 terminal 과 무관)" 정도의 1회성 disambiguation 각주를
  덧붙이는 것도 고려 가능하나 필수는 아니다.

## 발견사항

CRITICAL/WARNING 없음. 위 INFO 1건(용어 교차 재사용, 실질 충돌 아님)만 참고용으로 기록.

## 요약

이번 impl-done 세션은 `spec/2-navigation/**` 자체엔 아직 diff 가 없음을 실측(`git diff
origin/main --stat`)으로 먼저 확인한 뒤, 실질 target(사용자 가이드 라우팅 무한 중첩 fix + 그 spec
보강 draft)의 신규 식별자를 재검증했다. `workspaceScoped` 는 이전 두 impl-prep 세션과 동일하게
충돌 없음을 재확인했고, impl-done 시점에 새로 등장한 `WORKSPACE_ROUTE_SEGMENT`(값 `"w"`) 상수도
저장소 전수 검색 결과 동명 식별자가 없으며 값 자체는 기존 라우트 디렉토리 명명과 일치해 오히려
기존 관례를 사후 명문화한 것으로 확인했다. 신규 요구사항 ID·API endpoint·이벤트명·ENV/config
key·spec/코드 파일 경로는 전혀 도입되지 않았다. 유일한 참고 사항은 spec 보강 draft 가 쓰는
"terminal" 이라는 단어가 execution-engine 도메인의 formal 용어와 표면상 겹친다는 점이나, 파일·
문맥이 분리돼 있고 자연어 의미가 일치해 실질 충돌로 보지 않는다.

## 위험도

NONE
