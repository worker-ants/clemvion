---
title: spec 정정 — secret-store §2.1 각주의 "알려진 검증 공백" 철회 (#1113 이 해소함)
worktree: spec-secret-store-footnote-retract-f91d93
started: 2026-08-09
owner: planner
status: complete
priority: P3
spec_impact:
  - spec/conventions/secret-store.md
---

## Overview

[`spec/conventions/secret-store.md`](../../spec/conventions/secret-store.md) §2.1 의 `†` 각주
마지막 문단이 **거짓**이다. 그 문단은 `deleteByPrefix` LIKE 메타문자 가드의 근거가 아직
실행 가능한 테스트로 고정돼 있지 않다고 선언하는데, `#1113` 이 정확히 그것을 고정했다.

새 결정은 없다. **이미 내려지고 구현된 결정을 spec 이 아직 반대로 적고 있는 것**을 바로잡는
순수 정정 턴이다.

## 왜 이 상태가 됐나 — 두 세션이 같은 항목의 양쪽 끝을 잡았다

- `#1112`(2026-08-09 20:30 머지, planner 턴)가 각주를 신설하며 "알려진 검증 공백" 을 적었다.
  그 시점 기준으로는 **참이었다.**
- `#1113`(같은 날 저녁, developer 턴)이 그 공백을 닫았다. 두 작업이 **병렬로 진행돼**
  머지 순서상 각주가 먼저 들어갔다.

각주가 스스로 "본 각주가 유일한 기록이다" 라고 선언한 만큼 방치하면 다음 사람이 **없는 공백을
다시 메우려 든다** — 그것이 이 정정의 실질 비용이다.

## 실측 (2026-08-09, `origin/main` = `7ea30a23b`)

| 확인 대상 | 결과 |
| --- | --- |
| `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts` | 존재, `it(` 3건 |
| `secret-resolver.service.spec.ts` 의 쿼리 형태 단언 | 존재 (`expect(...condition).toBe('ref LIKE :prefix')`) |
| 각주 마지막 문단 | `spec/conventions/secret-store.md:91-94` — 여전히 "아직 …고정돼 있지 않고" |

## 변경안 — §2.1 각주 마지막 문단 교체

**제거**할 문단 (현행 91–94행):

> **알려진 검증 공백**: in-memory 테스트 mock 이 `startsWith` 라 LIKE 와일드카드 의미론을
> 재현하지 않는다 — "가드가 없으면 실제 Postgres 가 과다삭제한다" 는 아직 실행 가능한 테스트로
> 고정돼 있지 않고 본 각주가 유일한 기록이다. 재현하려면 mock 에 LIKE 해석기를 넣거나(테스트가
> DB 를 흉내 내다 틀릴 위험을 새로 만든다) e2e 를 추가해야 한다.

**대체**할 문단:

> **검증은 두 층으로 갈라 고정한다**: 이 불변식의 근거("메타문자가 섞이면 실 DB 가 의도보다
> 넓게 지운다")는 단위 테스트의 in-memory mock 으로 재현할 수 없다 — 그 mock 은 `startsWith`
> 로 대상을 고르므로 와일드카드 패턴에서 실제보다 **적게** 지운다(방향이 정반대라 과다삭제를
> 감춘다). mock 에 LIKE 해석기를 심는 선택지는 **테스트가 DB 를 흉내 내다 틀릴** 새 위험을
> 만들어 채택하지 않았다. 대신:
>
> - **와일드카드 의미론**은 실 Postgres 가 고정한다 — `_` 를 섞은 prefix 가 이웃 리소스까지
>   지우는 것을 "리터럴 해석 시 0건 vs 실제 2건" 으로 단언한다
>   (`codebase/backend/test/secret-store-like-prefix.e2e-spec.ts`).
> - **그 의미론이 이 API 에 적용된다는 사실**은 단위가 고정한다 — 쿼리가 `ref LIKE :prefix`
>   이고 바인딩이 `` `${prefix}%` `` 이며 `ESCAPE` 절이 **없다**는 형태 단언
>   (`secret-resolver.service.spec.ts`). `ESCAPE` 가 붙는 순간 메타문자가 리터럴이 되어 이
>   불변식의 전제 자체가 바뀌므로 그 부재도 계약이다.
>
> 둘 중 하나가 깨지면 나머지의 전제도 다시 봐야 한다. 단위 mock 은 자기 전제("패턴에 메타문자가
> 없다" — 위 가드가 세워 준다)를 직접 단언하므로, 가드가 제거되면 스위트가 조용히 통과하는 대신
> 실패한다.

## Rationale

**왜 "정정 이력" 이 아니라 현재 상태로 쓰는가.** `project-planner` §5 가 "옛 내용을 정리해
latest 만 남김 (history 가 아님)" 을 규정한다. "공백이었으나 해소됐다" 로 쓰면 각주가 변경
로그로 누적되고, 읽는 사람은 지금 무엇이 참인지 판정하려고 이력을 역추적해야 한다. 병렬 세션
경위는 본 draft 와 커밋 메시지에 남기고 spec 본문에는 결과만 적는다.

**왜 `mock 에 LIKE 해석기` 기각 근거를 남기는가.** 그 대안은 "더 간단한 길" 로 보여 재도입
압력이 있다. 기각 근거(테스트가 DB 를 흉내 내다 틀릴 새 위험)를 지우면 다음 사람이 같은 선택을
다시 검토한다. 이 저장소가 `## Rationale` 에 기각된 대안을 남기는 이유와 같다.

**`code:` frontmatter 는 건드리지 않는다.** 현재 글로브는
`codebase/backend/src/modules/secret-store/**` 이고 신설 e2e 는 `codebase/backend/test/` 라
밖이다. 그러나 (a) 각주는 이미 `triggers.service.ts` 처럼 글로브 밖 경로를 산문으로 인용하고
있어 스타일이 일관되고, (b) `spec-code-paths` 가 요구하는 것은 글로브 **하나 이상**의 매치라
빠뜨려도 evidence 사슬이 끊기지 않으며, (c) 넣으면 그 e2e 가 `review_guard` 의 spec-linked
판정에 들어가 앞으로 그 파일을 만지는 모든 PR 이 `--impl-done` 을 요구받는다. 정정 하나의
대가로는 크다. **필요해지면 그때 넣는다.**

## 체크리스트

- [x] 사전 일관성 검토 `/consistency-check --spec` — **BLOCK: NO** (5/5 checker, Critical 0 ·
      WARNING 0 · INFO 2, `review/consistency/2026/08/09/21_29_08`). 번들이 잘리지 않았는지
      먼저 실측했다 — 최대 1.5MB / 예산 2,600,000. `#1112` 가 **정확히 이 파일 때문에** 첫
      세션을 폐기한 전례가 있다(기본 예산에서 `secret-store.md` 가 통째로 생략됐다).
- [x] `spec/conventions/secret-store.md` §2.1 각주 문단 교체
- [x] side-effect — 이 각주를 인용하는 **다른 spec 은 없다**(전수 grep: `검증 공백`·
      `LIKE 해석기` 히트가 `secret-store.md` 한 곳뿐). `cross_spec` 도 "cross-spec 충돌 표면
      자체가 없음" 으로 동일 판정.
- [x] `backend-lint-gate-broken-on-main.md` §후속 의 철회 항목 체크
- [x] **자매 plan `spec-draft-auth-invariants-sync.md` 를 `complete/` 로 이동** (INFO 1·2).
      그 plan 의 미체크 2건은 전부 `#1112` **자신의** 기록(링크 무결성 회귀 · commit + PR)이고
      그 PR 은 20:30 에 머지됐다 — 체크 근거는 커밋 메시지에서 실측 인용했다.
      `plan-lifecycle.md §3` 이 **이동만 담은 별 PR 을 금지**하므로 인접 PR 이 정본 자리이고,
      본 PR 이 그 plan 이 쓴 각주를 정정하는 turn 이라 인접성이 가장 높다.
      > **이동이 링크 2개를 깨뜨릴 뻔했다** — 그 문서가 형제 plan 을 같은 디렉토리 기준
      > 상대경로(`auth-guard-reflection-hardening.md`)로 링크하고 있어 `complete/` 로 가면
      > `plan/complete/...` 를 가리킨다. `../in-progress/` 로 정정했고, 인입 참조 1건
      > (`auth-guard-reflection-hardening.md`)도 `../complete/` 로 갱신했다.
- [x] 게이트 — `spec-link-integrity` · `spec-links` · Gate C(`spec-plan-completion`) ·
      `plan-frontmatter` **4 파일 / 955 tests PASS**.
      > **통과를 증거로 쓰지 않았다 — 뮤테이션으로 확인했더니 이 게이트들은 위 링크 정정을
      > 검증하지 않는다.** 고친 링크를 깨진 형태로 되돌린 채 4종을 다시 돌렸는데 **전부
      > GREEN**(955 → 13 + 942). 즉 `plan/**` ↔ `plan/**` 상대링크는 어떤 게이트도 보지
      > 않는다(`spec-link-integrity` 는 이름대로 `spec/**` 기준이다). 링크 3개는 파일시스템
      > 존재 확인으로 직접 검증했다. **이동을 담는 PR 은 게이트를 믿지 말 것** — 이번 이동이
      > 링크 2개를 조용히 깨뜨릴 수 있었고 CI 는 통과했을 것이다.
- [x] commit + PR — [#1116](https://github.com/worker-ants/clemvion/pull/1116) (`c3fb5e9a9`)
      머지 완료 (2026-08-09)

## 후속 (이 PR 밖)

- [x] **`complete/` 이동 시 `status:` 미갱신을 잡는 게이트 부재** — **해소 (2026-08-09)**.
      `plan-frontmatter.test.ts` 에 `completed plans declare a terminal status` 신설.
      > **여기 적어 둔 "기존 위반 21건" 은 옳았다** — 다음 사람(나)이 처음에 262건으로 세고
      > 이 숫자가 틀렸다고 판단했는데, 262 는 `status:` **부재**까지 위반으로 센 값이었다.
      > `plan-lifecycle.md §4` 는 `status` 를 **선택 필드**로 규정한다(필수는 worktree ·
      > started · owner 셋뿐). 부재는 위반이 아니고, 실제 위반은 22건이었다.
      > **더 좁은 질문에 대한 정답을 틀렸다고 오판할 뻔했다.**
      >
      > 그리고 22 도 정확하지 않았다 — 게이트를 켜니 **23번째**가 나왔다.
      > `c1-pr2-aiturn-blueprint.md` 의 `status: complete (PR #625 머지)` 는 내 정규식
      > `^status:\s*(\S+)` 이 첫 토큰만 잡아 통과시켰지만 YAML 파서는 전체 문자열을 본다.
      > **정규식으로 센 숫자를 파서가 정정했다** — 자유서술을 `merged_pr:` 로 분리했다.
      >
      > **일괄 정정을 골랐다**(ratchet 아님). `in-progress` 15건은 사실 오류라 고치면
      > 끝이고, ratchet 은 옳은 값이 뭔지 아는데도 baseline 을 영구히 들고 가는 형태다.
      > 다만 `implemented`(3) · `applied`(3) · `superseded`(1) 는 **눕히지 않고 등재**했다 —
      > 특히 `superseded` 는 "대체됨" 이라 완료가 아니고, 일괄 `complete` 로 바꿨다면
      > 그 의미가 사라졌다.
- [x] **`plan/**` 내부 상대링크 무결성 게이트 부재** — **해소 (2026-08-09)**.
      같은 파일에 `top-level in-progress plans have no broken relative links` 신설.
      > **실측 후 스코프를 좁혔다**: 전체 `plan/**` 은 670건 중 148건이 깨져 있는데,
      > 그중 135건이 `plan/complete/**` 다. `plan-lifecycle.md §3` 이 "시점 기록 문서는 옛
      > 경로 유지" 를 규정하므로 완료 문서의 옛 링크는 **정상**이고, 게이트를 거기까지
      > 넓히면 정상 상태를 대량 RED 로 만든다. 살아있는 문서(top-level `in-progress`)만
      > 본다 — `plan-frontmatter.test.ts` 가 이미 쓰는 스코프 선례 그대로다.
      > 그 스코프의 깨진 링크 **8건을 전부 정정**했고(전부 `complete/` 로 옮겨간 plan 을
      > 가리키던 것 — 바로 이 실패 클래스다), 남은 3건은 하위 그룹 폴더
      > (`node-output-redesign/`)라 기존 면제 규칙에 걸린다.
- [x] 뮤테이션 **4/4 RED** — 링크를 이동 전으로 되돌림 · spec 링크 깊이 오류 ·
      `complete/` 에 `in-progress` 복귀 · 새 어휘(`done`) 무단 도입.
