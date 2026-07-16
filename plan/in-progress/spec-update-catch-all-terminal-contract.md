---
title: spec 보강 제안 — (main)/[...rest] catch-all 의 terminal 계약 명문화
worktree: (unstarted)
started: 2026-07-17
owner: project-planner
status: in-progress
spec_area: spec/2-navigation/_layout.md
---

> **developer → project-planner 위임 draft.** developer 는 `spec/` 쓰기 권한이 없다
> (CLAUDE.md §Skill 체계). 본 문서는 **제안 텍스트**이며, project-planner 가
> `/consistency-check --spec` 통과 후 spec 본문에 반영한다.
>
> 선행 PR: `plan/in-progress/user-guide-routing-loop-fix.md` (구현 완료·머지 대기).
> 근거 검토: `review/consistency/2026/07/17/00_32_57/SUMMARY.md` INFO #4.

## 배경

사용자 가이드 라우팅 무한 중첩 버그([user-guide-routing-loop-fix](./user-guide-routing-loop-fix.md))
수정 과정에서 `(main)/[...rest]` catch-all 의 **실제 계약이 spec 문언보다 넓어졌다**.

기존 spec 은 catch-all 을 **"흡수(redirect)만 하는 중간 경로"** 로만 서술한다:

- `spec/2-navigation/_layout.md:85` — "구 무-slug 경로로 진입하면 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수한다"
- `spec/2-navigation/9-user-profile.md:155` — "구 무-slug 경로·알림 딥링크·`/`는 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수한다(query/hash 보존)"
- `spec/2-navigation/10-auth-flow.md` §7.2 — "(redirect-only 중간 경로라 flash 허용)"

구현 후 실제 계약은 **입력에 따라 이원화**된다:

| 입력 | 동작 |
| --- | --- |
| slug 없는 경로 (`/workflows`·`/dashboard`·`/integrations/<id>`·`/`) | 기존과 동일 — 활성 slug 로 forward (query/hash 보존) |
| `/w/<slug>` 단독 | 그 워크스페이스 dashboard 로 forward (query/hash 보존) |
| 그 외 `/w/…` (예: `/w/<slug>/docs`) | **`notFound()` 로 종결** — forward 하지 않음 |

## 왜 spec 변경이 아니라 "보강" 인가

**기존 spec 문언은 반증되지 않았다** — 따라서 이 항목은 차단 사유가 아니었다
(consistency-check 00_32_57 에서 WARNING → INFO 로 하향):

- `11-error-empty-states.md` §1.3 이 이미 "404 감지 = **존재하지 않는 라우트 접근** 시 표시"
  + "사이드바 표시: 404 표시" 를 정책화한다. `/w/<slug>/docs` 는 실제로 존재하지 않는
  라우트이므로 `notFound()` 는 **기존 정책의 준수**이지 신규 발명이 아니다.
  (오히려 수정 전의 무한 리다이렉트가 이 정책 위반이었다.)
- `10-auth-flow.md` §7.2 의 "redirect-only 중간 경로" 는 **로그인 후 `/dashboard` 흐름**에
  한정된 괄호 설명이고, 그 경로(`rest[0] !== "w"`)는 수정 후에도 redirect-only 로 남는다.

다만 "catch-all = 흡수만 한다" 는 인상이 세 문서에 걸쳐 반복돼, 향후 구현자가
**"/w/ 접두 경로도 흡수해야 하는 것 아닌가"** 로 오독하면 이번 버그가 재발한다.
terminal 계약을 명문화해 그 오독 경로를 닫는 것이 본 제안의 목적이다.

## 제안 1 — `_layout.md` §2.2 각주(85행)에 한 줄 추가

기존 각주 끝에 이어 붙인다:

```markdown
> **catch-all 은 `/w/` 접두 경로를 흡수하지 않는다(terminal)**: `/w/<slug>/…` 인데 specific
> route 에 매칭되지 않는 경로(예: `/w/<slug>/docs` — `/docs` 는 slug 밖 라우트)는 slug 를
> 재부착하지 않고 종결한다 — `/w/<slug>` 단독은 그 워크스페이스 dashboard 로 forward,
> 그 외는 `notFound()`([11-error-empty-states §1.3](./11-error-empty-states.md) "존재하지 않는
> 라우트 접근 → 404"). 재부착하면 매칭되지 않는 경로가 한 세그먼트씩 길어지는 무한
> 리다이렉트가 된다(실제 회귀: `/w/a/docs` → `/w/a/w/a/docs` → …).
```

