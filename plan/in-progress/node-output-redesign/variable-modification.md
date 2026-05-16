# Variable Modification output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `recordValues` opt-in 정책(D5)이 활성화되고 마스킹 유틸이 적용된 상태.
> 잔여 권고 항목:
> - `config.recordValues` raw echo 추가 (현 spec 에 미명시). 다운스트림이 `meta.modifications[i].before/after` 노출 여부를 판별 가능하게. (2026-05-16 구현 분석) 현 handler 는 `recordValues === true` 일 때만 `config.recordValues: true` 를 echo (`variable-modification.handler.ts:88-92`) — Principle 7 ("항상 echo") 와 일관성 검토 필요. default `false` 도 echo 하거나, "schema default 와 동일하면 echo 생략" 을 spec 본문에 명시하는 두 선택지 중 하나.

> 대상 spec: `spec/4-nodes/1-logic/5-variable-modification.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/5-variable-modification.md:92-113`:

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": "{{ $delta }}" },
      { "variable": "log",     "operation": "append",    "value": " done" }
    ]
  },
  "output": { "user": { "id": 7, "name": "Alice" } },
  "meta": {
    "durationMs": 1,
    "modifications": [
      { "variable": "counter", "operation": "increment", "applied": true },
      { "variable": "log",     "operation": "append",    "applied": true }
    ],
    "coercionWarnings": [],
    "createdVariables": []
  }
}
```

## 진단

Variable Modification 도 **pass-through + side-effect 노드** (단계 1개). variable_declaration 과 동일 패턴.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input pass-through | 적절 | side-effect 는 `context.variables` 에만 발생 |
| `meta.modifications: Array<{variable, operation, applied, before?, after?}>` | 적절 (meta) | 적용된 modification 메트릭 + opt-in 스냅샷 (`recordValues=true` 시만 before/after, 마스킹 적용) |
| `meta.coercionWarnings` | 적절 (meta) | 비-매칭 타입 fallback 가시화 |
| `meta.createdVariables: string[]` | 적절 (meta) | 선언 없이 처음 생성된 변수 (오탈자 감지) |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.modifications` (raw echo) | 적절 | Principle 7 — `value` 의 `{{ }}` 보존 |

부적절 항목 없음.

추가 점검:

- **`config.recordValues` echo** — spec 에 명시되지 않았으나 raw echo 권장. 다운스트림이 `meta.modifications[i].before/after` 의 노출 여부를 알 수 있도록.
- **before/after 마스킹 정책 (variable name secret pattern, 4096 byte cap)** 은 spec §5.1 footnote 에 명시. 수정 불필요.

## 개선안 — 정리된 output

현 spec 거의 부합. 미시 보강:

- `config.recordValues` 도 echo 추가 권장 (현재 명시 없음).

```json
{
  "config": {
    "modifications": [<ModDef>, ...],
    "recordValues"?: <boolean>
  },
  "output": { /* input 전체 pass-through */ },
  "meta": {
    "durationMs": <number>,
    "modifications": [{ "variable": ..., "operation": ..., "applied": <boolean>, "before"?, "after"? }, ...],
    "coercionWarnings": [{ "variable": ..., "operation": ..., "fromType": ..., "error"? }, ...],
    "createdVariables": [<string>, ...]
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- variable_declaration 과 동일 — side-effect 결과는 `$var.<name>` 으로 참조되며 `output` 에 echo 하면 일관성 위반.
- `meta.modifications[i].applied` 는 silent no-op (예: `pop` on non-array) 가시화 — 필수 진단 메트릭.
- `recordValues` opt-in 정책은 (1) 큰 컬렉션 변수의 run log 비대화 방지, (2) PII 보호 — 합리적 default `false`.

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/logic/variable-modification/{variable-modification.handler.ts, variable-modification.schema.ts, variable-modification.handler.spec.ts, variable-modification.schema.spec.ts, variable-modification.component.ts}` 와 `backend/src/nodes/logic/_shared/value-masking.util.ts`.

1. **spec §5 ↔ handler return 정합성**:
   - `variable-modification.handler.ts:88-101` return `{ config: { modifications, recordValues? }, output: input, meta: { modifications, coercionWarnings, createdVariables } }` 가 spec §5.1 와 일치 (`durationMs` 는 engine inject).
   - **gap**: `config.recordValues` 가 `recordValues === true` 일 때만 echo (`:91`) — Principle 7 "항상 echo" 원칙과 미세 불일치. spec §1 에 `recordValues` 가 정의되어 있고 schema default `false` (`schema.ts:82-91`) 이므로 항상 echo 하는 게 일관성 좋다. spec §5.1 JSON 예시도 `recordValues` 누락 → "default 와 동일하면 echo 생략" 패턴인지 spec 명시 필요.
   - `meta.modifications[i]` 의 `before` / `after` 는 `recordValues === true` 에만 추가 (`:227-233`) — spec §5.1 footnote 정합.

