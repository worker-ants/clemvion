---
title: 사용자 가이드(/docs) 사이드바 진입 시 /w/<slug> 무한 중첩 라우팅 fix
worktree: manual-trigger-default-param-e0d395
started: 2026-07-17
owner: developer
status: in-progress
spec_area: spec/2-navigation/_layout.md
---

## 배경 / 증상

사용자 보고: 사이드바 "사용자 가이드" 메뉴 클릭 시 URL 이

```
workflow.getit.co.kr/w/lusiaz-8c7e/w/lusiaz-8c7e/w/lusiaz-8c7e/.../docs
```

처럼 `/w/<slug>` 세그먼트가 무한 중첩되며 가이드 페이지에 진입하지 못한다.

## 근본 원인 (2단 결함)

**① 진입점 — `components/layout/sidebar.tsx:441`**

`navItems.map` 이 **전 항목에 예외 없이** `buildWorkspaceHref(slug, item.href)` 를 적용한다.
`/docs` 는 `navItems` 중 유일하게 워크스페이스 밖 라우트라 존재하지 않는
`/w/<slug>/docs` 가 생성된다. 바로 아랫줄(442) 주석이 "slug 밖 라우트(docs 등)" 를
인지하고 있으나 **`isActive` 판정에만 반영**되고 href 생성에는 예외가 없다.

이는 spec 위반이다 — [`spec/2-navigation/_layout.md:85`](../../spec/2-navigation/_layout.md):

> **예외 — User Guide(`/docs`)는 워크스페이스 무관 콘텐츠라 slug 밖으로 유지**한다

`spec/2-navigation/9-user-profile.md:158` 도 동일("slug 밖 유지(워크스페이스 무관·별 그룹)").
따라서 spec 변경 불요 — 구현만 spec 에 맞춘다.

**② 증폭기 — `app/(main)/[...rest]/page.tsx:34-38`**

`/w/<slug>/docs` 는 `(main)/w/[slug]/` 밑에 `docs` 세그먼트가 없어 specific route 매칭에
실패하고 catch-all 로 흡수된다. catch-all 은 `rest` 가 **이미 `/w/<slug>` 로 시작하는지
가드가 없어** prefix 를 재부착한다:

```
rest=["w","lusiaz-8c7e","docs"] → replace("/w/lusiaz-8c7e" + "/w/lusiaz-8c7e/docs")
  → 또 미매칭 → catch-all 재진입 → 사이클마다 세그먼트 +1 → 무한 루프
```

`page.tsx:15` 주석의 전제 "specific route 가 우선하므로 `/w/[slug]/...` 는 여기 오지
않는다" 가 **틀렸다** — `w/[slug]` 하위에 없는 세그먼트면 catch-all 로 온다.

**부수 발견**: `(main)/w/[slug]/page.tsx` 가 없어 `/w/<slug>` **단독 경로도** 같은 루프에
빠진다 (rest=["w","<slug>"] → `/w/<slug>/w/<slug>` → …). 같은 결함 클래스라 함께 조치.

## 결정

- **①만 고치면 증상 클래스가 남는다** — 다른 소비처가 같은 실수를 하면 또 무한 루프.
  ②의 catch-all 을 **terminal** 로 만들어 "무한 중첩" 자체를 구조적으로 제거한다.
- **catch-all `rest[0]==="w"` 시 동작**:
  - `rest.length===2` (`/w/<slug>`) → `/w/<slug>/dashboard` 로 forward (워크스페이스 루트, 유용)
  - 그 외 (`/w`, `/w/<slug>/<미지의경로>`) → `notFound()`.
    근거: `/w/<slug>/x` 가 catch-all 에 왔다 = 그런 워크스페이스 라우트가 없다 = 정직한 404.
    **strip 후 재forward 는 채택 안 함** — `/w/<slug>/nonexistent` → strip → `/nonexistent`
    → catch-all → prefix → `/w/<slug>/nonexistent` → … **ping-pong 무한루프**가 생긴다.
    stale 북마크(`/w/<slug>/docs`)는 404 로 착지하지만, 무한 루프보다 정직하고 디버그 가능.
- **`buildWorkspaceHref` idempotent 화는 채택 안 함**. 이미 `/w/…` 인 path 를 조용히
  삼키면 호출자 버그를 **은폐**하고, `buildWorkspaceHref("team-a", "/w/team-b/x")` 의
  올바른 답이 정의되지 않는다(team-a? team-b?). ②의 terminal 가드가 실패를 무한루프에서
  **가시적 404** 로 바꾸므로 방어는 그쪽이 옳다. 이 결정을 헬퍼 주석에 남긴다.

### consistency-check WARNING 대응 (session 00_21_55)

