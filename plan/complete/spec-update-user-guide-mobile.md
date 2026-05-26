---
worktree: docs-mobile-sidebar
started: 2026-05-26
owner: project-planner
---

# Spec 정정 제안 — `/docs` 모바일 진입 + 검색 표기

> 본 plan 은 **spec 본문 수정** 을 동반하므로 `project-planner` 위임 대상. `developer` skill 안에서는 plan 노트만 작성하고 spec 수정은 하지 않는다. 본 plan 의 worktree 는 `docs-mobile-sidebar` 와 공유하며, 머지/분리 시점은 project-planner 가 판단.

## 배경

`docs-mobile-sidebar` 구현으로 다음 누적 drift 가 표면화됨 (consistency-check 2026-05-26 WARNING W-1/W-2):

1. **spec/2-navigation/13-user-guide.md §10** 의 "검색: 현재는 미포함" 표기 — 이미 `DocsSearch` 가 구현되어 있고 본 PR 로 모바일에서도 노출됨.
2. **§10 에 모바일 진입 정의 부재** — 신규 모바일 토글 + drawer 가 spec 어디에도 매핑돼 있지 않음.
3. **breakpoint 분리 근거** — docs 내부 사이드바(lg=1024px) 와 글로벌 사이드바(< 1280px, `_layout.md §2.4`) 가 다른 이유가 spec 에 기록돼 있지 않음.

## 정정 후보

### `spec/2-navigation/13-user-guide.md §10 접근·표시`

| 항목 | 현재 | 정정안 |
| --- | --- | --- |
| 사이드바 표시 | 모든 로그인 사용자 (권한 제한 없음) | (좌동) |
| 비로그인 표시 | 현재는 로그인 필수… | (좌동) |
| 검색 | 현재는 미포함. 콘텐츠 증가 시 별도 추가 | **DocsSearch 로 제공. 데스크탑 사이드바·모바일 drawer 양쪽에 동일 노출** |
| 모바일 진입 | (없음) | **< lg(1024px) 에서 article 상단의 토글 버튼 → 좌측 SlideDrawer 가 DocsSidebar + DocsSearch 동일 컴포넌트를 노출** |
| 인쇄용 CSS | 미포함 | (좌동) |

### `spec/2-navigation/13-user-guide.md` 신규 `## Rationale` 항목

> **R-x. /docs 내부 사이드바 breakpoint 가 글로벌(< 1280px) 과 다른 이유 (2026-05-26)**
>
> `_layout.md §2.4` 의 글로벌 사이드바는 1280px 미만에서 햄버거로 전환된다. `/docs` 내부 사이드바는 article 안의 보조 네비라 1024px(lg) 까지는 본문 옆에 자리가 충분히 남는다. 별 컨텍스트(전역 vs 페이지 내부) 이므로 breakpoint 도 별도. 두 사이드바가 동시에 햄버거로 전환되는 분기점을 일치시킬 필요가 없다.

### `spec/2-navigation/13-user-guide.md` frontmatter

`pending_plans: [spec-update-user-guide-mobile]` 등록 → 본 plan 이 머지될 때 제거 + `code:` 갱신 검토.

## 체크리스트

- [x] §10 표 갱신 (검색 행 + 모바일 진입 행)
- [x] Rationale R-1 추가 (R-x → R-1 로 확정)
- [x] frontmatter `pending_plans` 제거 + `status: spec-only → implemented` 승격 + `code:` 등록
- [x] `_layout.md §2.4` 에 `/docs` 별도 breakpoint 교차 참조 한 줄 추가 (cross-spec INFO)
- [x] `0-overview.md §3.5` 에 열람형 페이지 1024px 예외 단서 추가 (cross-spec INFO)
- [x] `/consistency-check --spec` 통과 — BLOCK: NO (`review/consistency/2026/05/26/11_57_24/`)

## 의존성

`docs-mobile-sidebar` 구현 PR 과 동일 PR 안에서 같이 머지. 구현·spec 정정이 한 PR 로 묶이므로 별도 drift 기간 없음.
