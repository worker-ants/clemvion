# ForEach output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 컨테이너 컨트랙트 (Principle 9) + `errorPolicy='skip'/'continue'` 시 `output.skipped` 분리 표현 모두 유지.
> 잔여 권고 항목:
> - §5.1 (시작 시점) 의 `output: items[]` 외부 노출 모호성 — Map 과 동일 (handler internal 명확화 권장).
> - Map 의 인라인 `_skipped: true` 마커 vs ForEach 의 별도 `output.skipped` 배열 — 두 노드의 시멘틱 차이로 의도된 분기이지만 다운스트림 일관성 위해 통일 검토 가치.
> - (2026-05-16 구현 분석) handler 가 `config.errorPolicy` 를 echo 하지 않는다 (`foreach.handler.ts:51-54`) — spec §5.2 JSON 예시에는 echo 되어 있어 구현 ↔ spec 미일치. 또한 `collectResults` 가 `ForEachConfig` 인터페이스에는 있으나 schema 정의에 부재 (dead field — `foreach.handler.ts:18`) — 보강 또는 제거 검토.

> 대상 spec: `spec/4-nodes/1-logic/9-foreach.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/9-foreach.md:83-91` — §5.1 시작 (body 진입 직전):

```json
{
  "config": { "arrayField": "{{ $input.items }}" },
  "output": [{ "id": "a", "name": "Alice" }, { "id": "b", "name": "Bob" }]
}
```

`spec/4-nodes/1-logic/9-foreach.md:103-118` — §5.2 완료 (`done`, 엔진 오버라이트):

```json
{
  "config": { "arrayField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": {
    "items": [{ "userId": "a", "ok": true }, { "userId": "b", "ok": true }],
    "count": 2
  },
  "meta": { "durationMs": 320, "iterations": 2 },
  "port": "done"
}
```

`spec/4-nodes/1-logic/9-foreach.md:144-166` — §5.3 (errorPolicy='skip'/'continue' 분리):

```json
{
  "output": {
    "items": [
      { "userId": "a", "ok": true },
      null,
      { "userId": "c", "ok": true }
    ],
    "count": 3,
    "skipped": [{ "index": 1, "error": { "code": "VALIDATION_FAILED", "message": "..." } }]
  },
  "meta": { "durationMs": 410, "iterations": 3, "skippedCount": 1 },
  "port": "done"
}
```

## 진단

ForEach 는 **컨테이너** (반복). 단계 2개. Map 과 동일 패턴이지만 컬렉션 키 = `items` (변형 의도가 아닌 "각 항목 처리").

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 (body 진입 직전) | `output: items[]` (해석된 원본 배열) | Map 과 동일한 컨트랙트 변형 — spec §5.7 표가 "외부 expression 노출되지 않는다" 명시 |
| 완료 (`done`) | `output: { items, count, skipped? }` | 적절 — 비즈니스 결과 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output.items[]` | 적절 (output) | 각 iter emit 결과. errorPolicy=skip/continue 시 실패 인덱스는 `null` placeholder (인덱스 보존) |
| `output.count` | 적절 | 입력 배열 길이 |
| `output.skipped: [{index, error}]` | 적절 (output) | 실패 항목 분리 — Map 의 인라인 `_skipped` 패턴과 다름 (시멘틱 분리 의도) |
| `meta.iterations` | 적절 (meta) | body 실행 횟수. `output.count` 와 동일하나 메트릭 축 분리 |
| `meta.skippedCount` | 적절 (meta) | `output.skipped.length` 미러 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.arrayField` / `errorPolicy` (raw echo) | 적절 | Principle 7 |
| `port: 'body' / 'done'` | 적절 | 두 단계 라우팅 |

핵심 점검:

