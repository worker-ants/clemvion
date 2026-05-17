# Transform output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `output` root 직접 노출은 의도적 Principle 8 예외 (사용자 입력 객체 재구조화 시멘틱). (2026-05-16 구현 분석) handler / schema / 테스트 모두 conventions Principle 0–11 부합 — 잔여 spec ↔ impl gap 0건, 미시 보강 후보 2건 (테스트 커버리지 + spec 표현 명확화).

> 대상 spec: `spec/4-nodes/5-data/1-transform.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/5-data/1-transform.md:138-159` — §5.1 정상 (단일 출력):

```json
{
  "config": {
    "operations": [
      { "type": "rename_field", "from": "user.firstName", "to": "user.name" },
      { "type": "type_convert", "field": "user.age", "targetType": "number" },
      { "type": "string_op", "field": "user.name", "operation": "uppercase" },
      { "type": "array_sort", "field": "items", "order": "asc" }
    ]
  },
  "output": {
    "user": { "name": "ALICE", "age": 30 },
    "items": [1, 2, 3]
  },
  "meta": {
    "durationMs": 3,
    "operationsApplied": 4,
    "operationsSkipped": 0
  }
}
```

## 진단

Transform 은 **순수 데이터 변형 노드** (단계 1개). operation 체인 결과를 root 에 직접 노출.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` (root 직접) | 적절 — Principle 8 예외 | 변형 결과를 root 에 둠 (spec footnote 명시). 후속 노드는 `$node["X"].output.<변형된 필드>` 직접 접근 |
| `meta.operationsApplied` | 적절 (meta) | 실제 변형이 발생한 op 수 |
| `meta.operationsSkipped` | 적절 (meta) | silent no-op 처리된 op 수 (필드 부재 / 타입 불일치 / `divide` 0 등) |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.operations` (raw echo) | 적절 | Principle 7 — `set_field.value` 의 `{{ }}` 보존 |
| `port` / `status` | 미설정 | Principle 5 단일 출력 / 비-블로킹 |

부적절 항목 없음.

추가 점검:

1. **`output` root 직접 노출 (vs `output.result.*` wrapper)** — Principle 8.2 표는 "코드 실행 결과 | `output.result`" 라 명시하지만 Transform 은 의도적으로 root 직접 노출 결정 (spec §5.1 footnote: "Principle 8 예외"). 이유: Transform 의 목적이 입력 객체를 "재구조화" 하는 것이므로 결과 객체가 입력 객체와 같은 shape 으로 나가야 후속 노드가 같은 expression path 를 사용. 합리적.
2. **`meta.operationsApplied + operationsSkipped === config.operations.length`** — 일관성 보장. 진단 메트릭으로 무결성 검증 가능.
3. **runtime 에러 포트 없음** — Transform 의 모든 실패는 (a) pre-flight throw (config 검증) 또는 (b) silent no-op (필드 부재 등). spec 명시: "사용자가 캔버스에서 즉시 알 수 있어야 하는 config 오류만 pre-flight throw". 합리적.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": { "operations": [<Operation>, ...] },
  "output": <변형 결과 객체 — input shape 유지>,
  "meta": {
    "durationMs": <number>,
    "operationsApplied": <number>,
    "operationsSkipped": <number>
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 (의도적 Principle 8 예외) |

## Rationale

- Transform 의 시멘틱 = "입력 객체를 재구조화하여 출력". 결과를 `output.result.*` wrapper 로 감싸면 후속 노드가 같은 필드 경로를 쓸 수 없어 노드의 본질적 가치 손실.
- silent no-op 정책 (필드 부재, 타입 mismatch, divide 0, dayjs invalid, JSON parse 실패, regex 길이 초과) 은 `meta.operationsSkipped` 로 가시화 — Principle 3 (silent failure 해소) 부합.
- runtime 에러 포트 부재는 Transform 의 단순한 데이터 처리 시멘틱 (외부 I/O 없음) 과 정합 — pre-flight throw 만으로 충분.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/data/transform/{transform.handler.ts, transform.schema.ts, transform.handler.spec.ts, transform.schema.spec.ts, transform.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - `transform.handler.ts:158-165` 의 return 객체 키 `{ config, output, meta }` 가 spec §5.1 과 일치. `port` / `status` 미지정 (단일 출력 비-블로킹 — Principle 5 부합).
   - `config: { operations: rawConfig.operations ?? operations }` (`:159`) — Principle 7 raw echo. `set_field.value` 의 `{{ }}` 보존 의도가 명확.
   - `output: data` (`:160`) — 변형된 input 객체 자체. Principle 8 예외 (root 직접 노출) 와 일치.
   - `meta: { operationsApplied, operationsSkipped }` (`:161-164`) — spec §5.1 표 두 필드 일치. `meta.durationMs` 는 엔진이 inject 하므로 handler return 에 없음 (Principle 2 공통).

2. **schema ↔ spec config 정합성**: `transformNodeConfigSchema` (`transform.schema.ts:47-61`) 의 `operations: z.array(transformOperationSchema).default([])` — spec §1 표 (`operations: Operation[], 필수, 기본값 []`) 완전 일치. `transformOperationSchema` (`:12-21`) 는 `type` discriminator + `.passthrough()` — operation 별 세부 필드는 imperative `validateTransformConfig` (`:132-216`) 가 담당.

3. **validate 일관성**:
   - `transform.handler.ts:117-129` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors(metadata, config)` (warningRules + `validateConfig` SSOT) + "operations 비-배열" guard 만 추가. SSOT 침범 없음.
   - `warningRules` (`transform.schema.ts:240-246`) 는 `transform:no-operations` (length=0) 만 담당. `validateTransformConfig` (`:132-216`) 가 per-operation type/operation/field/keys 화이트리스트 검증.
   - 검증 화이트리스트 (`VALID_TRANSFORM_TYPES` / `STRING_OPS` / `MATH_OPS` / `DATE_OPS` / `CONVERT_TYPES` / `VALID_CONDITION_OPERATORS`) 가 spec §1.1 표와 1:1 일치.

4. **에러 컨트랙트 (Principle 3)**:
   - Pre-flight throw 만 사용 — runtime `port:'error'` 없음. spec §5.8 표 (operations 검증, per-op type / operation / field / keys 누락, array_filter.condition 오류 등) 와 일치.
   - Runtime 무결성 실패 (필드 부재, 타입 mismatch, JSON parse 실패, dayjs invalid, divide-by-zero, regex 길이 초과) 는 모두 silent no-op 으로 처리되고 `meta.operationsSkipped` 카운트. spec §4 의 "no-op" 명시와 핸들러 분기 (`transform.handler.ts:204, 215, 235, 249-261, 296, 366, 386-389, 412-418, 472, 487, 519-520, 547`) 모두 일치.
   - Prototype pollution 방어: `BLOCKED_OBJECT_KEYS` (`transform.handler.ts:47`) 가 `__proto__` / `constructor` / `prototype` 을 `object_omit` 에서 차단. `set_field` 경로 차단은 `setNestedValue` (nested-value.util) 위임 — handler 가 `applied: true` 로 카운트 (`:228` 의 주석 명시: "사용자가 의도한 변형 시도이고, no-op 분류는 필드/타입 부재 케이스에 한정").

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1 (config ↔ output 직교): `output` 은 변형된 input 객체 (런타임 값). `config.operations` 는 raw echo. 직교 위반 없음.
   - Principle 2 (`meta` 는 메트릭만): `operationsApplied` / `operationsSkipped` 모두 메트릭. 부합.
   - Principle 3.1: pre-flight throw 만 — Data 공통 §4.1 일치.
   - Principle 5: `port: undefined` (단일 출력 대표 사례). 부합.
   - Principle 7: `context.rawConfig?.operations ?? operations` fallback 패턴 (`:155-159`) 으로 raw echo. evaluated `operations` 가 다르더라도 raw 가 echo 됨. 부합.
   - Principle 8.2 예외: spec §5.1 footnote 명시 — Transform 의 재구조화 시멘틱 보존. 부합.
   - Principle 10 (빈/null 입력 fallback): `structuredClone(input)` 가 `null`/`undefined` 입력 시 그대로 통과 → 첫 op 에서 `hasNestedValue` 가 false → no-op. throw 없음. 부합.

6. **handler 테스트 (`transform.handler.spec.ts`)**:
   - validate 4건 (`:22-50`), 11개 op 각각 정상/엣지 케이스 (`:52-749`), 보안·prototype pollution (`:750-824`), `meta.operationsApplied/operationsSkipped` 5건 (`:826-955`), 통합 chain (`:957-991`). 커버리지 매우 높음.
   - **미세 누락**: `context.rawConfig` 가 설정된 케이스의 `config` echo 검증 부재 — handler 가 항상 `config.operations` 를 echo 하므로 `rawConfig.operations` 와 `config.operations` 가 다를 때 (예: `{{ }}` 평가 전후) raw 가 우선되는지 직접 확인하는 테스트가 없음. 다른 노드(`if-else.handler.spec.ts` 등) 패턴과 비교하면 보강 여지 있음. 단 spec / Principle 7 위반은 아님 (코드는 `rawConfig.operations ?? operations` fallback 으로 올바르게 동작).
   - `transform.schema.spec.ts` 는 imperative validator 11종 + warningRules 3종 + integration 3종 (`:1-155`) — spec §5.8 표 row 전체 커버.

7. **횡단 일관성 (Data 2종)**: Transform 의 변형 결과는 `output` root 직접. Code 의 사용자 `return` 값도 `output` root 직접 (정상 시). 두 노드 모두 "shape 자유" 패턴으로 일관. 단, Code 는 에러 envelope (`output.error.{code,message,details}`) 으로 분기, Transform 은 에러 envelope 없음 (pre-flight throw 만) — 차이는 시멘틱 (Code 는 외부 I/O 와 동급 신뢰성 모델, Transform 은 순수 변형) 으로 정당.

8. **구현 품질**:
   - `structuredClone(input)` (`:137`) 로 원본 불변 보장 — 테스트 (`:330-340`) 가 검증.
   - `safeCompileRegex` (`:37-44`) + `MAX_REGEX_LENGTH = 200` 으로 ReDoS 방지. `string_op.replace` 와 `array_filter` (via `compileRegexCache`) 양쪽 적용.
   - dead code 없음. `DATE_UNITS` 만 runtime 사용 (executor `dateOp` 분기), 다른 화이트리스트는 schema 로 이전 — 주석 (`:101-104`) 이 history 명시.
   - `setNestedValue` 의 prototype pollution 차단 (`__proto__` / `constructor` / `prototype`) 은 `transform.handler.spec.ts:751-761` 가 검증.

## 종합 개선안 (2026-05-16)

- [ ] (impl) `transform.handler.spec.ts` 에 `context.rawConfig.operations` 와 `config.operations` 가 다른 경우 (expression 평가 전후) `result.config.operations` 가 raw 를 echo 하는지 확인하는 테스트 추가. 근거: `transform.handler.ts:155-159` 의 fallback 분기는 다른 노드 (`if-else.handler.spec.ts:rawConfig echo`) 처럼 단위 테스트로 명시 검증되어야 conventions Principle 7 의 회귀 방지가 된다.
- [ ] (spec) §5.1 footnote 또는 §4 본문에 "Transform 은 root 직접 노출 (Principle 8.2 예외) — 이유: 재구조화 시멘틱 보존" 을 명시. 현재 spec §5.1 표 footnote 에 "(Principle 8 예외 — 변형 결과를 root 에 둠)" 한 줄만 있어 의도 보강. 근거: code.md 의 같은 예외도 spec footnote 에 "shape 은 사용자 코드가 결정. `output.result` 래핑은 적용하지 않음" 으로 상세 — Transform 에도 동일 깊이 권고.
