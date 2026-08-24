# RESOLUTION — `12_13_36` (`--impl-done spec/conventions/`, BLOCK: YES)

CRITICAL 1 · WARNING 1 · INFO 3. **전부 처리**했다.

## CRITICAL 1 — **같은 파일 안에서** 미러를 놓쳤다

`12_02_30` W1 을 받고 `chat-channel-adapter.md` 의 §1.3 JSDoc 을 고쳤는데,
**같은 파일 §3 매핑표(line 382)에 같은 주장이 하나 더 있었다** — `template`: `output.rendered`.

이번 세션이 미러 스윕을 놓친 것이 **세 번째**이고, 매번 이유가 달랐다:

| 라운드 | 놓친 이유 |
|---|---|
| `#1208` `23_56_18` | 문서 셋만 세고 **코드 주석 둘**을 안 셌다 (세는 대상의 종류) |
| `#1208` `00_16_59` | 조사 한 글자(`은`/`이`)로 grep 이 비켰다 (매칭 방식) |
| **이번 `12_13_36`** | **같은 파일 안의 다른 절**을 안 봤다 (스윕 단위) |

앞의 둘을 고치고 나서도 이번 것이 남은 이유는 분명하다 — **파일을 이미 열어 고쳤으니
"그 파일은 처리됐다" 고 셌다.** 스윕 단위를 파일로 잡으면 파일 내부가 사각지대가 된다.
이번엔 고친 뒤 **그 파일 전체에 `grep 'output.rendered'`** 를 다시 돌려 남은 히트가
정정문 안의 인용 1건뿐임을 확인했다.

### 권한 — checker 의 라우팅에 동의하되, 그 planner 턴이 이 PR 안에 있다

checker 는 *"이 문장은 2026-06-04 작성이라 자기-반증형 소정정 조건 1 불충족 → planner 관할"*
이라 판정했다. **맞다.** 다만 그 결론이 이 PR 을 막지는 않는다 — `chat-channel-adapter.md` 는
`12_02_30` 처분 때 이미 `spec_impact` 에 **planner 턴 항목으로**(자기-반증형 예외 대상이
아님을 주석에 명시하고) 올려 뒀고, 이 정정은 그 턴의 연장이다. `10_44_28` 에서 확립한
구분 — **예외는 `conversation-thread.md` 한 파일, 나머지는 planner 턴** — 이 그대로 적용된다.

## WARNING 1 (plan_coherence) — 게이트 실행 증거 미인용

정확하다. plan 이 이 라운드 **시작 전에** 이미 `complete/` 로 확정돼 있어 체크리스트에
게이트 ID 가 없었다. 선례(`sse-nodeoutput-allowlist` 의 `00_26_17` 인용)대로 소급 기록했다 —
`12_02_30`(5-system, BLOCK: NO) · `12_13_36`(conventions, BLOCK: YES → 정정) ·
`12_37_04`(재실행) 셋을 한 항목으로 묶었다.

## INFO 1 — provider spec 3곳: **단정하지 않고 등재했다**

checker 가 *"함수 시그니처 확인 없이는 단정 불가"* 라 적었고 그 말이 맞다. 확인한 것은
`extractRendered` 가 `rendered` → `payload.rendered` → `output.rendered` **세 후보를 훑는다**
는 것뿐이다 — 즉 **동작은 어느 shape 이든 맞다**.

남은 질문은 그 문장이 *"노드가 무엇을 만드나"* 를 말하는가, *"렌더러가 어디서 읽나"* 를
말하는가다. 전자면 현행이 맞고 후자면 한 겹 얕다. **표의 다른 행들과 함께 봐야 갈리므로**
`spec/4-nodes/7-trigger/providers/` 스코프의 planner 턴으로 트래커에 등재했다 —
이 PR 의 `spec_impact` 밖이고, 여기서 셋을 그냥 고치면 **반대 방향으로 틀릴 수 있다**
(같은 라운드에서 `5-template.md` 등을 안 고친 것과 같은 판단).

## INFO 2·3

- **#2** (`narrowTopLevelNodeOutput` 명명 충돌 없음) · **#3** (§R17 재정정이 모범 사례) —
  조치 불요, 확인 기록.
