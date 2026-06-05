# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target: `spec/5-system/4-execution-engine.md`
Worktree: `impl-exec-concurrency-cap` (branch `claude/impl-exec-concurrency-cap`)
검토 일시: 2026-06-04

---

## 발견사항

### [INFO] exec-intake-queue-impl.md frontmatter worktree 필드 불일치
- target 위치: `/plan/in-progress/exec-intake-queue-impl.md` frontmatter
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` — `worktree: impl-exec-intake-queue`
- 상세: 현재 PR2(§8 concurrency cap) 구현은 `impl-exec-concurrency-cap` worktree 에서 진행 중이나, 이를 추적하는 plan 파일(`exec-intake-queue-impl.md`) 의 frontmatter `worktree` 필드가 `impl-exec-intake-queue` (PR1 predecessor worktree) 로 유지되고 있다. `impl-exec-intake-queue` 는 PR #463 으로 이미 머지된 stale 브랜치다. 기능적 차단은 아니나 plan lifecycle 추적 정합성이 흐려진다.
- 제안: `exec-intake-queue-impl.md` frontmatter 의 `worktree` 를 `impl-exec-concurrency-cap` 으로 갱신하거나, PR2 전용 별도 plan 항목에 올바른 worktree 를 등재.

### [INFO] spec-sync-execution-engine-gaps.md §8 항목 — PR2 착수 전 cross-ref 미갱신
- target 위치: `spec/5-system/4-execution-engine.md §8`
- 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` (§8 동시 실행 제한 — `[ ]` 미완)
- 상세: `spec-sync-execution-engine-gaps.md` 는 §8 동시 실행 제한을 여전히 `[ ]` 미착수 로 기록하고 있다. `exec-intake-queue-impl.md` PR2a/PR2b 가 이를 구현할 계획이지만, 두 plan 간의 명시적 연결(ex: "§8 항목은 `exec-intake-queue-impl.md PR2` 가 담당")이 `spec-sync-execution-engine-gaps.md` 에 없다. 이로 인해 다른 개발자가 §8 를 별도 착수할 오해 가능성이 있다.
- 제안: `spec-sync-execution-engine-gaps.md` 의 §8 항목에 "착수 중 — `exec-intake-queue-impl.md PR2a/PR2b`" 주석 추가.

### [INFO] channel-web-chat-followups.md §2 비용 가드 — 선행 결정 미해소 상태로 plan 유지
- target 위치: `spec/5-system/4-execution-engine.md` (§8 execution timeout / concurrency 관련)
- 관련 plan: `plan/in-progress/channel-web-chat-followups.md §2` (워크플로우 비용 가드 — 보류)
- 상세: `channel-web-chat-followups.md §2` 는 execution-engine 영역의 토큰 미터·예산 초과 가드 설계가 선행돼야 하는 항목으로, 복수의 미결 설계 질문(예산 단위/스코프·max turn 위치·미터링 지점·우아한 종료 의미·리셋 주기)을 나열하고 있다. PR2 의 §8 구현(실행 시간 타임아웃·동시성 cap)은 이 설계와 **직교**하므로 즉각 충돌은 없다. 단, §8 구현 후 `channel-web-chat-followups.md §2` 의 설계 질문 중 "미터링 지점" 이 execution-engine hook 가 될 경우 PR2/PR3 의 active-running 추적 인프라를 재사용할 수 있다는 점을 plan 에서 참조하면 설계 중복을 예방할 수 있다.
- 제안: 우선순위 낮음. PR2 완료 후 `channel-web-chat-followups.md §2` 에 "execution-engine active-running 추적 인프라(PR2a) 재사용 후보" 메모 추가 권장.

