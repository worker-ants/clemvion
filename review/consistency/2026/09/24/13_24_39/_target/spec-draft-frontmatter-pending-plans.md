---
title: spec/5-system 세 문서의 pending_plans frontmatter 정정
status: in-progress
owner: project-planner
worktree: spec-frontmatter-pending-plans-6b2e9f
spec_impact:
  - spec/5-system/10-graph-rag.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/5-system/4-execution-engine.md
started: 2026-09-24
---

# `pending_plans:` 가 plan 이 아닌 것을 담고, 끝난 것을 담고 있다

developer 턴(`jest-esm-native-load`)의 `--impl-prep spec/5-system` 이 **BLOCK: YES** 를 냈다
(`review/consistency/2026/09/24/12_57_36`). Critical 은 그 작업과 무관한 **기존 frontmatter
오염**이고, `spec/` 쓰기라 planner 몫으로 인계됐다. 이 draft 가 그 인계를 집행한다.

이 셋을 두면 **`spec/5-system` 을 스코프로 하는 모든 `--impl-prep` 이 계속 막힌다.**

## A. 실측 — 세 자리

### A-1. (Critical) `10-graph-rag.md` — 마이그레이션 세 경로가 `pending_plans:` 에 있다

`pending_plans:` 에 `.sql` 세 개가 들어 있다:

```yaml
  - codebase/backend/migrations/V026__graph_extraction_status_nullable_index.sql
  - codebase/backend/migrations/V027__relation_head_tail_index.sql
  - codebase/backend/migrations/V037__kb_retry_failed_status.sql
```

**원인은 YAML 키 삽입 위치다.** `git show 5fbcd20b8`(2026-08-30, `#1242`) 이 `pending_plans:` 와
그 아래 한 줄만 추가했는데, 그 키가 **이미 있던 세 줄 위에** 들어가면서 셋이 통째로 재소속됐다.
직전 줄이 `- …/migrations/V025__graph_rag.sql` 로 `code:` 리스트의 마지막이었던 것이 그 증거다.

- 세 파일 **전부 실재**(확인함) — 즉 `code:` 증거이지 «미구현 plan» 이 아니다.
- 본문도 셋을 구현 완료 근거로 인용한다.
- **CI 가 못 잡는다**: `spec-pending-plan-existence.test.ts` 는 경로 **존재**만 검사하고
  «그게 plan 인가» 는 묻지 않는다. `.sql` 파일은 존재하므로 통과한다(false negative).

### A-2. `8-embedding-pipeline.md` · `10-graph-rag.md` — `implemented` 인데 `pending_plans` 가 있다

`spec/conventions/spec-impl-evidence.md` §3 표: `implemented` 의 `pending_plans` 는 **없음**.
두 문서 다 `status: implemented` 이면서 `plan/in-progress/update-returning-tuple-shape.md` 를
담고 있다.

### A-3. `4-execution-engine.md` — 이미 끝난 plan 을 «잔여 후속» 으로 지목한다

`pending_plans` 와 본문 두 곳(`:439`, `:1155`)이 `plan/in-progress/exec-intake-followups.md` 를
가리키는데, 그 파일은 **`plan/complete/` 로 이동 완료**다(확인함). `pending_plans` 가드는
*in-progress→complete 치환*으로도 실존을 인정하므로 이 stale 참조를 잡지 못한다.

## B. R-11 전수 판정 — 공유 트래커를 뺄 수 있는가

`update-returning-tuple-shape.md` 는 **공유 트래커**다(`spec_impact` 에 네 문서). §3.1 R-11 은
이 경우 승격 시점을 «파일 이동» 이 아니라 **«그 문서 몫의 미구현 surface 가 0 이 된 시점»** 으로
규정하고, **열린 항목을 전수로 열어** 각각이 (i) 미구현 surface 인지 (ii) 문서 위생·`code:`
등재 질문·새 규칙 제안인지 가르라고 한다. 후자만 남으면 빼고 **판정 근거를 커밋에 남긴다.**

열린 항목 **6건 전수**:

| # | 항목 | 분류 |
| --- | --- | --- |
| 1 | 배포 후 관측 — 4개월 죽어 있던 분기가 처음 라이브 | 운영 관측. 문서가 약속한 동작은 이미 구현됨 |
| 2 | 리뷰 중 뮤테이션 금지(관행) | 프로세스 |
| 3 | `ALLOWED` 설명이 docstring·테스트 주석에 중복 | 문서 위생 |
| 4 | `ALLOWED` 5번째 항목이 생기면 조임 방식 재검토 | 미래 트리거 |
| 5 | 자매 가드의 `CONSUMING` 정규식 복제 | 가드 코드 위생 |
| 6 | harness: stale 워크트리 이름이 검토 대상을 오염 | harness |

**여섯 중 (i) 에 해당하는 것이 하나도 없다.** 세 문서가 약속한 동작 — `UPDATE … RETURNING` 을
`[rows, count]` 튜플로 다루는 CAS 락 — 은 `#1168`(2026-08-14)이 고쳤고, `5fbcd20b8` 이 그
사실을 각 문서에 소급 각주로 적었다. 남은 여섯은 가드·프로세스·harness 다.

→ **세 문서의 `pending_plans` 에서 이 트래커를 뺀다.** 트래커 자체는 그대로 `in-progress` 다
(다른 몫이 남았다).

## C. 적용

| 문서 | 변경 |
| --- | --- |
| `10-graph-rag.md` | `V026`·`V027`·`V037` 세 줄을 `code:` 끝으로 복귀 → `pending_plans` 가 비므로 **키 제거**(`implemented` 는 «없음») |
| `8-embedding-pipeline.md` | `pending_plans` **키 제거**(R-11) |
| `4-execution-engine.md` | `pending_plans` 에서 `exec-intake-followups.md`(완료) · `update-returning-tuple-shape.md`(R-11) 제거. `status: partial` 유지 — `execution-engine-residual-gaps.md` · `retry-turn-terminal-guard.md` 둘이 남는다. 본문 `:439`·`:1155` 의 «잔여 후속» 열거도 동기화 |

**가드 영향 확인**: `spec-status-lifecycle.test.ts` 의 (b)(c) 는 `partial` 에만 걸린다 —
`implemented` 문서에서 키를 빼는 것은 대상이 아니다. `4-execution-engine.md` 는 제거 후에도
in-progress plan 둘이 남아 (c)(전부 complete ⇒ 승격 의무)에 걸리지 않는다.

## D. 하지 않는 것

- **`spec-pending-plan-existence.test.ts` 를 «plan 경로인지» 까지 보게 고치는 것** — 이번
  Critical 을 CI 가 못 잡은 진짜 이유이고 고칠 값이 있지만, **가드는 `codebase/` 라
  developer 소유**다. 후속 항목으로 등재한다.
- `spec/5-system` 의 `## Overview` 표기 3갈래 혼재(같은 리포트 INFO) — 이번 건과 무관한
  standing 편차. 이미 별 항목으로 등재돼 있다.

## 체크리스트

- [ ] `/consistency-check --spec plan/in-progress/spec-draft-frontmatter-pending-plans.md` → BLOCK: NO
- [ ] 세 문서 frontmatter·본문 적용
- [ ] `pnpm --filter frontend test -- spec-frontmatter spec-code-paths spec-pending-plan-existence spec-status-lifecycle` 통과
- [ ] 가드 개선(§D) 후속 등재
- [ ] draft `plan/complete/` 로
