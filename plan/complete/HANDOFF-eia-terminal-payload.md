---
title: 재개 인계 (종결) — claude/eia-terminal-payload 중단·재개 기록
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-14
owner: developer
status: complete
priority: P1
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
---

> ## ✅ 재개 완료 — 이 문서의 차단은 전부 해소됐다 (`462455a52`)
>
> 아래 본문은 **중단 시점(HEAD `85511cafc`)의 기록**이다. 재개 후 두 차단을 모두 닫았다:
>
> | 차단 | 처분 |
> |---|---|
> | 1 `waitingNodeType` SoT 상충 | §6.2 행 철회 + WS-owned 4개 목록 복원 (`462455a52`) |
> | 2 REST 이중 순회 미실측 | 실측 완료 — **부호가 갈렸다**(AI payload 0.08×, non-AI 1.91×) |
>
> 게이트: consistency `--impl-done` `21_53_54` **BLOCK: NO** · ai-review `21_54_03`
> **CRITICAL 0**. 상세는 `review/code/2026/08/14/16_44_37/RESOLUTION.md`.
>
> **더 재개할 것이 없다** — 아래 "재개 절차" 는 이미 집행됐다. 남긴 이유는 중단·재개가
> 있었다는 사실과 그때의 측정치가 기록으로서 값을 갖기 때문이다
> (`21_53_54` plan_coherence W1 · `21_54_03` W1 이 두 게이트에서 같은 staleness 를 지적했다).

## 왜 멈췄나

사용자 지시로 **두 게이트 결과가 나온 시점에 중단**했다. push·PR 미수행.
네트워크가 필요한 작업은 **하나도 시작하지 않았다** — 로컬 커밋은 전부 안전하다.

- 브랜치 `claude/eia-terminal-payload`, HEAD `9482cc0c0`
- `origin/main` = `f9d31041d` (중단 시점 기준, 병렬 머지 없음)

## 게이트 현황

| 게이트 | 세션 | 결과 |
|---|---|---|
| 1 ai-review | `review/code/2026/08/14/16_44_37` | CRITICAL 0 / **WARNING 1** — RESOLUTION 필요 |
| 2 consistency `--impl-done` | `review/consistency/2026/08/14/16_44_43` | **BLOCK: YES** — CRITICAL 1 |

두 SUMMARY.md 는 디스크에 기록 완료(main 이 직접 write — sub-agent 는 그 basename 을 못 쓴다).

## 🚫 차단 1 — `waitingNodeType` SoT 상충 (consistency CRITICAL, **내 실수**)

**planner 턴에서 내가 넣은 §6.2 blockquote 행이 틀렸다.** `node.type → waitingNodeType` 을
"위젯/SDK 가 읽는 외부 소비 필드" 로 선언했는데, WS §4.4 는 같은 필드를 "WS 내부 전용,
EIA 밖" 이라 선언한다. 정반대다.

**직접 실측했다** (`grep -rn waitingNodeType codebase/`):

| 소비처 | 결과 |
|---|---|
| `codebase/frontend/src/lib/websocket/use-execution-events.ts:304,350,359` | **읽는다** — 내부 에디터 WS 채널 |
| `codebase/channel-web-chat/**` (외부 위젯, `parseWaitingForInput`) | **0건** |

즉 내 §6.2 주장은 **그 자신이 참조 구현으로 인용한 코드에 반증된다.** 원래의 "WS 소유"
쪽이 코드 실태와 부합한다.

**처분: 체커 권고 (b) 를 택한다** — §6.2 blockquote 에서 `waitingNodeType` 행과
"위젯/SDK 가 읽는다" 서술을 **철회**하고, `waitingNodeLabel`/`nodeExecutionId`/`startedAt`
과 함께 원래의 4개 WS-owned 제외 목록으로 되돌린다. 코드 변경 불요, 설계 의도와 정합.

