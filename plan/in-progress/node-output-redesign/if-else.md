# If/Else output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: handler 가 `compileRegexCache` + 공유 `condition-evaluator.util` 로 리팩토링(PR #446 Switch regex no-op 수정·#570 refactor 04 M-3 safe-regex ReDoS 방어)되어 §7 의 핸들러 라인 인용 전부 stale → 현재 값으로 정정. §8 item 2(impl `strictComparison` echo)는 이미 D1(2026-05-17, handler.ts:73-78)로 해소 확인(회귀 없음, 라인 정정). §8 item 1(spec)은 **방향이 역전된 채 잔여** — 이제 handler 는 `strictComparison` 을 echo 하는데 spec §5.1 JSON 예시는 여전히 미표기 → spec example 이 impl 보다 stale. §8 item 3(spec matchedConditions short-circuit 명시)은 spec §4 line 66 이 "모든 conditions[i] 평가" 로 부분 흡수했으나 §5 의 `meta.matchedConditions` 전용 footnote 는 미반영 → 잔여. 새 갭: §7 분석에 regex/`compileRegexCache` 경로 언급 부재(서술 보강).

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 모든 항목이 conventions Principle 0–11 에 부합. (2026-05-16 구현 분석) handler `config` echo 에 `strictComparison` 누락 — spec §5.1 예시는 echo 하지 않지만 schema 정의상 raw echo 대상이라 보강 권고 1건 발생.

> 대상 spec: `spec/4-nodes/1-logic/1-if-else.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/1-if-else.md:70-100` (Case 5.1 — 조건 만족, port `true`):

```json
{
  "config": { "conditions": [...], "combineMode": "and" },
  "output": { "user": { "age": 25, "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "conditionResult": true,
    "matchedConditions": [
      { "index": 0, "field": "user.age", "operator": "gte", "value": 18, "result": true }
    ]
  },
  "port": "true"
}
```

§5.2 의 Case `false` 분기는 `port: "false"` + `meta.conditionResult: false` 만 다르며 `output` 은 동일하게 input pass-through.

## 진단

If/Else 는 분기만 수행하는 **pass-through 노드**이므로 단계가 1개이고, "그 단계가 끝났을 때 채워지는 field" 는 *input 그대로 통과한 결과* 다. 따라서 현 spec 의 `output = input pass-through` 는 **정의에 부합한다**.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input 전체 (pass-through) | 적절 | Logic 공통 Pass-through 규약. 다음 노드가 받을 데이터 = 분기 통과한 값 = input 자체 |
| `meta.conditionResult: boolean` | 적절 (meta) | 실행 메트릭 (Principle 2) — `port` 문자열 비교 없이 boolean 판별용 |
| `meta.matchedConditions: Array` | 적절 (meta) | 디버깅용 per-condition 평가 결과 — 비즈니스 데이터 아님 |
| `meta.durationMs` | 적절 (meta) | engine 공통 주입 |
| `config.conditions` / `config.combineMode` | 적절 (config echo) | Principle 7 raw echo |
| `port: 'true' | 'false'` | 적절 | Principle 5 — 분기 결과 |

부적절한 항목 없음. 다만 다음 미시 점검:

- **`meta.matchedConditions[i]` 의 shape 일관성** — `combineMode='or'` 일 때 단락 평가(short-circuit)가 적용되면 평가되지 않은 조건은 누락되는지 spec 에 명시되지 않음. "단계마다 채워지는 field" 정의에는 영향 없으나 디버깅 진단 누락 가능.
- **`output` 단일 case** — pass-through 이므로 `output` 자체에 분기별 차이가 없다. 후속 노드는 `port` 또는 `meta.conditionResult` 로 분기 판별. spec 이 이미 명시.

## 개선안 — 정리된 output

현 spec 은 conventions 에 부합하므로 **구조 변경 없음**. 다만 다음 미시 보강:

- §5.1 / §5.2 둘 다에서 `meta.matchedConditions` 가 short-circuit 시 어떻게 채워지는지 한 줄 명시 (모두 평가 / 매칭 시점까지만 평가) — "단계마다 채워지는 field" 정의가 흔들리지 않도록.

