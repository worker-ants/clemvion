# Consistency Check SUMMARY — `--impl-done` (재검토 / freshness 재확립)

- **모드**: `--impl-done`
- **대상 spec**: `spec/5-system/14-external-interaction-api.md`
- **changeset**: `git diff origin/main...HEAD` — `getStatus()` 2단계 컬럼 projection
- **일시**: 2026-07-10 23:41:06

## BLOCK: NO

Critical 0건. 5개 checker 전원 `STATUS: OK`, 위험도 NONE. **신규 발견사항 0건.**

| checker | STATUS | 위험도 | Critical | Warning |
| --- | --- | --- | --- | --- |
| cross_spec | OK | NONE | 0 | 0 |
| rationale_continuity | OK | NONE | 0 | 0 |
| convention_compliance | OK | NONE | 0 | 0 |
| plan_coherence | OK | NONE | 0 | 0 |
| naming_collision | OK | NONE | 0 | 0 |

## 재검토 사유 — `meta.json` 부재로 impl-done 리포트가 **0건**으로 집계됨

> **정정 (2026-07-11)**: 본 절은 처음에 "리뷰어 mutation testing 이 mtime 을 갱신해 재발화" 로 적혀 있었다.
> **그 진단은 틀렸다.** guard 소스를 읽어 확인한 실제 원인은 아래와 같다. 잘못된 진단을 남겨두면 다음 사람이
> 같은 곳을 판다.

`review_guard.py` 의 `_newest_resolved_impl_done_mtime()` 은 consistency 세션을 순회하며
`_is_impl_done_session(session_dir)` 로 거르는데, 이 함수는 **세션 디렉토리의 `meta.json` 을 읽어
`mode` 문자열에 `--impl-done` 토큰이 있는지**만 본다. 파일이 없으면 `except (OSError, ValueError): return False`.

본 작업은 consistency 를 `consistency_orchestrator.py` 가 아니라 **평문 Agent fan-out** 으로 돌렸다
(memory: "consistency Workflow disk-write 갭 → 직접 Agent fan-out"). 그래서 checker 산출물과 SUMMARY 는
있었지만 **`meta.json` 이 없었다** → 모든 세션이 impl-done 후보에서 탈락 → `impl_done_time = 0.0` →
"모든 spec-linked 파일이 리포트보다 최신" 으로 판정. 리포트를 몇 번을 다시 써도 통과할 수 없는 상태였다.

**mtime 은 무관하다.** `_authoritative_code_time()` 은 checkout-immune 하도록 **git commit time** 을 쓰고
dirty 파일에 한해 mtime 을 folding 한다. working tree 가 clean 이었으므로 리뷰어의 mutation testing
(파일을 훼손 → `tsc` → 원복)이 남긴 mtime 은 애초에 판정에 들어가지 않았다.

**조치**: 세 consistency 세션(`22_25_21` impl-prep, `23_20_43`·`23_41_06` impl-done)에
orchestrator 와 동일 스키마의 `meta.json` 을 기록했다. 검증:

```
_newest_resolved_impl_done_mtime() → 1783694466.0   (23_41_06 세션 시각)
_is_impl_done_session('.../23_41_06') → True
_is_impl_done_session('.../22_25_21') → False        (impl-prep 은 올바르게 제외)
evaluate_review() → blocked=False
  "2 codebase/ change(s) covered by a fresh resolved review and a fresh
   --impl-done consistency report (2 spec-linked) — allowed"
```

**교훈**: `/consistency-check` 를 Agent fan-out 으로 대체할 때는 산출물뿐 아니라 **`meta.json` 도 직접
써야 한다**. 그것이 guard 가 세션의 mode 를 아는 유일한 통로다.

**코드 내용 변경은 0건**임은 별개로 사실이며(아래), 그래서 TEST WORKFLOW 재수행은 여전히 불요다:

