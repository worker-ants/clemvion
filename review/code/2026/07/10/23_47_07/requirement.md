# 요구사항(Requirement) Review — 재검토 (fresh re-review, delta `bd15f63f6`)

## 검토 대상

- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — resume 턴 `llmContext` 명시 타입 주석
  (`LlmCallContext`) + 그 근거를 설명하는 인라인 주석. 본 세션의 delta 는 **이 주석 문구의 정정뿐**
  (런타임/타입 변경 없음).
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — collection-retry
  2번째 chat 호출 attribution 회귀 테스트 1건.
- `review/code/2026/07/10/23_20_30/RESOLUTION.md` — 3-헤더 스키마로 재작성.
- `review/consistency/2026/07/10/23_33_44/**` — 신규 `--impl-done` consistency 산출물.
- 목적: `#501` attribution 불변식(`spec/5-system/4-execution-engine.md` §"resume/retry 턴 usage-log
  attribution — 식별 필드 재유도 불변식")의 회귀 방지 하드닝.

## 핵심 검증 — 정정된 주석의 TypeScript 의미론 실측

orchestrator 지시대로 정정된 주석을 신뢰로 받아들이지 않고 독립 재현했다.

정정 후 주석(`ai-turn-executor.ts:2599-2607`):

> "TS 의 excess-property check 는 object literal 이 타입이 알려진 대상(함수 인자 또는 주석 붙은
> 변수)에 직접 assign 될 때만 걸린다. … 주석 없는 const 에 담으면 대상 타입이 없어 리터럴이 그대로
> 추론되고, 이후 변수로 넘길 땐 freshness 가 사라져 검사되지 않는다."

`typescript@5.9.3 --noEmit --strict` 로 3-케이스를 직접 컴파일해 재현(스크래치패드
`ts-check/test.ts`, 세션에서 실행):

```ts
interface T { a?: string; b?: string; }
function f(x: T) {}

const a: T = { a: '1', c: '2' };   // (a) 주석 붙은 변수 선언 + 직접 리터럴 대입
const b = { a: '1', c: '2' };
f(b);                               // (b) 무주석 const 를 변수로 f 에 전달
f({ a: '1', c: '2' });               // (c) 리터럴을 인자 자리에 직접 전달
```

결과: `(a)` → `TS2353` 발생, `(b)` → **에러 없음**, `(c)` → `TS2353` 발생.

이는 주석이 주장하는 세 가지 판정과 정확히 일치한다 — "타입이 알려진 대상(함수 인자 또는 주석 붙은
변수 선언)에 직접 assign" 될 때만 검사가 걸리고, 무주석 `const` 를 한 번 거치면(변수로 전달되는 시점엔
"fresh" 상태가 아니므로) excess-property check 를 우회한다는 TypeScript 공식 동작(literal freshness)과
동일하다. 실제 코드에서도 `llmContext` 는 정의 직후 바로 함수 인자로 쓰이지 않고 변수로 저장된 뒤
두 곳(`:2623`, `:2765`)에서 참조로만 전달됨을 `grep` 으로 확인 — 정정 전 주석("인자로 직접 넘길 때만")이
설명하지 못했던 "그런데 왜 이 PR 의 타입 주석이 효과가 있는가"를 정정 후 문구가 정확히 메운다.

**결론: 정정된 주석은 TypeScript 의미론적으로 정확하다.** 이전 라운드에서 `--impl-done`
`rationale-continuity` checker 가 지적한 결함(정정 전 문구가 "주석 붙은 변수 선언" 경로를 누락해
이 PR 자체의 효과를 설명 못함)은 실제로 존재했고, 이번 fix 로 해소됐다. 코드/런타임 영향은 없음(주석
텍스트만 변경, `git show bd15f63f6 -- codebase/` 로 재확인 — 우변 표현식·타입 주석 자체는 무변경).

## 전체 diff (`origin/main...HEAD`) 검증

- `git diff origin/main...HEAD --stat` 로 25개 파일 확인 — payload 와 완전 일치, 코드 변경분은 여전히
  2개 파일(`ai-turn-executor.ts` +13/-2, `information-extractor.handler.spec.ts` +48)뿐이고 나머지는
  `review/**` 산출물.
- `ai-turn-executor.ts`: 정정된 주석 외 diff 없음. `LlmCallContext` 를 `type` import, `const llmContext: LlmCallContext = {...}` 타입 주석 — 이전 세션에서 검증된 내용과 동일, 런타임 변경 0.
- `information-extractor.handler.spec.ts`: 신규 `it('passes the same llmContext attribution to the retried
  (2nd) chat call', ...)` — 직전 기존 테스트(`:994`, `feeds tool_result back and loops...`)와 동일한 시나리오
  구조(1차 `orderNumber: null` → retry → 2차 `orderNumber: 'O-99'`)를 재사용하되 attribution 3필드
  override + `mock.calls[0][2]`/`mock.calls[1][2]` 단언을 추가한 것으로 확인. `information-extractor.handler.ts:891-897`
  (`state.executionId ? {...} : undefined`)·`:1019-1145`(`runTurnWithCollectionRetries` 루프가 매 반복 동일
  `params.llmContext` 참조를 `traceChat`(`:1881-1899` 대응부)에 전달)를 직접 읽어 테스트가 실제 코드 흐름과
  1:1 대응함을 재확인. Vacuous 아님.
