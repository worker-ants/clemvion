# Variable Modification output 개선안

> **7차 갱신 (2026-07-11, `variables.__*` 예약 강제 PR)**: `reserved-variable-name.util` import 와 `validateConfig` 의 `__` reject else-if, handler 루프의 L2 가드가 삽입돼 아래 6차 갱신의 라인 인용이 다시 밀렸다. 현재 실제 위치: `schema.ts` — `variableModificationNodeConfigSchema`:65, `validateVariableModificationConfig`:115, `warningRules`:170. `handler.ts` — `execute`:67(**이 PR 에서 async 로 전환** — L2 예약 가드 throw 를 rejection 으로). 이 노드에 L1(schema)·L2(handler, 6개 연산 전 분기 앞) 예약 가드가 추가됐다(§6 강제, execution-context 원칙 5). 나머지 잔여 2건(recordValues echo spec/test)은 이 PR 과 무관하게 유지.
>
> **6차 갱신 (2026-06-25 코드 재검증)**: 핸들러 분할 없음 (단일 `variable-modification.handler.ts` 유지). §8 impl 항목 [x] (recordValues 항상 echo) 회귀 없이 성립 — D1 explicit-enumeration 리팩토링이 `recordValues: rawConfig.recordValues` 를 무조건 echo (`handler.ts:88-92`, D1 주석 `:83-85`, PR D1 configEcho commit c10383fc). §7.1 의 "`recordValues === true` 일 때만 echo (`:91`)" gap 서술은 이제 **무효(CHANGED)** — 무조건 echo 로 전환됨. 잔여 2건: (1) spec §5.1 config 표·JSON 예시에 `config.recordValues` echo 필드 미기재 (handler 가 echo 하는데 spec 예시는 누락 → 오히려 spec 이 stale), (2) `handler.spec.ts` 에 `recordValues` 미지정/false 시 `config.recordValues` echo 여부 명시 테스트 부재 (default 케이스 `:574-597` 는 `meta` 만 검증, `config.recordValues` assert 없음). §7 stale 라인 정정: schema config `:61-93`→`:61-95`, validateConfig `:109-142`→`:111-144`, warningRules `:160-171`→`:162-173`, test 범위 `:23-691`→`:23-693`, Principle 10 create 라인 정정. §7.6 의 "마스킹 secret 패턴 직접 테스트 부재" 는 이미 해소 (`:626-645` 존재).

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

대상 파일: `codebase/backend/src/nodes/logic/variable-modification/{variable-modification.handler.ts, variable-modification.schema.ts, variable-modification.handler.spec.ts, variable-modification.schema.spec.ts, variable-modification.component.ts}` 와 `codebase/backend/src/nodes/logic/_shared/value-masking.util.ts`.

1. **spec §5 ↔ handler return 정합성**:
   - `variable-modification.handler.ts:88-101` return `{ config: { modifications, recordValues }, output: input, meta: { modifications, coercionWarnings, createdVariables } }` 가 spec §5.1 와 일치 (`durationMs` 는 engine inject).
   - ~~**gap**: `config.recordValues` 가 `recordValues === true` 일 때만 echo (`:91`) — Principle 7 "항상 echo" 원칙과 미세 불일치.~~ → (2026-06-25) **CHANGED**: D1 explicit-enumeration 리팩토링으로 `config.recordValues: rawConfig.recordValues` 를 **무조건 echo** 한다 (`handler.ts:88-92`, D1 baseline 주석 `:83-85`, PR D1 configEcho commit c10383fc). 이제 Principle 7 와 정합. 단 **잔여 spec gap**: spec §5.1 config 표(`:126-135`) 와 JSON 예시(`:107-112`) 는 여전히 `config.recordValues` 를 기재하지 않는다 → 이제 **handler 가 echo 하는데 spec 예시는 누락**된 역방향 drift. §8 spec 항목 참조.
   - `meta.modifications[i]` 의 `before` / `after` 는 `recordValues === true` 에만 추가 (`:227-233`) — spec §5.1 footnote 정합.

2. **schema ↔ spec config 정합성**: `variableModificationNodeConfigSchema` (`variable-modification.schema.ts:61-95`) 의 `modifications` / `recordValues` 모두 spec §1 표와 동일. `modOperationSchema` (`:7-14`) 의 6 operation enum (set/increment/decrement/append/push/pop) 이 spec §1.2 표와 일치.

