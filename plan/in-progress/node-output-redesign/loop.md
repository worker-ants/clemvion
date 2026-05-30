# Loop output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `breakCondition` 평가 + `meta.exitReason` (D2) 이 활성화되어 컨테이너 컨트랙트 (Principle 9) 가 일관되게 적용된 상태. (2026-05-16 구현 분석) handler 본체는 부합하나, schema `loopNodeOutputSchema` 의 `config.count` 타입 (`z.number()`) 이 spec / handler 가 raw string echo 를 보존하는 정의 (`number | string`) 와 미세 불일치 — schema 보강 권고 1건.

> 대상 spec: `spec/4-nodes/1-logic/3-loop.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/3-loop.md:91-99` — §5.1 시작 시점 (핸들러 반환):

```json
{ "config": { "count": "10", "maxIterations": 1000 }, "output": null }
```

`spec/4-nodes/1-logic/3-loop.md:113-141` — §5.2 완료 시점 (`done` 포트, 엔진 오버라이트 후):

```json
{
  "config": { "count": "10", "maxIterations": 1000 },
  "output": {
    "iterations": ["body emit result 0", "body emit result 1", "body emit result 2"]
  },
  "meta": {
    "iterations": 3,
    "maxIterationsReached": false,
    "exitReason": "completed",
    "durationMs": <number>
  }
}
```

## 진단

