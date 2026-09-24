---
title: pending_plans frontmatter 정정 — 사고 하나와 규약 위반 셋
status: complete
owner: project-planner
worktree: spec-frontmatter-pending-plans-6b2e9f
spec_impact:
  - spec/5-system/10-graph-rag.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/5-system/4-execution-engine.md
  - spec/conventions/raw-query-results.md
started: 2026-09-24
---

# `pending_plans:` 가 plan 이 아닌 것을 담고, 규약이 금지한 자리에 있다

developer 턴(`jest-esm-native-load`)의 `--impl-prep spec/5-system` 이 **BLOCK: YES** 를 냈다
(`review/consistency/2026/09/24/12_57_36`). Critical 은 그 작업과 무관한 기존 frontmatter
오염이고 `spec/` 쓰기라 planner 로 인계됐다. 이 draft 가 그 인계를 집행한다.

이 셋을 두면 **`spec/5-system` 을 스코프로 하는 모든 `--impl-prep` 이 계속 막힌다.**

> **두 가지를 섞어 보면 안 된다 — 초판에서 내가 섞었고 `--spec` `13_24_39` 가 잡았다.**
> `pending_plans:` 에 들어 있는 것은 두 종류이고 **원인이 다르다**:
>
> | | 무엇 | 원인 |
> | --- | --- | --- |
> | (가) | `V026`·`V027`·`V037` **`.sql` 세 경로** | **사고** — YAML 키 삽입 위치 실수 |
> | (나) | `update-returning-tuple-shape.md` | **의도** — `#12` 가 5개 문서에 일부러 등재 |
>
> 초판은 (나)까지 «우발적 오염» 이라 적었다. **틀렸다.** 처방은 둘 다 «빼기» 지만 근거가
> 전혀 다르고, (나)는 **남의 결정을 뒤집는 것**이라 그 결정의 완료 기록도 함께 고쳐야 한다.

## A. 실측

### A-1. (Critical) `10-graph-rag.md` — 마이그레이션 세 경로가 `pending_plans:` 에 있다

```yaml
pending_plans:
  - plan/in-progress/update-returning-tuple-shape.md
  - codebase/backend/migrations/V026__graph_extraction_status_nullable_index.sql   # ← code: 였다
  - codebase/backend/migrations/V027__relation_head_tail_index.sql                 # ←
  - codebase/backend/migrations/V037__kb_retry_failed_status.sql                   # ←
```

`git show 5fbcd20b8`(2026-08-30, `#1242`) 이 `pending_plans:` 와 그 아래 **한 줄만** 추가했는데,
그 키가 **이미 있던 세 줄 위에** 들어가면서 셋이 통째로 재소속됐다. 직전 줄이
`- …/V025__graph_rag.sql` 로 `code:` 리스트의 마지막이었던 것이 증거다.

- 세 파일 **전부 실재**(확인함) — `code:` 증거이지 «미구현 plan» 이 아니다. 본문도 구현 완료
  근거로 인용한다(`:96` 이 `V037` 을 `✅` 로).
- **CI 가 못 잡는다**: `spec-pending-plan-existence.test.ts` 는 경로 **존재**만 보고 «그게
  plan 인가» 는 묻지 않는다. `.sql` 이 실재하므로 통과한다(false negative).

### A-2. `implemented` 인데 `pending_plans` 가 있다 — 세 문서

`spec/conventions/spec-impl-evidence.md` §3 표: `implemented` 의 `pending_plans` 는 **없음**.

| 문서 | status | 담고 있는 것 |
| --- | --- | --- |
| `5-system/10-graph-rag.md` | implemented | `update-returning-tuple-shape.md` |
| `5-system/8-embedding-pipeline.md` | implemented | 〃 |
| `conventions/raw-query-results.md` | implemented | 〃 |

### A-3. `4-execution-engine.md` — 이미 끝난 plan 을 «잔여 후속» 으로 지목한다

`pending_plans` 와 본문 두 곳(`:439`, `:1155`)이 `plan/in-progress/exec-intake-followups.md` 를
가리키는데 그 파일은 **`plan/complete/` 로 이동 완료**다(확인함). 가드는
*in-progress→complete 치환*으로도 실존을 인정하므로 이 stale 참조를 못 잡는다.

## B. 판별선 — `implemented` 냐 `partial` 이냐

같은 트래커(`update-returning-tuple-shape.md`)를 담은 문서는 **다섯**이다. 전부 빼거나 전부
두는 대신, **규약이 이미 그은 선**으로 자른다:

| 문서 | status | 처분 | 근거 |
| --- | --- | --- | --- |
| `10-graph-rag.md` | implemented | **제거** | §3 표 위반 |
| `8-embedding-pipeline.md` | implemented | **제거** | §3 표 위반 |
| `raw-query-results.md` | implemented | **제거** | §3 표 위반 |
| `4-execution-engine.md` | partial | **유지** | 위반 아님 |
| `node-cancellation.md` | partial | **유지** | 위반 아님 |

`--spec` `13_24_39` 이 «스코프 밖 `node-cancellation.md` 비대칭» 을 경고했는데, 위 선을 쓰면
비대칭이 아니다 — **내가 고른 스코프가 아니라 문서의 `status` 가 처분을 정한다.**

