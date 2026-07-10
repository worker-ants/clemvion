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

## 재검토 사유 — mtime-only 재발화 (코드 회귀 아님)

직전 `--impl-done`(`review/consistency/2026/07/10/23_20_43/`)은 이미 `BLOCK: NO` 로 종결됐다. 그러나
`review_guard.py` 의 SPEC-CONSISTENCY 게이트는 `_newest_code_mtime()` 으로 **파일 mtime** 을 비교하는데,
그 직후 실행한 fresh `/ai-review` 의 sub-agent(testing / database / maintainability)들이 **mutation testing**
(`'outputData'`→`'output_data'` 오기 후 `tsc` 로 `TS2820` 확인 → 원복, projection 컬럼 추가 → 테스트 red 확인
→ 원복)을 수행하며 `interaction.service.ts` 의 mtime 을 `23:27:01` 로 갱신했다. 리포트 경로 시각
(`23_20_43`)보다 최신이 되어 게이트가 재발화했다.

**코드 내용 변경은 0건**임을 실증:

- `git status --short` → clean (working tree 에 미커밋 변경 없음)
- `git diff f2764f3a9 HEAD -- codebase/` → 빈 출력 (마지막 코드 커밋 이후 내용 동일)
- 마지막 코드 커밋 `f2764f3a9` 는 `23:20:20` — 직전 리포트(`23:20:43`)보다 **앞선다**

즉 게이트가 잡은 것은 "리뷰 후 코드가 바뀌었다" 가 아니라 "리뷰어가 코드 파일을 건드렸다(내용은 원복)" 이다.
BYPASS 로 우회하지 않고 **재검토를 정식 수행**해 리포트가 최신 mtime 을 postdate 하도록 했다.

**재발 방지**: 본 라운드 checker 들에게 `codebase/` 수정·mutation testing 을 명시 금지했고, 실행 후
mtime 이 유지됨(`23:27:01` / `23:01:41` < `23:41:06`)을 확인했다.

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