2. **schema ↔ spec config 정합성**: `variableModificationNodeConfigSchema` (`variable-modification.schema.ts:61-93`) 의 `modifications` / `recordValues` 모두 spec §1 표와 동일. `modOperationSchema` (`:7-14`) 의 6 operation enum (set/increment/decrement/append/push/pop) 이 spec §1.2 표와 일치.

3. **validate 일관성**:
   - `handler.validate()` (`variable-modification.handler.ts:48-58`) 는 SSOT (`evaluateMetadataBlockingErrors`) + `Array.isArray` guard. operation 화이트리스트는 `validateVariableModificationConfig` (`schema.ts:109-142`) 가 담당 — handler 의 inline VALID_OPERATIONS 는 제거됨 (`:42-43` 의 주석).
   - `warningRules` (`schema.ts:160-171`) 의 `no-modifications` / `first-variable-empty` 와 캔버스 mirror.
   - 잠재적 중복 검출: 없음. handler 의 switch default (`:215-219`) 는 unknown operation 을 silent `applied: false` 로 표기하는 방어 코드 — `validate()` 가 pre-flight 차단해도 raw fixture 대비.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만. runtime `port: 'error'` 없음. spec §6 정합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: pass-through 이므로 `output` 직교 위반 없음.
   - Principle 2: meta 3개 필드 모두 실행 메트릭 — 부합.
   - Principle 5: `port` 미반환 — 단일 출력 부합.
   - Principle 7 (raw echo 갭): `config.modifications` 는 `rawConfig.modifications` echo (`:90`) — `value` 의 `{{ }}` 보존 부합. `config.recordValues` 는 conditional echo — 위 §1 gap 참고.
   - Principle 8: 이중 중첩 없음.
   - Principle 10: 변수 미존재 시 `set`/`increment`/`append`/`push` 가 fallback 으로 새 변수 생성 (`:124, 138, 149, 161, 179, 195`) → silent create. `coercionWarnings` 는 명시적 fallback 분기에서만 기록 — 미존재 케이스는 `createdVariables` 로 분리 (적절).

6. **handler 테스트 (`variable-modification.handler.spec.ts`)**:
   - validate (10 case) / execute per operation (6 op × 다양 분기) / rawConfig echo (1 case) / meta metrics + recordValues opt-in (D5) 4 sub-case 모두 커버 (`:23-691`).
   - `recordValues` 케이스: `omits before/after by default` / `records masked before/after` / `secret pattern → '***'` / `pre-mutation snapshot for push` / `oversized → truncated` 5 케이스 직접 커버 (`:573-690`).
   - **미세 누락**: spec §5.1 footnote 의 마스킹 분기 4종 중 (3) "함수/심볼 → `'[unsupported:...]'`" 케이스는 직접 테스트 부재. value-masking.util 본체 spec 으로 위임됐을 가능성 — 분리 검토 권고.
   - **미세 누락**: `recordValues: false` 인데 그래도 echo 되는지 (Principle 7 일관성 측면) 테스트 없음. 위 §1 gap 의 spec/impl 결정에 따라 보강.

7. **횡단 일관성 (Logic side-effect pass-through 2종)**: variable_modification 의 `meta.createdVariables` 가 variable_declaration `meta.declared` 와 시멘틱 분리 — modification 측은 "선언 없이 implicit 생성" 만 표기, declaration 측은 "명시적 declared" 표기. 분리 적절. 두 노드 모두 `coercionWarnings` 메트릭 공유 (단 shape 다름: declaration 측 `attemptedType`, modification 측 `fromType`) — 시멘틱 차이 (변환 대상 vs 현재 값 타입) 로 일관성 적절.

8. **구현 품질**:
   - in-place mutation (push/pop) 의 위험은 spec §1.2 에 명시 + `beforeSnapshot` 을 mutation 이전에 캡쳐 (`:130-132`) — masking 유틸이 deep clone 으로 처리 (spec test `:647-668` 확인).
   - default value handling: `Number(mod.value ?? 1)` 로 `null` 값을 `1` 로 fallback (`:151`). `Number(null) === 0` 가 아니라 `?? 1` 이 먼저 적용되므로 의도된 default `+1`/`-1`. dead code 없음.
   - `Object.hasOwn` 사용으로 `'__proto__'` 같은 prototype key 안전 (`:124`).

## 종합 개선안 (2026-05-16)

- [ ] (spec) §1 의 `recordValues` 필드와 §5.1 JSON 예시·필드 표에 `config.recordValues` 의 echo 정책 명시 — "항상 echo" (Principle 7 일관) 또는 "true 일 때만 echo" 중 하나. 근거: `variable-modification.handler.ts:88-92` 의 conditional spread 가 Principle 7 와 미세 충돌.
- [ ] (impl) 위 spec 결정에 따라 `handler.execute` 의 config echo 객체에서 `recordValues` 항상 echo 또는 spec 의도 명시. 근거: `variable-modification.handler.ts:88-92`.
- [ ] (impl) `handler.spec.ts` 에 `recordValues: false` 일 때 `config.recordValues` 가 echo 되는지/되지 않는지 명시 케이스 추가. 근거: spec/impl 결정에 따른 보강.