**«그럼 `partial` 두 문서는 R-11 로 빼야 하지 않나»** — 뺄 **수** 있지만 **안 뺀다.**
R-11 은 *`partial` → `implemented` 승격 시점*을 정하는 규칙이지 «pending_plans 를 비우는
의무» 가 아니다. 두 문서는 각자 다른 미구현 surface 로 이미 `partial` 이라 승격 대상이
아니고, 이 트래커는 그 문서들에서 **본문 cross-link 의 보강 포인터**로 계속 값을 한다
(`4-execution-engine.md` §1.1 이 그것을 «전수 목록의 정본» 으로 지목한다). 필요 최소만 고친다.

> **R-11 은 이번 처방의 근거가 아니다 — 보강일 뿐이다.** 제거를 정당화하는 것은 §3 표
> 한 줄이다. 다만 «그 트래커가 이 문서들의 미구현 surface 를 정말 안 담고 있나» 를 확인해
> 두면 다음 사람이 되묻지 않으므로, 열린 6건을 전수로 분류해 둔다:
>
> | # | 항목 | 분류 |
> | --- | --- | --- |
> | 1 | 배포 후 관측 | 운영 관측 |
> | 2 | 리뷰 중 뮤테이션 금지 | 프로세스 |
> | 3 | `ALLOWED` 설명 중복 | 문서 위생 |
> | 4 | `ALLOWED` 5번째 항목 트리거 | 미래 트리거 |
> | 5 | 자매 가드 `CONSUMING` 정규식 복제 | 가드 코드 위생 |
> | 6 | harness: stale 워크트리 이름 | harness |
>
> **여섯 중 «문서가 약속한 동작의 구현 미완» 은 없다.** 실제 결함은 `#1168`(2026-08-14)이
> 고쳤고 `5fbcd20b8` 이 각 문서에 소급 각주로 적었다.

## C. `#12` 의 완료 기록도 함께 고친다

(나)를 빼는 것은 **`spec-update-node-cancellation-shutdown-classification.md` §추가 위임(#12)의
결정을 뒤집는 것**이다. 그 plan 은 *"`pending_plans:` 에 등재. 대상은 위 표의 5개 문서 전부"*
라 지시했고 *"✅ 완료 (2026-08-30) — 등재 가능한 4곳 전부 반영"* 으로 기록돼 있다.

**세 곳을 빼면 그 완료 기록이 조용히 거짓이 된다.** 같은 planner 소유이므로 같은 턴에 각주를
단다 — «셋은 2026-09-24 에 제거됨, 사유: §3 표는 `implemented` 에 `pending_plans` 를 허용하지
않는다. 포인터 역할은 본문 cross-link 가 이어받는다.»

> **왜 `#12` 가 틀린 도구를 골랐나** — 의도는 옳았다(*"각주가 그 plan 자신의 후속 절에만 있어
> 다음 스윕에서 놓칠 위험"*). 다만 `pending_plans` 는 §2.1 이 «**미구현 surface** 를 책임지는
> plan 경로» 로 정의한 필드라 **cross-reference 포인터 용도가 아니다.** 용도를 벗어나 쓰니
> `status` 규칙과 충돌했다.

## D. 적용

| 문서 | 변경 |
| --- | --- |
| `10-graph-rag.md` | `V026`·`V027`·`V037` → `code:` 끝으로 복귀 · `pending_plans` **키 제거** · Overview 배너의 마이그레이션 범위를 `V025 ~ V037` 로(본문 `:96` 이 이미 V037 을 인용하는데 배너만 `V027` 까지였다 — `--spec` INFO 1) |
| `8-embedding-pipeline.md` | `pending_plans` **키 제거** |
| `raw-query-results.md` | `pending_plans` **키 제거** |
| `4-execution-engine.md` | `pending_plans` 에서 `exec-intake-followups.md`(완료) 제거 · 본문 `:439`·`:1155` 의 «잔여 후속» 열거 동기화 · `status: partial` 과 나머지 셋 유지 |
| `spec-update-node-cancellation-shutdown-classification.md` | `#12` 완료 기록에 제거 각주(§C) |

**«비움» 이 아니라 «키 제거» 를 택한다** — 규약 §5.3 은 둘 다 허용한다(`--spec` INFO 3).
빈 배열은 «있는데 비었다» 로 읽혀 다음 사람이 채울 것을 찾게 만든다.

**가드 영향**: `spec-status-lifecycle.test.ts` 의 (b)(c) 는 `partial` 에만 걸린다 —
`implemented` 에서 키를 빼는 것은 대상이 아니다. `4-execution-engine.md` 는 제거 후에도
in-progress plan 셋이 남아 (c)(전부 complete ⇒ 승격 의무)에 걸리지 않는다.

## E. 하지 않는 것

- **`spec-pending-plan-existence.test.ts` 를 «plan 경로인지» 까지 보게 고치는 것** — 이번
  Critical 을 CI 가 못 잡은 **진짜 이유**이고 고칠 값이 있지만, 가드는 `codebase/` 라
  **developer 소유**다. 후속 항목으로 등재한다.
- `spec/5-system` 의 `## Overview` 표기 3갈래 혼재 — 이번 건과 무관한 standing 편차, 이미 등재됨.

## 체크리스트

- [x] `/consistency-check --spec …` → **BLOCK: NO** (`13_24_39`, Critical 0 · Warning 2).
      W1(«우발적» 이라는 내 진단이 틀렸다)과 W2(4번째 문서 비대칭)를 이 개정판이 반영했다.
- [x] 네 spec 문서 + `#12` 기록 적용
- [x] `pnpm --filter frontend test -- spec-frontmatter spec-code-paths spec-pending-plan-existence spec-status-lifecycle` 통과
- [x] 가드 개선(§E) 후속 등재
- [x] draft `plan/complete/` 로