1. **§5.1 외부 노출 모호성** — Map 과 동일한 문제. spec 의 §5.7 표가 "다운스트림은 §5.2 형태만 본다" 라고 명시하지만 §5.1 의 JSON 예시가 envelope 으로 표시되어 혼동 여지. 표현 명확화 권장.
2. **`output.skipped` 분리 vs Map 의 인라인 `_skipped`** — ForEach 는 P0 채택안으로 분리, Map 은 인라인 유지. 두 노드의 시멘틱 (각 항목 독립 처리 vs 변형 배열) 이 다르므로 의도된 차이지만, 다운스트림 분기 코드의 일관성 관점에서 통일 검토 가치 있음 — 본 plan 은 현 정책 유지, 통일은 별도 조정 필요.
3. **`output.skipped` 가 0 건일 때 필드 자체 생략** — Principle 11 (`undefined` 필드 echo 금지) 부합. 다운스트림은 `output.skipped` 존재 여부로 실패 처리 분기.

## 개선안 — 정리된 output

**시작 단계 (handler 반환):**
```json
{ "config": { "arrayField": <raw> }, "output": <items[] internal> }
```

**완료 단계 (엔진 오버라이트, 다운스트림 노출):**
```json
{
  "config": { "arrayField": <raw>, "errorPolicy": <enum> },
  "output": {
    "items": [<emit | null>, ...],
    "count": <number>,
    "skipped"?: [{ "index": <number>, "error": { "code": ..., "message": ... } }, ...]
  },
  "meta": {
    "durationMs": <number>,
    "iterations": <number>,
    "skippedCount"?: <number>
  },
  "port": "done"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| §5.1 의 raw `items[]` 외부 노출 가능성 | handler internal (또는 spec 표현 명확화) | Principle 9.1 |
| (그 외 변경 없음) | — | conventions 부합 |

## Rationale

- 컨테이너의 두 단계 분리는 Principle 9 의 핵심.
- `skipped` 별도 필드 분리 (vs Map 의 인라인) 는 ForEach 의 의도 — "각 항목을 독립적으로 처리하는 작업" — 와 정합. 성공만 추리려면 `output.items.filter(x => x !== null)`, 실패 처리는 `output.skipped` 배열만 walk.
- `output.count` 는 ForEach 의 SSOT — 정상/실패 통합 카운트 (≠ `meta.iterations`). spec 의 footnote: "= 입력 배열 길이, 인덱스 유지".

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/logic/foreach/{foreach.handler.ts, foreach.schema.ts, foreach.handler.spec.ts, foreach.schema.spec.ts, foreach.component.ts}`.

1. **spec §5 ↔ handler return 정합성 (컨테이너 컨트랙트)**:
   - `foreach.handler.ts:51-54` 의 return 객체 키 `{ config, output }` — 시작 시점 (body 진입 직전) 핸들러 반환. spec §5.1 의 시작 단계 JSON 과 정합 (`output: items[]`).
   - **gap1**: handler 가 `config.errorPolicy` 를 echo 하지 않는다 (`:52` — `arrayField` 만 echo). spec §5.2 JSON 예시(`9-foreach.md:104`)는 `config.errorPolicy` 를 echo 한다고 표기 → 구현 ↔ spec 미일치. Principle 7 "raw echo 항상" 에 따르면 echo 해야 함.
   - **gap2**: `ForEachConfig` 인터페이스(`:11-18`) 에 `collectResults: boolean` 필드가 있으나 schema 정의(`foreach.schema.ts:29-47`) 에는 부재. spec §1 표에도 없음 — dead field, 제거 권고.
   - 완료 시점 `{ items, count, skipped? }` 오버라이트는 엔진 책임 (handler 가 직접 반환하지 않음) — Principle 9.2 부합.

2. **schema ↔ spec config 정합성**: `foreachNodeConfigSchema` (`foreach.schema.ts:29-47`) 의 `arrayField` (default `''`) / `errorPolicy` (enum `stop|skip|continue`, default `stop`) 모두 spec §1 표와 동일. **`collectResults` 누락** — spec 에 없으니 handler 인터페이스가 옛 잔재로 추정.