3. **validate 일관성**:
   - `handler.validate()` (`variable-modification.handler.ts:48-58`) 는 SSOT (`evaluateMetadataBlockingErrors`) + `Array.isArray` guard. operation 화이트리스트는 `validateVariableModificationConfig` (`schema.ts:111-144`) 가 담당 — handler 의 inline VALID_OPERATIONS 는 제거됨 (`:42-43` 의 주석).
   - `warningRules` (`schema.ts:162-173`) 의 `no-modifications` / `first-variable-empty` 와 캔버스 mirror.
   - 잠재적 중복 검출: 없음. handler 의 switch default (`:215-219`) 는 unknown operation 을 silent `applied: false` 로 표기하는 방어 코드 — `validate()` 가 pre-flight 차단해도 raw fixture 대비.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만. runtime `port: 'error'` 없음. spec §6 정합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: pass-through 이므로 `output` 직교 위반 없음.
   - Principle 2: meta 3개 필드 모두 실행 메트릭 — 부합.
   - Principle 5: `port` 미반환 — 단일 출력 부합.
   - Principle 7 (raw echo 갭): `config.modifications` 는 `rawConfig.modifications` echo (`:90`), `config.recordValues` 는 `rawConfig.recordValues` echo (`:91`) — 둘 다 무조건 echo 로 Principle 7 정합 (위 §1 CHANGED 참고). `value` 의 `{{ }}` 보존 부합.
   - Principle 8: 이중 중첩 없음.
   - Principle 10: 변수 미존재 시 `set`/`increment`/`decrement`/`append`/`push` 가 fallback 으로 새 변수 생성 (`createdNew = true` 분기 `:138, 149, 161, 179, 195`) → silent create. `coercionWarnings` 는 명시적 fallback 분기에서만 기록 — 미존재 케이스는 `createdVariables` 로 분리 (적절).

6. **handler 테스트 (`variable-modification.handler.spec.ts`)**:
   - validate (10 case) / execute per operation (6 op × 다양 분기) / rawConfig echo (1 case) / meta metrics + recordValues opt-in (D5) 5 sub-case 모두 커버 (`:23-693`).
   - `recordValues` 케이스: `omits before/after by default` (`:574-597`) / `records masked before/after when recordValues=true` (`:599-624`, `config.recordValues===true` assert `:616`) / `masks secret-named → '***'` (`:626-645`) / `pre-mutation snapshot for push` (`:647-668`) / `oversized → truncated` (`:670-690`) 5 케이스 직접 커버 (`:573-691`).
   - **미세 누락**: spec §5.1 footnote 의 마스킹 분기 4종 중 (3) "함수/심볼 → `'[unsupported:...]'`" 케이스는 직접 테스트 부재. value-masking.util 본체 spec 으로 위임됐을 가능성 — 분리 검토 권고.
   - **미세 누락 (잔여)**: `recordValues` 미지정/false 인데 `config.recordValues` 가 echo 되는지 명시 assert 없음. default 케이스 (`:574-597`) 는 `meta.modifications` 만 검증하고 `result.config.recordValues` 를 보지 않는다. §8 impl test 항목 참조.

7. **횡단 일관성 (Logic side-effect pass-through 2종)**: variable_modification 의 `meta.createdVariables` 가 variable_declaration `meta.declared` 와 시멘틱 분리 — modification 측은 "선언 없이 implicit 생성" 만 표기, declaration 측은 "명시적 declared" 표기. 분리 적절. 두 노드 모두 `coercionWarnings` 메트릭 공유 (단 shape 다름: declaration 측 `attemptedType`, modification 측 `fromType`) — 시멘틱 차이 (변환 대상 vs 현재 값 타입) 로 일관성 적절.

8. **구현 품질**:
   - in-place mutation (push/pop) 의 위험은 spec §1.2 에 명시 + `beforeSnapshot` 을 mutation 이전에 캡쳐 (`:130-132`) — masking 유틸이 deep clone 으로 처리 (spec test `:647-668` 확인).
   - default value handling: `Number(mod.value ?? 1)` 로 `null` 값을 `1` 로 fallback (`:151`). `Number(null) === 0` 가 아니라 `?? 1` 이 먼저 적용되므로 의도된 default `+1`/`-1`. dead code 없음.
   - `Object.hasOwn` 사용으로 `'__proto__'` 같은 prototype key 안전 (`:124`).

## 종합 개선안 (2026-05-16)

- [ ] (spec) §5.1 JSON 예시(`spec/4-nodes/1-logic/5-variable-modification.md:107-112`)·config 필드 표(`:126-135`)에 `config.recordValues` echo 필드 추가 — impl 이 이미 무조건 echo (`handler.ts:91`) 하므로 spec 예시·표가 역으로 stale. "항상 echo (Principle 7)" 정책을 spec 본문에 명시. (2026-06-25) impl 측은 D1 으로 해소됐으나 spec 문서는 미반영 — 잔여.
- [x] (impl) 위 spec 결정에 따라 `handler.execute` 의 config echo 객체에서 `recordValues` 항상 echo. — ✅ (2026-06-25) D1 explicit-enumeration 으로 `config.recordValues: rawConfig.recordValues` 무조건 echo (`variable-modification.handler.ts:88-92`, D1 주석 `:83-85`), PR D1 configEcho (commit c10383fc).
- [ ] (impl) `handler.spec.ts` 에 `recordValues` 미지정/false 일 때 `config.recordValues` echo 여부를 명시 assert 하는 케이스 추가. (2026-06-25) 잔여 — default 케이스 (`variable-modification.handler.spec.ts:574-597`) 는 `meta.modifications` 만 검증하고 `result.config.recordValues` 를 보지 않는다. `recordValues=true` 케이스만 `:616` 에서 echo 를 assert.
