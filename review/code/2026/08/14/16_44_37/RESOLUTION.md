# RESOLUTION — `16_44_37` (+ consistency `--impl-done` `16_44_43`)

ai-review **CRITICAL 0 / WARNING 1** — 실측으로 닫았고, **결론이 뒤집혔다**.
consistency **BLOCK: YES / CRITICAL 1** — planner 정정으로 해소.

## ai-review W1 — REST 경로 이중 순회 미실측 (performance)

**지적이 정확했다.** W1 을 "실측 완료" 로 닫으면서 WS emit 경로만 쟀고, **정작 마지막에
바꾼 REST `getStatus`**(`deepRedactSecrets` 1회 → strip+redact 2회)는 측정 범위 밖이었다.
"실측했다" 가 또 측정 범위 안에서만 참이었다 — 이 브랜치에서 두 번째다.

**측정 결과 (before = `deepRedactSecrets` 단독, after = strip+redact):**

| payload | before | after | 배율 |
|---|---|---|---|
| `llmCalls` 없음 24 KB | 0.29 ms | 0.55 ms | 1.90× |
| `llmCalls` 없음 252 KB | 2.97 ms | 5.72 ms | 1.93× |
| `llmCalls` 없음 2.6 MB | 31.1 ms | 59.3 ms | 1.91× |
| **AI 대화 20 KB** | 0.070 ms | 0.017 ms | **0.24×** |
| **AI 대화 202 KB** | 0.706 ms | 0.045 ms | **0.06×** |
| **AI 대화 809 KB** | 2.906 ms | 0.235 ms | **0.08×** |

**부호가 갈린다 — 리뷰어와 나 둘 다 한쪽만 보고 있었다.** `llmCalls` 를 실제로 싣는
payload(= 이 필드가 존재하는 유일한 경우)에서는 **12~16배 빨라졌다**. strip 이 809KB 를
3.7KB 로 줄인 뒤 정규식을 돌리기 때문이다. 느려지는 것은 `llmCalls` 가 **없는** payload
뿐이고, 거기선 strip 이 순수 오버헤드다(1.9배).

덤으로 `stripAndRedact` JSDoc 의 **순서 근거도 실증됐다** — strip 먼저 vs redact 먼저
**75~94% 절감**. 쓸 때는 추론이었고 이제 숫자가 있다. JSDoc 에 병기했다.

**처분: 코드 변경 없음.** REST 는 이 변경으로 AI 경로가 빨라졌고, 느려지는 non-AI 경로는
요청당 1회다. 숫자를 plan·JSDoc 양쪽에 남겨 다음 사람이 재측정 없이 판단하게 한다.

## consistency CRITICAL — `waitingNodeType` SoT 상충 (**내 실수**)

**조치 완료(planner 정정).** 앞선 planner 턴(`4b13ca5ae`)에서 §6.2 blockquote 에
`node.type → waitingNodeType` 을 **"위젯/SDK 가 읽는 외부 소비 필드"** 로 넣었는데,
WS §4.4 는 같은 필드를 "WS 내부 부가 식별자" 로 선언한다. 정반대다.

**체커 주장을 그대로 받지 않고 실측했다** (`grep -rn waitingNodeType codebase/`):

| 소비처 | 결과 |
|---|---|
| `frontend/src/lib/websocket/use-execution-events.ts:304,350,359` | **읽는다** — 내부 에디터 WS 채널 |
| `channel-web-chat/**` (외부 위젯 `parseWaitingForInput`) | **0건** |

즉 내 주장은 **그 자신이 참조 구현(SoT)으로 인용한 코드에 반증된다.** 게다가 WS
Rationale 983 행은 `waitingNodeType` 을 **WS 전용 필드의 대표 예시**로 들고 있다 —
내가 뒤집은 것이 지엽적 항목이 아니라 그 결정의 예시 자체였다.

**체커 권고 (b) 채택** — §6.2 에서 해당 행을 철회하고 4개 WS-owned 목록을 복원했다.
(a)안(WS 쪽을 EIA 로 이관)은 위젯 코드까지 바꿔야 해서 보안 PR 의 범위를 넘는다.

행만 지우면 `node.type` 의 매핑이 사라져 새 공백이 생기므로, **"외부 소비 매핑이 없다 —
외부는 `interactionType` 으로 분기한다"** 를 근거(참조 구현이 안 읽는다는 사실)와 함께
명시했다. 지우기만 하면 다음 사람이 "빠뜨렸나?" 하고 되돌린다.

> **교훈**: planner 턴에서 "매핑표를 완성한다" 는 충동이 **오너십 경계를 넘게 했다.**
> 표를 채우는 것이 목적이 되면, 그 칸이 다른 문서 소유인지 묻지 않는다. WS Rationale 이
> 이미 "3중 복제·재-drift 회피" 를 이유로 경계를 그어 뒀는데 그걸 읽고도 넘었다.

## consistency INFO 1 — `Planned` 표기 불일치 (convention)

**조치 완료.** §6.2 가 `Planned (미구현)`·`Planned 다` 를 쓰는데 같은 문서 §6 표는
`미구현 (Planned)` 로 통일돼 있었다. **내 blockquote 이 "같은 표기" 라고 주장하면서
실제 문자열이 달랐다** — 주장과 사실이 어긋난 자리라 고쳤다. 2곳 통일.

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| ai INFO 2 (`stripAndRedact` 가 `DEEP_REDACT_CACHE` 무력화) | 정확성 버그 아님. 위 실측대로 AI 경로는 캐시 없이도 빨라졌다 |
| ai INFO 3 (`CANCELLED` 시 `error` 미채움) | pre-existing, 이 diff 밖. 별건 planner 검토 |
| ai INFO 7 (인접 `it.each` 튜플 순서 상이) | 각각 정확하고, 순서가 의도임을 주석으로 고정해 뒀다 |
| ai INFO 8 (`sanitizeInner` 는 `__proto__` 방어 없음) | 이 diff 밖. **단, 실재하는 비대칭이다** — 다음에 그 함수를 만질 때 같은 하네스로 회귀 테스트 + 방어 적용 |
| ai INFO 12 (빈 줄 1개 혼입) | 무해 |
| consistency INFO 2 (형제 plan raw line 인용 stale) | 다른 owner. 그 plan 집행 시 본문 텍스트로 재탐색 |

## 검증

- spec 무결성 가드 **20 files / 2932 tests**
- REST A/B·순서 A/B 실측(위 표), 뮤턴트/벤치는 커밋하지 않음
- `waitingNodeType` 소비처 전수 grep