Loop 은 **컨테이너 노드**로 두 단계가 명확하다 — (1) 시작(body 진입 직전) / (2) 완료(`done` 포트). 각 단계의 `output` 이 **단계마다 채워지는 field** 정의에 부합:

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 | `output: null` | 적절 — 엔진 오버라이트 시그널 (Principle 9.1). 다운스트림에 노출되지 않는 internal 상태 |
| 반복 중 | (외부 관측 안 됨) | 적절 — body 노드들이 자체 output 을 가짐 |
| 완료 | `output: { iterations: unknown[] }` | 적절 — 엔진이 collected emit 결과를 컬렉션 키 `iterations` 로 오버라이트 (Principle 9.2) |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output.iterations` | 적절 (output) | 각 반복의 emit 출력 = 비즈니스 결과 (다운스트림이 그대로 사용) |
| `meta.iterations` (number) | 적절 (meta) | `output.iterations.length` 의 메트릭 미러 (Principle 2). 직교성 유지 |
| `meta.maxIterationsReached` | 적절 (meta) | 종료 진단 boolean |
| `meta.exitReason` | 적절 (meta) | 종료 사유 enum (`completed` / `break` / `maxIterations`) |
| `meta.durationMs` | 적절 | engine 공통 주입 |
| `config.count`, `config.maxIterations` (raw echo) | 적절 | Principle 7 |

부적절 항목 없음. spec 본문이 이미 conventions 와 정합.

추가 점검:

- **`config.breakCondition` echo 부재** — spec 이 의도적으로 echo 안 함 (§5.1 footnote: "다운스트림이 raw 표현식을 다시 평가할 일 없음"). 합리적이며 Principle 7 의 "선택적 echo" 원칙 안에 들어감.
- **`output.iterations` 와 `meta.iterations` 동일 값 분리** — spec §5.2 의 footnote 가 "결과 배열 vs 메트릭 축 분리" 로 정당화. 직교성 유지를 위해 둘 다 유지하는 것은 conventions Principle 1.1 / 2 합산 결정.
- **`output.count` 추가 제안 검토 → 폐기** — spec footnote: "`output.iterations.length` 가 SSOT". 현 정의 유지.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

**시작 단계:**
```json
{ "config": { "count": <raw>, "maxIterations": <number> }, "output": null }
```

**완료 단계 (엔진 오버라이트 후):**
```json
{
  "config": { "count": <raw>, "maxIterations": <number> },
  "output": { "iterations": [<emit>, ...] },
  "meta": {
    "iterations": <number>,
    "maxIterationsReached": <boolean>,
    "exitReason": "completed" | "break" | "maxIterations",
    "durationMs": <number>
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- 컨테이너 노드의 두 단계는 spec 이 §5.1 / §5.2 / §5.7 로 명시 분리. Principle 9 컨트랙트 (`output: null` → engine override) 가 `iterations` 컬렉션 키와 함께 작동.
- `output.count` 비포함은 Principle 1.1 직교 (`config.count` 와 중복 방지). 조기 종료 시 `output.iterations.length` ≠ `config.count` 인 케이스가 있어 동등성도 깨짐.
- 옛 PRD 초안의 `output.completedIterations` / `output.lastResult` 같은 필드 제안은 `iterations` 배열로 흡수 가능하므로 폐기.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/logic/loop/{loop.handler.ts, loop.schema.ts, loop.handler.spec.ts, loop.schema.spec.ts, loop.component.ts}`. 엔진 측 오버라이트 로직 (`LoopExecutor` / `meta.exitReason` 채움)은 본 노드 디렉토리 밖이므로 read-only 로 가정.

1. **spec §5 ↔ handler return 정합성**:
   - `loop.handler.ts:39-45` 의 return `{ config: { count, maxIterations }, output: null }` 가 spec §5.1 (시작 시점) 과 일치. `breakCondition` 미echo 는 spec §5.1 footnote 의 의도된 결정과 부합.
   - 완료 시점 `output: { iterations, count }` + `meta.{iterations, maxIterationsReached, exitReason}` 는 엔진이 오버라이트하므로 handler 단위에서는 책임 없음 — Principle 9.1 컨트랙트 (`output: null` 시그널) 만 충족.

2. **schema (Zod) ↔ spec config 정합성**:
   - `loopNodeConfigSchema` (`loop.schema.ts:28-64`) 의 `count` 가 `z.string().default('1')` — spec §1 의 "Expression | Integer" 와 일치 (number 도 string 으로 직렬화되어 들어옴, validate 가 parse). `maxIterations` 가 `z.number().int().default(1000)`, `breakCondition` 이 `z.string().optional()` — spec §1 표와 일치.
   - **gap**: `loopNodeOutputSchema.config.count` 는 `z.number().optional()` (`loop.schema.ts:18`) 로 정의되어 있으나, handler 는 raw string `'10'` 또는 `'{{ ... }}'` 를 그대로 echo 한다 (`loop.handler.ts:41`). 즉 outputSchema 가 실제 출력 형태를 너무 좁게 정의 — runtime 에서 `z.number().optional()` 로 parse 시 string 이 떨어진다. outputSchema 가 호출되는 경로 (debugger/inspector 등) 가 있다면 잠재 회귀.

3. **validate 일관성**:
   - `handler.validate()` (`loop.handler.ts:20-25`) 는 `evaluateMetadataBlockingErrors` 만 호출 — warningRules + `validateLoopConfig` 의 SSOT 로 위임. 깨끗.
   - `validateLoopConfig` (`loop.schema.ts:99-136`) 가 `count` numeric/expression 분기 + cross-field `count ≤ maxIterations` 담당. 명확한 분리.

4. **에러 컨트랙트 (Principle 3)**:
   - pre-flight throw (count 누락 / 파싱 실패 / cross-field) + 엔진 런타임 throw (`MAX_ITERATIONS_EXCEEDED`, `CONTAINER_MISSING_EMIT`, `CONTAINER_MULTIPLE_EMIT`) 만 사용. spec §6 와 일치. runtime `port:'error'` 없음 — 컨테이너 노드 컨트랙트 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `output.count` 미제공 (spec §5.2 footnote) — `config.count` 와 직교. 부합.
   - Principle 2: `meta.iterations` / `maxIterationsReached` / `exitReason` 모두 메트릭. 부합.
   - Principle 7: `rawConfig.count` echo (`loop.handler.ts:41`) — Principle 7 정합. `breakCondition` 미echo 는 spec §5.1 footnote 의 의도적 결정.
   - Principle 9: `output: null` → 엔진 `{ iterations, count }` 오버라이트 컨트랙트 활성화. 부합.

6. **handler 테스트 (`loop.handler.spec.ts`)**:
   - count numeric / string / expression / 누락 / 음수 / `count > maxIterations` / numeric maxIterations / rawConfig echo / output: null 모두 커버 (`:1-115`).
   - **미세 누락**: 엔진 오버라이트 결과 (`output.iterations` / `meta.exitReason`) 의 통합 테스트는 본 spec 디렉토리에 없음 — 엔진 통합 테스트가 `codebase/backend/src/execution-engine/*` 또는 `codebase/backend/test/` 에 있을 것 (read-only 가정으로 미확인).

7. **횡단 일관성 (컨테이너 4종)**:
   - Loop / Map / ForEach / Parallel 모두 `output: null` → 엔진 오버라이트 컨트랙트. Loop 의 컬렉션 키는 `iterations` 로 README 잔여 권고 표의 Parallel `done` 시점 meta 누락과 대조되어 양호.
   - `meta.exitReason` enum (`completed | break | maxIterations`) 은 Loop 전용 — 다른 컨테이너에는 해당 없음. 카테고리 일관성 유지.

8. **구현 품질**:
   - `DEFAULT_MAX_ITERATIONS = 1000` (`loop.handler.ts:15`) 는 spec §1 default 와 일치 (매직 넘버 아닌 명명 상수).
   - `rawConfig ?? config` fallback (`:38`) — 다른 logic 핸들러들과 일관된 escape hatch 패턴.
   - `loopLooksLikeExpression` (`loop.schema.ts:96-98`) 의 regex `/\{\{.*\}\}/` 는 greedy — 다중 expression 토큰이 한 줄에 있어도 매칭. 의도된 동작.

## 종합 개선안 (2026-05-16)

- [x] (impl) `loop.schema.ts:14-21` 의 `loopNodeOutputSchema.config.count` 를 `z.union([z.string(), z.number()]).optional()` 로 확장 — handler 가 raw string 을 echo 하므로 outputSchema 가 runtime 출력을 통과시켜야 함. 근거: `loop.handler.ts:41` 가 `rawConfig.count` (string) 를 그대로 echo + `loop.handler.spec.ts:87` 가 `count: '10'` 기대.
- [ ] (impl) `loop.handler.spec.ts` 또는 새 통합 테스트에 엔진 오버라이트 결과 (`output.iterations` / `meta.exitReason`) 를 직접 검증하는 케이스 추가 — 현재 handler 단위 테스트는 `output: null` 만 확인. 근거: spec §5.2 의 다운스트림이 보는 출력 형태가 가드되지 않음.
- [ ] (spec) §5.1 footnote 의 `breakCondition` 미echo 결정과, `loopNodeConfigSchema` 의 `breakCondition: z.string().optional()` 존재가 호환됨을 명시 — Principle 7 의 "선택적 echo" 항목에 안 들어있어 모호. 근거: `spec/conventions/node-output.md` 의 Principle 7 "선택적 echo" 표는 form.fields / ai_agent.systemPrompt 만 언급.