- **W#2 (catch-all 이 redirect-only → redirect ∪ notFound 이원화)**: 재검토 결과 **spec 위반
  아님**. `11-error-empty-states.md §1.3` 이 이미 "404 감지 = 존재하지 않는 라우트 접근 시
  표시" + "사이드바 표시: 404 표시" 를 정책화했고 `(main)/not-found.tsx` 가 그 구현이다 —
  `notFound()` 종결은 **기존 정책 준수**이며, 현재의 무한 리다이렉트가 오히려 그 정책 위반이다.
  `10-auth-flow.md:443` 의 "redirect-only 중간 경로" 는 **로그인 후 `/dashboard` 흐름 한정**
  괄호 설명이고 그 경로는 본 수정 후에도 redirect-only 로 남아 반증되지 않는다.
  다만 catch-all 계약이 넓어지는 것은 사실 → **spec 보강 draft 를 정식 항목으로 포함**
  (`plan/in-progress/spec-update-catch-all-terminal-contract.md`, developer 는 spec 직접 수정
  불가 → project-planner 위임). 구현 차단 사유는 아니므로 본 PR 은 진행한다.
- **W#3 (idempotent 미채택 근거 미기록)**: `href.ts` 의 `buildWorkspaceHref` 문서 주석에 근거를
  명시한다. 저장소 관행(`buildExecutionHref`/`buildEditorHref` + `no-raw-*-href` guard)은
  **"호출부가 리터럴을 직접 조립"** 하는 것을 막는 가드지, 헬퍼를 idempotent 로 만드는 관행이
  아니다 — 본 건은 성격이 다르다(호출부가 헬퍼를 *쓰되* 대상이 slug 밖 라우트).
- **I#5 (docstring 반증)**: `(main)/[...rest]/page.tsx` 상단 docstring 의 "specific route 가
  우선하므로 `/w/[slug]/...` 는 여기 오지 않는다" 를 같은 PR 에서 정정한다.
- **I#6/I#7**: `workspaceScoped` 명명 충돌 없음, `(editor)` 그룹엔 catch-all 이 없어 동일 결함
  클래스 없음 — 수정 범위 충분함 확인.

## 작업 체크리스트

- [x] 0. worktree 확인
- [x] 1. spec 분석 (`_layout.md` §메뉴표, `9-user-profile.md` §3)
- [x] 2. 모호성 해소 — spec 이 `/docs` slug 밖 유지를 명시, 구현만 정렬
- [x] 3a. `/consistency-check --impl-prep` 1차 (session 00_21_55) → BLOCK: YES, 단 사유는
      **호출자 payload 조립 오류**(`--impl-prep SCOPE` 에 설명문 전체 전달). 실질 충돌 0건.
- [x] 3b. `--impl-prep spec/2-navigation/` 정정 재실행 (session 00_32_57) → **BLOCK: NO**.
      5/5 전수 확보(FS-flaky 2건 직접 재실행). Critical 0. WARNING 2건은 본 수정 무관
      기존 spec 이슈(`Workspace.settings.timezone` 표기·executions API 경로 규약)라 범위 밖.
- [x] 4. DOCUMENTATION — `PROJECT.md §변경 유형 → 갱신 위치 매핑` 전수 대조: 해당 행 **없음**.
      신규 UI 문자열·노드 schema·API·가이드 본문 변경이 없다(가이드에 *도달하는 링크* 만 수정).
- [x] 5. 테스트 선작성 (red 확인: 9 failed)
- [x] 6. 구현 (`workspaceScoped` 플래그 + catch-all terminal 가드 + docstring/주석 정정)
- [x] 7. 테스트 보강 (e2e 5건 — 사용자 보고 흐름·stale URL·워크스페이스 루트)
- [x] 8. TEST WORKFLOW — lint PASS / unit PASS(5502) / build PASS / e2e PASS.
      **e2e 는 `make e2e-test-full` 로 수행** — 표준 wrapper(`run-test.sh e2e` = `make e2e-test`)는
      backend e2e 만 돌리고 playwright 를 건너뛴다(§인프라 갭). 본 변경은 순수 frontend 라우팅이라
      playwright(51 passed, 신규 5건 포함)가 본질적 검증이다.
- [ ] 9. REVIEW WORKFLOW — `/ai-review` + Critical/Warning fix
- [ ] 10. spec 보강 draft (`spec-update-catch-all-terminal-contract.md`) → project-planner 위임

## 인프라 갭 (본 PR 발견, 범위 밖)

`.claude/test-stages.sh` 의 `cmd_e2e()` 가 `make e2e-test` 를 호출하는데, 이 타겟은
**backend e2e runner 만** 실행한다(`Makefile:58`). playwright 는 `e2e-test-full` 에만 있다
(`Makefile:73`). 따라서 **frontend 전용 변경은 TEST WORKFLOW 를 통과해도 playwright 가
한 번도 실행되지 않는다** — 본 라우팅 버그가 정확히 그 사각지대에서 나온 클래스다.
(본 PR 은 `e2e-test-full` 을 수동 실행해 회피했으나, wrapper 기본값 자체의 문제라
별도 판단이 필요 → 사용자 보고.)

## 검증 (실측)

playwright 51 passed — 유닛 테스트가 `useParams` mock 때문에 증명하지 못하는 계층을 커버:
- `clicking the sidebar user-guide menu lands on the guide, not a slug-nesting loop`
  — **사용자 보고 흐름 그대로** 재현·수정 확인.
- `stale /w/<slug>/docs URL terminates on 404 instead of nesting forever`
  — 실제 Next 라우트 매칭이 catch-all 로 떨어지는 것 + 클라이언트 `notFound()` 종결 동시 증명.
- `workspace root (/w/<slug>) forwards to that workspace dashboard` — 부수 발견 fix 확인.