3. **validate 일관성**:
   - `foreach.handler.ts:23-35` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` (warningRules SSOT) + `errorPolicy` enum guard 만 추가. SSOT 침범 없음.
   - `warningRules` (`foreach.schema.ts:75-82`) 가 `foreach:no-array-field` 만 정의 — `errorPolicy` 는 zod enum 으로 충분. 명확한 분리, Spec §6 표와 일치.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만 사용 — runtime `port:'error'` 없음 (spec §6 명시: "runtime 에러 포트를 갖지 않는다"). `errorPolicy=skip/continue` 시 분리는 엔진 책임. 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1 (config ↔ output 직교): 컨테이너 시작 시점 `output: items[]` 은 resolver 결과 — config 가 raw 표현식이면 evaluated 와 다르므로 직교 (raw 와 evaluated 의 분리). 완료 시점은 엔진 오버라이트. 부합.
   - Principle 2: `meta.durationMs` / `meta.iterations` / `meta.skippedCount` 는 엔진 inject — 핸들러는 meta 주입 안 함. 부합.
   - Principle 5: 시작 시점 `port` 미반환 (`undefined`) — 핸들러는 `output: items[]` 만 반환하고 엔진이 body 포트 활성화. spec §5.1 의 JSON 예시도 `port` 없음. 부합.
   - Principle 7: gap1 — `errorPolicy` echo 누락.
   - Principle 9: handler 는 시작 시점 `output: items[]` 반환, 엔진이 완료 시점 `{ items, count, skipped? }` 오버라이트. 부합.
   - Principle 10: `Array.isArray(resolved) ? resolved : []` (`:45`) — null/undefined/primitive 모두 `[]` fallback. 부합.

6. **handler 테스트 (`foreach.handler.spec.ts`)**:
   - validate (dot-path / inline array / missing / empty / null / enum / each policy / omitted — `:23-83`)
   - execute (path resolve / nested / inline value / non-array fallback / missing path / empty / null input / config echo / `{{ }}` template — `:86-173`)
   - **누락**:
     - `config.errorPolicy` echo 테스트 부재 — gap1 미커버 (테스트가 echo 누락을 잡지 못함).
     - `collectResults` 관련 테스트 부재 (dead field 인지 확인 필요).

7. **횡단 일관성 (컨테이너 4종 — Loop/Map/ForEach/Parallel)**:
   - 시작 시점 반환 형태: Loop (output 없음 — 입력 분배 안 함) / Map (`output: items[]`) / ForEach (`output: items[]`) / Parallel (`output: null`).
   - ForEach / Map 은 spec 의 시작 시점 JSON 예시가 `output` envelope 으로 보여 다운스트림 노출 오해 가능 — Parallel 의 `null` 패턴이 더 명확. spec 표현 통일 권장.
   - 완료 시점 컬렉션 키: `iterations` / `mapped` / `items` / `branches` — 의도된 시멘틱 차이 (변형 vs 항목 처리 vs 분기). 0-common §5 표 부합.

8. **구현 품질**: dead code (`collectResults`) 외 매직 넘버 / 누수 없음. `rawConfig ?? config` (`:50`) 패턴은 unit-test escape hatch — if-else 와 동일 패턴.

## 종합 개선안 (2026-05-16)

- [ ] (impl) `foreach.handler.ts:52` 의 `config` echo 객체에 `errorPolicy: rawConfig.errorPolicy` 추가 — Principle 7 "raw echo 항상" 부합 + spec §5.2 JSON 예시와 일치. 근거: `foreach.handler.ts:51-54` vs `spec/4-nodes/1-logic/9-foreach.md:104`.
- [ ] (impl) `ForEachConfig` 인터페이스(`foreach.handler.ts:11-18`) 의 `collectResults: boolean` 필드 제거 — schema·spec 어디에도 없는 dead field. 근거: `foreach.schema.ts:29-47` (schema) vs `foreach.handler.ts:11-18` (interface).
- [ ] (impl) `foreach.handler.spec.ts` 에 `config.errorPolicy` echo 테스트 추가 — 위 impl 변경 후 회귀 방지.
- [ ] (spec) §5.1 (시작 시점) JSON 예시의 `output: items[]` 표현을 "다운스트림 노출 안 됨" 부각 — `output: null` + footnote 또는 표 형태로 변경 검토. Parallel 의 `output: null` 패턴 (spec `10-parallel.md:81`) 와 일관성.