> (a)안(WS 쪽을 EIA 로 넘김)은 위젯 코드까지 바꿔야 해서 보안 PR 의 범위를 넘는다.

**`spec/` 쓰기는 developer 권한 밖 → planner 턴이 정상 경로다** (우회 금지).

## ⚠️ 차단 2 — REST 경로 이중 순회 미실측 (ai-review WARNING 1)

정당한 지적이고 **같은 교훈의 재발**이다. W1 에서 WS emit 경로는 A/B 로 쟀지만
(`+61ms @6.5MB`), REST `getStatus` 는 이번 변경으로 `deepRedactSecrets` 1회 →
strip+redact **2회**가 됐는데 그 경로를 재지 않았다. **"실측했다" 는 측정한 범위 안에서만
참이다** — 정작 마지막에 바꾼 경로가 범위 밖이었다.

REST 는 요청마다 새 객체라 WS 의 identity 캐시(`SANITIZE_CACHE`/`DEEP_REDACT_CACHE`)
이득도 없다. 오히려 `stripAndRedact` 의 clone-on-write 산출물이 `DEEP_REDACT_CACHE` 를
항상 무력화한다(side_effect INFO 2 — 정확성 버그는 아님).

**재개 시 택일**: ① REST 전용 A/B 측정 후 숫자 병기, 또는 ② 유예하되 근거를 실측으로
남길 것. 유예 근거는 실측해야 한다 — "요청당 1회라 낮다" 는 검증 가능한 주장이다.

## 재개 절차

1. `git fetch origin main` → **병렬 머지 재확인** (중단 동안 머지됐을 수 있다. 델타 0 이면 폐기)
2. **planner 턴**: §6.2 `waitingNodeType` 행 철회 (위 차단 1)
3. ai-review WARNING 1 처리 → `review/code/2026/08/14/16_44_37/RESOLUTION.md` 작성
4. `--impl-done` 재실행 → **BLOCK: NO** 확인
5. 코드가 바뀌었으면 ai-review 한 라운드 더 (게이트 1 은 코드보다 리뷰가 새로워야 한다)
6. 게이트 dry-run:
   ```
   python3 -c "import sys,pathlib; sys.path.insert(0,'.claude/hooks'); from guard_review_before_push import evaluate_review; d=evaluate_review(pathlib.Path('.')); print(d.blocked, d.reason)"
   ```
7. `blocked: False` 면 push → PR (**타이틀에서 `wip(` 접두사 정리**)

## 이 브랜치가 담고 있는 것 (PR 본문 재료)

외부 수신자에게 **raw LLM 프롬프트·대화 이력(`llmCalls`)이 유출되던 보안 결함**을 닫는다.
출구가 셋이었고 세 라운드에 걸쳐 하나씩 발견됐다 — fanout(depth-1 만 제거) → REST
`getStatus` waiting → REST terminal `result`/`error`. 최종적으로 **셋을 한 공용 헬퍼에
묶어** 따로 고쳐질 수 없게 했다.

- `shared/utils/strip-external-only-fields.ts` (신규) + 자체 spec 16 tests
- 깊이 무관·lazy clone-on-write·`__proto__` 안전(스프레드가 실제 방어)
- 백엔드 **423 suites / 8659 passed** · `lint --max-warnings 0` · spec 가드 2928

**이미 전송된 데이터는 회수되지 않는다** — 운영 판단 항목으로
[`spec-draft-eia-62-waiting-payload.md`](./spec-draft-eia-62-waiting-payload.md) 에 등재됨.

## 별건 등재됨 (이 PR 밖)

**WS emit payload 크기 상한 부재** — strip 과 무관한 선존 결함. strip 없이도 6.5MB 에서
39ms. 최대 생산자(DB 쿼리 rows·HTTP 응답 body)가 무제한이고, `ai-turn-executor.ts:2978`
주석에 "outputData JSONB 가 수십 MB 까지 증가" 한 실제 이력이 있다.
