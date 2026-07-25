# RESOLUTION — CRITICAL 은 harness 규약 갭, 코드 결함 아님

CRITICAL 1 / WARNING 2. **CRITICAL 이 내 코드가 아니라 `consistency-summary` 에이전트의 판단을
가리킨다** — 지적 자체는 정확하고, 내가 고칠 수 있는 부분과 없는 부분이 갈린다.

## CRITICAL — 사실관계 실측

`22_28_51/SUMMARY.md` 가 `cross_spec` 의 `[CRITICAL]`(§6 표 stale)을 통합 단계에서 `WARNING`
으로 하향하고 `BLOCK: NO` 를 냈다. 규약을 직접 확인했다:

```
.claude/agents/consistency-summary.md:20  Critical 1건이라도 있으면 상단 BLOCK: YES
.claude/agents/consistency-summary.md:45  차단 결정 명시 — Critical 1건 이상 → BLOCK: YES
```

**예외 조항이 없다.** 리뷰어 지적이 맞다. 그리고 `review_guard.py` 는 `BLOCK:` 한 줄만 보므로
이 하향은 SPEC-CONSISTENCY 게이트를 실제로 통과시키는 효과를 낸다.

## 내가 할 수 있는 것과 없는 것

| | 상태 |
|---|---|
| 근본 원인(§6 표 stale) 수정 | **불가** — `spec/` 는 developer 쓰기 권한 밖(CLAUDE.md §Skill 체계). 이미 `spec-update-node-cancellation-shutdown-classification` 에 승격 조건까지 명시해 위임했다 |
| 규약 갱신(`.claude/agents/consistency-summary.md`) | **불가** — 리뷰어도 "리뷰어 권한 밖, harness 관리자/planner 몫" 이라고 적었다 |
| 구조적 갭을 기록 | **가능** → `harness-consistency-summary-downgrade-rule`(P2) 신설 |

즉 이 CRITICAL 은 **developer 혼자 닫을 수 없는 종류**다. 구현이 끝나도 spec 표 갱신이 planner
몫인 한 impl-done 은 매번 같은 CRITICAL 을 낸다 — 그게 이번에 드러난 구조적 갭이고, 티켓에
선택지 (a)/(b)/(c) 와 함께 남겼다.

## W1 — 미완료 세션이 게이트를 가리고 있었다

두 종류가 있었고 성격이 다르다:

- `21_35_11` **consistency** 세션: 분류기 일시 장애로 checker 를 한 번도 못 띄운 채 커밋됐다.
  `meta.json` 에 중단 사유와 `superseded_by`(21_58_52)를 기록했다.
- `22_57_59` **code review** 세션(미커밋): 같은 원인으로 생긴 빈 디렉토리. **이게 남아 있는
  동안 push 게이트가 `"a code review session is in flight (SUMMARY pending)"` 로 통과를
  내주고 있었다**(실측). 제거하자마자 게이트는 정직하게
  `blocked: True — 8 codebase/ file(s) changed AFTER the most recent resolved review` 로 바뀌었다.

빈 세션 하나가 게이트를 무력화하고 있던 셈이라, W1 은 위생 문제가 아니라 **게이트 정확성**
문제였다.

## W2 — 테스트 수치에 실행 근거

- lint: `.claude/tools/run-test.sh lint` → **PASS**
- unit: `.claude/tools/run-test.sh unit` → **PASS** (14)
- integration 노드: `npx jest src/nodes/integration` → **345 passed**
- build: `.claude/tools/run-test.sh build` → **PASS**
- e2e: `.claude/tools/run-test.sh e2e` → **통과** (259)

## 보류·후속 항목

- §6 표 갱신 · §4 예시 정정 · `AbortError` 명명 · `meta.success` 서술 → 전부
  `spec-update-node-cancellation-shutdown-classification` 위임(planner).
- `http-request.handler.spec.ts` 의 AbortError 전파 미검증 갭(리뷰 INFO5) — 이번 PR 이 확립한
  패턴(재throw 가드 + 경계 테스트 쌍)을 그대로 재사용하면 된다. 같은 위임 문서에 기재.
- harness 규약 갭 → `harness-consistency-summary-downgrade-rule`.