## 제안 2 — `9-user-profile.md` §3 (155행) 문장 보정

현재: "구 무-slug 경로·알림 딥링크·`/`는 `(main)/[...rest]` catch-all 이 활성 slug 로 흡수한다(query/hash 보존)."

제안: 위 문장 끝에 다음을 덧붙인다.

```markdown
 단 **이미 `/w/` 로 시작하는 경로는 흡수 대상이 아니다** — 재부착 시 무한 중첩이 되므로
 catch-all 이 terminal 로 처리한다(`_layout.md` §2.2 각주).
```

## 제안 3 — `11-error-empty-states.md` §1.3 표에 행 추가 (선택)

"무효/비멤버 워크스페이스 slug" 행 **아래**에, 혼동되기 쉬운 인접 케이스로 나란히 둔다:

```markdown
| `/w/<slug>` 하위 미지의 경로 | **404** — `/w/<slug>/…` 가 어떤 specific route 에도 매칭되지 않으면 `(main)/[...rest]` catch-all 이 `notFound()` 로 종결한다(slug 재부착 시 무한 리다이렉트가 되므로). 위 행(무효 slug + **유효 라우트** → 편의 redirect)과 구분: 여기는 **라우트 자체가 없는** 경우다. |
```

> 이 행이 유용한 이유: 바로 위 "무효/비멤버 slug → 404 아님, default 로 redirect" 와
> 혼동되기 쉽다. 두 케이스의 구분선(**slug 해석 실패** vs **라우트 부재**)을 표에서
> 바로 읽히게 한다.

## 제안 4 — frontmatter `code:` 글로브 보강 (consistency `--impl-done` 01_25_26 WARNING)

`spec/conventions/spec-impl-evidence.md` §2.1 은 `code:` 를 "본 spec 이 약속한 surface 의 구현
경로" 로 정의한다. 아래 세 문서는 **본문에서 catch-all 동작을 명시적으로 약속**하면서도 그
구현 파일을 `code:` 로 가리키지 않는다 (build gate 는 green — 각 글로브가 다른 파일로 ≥1
매치하므로 `spec-code-paths.test.ts` 가 통과한다. 즉 **가드가 못 잡는 완결성 갭**이다).

| 문서 | 약속하는 본문 | 현재 `code:` 갭 | 추가 제안 |
| --- | --- | --- | --- |
| `_layout.md` | §2.2 line 85 (catch-all 흡수 + `/docs` slug 밖 예외), line 126 | `components/layout/**` 는 sidebar 를 덮지만 catch-all·href 헬퍼 미포함 | `codebase/frontend/src/app/(main)/[...rest]/page.tsx`<br>`codebase/frontend/src/lib/workspace/href.ts` |
| `9-user-profile.md` | §3 line 155 ("catch-all 이 활성 slug 로 흡수") | 동일 | 동일 2경로 |
| `10-auth-flow.md` | §7.2 ("`(main)/[...rest]` catch-all 이 … 해소한다") | 동일 | `codebase/frontend/src/app/(main)/[...rest]/page.tsx` |

> `href.ts` 는 `_layout.md`(사이드바 링크 생성)·`9-user-profile.md`(URL slug = FE 라우팅 SoT)가
> 함께 약속하는 surface 이므로 두 문서에 넣는 것이 맞다. `10-auth-flow.md` 는 §7.2 의 로그인 후
> `/dashboard` 흡수만 약속하므로 catch-all 만으로 충분하다.

## 반영 후 코드 측 후속

없음 — 구현은 선행 PR 에서 완료됐고 본 제안은 전부 문서 정합화다.

## 체크리스트

- [ ] project-planner 가 제안 1·2·4 검토 (제안 3 은 선택)
- [ ] `/consistency-check --spec plan/in-progress/spec-update-catch-all-terminal-contract.md` → BLOCK: NO
- [ ] spec 본문 반영 (제안 1·2, 선택적으로 3)
- [ ] 제안 4 — 세 문서 frontmatter `code:` 글로브 보강
- [ ] 본 plan `plan/complete/` 이동

## 출처

- `review/consistency/2026/07/17/00_32_57/SUMMARY.md` INFO #4 (terminal 계약 spec 미문서화)
- `review/code/2026/07/17/01_07_43/SUMMARY.md` W#1 (SPEC-DRIFT — "코드가 옳고 spec 이 못 따라간 케이스")
- `review/consistency/2026/07/17/01_25_26/convention_compliance.md` WARNING (제안 4 의 근거)