```json
{
  "config": { "conditions": [...], "combineMode": "and" },
  "output": { /* input 전체 그대로 */ },
  "meta": { "durationMs": <number>, "conditionResult": <boolean>, "matchedConditions": [/* 평가된 항목만 */] },
  "port": "true" | "false"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | 본 노드는 conventions 부합 |

## Rationale

- **pass-through 노드의 단계** = 분기 평가 1단계. 평가 결과는 `port` (라우팅) + `meta.conditionResult` (boolean 진단) 로 분리되어 있어 `output` 에 추가 데이터를 넣을 필요가 없다.
- 옛 PRD 초안에서 검토되었던 `output.view` 판별자 / `output.matchedBranch` 같은 필드는 [Principle 1.1.4](../../../spec/conventions/node-output.md#114-예외--outputview-타입-판별자-패턴은-사용하지-않는다) 에 따라 폐기.
- `output.matchedConditions` 처럼 진단 메트릭을 `output` 에 두는 대안도 검토 가능하나, 비즈니스 로직(다운스트림 노드의 정상 입력)이 아니므로 `meta` 가 정답.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/logic/if-else/{if-else.handler.ts, if-else.schema.ts, if-else.handler.spec.ts, if-else.schema.spec.ts, if-else.component.ts}`. (2026-06-25) handler 는 조건 평가를 공유 헬퍼 `codebase/backend/src/nodes/core/condition-evaluator.util.ts` 의 `evaluateCondition` + `compileRegexCache` 로 위임 (Filter/Transform 와 동일 경로; PR #446 Switch regex no-op 수정 · #570 refactor 04 M-3 safe-regex ReDoS 방어).

1. **spec §5 ↔ handler return 정합성**:
   - `if-else.handler.ts:72-91` 의 return 객체 키 `{ config, output, meta, port }` 가 spec §5.1/§5.2 와 일치 (`status` 없음 — 비-블로킹).
   - ~~**gap**: handler 가 `config` echo 에서 `strictComparison` 을 echo 하지 않는다~~ → (2026-06-25) 해소: handler `config` echo 가 `conditions` / `combineMode` / `strictComparison` 3필드 모두 raw echo (`if-else.handler.ts:73-78`, D1 2026-05-17 주석). schema 정의(`if-else.schema.ts:88-97`)와 Principle 7 raw echo 원칙 부합. 단 **spec §5.1 JSON 예시는 여전히 `strictComparison` 미표기** → 이제 impl 이 spec example 보다 앞서므로 §8 item 1 의 spec 동기화가 잔여 (방향 역전).
   - `output: input` pass-through 는 Logic 공통 §Pass-through 부합 (`:79`).

2. **schema ↔ spec config 정합성**: `ifElseConfigSchema` (`if-else.schema.ts:66-99`) 의 `conditions` / `combineMode` / `strictComparison` 모든 필드가 spec §1 표와 동일 (기본값 `[]` / `'and'` / `false`, `strictComparison` 정의 `:88-97`). default 값 일치 — 변경 없음.

3. **validate 일관성**:
   - `if-else.handler.ts:24-39` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` (warningRules + `validateConfig` SSOT) + `combineMode` / `strictComparison` 두 enum-and-type guard (`:29-37`) 만 추가. SSOT 침범 없음.
   - `warningRules` (`if-else.schema.ts:158-169`) 가 `no-conditions` / `first-condition-field-empty` 를 담당하고, `validateIfElseConfig` (`:116-141`) 가 per-condition field/operator 검증. 명확한 분리 — Spec §6 표와 일치.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만 사용 — runtime `port:'error'` 없음. Spec §6 의 "If/Else는 runtime 에러 포트를 갖지 않는다" 와 일치. 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1 (config ↔ output 직교): `output = input` pass-through 라 config 리터럴 echo 잔재 없음. 부합.
   - Principle 2: `meta.conditionResult` / `meta.matchedConditions` 모두 진단 메트릭 — 비즈니스 데이터 아님. 부합.
   - Principle 5: `port: 'true' | 'false'` 정적 string. 부합.
   - Principle 7: `conditions` / `combineMode` / `strictComparison` 3필드 모두 echo (`if-else.handler.ts:73-78`). (2026-06-25) §1 gap 해소 — `strictComparison` 누락 없음.
   - Principle 8: 이중 중첩 없음.
   - (2026-06-25) regex 평가는 `compileRegexCache` (`if-else.handler.ts:56`) 로 조건별 RegExp 를 1회 컴파일해 `evaluateCondition(input, cond, { strict, regex })` (`:57-59`) 에 전달 — Filter/Transform 와 동일 경로. 컴파일 실패·길이 초과·safe-regex 위험 패턴은 skip → 해당 조건 `false` (spec §6 regex 주의 인용).

6. **handler 테스트 (`if-else.handler.spec.ts`)**:
   - §5.1 / §5.2 / 다양한 operator / `and`/`or` combineMode / `strictComparison` / nested field / rawConfig echo / **regex 동작·invalid 패턴 no-throw** 모두 커버 (`:1-578`).
   - **미세 누락**: `meta.matchedConditions` 가 `or` 모드 단락 평가 없이 모든 조건을 평가한다는 사실은 `:417-455` 테스트에 명시되어 있으나, **`and` 모드에서 첫 조건이 false 일 때도 모든 조건이 평가되는지** 직접 확인하는 테스트 부재. spec 의 §5 footnote 권고 (short-circuit 표기) 가 spec §5 본문에 반영되지 않은 상태 (단 §4 line 66 "모든 conditions[i] 평가" 로 부분 흡수).

7. **횡단 일관성 (분기 4종)**: If/Else 의 `meta.matchedConditions` 는 Switch 의 `meta.matchedCase*` 와 분리된 시멘틱 (전자는 condition 단위, 후자는 case 단위). Filter 의 동시-활성화 패턴과도 분리. 분기 노드 4종 간 일관성 적정.

8. **구현 품질**: dead code / 매직 넘버 없음. `rawConfig ?? config` fallback 패턴 (`if-else.handler.ts:66`) 은 unit-test 가 엔진 없이 실행되도록 의도된 escape hatch.

## 종합 개선안 (2026-05-16)

- [ ] (spec) §5.1 JSON 예시에 `strictComparison` 을 raw echo 로 포함하거나, 반대로 "strictComparison 은 echo 안 함" 을 명시하여 Principle 7 "항상 echo" 원칙과의 모호함 해소. 근거: `if-else.schema.ts:88-97` 에 schema 정의되어 있음 + Principle 7 ("UI 에서 설정한 비민감 값 항상 echo"). **(2026-06-25) 방향 역전 — handler 가 이제 `strictComparison` 을 echo (`if-else.handler.ts:76-77`) 하므로 spec §5.1 JSON 예시(`spec/4-nodes/1-logic/1-if-else.md:79-97`)만 미표기로 남아 impl 보다 stale. spec example 에 `strictComparison` 추가 동기화가 잔여.**
- [x] (impl) `handler.execute` 의 `config` echo 객체에 `strictComparison: rawConfig.strictComparison` 추가 — 위 spec 결정에 따라 echo 한다면. 근거: `if-else.handler.ts:76-77`. — ✅ (2026-06-25) `if-else.handler.ts:73-78` 에서 `conditions`/`combineMode`/`strictComparison` 3필드 모두 echo (D1 2026-05-17 주석). 회귀 없음.
- [ ] (spec) §5 본문 또는 §5.1 footnote 에 "`meta.matchedConditions` 는 단락 평가 없이 모든 조건을 평가한다" 명시 — 현 plan 의 §"진단" 미시 점검 항목을 spec 에 흡수. 근거: `if-else.handler.ts:57-59` 의 `conditions.map((cond, i) => evaluateCondition(...))` 가 short-circuit 없음. **(2026-06-25) spec §4 line 66 이 "모든 conditions[i] 를 evaluateCondition 으로 평가" 로 부분 흡수했으나, §5 의 `meta.matchedConditions` 전용 short-circuit 명시는 미반영 → 잔여.**
