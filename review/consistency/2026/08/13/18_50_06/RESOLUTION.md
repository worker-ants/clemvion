# RESOLUTION — consistency `18_50_06` (`--impl-done spec/5-system/`)

**BLOCK: NO** (Critical 0). WARNING 1건 **조치 완료**, INFO 1건 조치, 2건 무조치.

## WARNING 1 — admission catch 주석이 `attempts:1` 과 모순 (rationale_continuity)

**지적이 맞다. 전제를 직접 확인했다:**

```
execution-run.queue.ts — EXECUTION_RUN_QUEUE_DEFAULT_OPTS
  attempts: 1  … "job 실패(throw) 시 application-level 재시도는 하지 않는다.
                  비멱등 노드(Integration write 등) 이중 실행 방지.
                  (stalled 재배달은 attempts 와 별개 카운터)"
```

`17_15_21` WARNING 2 를 고치면서 내가 쓴 *"BullMQ 재배달 시 재등록되므로 대개 자가
치유되지만, 재시도가 소진되면…"* 은 **거짓**이다. `attempts: 1` 이라 명시적 throw 는
재시도가 **0회**이고 job 은 곧바로 failed 로 간다. "재시도 소진" 이라는 상황 자체가 없다.

이건 단순 오타가 아니라 **`throw err` 의 근거 자체가 틀린 것**이다 — 나는 "재배달에
맡긴다" 는 이유로 재전파를 골랐는데 재배달이 없다.

**처분: 코드 유지, 근거 교체.** 재검토해도 `throw` 가 여전히 맞다:

| | 삼키면 | 던지면 |
|---|---|---|
| job | 성공으로 보임 → `removeOnComplete: true` 로 **소멸** | `removeOnFail: false` 로 **보존** → DLQ 모니터(§9.3) 관측 |
| execution | `pending` 좌초 사실이 아무 데도 안 남음 | 좌초가 실패 job 으로 드러남 |

자매 catch(`runExecution`)가 반대로 swallow 하는 이유도 명시했다 — **거기선 노드가 이미
실행됐을 수 있어** 재전파가 이중 실행을 부른다. admission 단계는 노드 미실행이라 그 위험이
없다. 리뷰어가 "그 차이를 근거화하지 않았다" 고 한 지적 그대로다.

회수 경로도 사실대로 적었다: 트랜잭션 롤백으로 execution 은 `pending` 에 남고, 회수는
앱 재기동의 orphan-pending backstop 몫이다.

> **전파된 오서술에 대해**: 리뷰어가 같은 문장이 `review/code/.../18_38_10/security.md:55`
> 에도 있다고 지적했다. 그건 **reviewer 가 내 주석을 인용한 것**이라 고치지 않는다 —
> 남의 리포트를 사후 편집하면 그 라운드에 실제로 무엇을 봤는지 기록이 훼손된다.
> 원본(코드 주석)을 고쳤고, 그 경위를 여기 남기는 것이 맞는 처분이다.

## INFO 3 — stale `worktree:` frontmatter (plan_coherence)

**조치 완료.** `lint-warning-triage` → `eia-r8-cache-scope-4ae434`. 방치하면 이 plan 의
잔여 항목을 다른 worktree 에서 처리할 때 plan-guard 가 무장 해제된다.

## 함께 닫은 것 — 스타일 4건

등재 직후 "다음 실질 변경 때" 로 미뤘는데, 위 WARNING 으로 **`codebase/**` 수정이 확정**돼
미룰 이유가 사라졌다. 4라운드 연속 재부상하던 항목이라 같은 커밋에서 닫았다:
오배치 JSDoc 이동 · pass-through 래퍼 제거 · `make*`→`build*` 통일 · 캐스트 4곳 →
`callHandle` 헬퍼.

## 검증 — 뮤테이션에서 한 번 속을 뻔했다

리팩터가 호출 경로(`handle` 캐스트 → `callHandle`)를 바꿨으니 GREEN 은 증거가 아니다.
`isSubFilterNull` 삼항을 반전시켜 봤더니 **처음엔 "생존"** 이 나왔다 —
`isSubFilterNull ?` 를 공백 한 칸으로 가정했는데 실제는 `isSubFilterNull` **개행** `?` 라
**치환이 아예 안 먹은 무효 뮤턴트**였다. 변경 결과가 원본과 다른지 `assert` 를 걸고 재실행:

| 뮤턴트 | 결과 |
|---|---|
| baseline | 38 passed |
| 삼항 조건 반전 | **2 failed** / 36 passed → 사살 (양방향 판별력 유지) |

그 외: `lint --max-warnings 0` 통과, `tsc --noEmit` **199**(baseline 동일),
dispatcher+engine 스위트 **482 passed**.

## INFO 무조치

| # | 처분 |
|---|---|
| 1 | `§R8` 로컬 레이블 중복 — 파일별 독립 번호가 기존 컨벤션이고 cross-ref 는 항상 문서명 동반. 리뷰어도 "액션 불필요" |
| 2 | target 스코프에 diff 없음 — orchestrator 동작 특성이지 결함 아님 |