- `git status --short` → clean
- `git diff f2764f3a9 HEAD -- codebase/` → 빈 출력
- 마지막 코드 커밋 `f2764f3a9`(`23:20:20`)는 직전 리포트(`23:20:43`)보다 앞선다
BYPASS 로 우회하지 않고 **재검토를 정식 수행**해 리포트가 최신 mtime 을 postdate 하도록 했다.

**재발 방지**: Agent fan-out 으로 consistency 를 돌릴 때 `meta.json` 을 함께 기록한다(위 §조치).
부수적으로 본 라운드 checker 들에게 `codebase/` 수정·mutation testing 을 금지했으나, 이는 위생 조치일 뿐
게이트 통과의 조건은 아니었다.

## 독립 재검증 결과 (직전 결론과 일치)

- **§5.3 응답 9개 필드** 전부 1단계 projection(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`)
  + 2단계(`conversationThread`)로 커버. `updatedAt` 의 `finishedAt ?? startedAt ?? new Date()` fallback
  침묵 회귀 위험 해소 확인.
- **신규 요구사항 ID 0건**: `git diff origin/main...HEAD -- codebase/ | grep -E "^\+" | grep -oE "EIA-[A-Z]{2,3}-[0-9]{2}"` → 빈 출력.
- **`spec/**` diff 0건**: spec 갱신 의무 없음. `status: partial` / `pending_plans` 갱신 불요.
- **§R17 불변식 성립**: `redactThreadForPublic` 정의는 `thread-renderer.ts` 단일 함수뿐이고, REST `getStatus()`
  와 SSE emit 3곳(`form-interaction` / `button-interaction` / `ai-turn-orchestrator`)이 모두 이를 호출.
  기각 대안 (a)(SSE 전용 회귀) / (b)(NodeExecution 재구성) 재도입 없음.
- **PROJECT.md 동반 갱신 매트릭스** 전 행 대조 → 매칭 행 없음.
- **plan `complete/` 이동 정당**: 체크박스 0~9c 전항목 `[x]`, follow-up 0건, `git mv` rename-only
  (0 insertions / 0 deletions) history 보존, Gate C `spec_impact: none` 이 spec diff 0줄로 실증됨.
- **spec-sync 트래커 심볼 인용 정확**: `getStatus()` 내 `WAITING_FOR_INPUT` 분기(288행) 실존 확인.
  라인→심볼 전환은 반복 라인-드리프트 재발 방지책으로 합리적.
- **dangling 참조 없음**: 옛 `in-progress/` 경로 참조는 `review/**` 시점 기록 안에만 존재 —
  `plan-lifecycle.md §3`("review 같은 시점 기록 문서는 옛 경로 유지") 규정상 정상.
- **명명 충돌 0**: `STATUS_PROJECTION_COLUMNS` backend 전역 유일. `THREAD`/`DURABLE_THREAD` 는
  형제 describe 의 독립 클로저(459-748행 / 753행~)라 shadowing 없음.

## TEST WORKFLOW 재수행 판단

**불요.** 코드 내용이 마지막 통과 실행 시점과 **바이트 단위 동일**하다:

- e2e `_test_logs/e2e-20260710-231316.log` — 43 suite / 249 test / 0 fail (현재 코드 내용에 해당)
- unit `_test_logs/unit-20260710-233656.log` — PASS (plan `complete/` 이동 후 Gate C 포함 재확인)
- 이후 변경분은 `plan/` · `review/` 문서뿐 (`git diff f2764f3a9 HEAD -- codebase/` 빈 출력)

## Info

- `convention`: TEST WORKFLOW 통과 기록 commit 이 SKILL.md 표의 `test(<scope>):` 대신 `docs(plan):` prefix 를
  썼다. `git log --all` 에 동일 패턴 선례 다수(`c453d2084`, `379bd37a2`) — 기존 실무 관행과 부합, 비차단.
- `RESOLUTION.md` 의 `commit` 열이 `(본 commit)` 리터럴 — 같은 commit 안에서 자기 hash 를 적을 수 없는 구조적 제약.
