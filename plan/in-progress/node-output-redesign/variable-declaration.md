# Variable Declaration output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. side-effect 결과는 `$var.<name>` 로 참조되고 `output` 은 input pass-through — 일관성 유지. (2026-05-16 구현 분석) handler / schema / spec 5필드 envelope 정합. 미시 누락은 §"종합 개선안" 표에 정리 — spec §5.1 에 명시된 `port: undefined` 가 handler return 객체에 명시적으로 포함되지 않는 정도가 유일한 표기 차이.

> 대상 spec: `spec/4-nodes/1-logic/4-variable-declaration.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/4-variable-declaration.md:88-107` — §5.1 단일 출력:

```json
{
  "config": { "variables": [{...}, {...}, {...}] },
  "output": { "user": { "id": "u-1", "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "declared": ["counter", "users", "today"],
    "skipped": [],
    "coercionWarnings": []
  }
}
```

## 진단

Variable Declaration 은 **pass-through + side-effect 노드** (단계 1개). 변수 등록은 `context.variables` 에 side-effect 로 일어나고, 다음 노드가 받는 데이터는 input 그대로. "단계마다 채워지는 field" = input pass-through.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input pass-through | 적절 | Logic 공통 §10. side-effect 는 `context.variables` 에만 발생 |
| `meta.declared: string[]` | 적절 (meta) | 신규 등록된 변수 이름 — 진단 메트릭 (skip-if-exists 동작 가시화) |
| `meta.skipped: string[]` | 적절 (meta) | 이미 존재해 skip 된 변수 — 의도된 초기화 누락 감지 |
| `meta.coercionWarnings` | 적절 (meta) | silent null fallback 가시화 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.variables` (raw echo) | 적절 | `defaultValue` 의 `{{ }}` 보존 (Principle 7) |
| `port`: undefined (단일 출력) | 적절 | Principle 5 |

부적절 항목 없음.

추가 점검:

- **`output` 에 등록된 변수 값 echo 안 함** — spec 이 의도적. 후속 노드는 `$var.<name>` 으로 참조 — 이는 conventions Principle 1.1 직교성에 부합 (variables 저장소는 별도 컨텍스트, `output` 으로 echo 하면 직교 위반).
- **`meta.declared` / `meta.skipped` / `meta.coercionWarnings` 의 cardinality** — 변수 정의 수가 매우 많을 때 (100+) 어떻게 표시할지 spec 에 명시 없음. 현 시점 cap 도입 불필요, 변경 없음.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": { "variables": [<VarDef>, ...] },
  "output": { /* input 전체 pass-through */ },
  "meta": {
    "durationMs": <number>,
    "declared": [<string>, ...],
    "skipped": [<string>, ...],
    "coercionWarnings": [{ "name": ..., "attemptedType": ..., "error"? }, ...]
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- side-effect 노드의 핵심 동작 (변수 등록) 은 `context.variables` 에 저장되고 `$var.<name>` 으로 참조되는 워크플로우 전역 상태이지, 본 노드의 output 이 아니다.
- `output` 에 변수 값을 echo 하면: (1) `$var.<name>` 와 의미 중복, (2) 같은 워크플로우 안에서 변수가 modify 되면 `$node["X"].output.<var>` 와 `$var.<var>` 가 어긋나 혼란 발생. 둘 다 회피.
- 변경 가시성은 `meta.declared` / `meta.skipped` 로 충분.

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/logic/variable-declaration/{variable-declaration.handler.ts, variable-declaration.schema.ts, variable-declaration.handler.spec.ts, variable-declaration.schema.spec.ts, variable-declaration.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - `variable-declaration.handler.ts:81-89` 의 return `{ config: { variables }, output: input, meta: { declared, skipped, coercionWarnings } }` 가 spec §5.1 JSON 예시와 키·shape 모두 일치 (`port` / `status` 생략 — 단일 출력 / 비-블로킹).
   - `output: input` (변형 없는 reference) — Logic 공통 §10 Pass-through 부합.
   - `meta.durationMs` 는 engine 에서 공통 주입되므로 handler 가 직접 추가하지 않음 (spec §5.1 의 "engine inject" 와 정합).

2. **schema ↔ spec config 정합성**: `variableDeclarationNodeConfigSchema` (`variable-declaration.schema.ts:53-66`) 의 `variables: z.array(varDefSchema).default([])` 와 `varDefSchema` (`:7-30`) 의 `name` / `type` / `defaultValue` 필드가 spec §1 표와 동일. `type` enum (`string`/`number`/`boolean`/`array`/`object`) 일치. default `''`/`'string'` 정합.

3. **validate 일관성**:
   - `handler.validate()` (`variable-declaration.handler.ts:24-34`) 는 `evaluateMetadataBlockingErrors` SSOT (warningRules + validateConfig) 위에 `Array.isArray(variables)` 단일 type guard 만 추가.
   - `warningRules` (`variable-declaration.schema.ts:115-126`) 가 `no-variables` / `first-variable-name-empty` 를 담당 → 캔버스 배지와 mirror.
   - `validateVariableDeclarationConfig` (`:81-99`) 는 per-variable `name` / `type` 의 array iteration 검사. SSOT 분리 명확.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만 사용 — runtime `port: 'error'` 없음. spec §6 의 "Variable Declaration 은 runtime 에러 포트를 갖지 않는다" 와 일치.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1 (config ↔ output 직교): pass-through 이므로 config 리터럴 echo 잔재 없음. `context.variables` 에만 side-effect 발생 → conventions 부합.
   - Principle 2: `meta.declared` / `meta.skipped` / `meta.coercionWarnings` 모두 실행 메트릭 — Principle 2 부합.
   - Principle 5: `port` 미반환 — 단일 출력 부합.
   - Principle 7: `config.variables` 가 `context.rawConfig.variables` 를 echo (`:79-82`) — `defaultValue` 의 `{{ }}` 보존 부합.
   - Principle 8: 이중 중첩 없음.
   - Principle 10: `defaultValue ?? null` (`:59`) — `undefined` / `null` 입력을 silent `null` 저장으로 fallback. spec §1 표 일치 (silent fallback 의도).

6. **handler 테스트 (`variable-declaration.handler.spec.ts`)**:
   - validate (5 case) / execute (10 case) / rawConfig echo (1 case) / meta observability (4 case) 모두 커버 (`:23-347`).
   - §5.1 의 모든 meta 필드 (`declared` / `skipped` / `coercionWarnings`) 가 `meta observability` 블록(`:269-347`) 에서 정상/skip/fail 분기로 직접 검증됨.
   - **미세 누락**: spec §1 `coerceToType` 표의 "문자열 → array/object → JSON.parse 실패 시 null + coercionWarnings 기록" 케이스가 `coercionWarnings` 관점에서 명시적으로 spec 화되어 있으나 테스트는 `number` mismatch (`:309-332`) 만 검증 — `type='array'` + `defaultValue='not-json'` 케이스가 `coercionWarnings` 에 기록되는지 직접 케이스 부재.

7. **횡단 일관성 (Logic side-effect pass-through 2종)**: variable_declaration `meta.declared/skipped/coercionWarnings` 와 variable_modification `meta.modifications/coercionWarnings/createdVariables` 가 모두 array-based 메트릭 — 시멘틱 정합. `createdVariables` 는 modification 측의 "선언 없이 처음 생성" 시 가시화, `declared` 는 declaration 측의 "신규 등록" 시 가시화. 두 노드 패턴 일관.

8. **구현 품질**:
   - `coerceToType` 결과 null 인데 raw 가 null 아님 검사 (`:67`) → `coercionWarnings` 합리적.
   - dead code 없음. `executionMetadata.kind: 'standard'` (`schema.ts:108`) 일치.

## 종합 개선안 (2026-05-16)

- [ ] (impl) `handler.handler.spec.ts` 에 `type='array' + defaultValue='not-json'` 케이스 추가 — `coercionWarnings` 가 `array` 실패도 잡는지 명시적으로 검증. 근거: `variable-declaration.handler.ts:60-73` 의 generic coercion path 가 array/object JSON 실패도 동일 흐름이지만, 테스트는 `number` 만 커버 (`:309-332`).
