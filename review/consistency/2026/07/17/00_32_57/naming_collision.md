# 신규 식별자 충돌 검토 결과

## 검토 대상 안내

`prompt_file` 의 "Target 문서" 절은 `spec/2-navigation/` 전체 파일 덤프이며, 뒤이은 "검색 대상
코퍼스" 절은 `spec/` 전체 + `plan/in-progress/*.md` + `spec/conventions/**` 를 포괄하는 광범위
corpus 다(예: 무관한 `cafe24-backlog-residual-batch.md` 까지 포함 — 이번 세션은 지난 세션
(`00_21_55`)과 달리 payload 자체는 정상적으로 로드됐고, 다만 범위가 매우 넓다).

호출자(orchestrator)가 추가로 명시한 실질 target 은 다음이다:
- 대상 작업: `plan/in-progress/user-guide-routing-loop-fix.md` (사용자 가이드 `/docs` 사이드바 진입 시
  `/w/<slug>` 무한 중첩 라우팅 버그 fix)
- **이번 구현이 도입하는 유일한 신규 식별자**: `codebase/frontend/src/components/layout/sidebar.tsx`
  의 `navItems` 배열 각 항목에 추가될 boolean 필드 `workspaceScoped`

plan 문서 자체가 명시하듯("따라서 spec 변경 불요 — 구현만 spec 에 맞춘다", `user-guide-routing-loop-fix.md:34`)
이 target 은 **순수 버그 수정**이며, 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트/메시지명·ENV/config
key·신규 spec/코드 파일 경로를 전혀 도입하지 않는다. 이 전제를 아래 6개 관점 각각에서 저장소를 직접
검색해 재확인했다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌 — 해당 없음

target 은 신규 요구사항 ID(`NAV-*` 등)를 부여하지 않는다. `spec/2-navigation/_layout.md:85`
("**예외 — User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지**한다")와
`spec/2-navigation/9-user-profile.md:158`("slug 밖 유지(워크스페이스 무관·별 그룹): 유저 가이드(`/docs`)…")
에 이미 명시된 규정을 코드가 준수하도록 정렬할 뿐이다. spec 문서 어디에도 새 ID 가 신설되지 않는다.

### 2. 엔티티/타입명 충돌 — 없음 (신규 식별자 `workspaceScoped` 검증)

- target 신규 식별자: `workspaceScoped` (boolean 플래그, `sidebar.tsx:115` 부근 `navItems` 배열
  각 항목 리터럴에 추가 예정. 현재 항목은 `{ labelKey, href, icon }` 3필드뿐 — `codebase/frontend/src/components/layout/sidebar.tsx:116-128` 실측).
- 검증 1: `grep -rn "workspaceScoped|workspace_scoped|WorkspaceScoped" codebase spec plan review .claude` 결과
  본 plan 문서(`plan/in-progress/user-guide-routing-loop-fix.md`)와 이번/이전 review 산출물
  (`review/consistency/2026/07/17/00_21_55/*`, `review/consistency/2026/07/17/00_32_57/rationale_continuity.md`)
  외 매치 없음 — `codebase/`·`spec/` 어디에도 아직 실제 코드/문서로 존재하지 않는 순수 신규 이름이다.
- 검증 2: `sidebar.tsx` 및 `@/lib/workspace/href.ts` 전체에서 유사 개념(scope 판정용 boolean/enum)으로
  이미 쓰이는 이름이 있는지 확인 — `bare`, `unscoped`, `exempt`, `global` 계열을 검색했으나 매치는
  `ExpressionInput` 컴포넌트의 `bare` prop(UI 테두리 유무 지정, 워크스페이스 스코프와 무관한 다른 도메인)
  뿐이다. 문자열 자체의 재사용/의미 충돌 없음.
- 결론: `workspaceScoped` 는 신규 도입 이름이며 기존 사용처와 이름·의미 모두 겹치지 않는다. 충돌 없음.

### 3. API endpoint 충돌 — 해당 없음

target 은 프론트엔드 라우팅(사이드바 href 생성 로직, Next.js `(main)/[...rest]/page.tsx` catch-all)만
변경한다. `spec/2-navigation/*.md` 에 나열된 기존 endpoint(`GET /api/dashboard/summary` 등, 검색
코퍼스에 다수 포함)와 겹치는 신규 REST endpoint 를 추가/재정의하지 않는다.

### 4. 이벤트/메시지명 충돌 — 해당 없음

webhook·queue·SSE 이벤트를 다루지 않는 순수 라우팅 변경이다.

### 5. 환경변수·설정키 충돌 — 해당 없음

신규 ENV var / config key 없음.

### 6. 파일 경로 충돌 — 해당 없음

- 신규 spec 파일 없음 — plan 이 "spec 변경 불요"를 명시. (plan checklist #10 의 spec 보강 draft
  `plan/in-progress/spec-update-catch-all-terminal-contract.md` 는 `plan/` 영역 파일이지 `spec/` 파일이
  아니며, 이번 impl-prep target 인 `spec/2-navigation/` 명명 컨벤션과 무관하다.)
- 신규 코드 파일도 없음 — 기존 `codebase/frontend/src/components/layout/sidebar.tsx` 와
  `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 두 파일만 수정 대상이다(`git status`로
  이번 worktree 에 아직 코드 변경이 없음도 확인 — 구현 착수 전 단계).
- `(main)/w/[slug]/page.tsx` 부재로 인한 `/w/<slug>` 단독 접근 루프는 plan 이 신규 파일 추가가 아니라
  기존 catch-all 내부 분기(`rest.length===2` → `/w/<slug>/dashboard` forward)로 처리하는 설계라 파일
  경로 신규 도입이 없다. 이는 identifier 충돌이 아닌 별도 완결성 이슈이므로 본 리뷰 범위 밖으로 언급만 한다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급에 해당하는 신규 식별자 충돌을 발견하지 못했다.

## 요약

target 은 사용자 가이드(`/docs`) 진입 시 발생하는 `/w/<slug>` 무한 중첩 라우팅 버그를 기존 spec 규정
(`_layout.md §2.2`, `9-user-profile.md §3`)에 맞춰 구현만 정렬하는 순수 버그 픽스다. 신규 요구사항
ID·엔티티/DTO·API endpoint·이벤트명·ENV/config key·spec 파일 경로가 전혀 도입되지 않으며, 유일한
신규 식별자인 코드 레벨 플래그 `workspaceScoped` 는 저장소 전체(`codebase/`, `spec/`, `plan/`,
`review/`) 검색 결과 기존 사용처와 이름·의미 모두 겹치지 않는 고유한 이름임을 재확인했다. 이는
이전 세션(`00_21_55`)의 동일 결론과 일치하며, 이번 세션은 광범위한 corpus(`spec/` 전체 + 무관한
`plan/in-progress` 항목 포함)를 대상으로 재검증해도 결론이 바뀌지 않음을 확인한 것이다.

## 위험도

NONE