### [INFO] node-cancellation-infrastructure.md §2 — PR3 코드 영역 겹침 명시됨 (비차단)
- target 위치: `exec-intake-queue-impl.md PR3`
- 관련 plan: `plan/in-progress/node-cancellation-infrastructure.md §2`
- 상세: `exec-intake-queue-impl.md` 가 PR3 에서 "`node-cancellation-infrastructure.md §2` 와 코드영역 겹침 → 직렬화 순서: cancellation 인프라 선/후행을 PR3 착수 시 확정"을 이미 명시하고 있다. PR2(현재 착수 중) 는 `execution-engine.service.ts` dispatch 직전 AbortSignal 사전체크와 관련이 없으므로 PR2 단계에서는 차단 없음. PR3 착수 시점에 직렬화 결정이 필요하다.
- 제안: 현재 PR2 착수 단계에서는 조치 불요. PR3 착수 전에 `node-cancellation-infrastructure.md §2` 완료 여부 재검토.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과, 아래 후보들을 stale 판정하여 §5 CRITICAL 분석에서 제외하였다.

| worktree | branch | 판정 |
|---|---|---|
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | Step 2 — PR MERGED |
| `fix-spec-frontmatter-catalog` | `claude/fix-spec-frontmatter-catalog` | Step 2 — PR MERGED |
| `impl-exec-intake-queue` | `claude/impl-exec-intake-queue` | Step 2 — PR #463 MERGED |
| `spec-exec-intake-queue` | `claude/spec-exec-intake-queue` | Step 2 — PR MERGED |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | Step 1 — ancestor of origin/main + Step 2 PR MERGED |
| `competitive-analysis-e0569b` | `claude/competitive-analysis-e0569b` | Step 2 — PR MERGED |
| `integration-index-unify-2c7973` | `claude/integration-index-unify-2c7973` | Step 2 — PR MERGED |
| `kb-quality-fba2f2` | `claude/kb-quality-fba2f2` | Step 2 — PR MERGED |
| `makeshop-api-catalog-730deb` | `claude/makeshop-api-catalog-730deb` | Step 2 — PR MERGED |

stale 확인 기준: worktree `spec-sync-audit`(branch `claude/spec-sync-audit`) 도 PR #443 MERGED → stale 이나, worktree 디렉토리가 별도 등록돼 있지 않아 충돌 후보 목록에 미포함.

**OPEN PR 이 있는 worktree (실제 분석 대상):**

- `ai-context-memory-9c7e6e` (PR OPEN) — `execution-engine.module.ts` · `node-handler-dependencies.provider.ts` 변경. `spec/5-system/4-execution-engine.md` 는 **무수정**. PR2 가 주로 건드리는 파일(`execution-engine.service.ts`, `queues/`, DB migrations)과 **직접 충돌 없음** — §5 CRITICAL 분류 해당 없음.
- `persistent-enhance-32f236` (PR OPEN) — 동일 파일 변경 패턴. `spec/5-system/4-execution-engine.md` 무수정. **충돌 없음**.
- `rag-rerank-impl` (PR 없음, Step 3 fallback → active 처리) — RAG/KB 파일만 변경, execution-engine 영역 무수정. **충돌 없음**.

stale 으로 skip 된 worktree 총 9건. 이 worktree 들이 물리적으로 남아 있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`impl-exec-concurrency-cap` worktree 에서 `spec/5-system/4-execution-engine.md §8` 구현(PR2a: active-running timeout, PR2b: 동시성 cap)을 착수하는 데 있어 plan 관점의 정합성 위해 요인은 발견되지 않는다. 미해결 결정과의 충돌(§1), 병렬 worktree 경합(§5) — 어느 활성 worktree 도 `4-execution-engine.md` 를 동시 수정하지 않음 —, 미해소 선행 조건(§3) 모두 차단 요인 없음. 발견사항은 전부 INFO 수준의 plan 위생(cross-ref 미갱신·frontmatter 오래된 worktree 필드) 이다. PR3 단계에서 `node-cancellation-infrastructure.md §2` 직렬화 결정이 필요하나 이는 PR2 범위 밖이다. worktree 충돌 후보 9건은 모두 stale(MERGED) 확인 후 skip 하였으며, OPEN PR 을 가진 2개 worktree 는 execution-engine spec 파일을 건드리지 않아 CRITICAL 해당 없음.

---

## 위험도

NONE