- `spec/5-system/4-execution-engine.md:1378-1385`(#501 불변식 Rationale), `spec/data-flow/7-llm-usage.md:95,105-106,163,195-199`
  (§1.3 attribution 카탈로그)를 직접 대조 — "현재 이 불변식은 회귀 테스트로만 강제된다"는 spec 서술과
  본 PR 의 방향(테스트 커버리지 확장 + 컴파일 타임 오탈자 가드 추가)이 정확히 일치. 코드가 spec 을
  앞서가거나 뒤처지는 지점 없음 — CRITICAL 없음.

## 발견사항

- **[WARNING]** RESOLUTION.md 의 "durable 등록" 근거 중 하나(task chip)가 그 자신의 커밋 메시지·연계 문서와 모순
  - 위치: `review/code/2026/07/10/23_20_30/RESOLUTION.md:10,26,55` (task chip 참조 3곳, 전부 `task_e03a0b87`)
  - 상세: 본 delta 커밋(`bd15f63f6`)의 메시지는 "task chip 도 교체(e03a0b87 → 33bc64aa)" 라고 명시하고,
    같은 커밋에 동봉된 `review/consistency/2026/07/10/23_33_44/SUMMARY.md:52,59` 도 "durable 등록(task chip
    `task_33bc64aa`)이 명시됐다" / "기존 chip `task_e03a0b87` 은 dismiss, `task_33bc64aa` 로 대체" 라고
    적는다. 그런데 실제로 커밋된 `RESOLUTION.md` 본문(`git show bd15f63f6 -- review/code/2026/07/10/23_20_30/RESOLUTION.md`
    로 확인)은 세 곳 모두 여전히 옛 chip id `task_e03a0b87` 를 인용한다 — chip 교체가 그 자신이 "저장소
    영구 기록"(RESOLUTION.md:55 "본 RESOLUTION.md(저장소 영구 기록)")이라고 부르는 문서에 반영되지
    않았다. RESOLUTION.md 는 W1(plan 체크박스 defer)의 "durable 3중 해소" 근거의 한 축으로 이 chip id 를
    쓰는데, 지금 상태로는 향후 이 문서만 보고 후속 작업을 추적하는 사람이 이미 dismiss 된 chip 을
    쫓게 된다. 순수 문서/프로세스 아티팩트 이슈이며 런타임 코드에는 영향 없다.
  - 제안: `RESOLUTION.md` 의 3개 chip 참조를 `task_33bc64aa` 로 갱신(또는 최소한 "→ 이후 `task_33bc64aa` 로
    교체됨" 각주 추가)하는 별도 소규모 fix. 코드 fix 는 아니고 리뷰 산출물 정합화 항목.

- **[INFO]** 이전 라운드에서 이미 확인된 W1(plan 체크박스 defer)·INFO#3(대칭 커버리지 갭)은 이번 delta 로
  변경되지 않음 — 재확인 결과 여전히 견고
  - 위치: `plan/in-progress/resume-llm-usage-attribution.md`(74-79, 53행), `information-extractor.handler.spec.ts:1027`
  - 상세: `plan_guard.py` 의 `worktree:` frontmatter 불일치(`elastic-shannon-e52824` vs 현재
    `llm-usage-attr-hardening-4648ca`)로 push-gate 는 이 plan 을 "연결된 plan" 으로 인지하지 않음(gate
    우회가 아니라 gate 미작동, 이전 라운드 판정과 동일 — 재확인). INFO#3(역방향 attribution 유지 검증
    부재)도 `runTurnWithCollectionRetries`/`traceChat` 코드 구조상 발생 경로가 없다는 defer 근거를 직접
    코드로 재확인 — 결론 불변.
  - 제안: 없음(기존 defer 유지 타당, 재차 확인만).

- **[INFO]** spec fidelity — line-level 일치, CRITICAL 없음
  - 위치: `spec/5-system/4-execution-engine.md:1378-1385`, `spec/data-flow/7-llm-usage.md §1.3`
  - 상세: 두 spec 문서 모두 "이 불변식은 현재 회귀 테스트로만 강제된다" 고 명시하며, 본 PR 은 그 강제
    수단을 (a) 컴파일 타임 오탈자 가드, (b) 2번째 chat 호출까지 확장된 회귀 테스트로 보강한다. spec
    문구·필드명(`workflowId`/`executionId`/`nodeExecutionId`)·조건 분기(`state.executionId ? {...} :
    undefined`) 모두 코드와 일치. SPEC-DRIFT 도 아니고 코드 결함도 아님.
  - 제안: 없음.

## 요약

이번 delta(`bd15f63f6`)가 정정한 인라인 주석 문구는 TypeScript 의 literal-freshness 기반 excess-property
check 의미론과 정확히 일치함을 3-케이스 독립 컴파일(`tsc --strict`)로 재확인했다 — "함수 인자 또는
주석 붙은 변수 선언에 직접 assign 될 때만 걸리고, 무주석 `const` 를 경유하면 우회된다"는 서술과
`(a)/(b)/(c)` 실측 결과가 완전히 일치한다. `origin/main...HEAD` 전체 diff 도 이전 세션에서 검증된 두
파일(타입 주석 1줄 + import, IE collection-retry 회귀 테스트 1건)에서 실질적으로 변경되지 않았으며,
런타임 동작·spec 정합성(`spec/5-system/4-execution-engine.md` §Rationale, `spec/data-flow/7-llm-usage.md`
§1.3)도 CRITICAL 급 괴리 없이 그대로 유지된다. 유일하게 새로 발견한 사항은 이번 delta 커밋이 스스로
"chip 교체(e03a0b87→33bc64aa)" 를 주장하면서도 실제 커밋된 `RESOLUTION.md`(자칭 "저장소 영구 기록")
본문에는 그 교체가 반영되지 않아 durable-tracking 근거 문서 자체에 사소한 내부 모순이 남은 점이다 —
코드/런타임에 영향 없는 리뷰 산출물 수준의 WARNING 이며 차단 사유는 아니다.

## 위험도

LOW

STATUS: DONE
