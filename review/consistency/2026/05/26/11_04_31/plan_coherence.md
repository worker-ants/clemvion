# Plan 정합성 검토 결과

검토 모드: `--impl-prep`  
Target 범위: `codebase/frontend` — docs/layout.tsx, docs-mobile-sidebar.tsx (신규), slide-drawer.tsx (side prop 추가), i18n/dict/{ko,en}/docs.ts  
Spec 참조: `spec/2-navigation/13-user-guide.md`, `spec/2-navigation/_layout.md`  
검토일: 2026-05-26

---

## 발견사항

- **[WARNING]** spec/2-navigation/13-user-guide.md §10 "검색 미포함" 표기가 실제 구현과 이미 drift 상태 — target 이 이를 악화시키지는 않으나, 후속 plan 등록이 필요
  - target 위치: 변경 의도 §"spec 본문은 손대지 않음" 설명 / spec §10 "검색" 행
  - 관련 plan: 어느 in-progress plan 에도 이 drift 추적 없음 (prompt 에서 `plan/in-progress/spec-update-user-guide-mobile.md` 로 후속 제안하겠다고 명시함)
  - 상세: 현재 `spec/2-navigation/13-user-guide.md §10` 의 "검색 | 현재는 미포함. 콘텐츠 증가 시 별도 추가" 표기는 이미 사실이 아님 — `codebase/frontend/src/components/docs/docs-search.tsx` 와 `docs/layout.tsx` 의 `DocsSearch` 가 이미 존재한다. 본 task 의 `DocsMobileSidebar` 가 `DocsSearch` 를 재사용하면, spec §10 의 "검색 미포함" 행은 더욱 명확하게 잘못된 진술이 된다. 또한 §10 에는 모바일 진입 방법에 대한 정의 자체가 없어 "사이드바 표시" 행이 모바일 < lg 에서는 사실과 다른 상태다.
  - 제안: 본 task 착수 시 또는 착수 직후 `plan/in-progress/spec-update-user-guide-mobile.md` 를 실제로 생성해 in-progress 목록에 등록. 해당 plan 이 §10 갱신 (검색 포함 표기 + 모바일 토글 진입 표기) 을 scope 로 가져야 한다. spec 변경은 project-planner 스킬 위임 필요.

- **[INFO]** spec/2-navigation/_layout.md §2.4 의 글로벌 사이드바 breakpoint (< 1280px) 와 /docs 내부 사이드바 breakpoint (lg = 1024px) 불일치 — 차단 사항이 아님
  - target 위치: 변경 의도 "확인 요청" 첫 번째 항목
  - 관련 plan: `spec/2-navigation/_layout.md §2.4` 에는 이 불일치에 대한 어떤 미해결 결정도 없음
  - 상세: `_layout.md §2.4` 는 앱 글로벌 사이드바에 대해 "< 1280px 숨김, 햄버거 메뉴로 토글"을 명시한다. `/docs` 내부 사이드바는 `layout.tsx` 에서 `lg:block` (= 1024px) 기준으로 숨긴다. 두 breakpoint 는 서로 다른 UI 컨텍스트(앱 메인 내비게이션 vs 문서 내부 내비게이션)에 적용되며, `_layout.md` 가 docs-specific 사이드바 breakpoint 를 별도 지정하고 있지 않다. 따라서 이 불일치는 현재 "미결 결정"이 아니라 spec 미커버 영역이다. 본 task 범위(모바일 진입 토글 추가) 의 차단 조건이 되지 않는다.
  - 제안: 본 task 이후 `spec-update-user-guide-mobile.md` plan 에 "§10 모바일 breakpoint 결정 (1024px 현상 유지 또는 1280px 통일)" 을 항목으로 추가 권장.

- **[INFO]** `plan/in-progress/spec-update-user-guide-mobile.md` 파일이 아직 생성되지 않음
  - target 위치: 변경 의도 "spec 본문은 손대지 않음" 단락
  - 관련 plan: 존재하지 않음 (본 task 후 생성 예정)
  - 상세: 변경 의도에서 해당 plan 생성을 "후속 제안"으로 명시했으나 실제 파일이 없다. 이 plan 없이 구현이 완료될 경우 spec drift 추적이 in-progress 목록에서 누락된다. 구현 PR 머지 전까지 해당 plan 을 생성해야 한다.
  - 제안: 구현 PR 제출 전에 `plan/in-progress/spec-update-user-guide-mobile.md` 를 실제로 생성하고 `0-unimplemented-overview.md` 목록에도 추가.

- **[INFO]** `SlideDrawer` 의 `side` prop 추가 — 기존 사용처 3곳 동작 무영향 확인됨
  - target 위치: 변경 의도 "SlideDrawer 에 side prop 추가" 항목
  - 관련 plan: 없음 (기존 SlideDrawer 사용처 plan 없음)
  - 상세: 현재 SlideDrawer 사용처는 `authentication/page.tsx`, `trigger-detail-drawer.tsx` 2곳이다. 글로벌 `sidebar.tsx` 는 SlideDrawer 를 사용하지 않으며 자체 `mobileOpen` state 로 동작한다. `side` prop 을 optional + default "right" 로 추가하면 기존 사용처는 변경 없이 동일하게 동작한다. 차단 없음.

- **[INFO]** `logo-refresh-2026-05-25.md` plan 이 `codebase/frontend/src/components/layout/sidebar.tsx` 를 code_touched 목록에 포함하나, target task 는 해당 파일을 건드리지 않음 — 충돌 없음
  - target 위치: 해당 없음
  - 관련 plan: `plan/in-progress/logo-refresh-2026-05-25.md` (worktree `update-logo-and-favicon-cb7b91` 은 PR #327 MERGED, stale)
  - 상세: logo-refresh plan 의 worktree 는 이미 머지되어 stale (아래 §stale 목록 참조). 또한 logo-refresh 의 sidebar.tsx 변경은 코드 동작·hex 값 변경 없는 코멘트 수정 범위이며, target task 는 `sidebar.tsx` 를 전혀 건드리지 않는다. 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과 다음 2건이 stale 판정되어 §5번 검토 대상에서 제외됨:

- `update-logo-and-favicon-cb7b91` (branch `claude/update-logo-and-favicon-cb7b91`) — Step 1 ancestor 검사 ACTIVE (squash merge로 hash 변경), Step 2 PR #327 MERGED → **stale**. `logo-refresh-2026-05-25.md` plan 도 완료 처리 후 `plan/complete/` 이동 권장.
- `user-guide-internal-refs-cleanup` (branch `worktree-user-guide-internal-refs-cleanup`) — Step 1 ancestor 검사 ACTIVE, Step 2 PR #332 MERGED → **stale**. 해당 worktree 및 plan 정리 권장.

두 worktree 모두 활성으로 남아있을 이유가 없음. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

Plan 정합성 관점에서 본 task 의 구현 착수를 차단하는 CRITICAL 항목은 없다. active worktree 중 target 파일(`docs/layout.tsx`, `docs-mobile-sidebar.tsx`, `slide-drawer.tsx`, `i18n/dict/.../docs.ts`)과 동일 영역을 수정하는 것은 없다. 주요 경고는 구현 완료 시 `spec/2-navigation/13-user-guide.md §10` drift(검색 미포함 표기 오류 + 모바일 진입 미정의)가 심화되므로, 구현 PR 머지 전 `plan/in-progress/spec-update-user-guide-mobile.md` 를 실제로 생성해 drift 추적을 in-progress 목록에 등록해야 한다는 것이다. worktree 충돌 후보 2건 중 stale 2건 skip, active 0건 분석.

---

## 위험도

LOW
