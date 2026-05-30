# Map output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합.
> 잔여 권고 항목:
> - §5.1 (시작 시점) 의 `output: items[]` 가 외부 expression 으로 노출되지 않는다는 점을 spec 표현 더 명확화 (또는 handler 가 Loop/Parallel 처럼 `output: null` 반환 + 별도 internal 필드로 분배 — executor 변경 동반).
> - `errorPolicy: 'skip' / 'continue'` 시 인덱스 보존 마커 (`_skipped: true`) 와 ForEach 의 별도 `output.skipped` 분리 패턴의 통일 여부 검토.
> - (2026-05-16 구현 분석) handler 의 `config` echo 가 `errorPolicy` 를 echo 하지 않음 — schema 에 `errorPolicy: enum.default('stop')` 정의가 있으나 `handler.execute` return `config` 객체에 누락. spec §5.1/§5.2 예시는 `config.errorPolicy` 를 포함하므로 spec ↔ impl 불일치.
> - (2026-05-16 구현 분석) handler 가 시작 시점에 `meta` 자체를 비반환 — spec §5.1 의 `meta.durationMs: 0` 은 engine inject 로 해석되지만, handler 가 `meta: {}` 또는 미반환인지 명시 검토.

> 대상 spec: `spec/4-nodes/1-logic/7-map.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/7-map.md:66-94` — §5.1 시작 시점 (port `body`):

```json
{
  "config": { "inputField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" },
    { "id": 3, "name": "Carol" }
  ],
  "meta": { "durationMs": 0 },
  "port": "body"
}
```

`spec/4-nodes/1-logic/7-map.md:104-124` — §5.2 완료 시점 (port `done`, 엔진 오버라이트 후):

```json
{
  "config": { "inputField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": {
    "mapped": [
      { "id": 1, "label": "user-1: Alice" },
      { "id": 2, "label": "user-2: Bob" },
      { "id": 3, "label": "user-3: Carol" }
    ],
    "count": 3
  },
  "meta": { "durationMs": 187 },
  "port": "done"
}
```

## 진단

Map 은 **컨테이너 노드** (반복 변형). 단계 2개:

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 (body 진입 직전) | `output: items[]` (해석된 원본 배열) | **부분적으로 부적절** — Loop/Parallel 은 `output: null` 인데 Map/ForEach 는 배열을 반환. spec §5.7 footnote 가 "ForEachExecutor 가 이 배열을 분배 입력으로 소비" 라고 정당화하나, 다운스트림이 잠시 이 raw 배열을 보는 시점이 존재 |
| 완료 (`done` 포트) | `output: { mapped, count }` (엔진 오버라이트) | 적절 — 변형 결과 = 비즈니스 데이터 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| §5.1 `output: items[]` | 컨테이너 컨트랙트 변형 — Principle 9.1 의 `output: null` 패턴과 다름 | spec 명시: "다운스트림이 직접 참조해서는 안 된다 — 완료 후 §5.2 의 `{mapped, count}` 로 덮어쓰여진다" |
| §5.2 `output.mapped` | 적절 (output) | 변형된 배열, 컬렉션 키 = `mapped` (Loop=`iterations`/ForEach=`items`/Parallel=`branches` 와 구분) |
| §5.2 `output.count` | 적절 | O(1) 접근, ForEach 와 대칭성 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.inputField` / `errorPolicy` (raw echo) | 적절 | Principle 7 |
| `port: 'body' / 'done'` | 적절 | 두 단계 라우팅 |

핵심 점검 — **§5.1 의 `output: items[]` 노출 여부**:

- 다운스트림 expression `$node["Map"].output.*` 가 시작 시점에 raw 배열을 본다면 conventions Principle 9 의 "외부 expression 으로 노출되지 않는 중간 형태" 와 모순.
- spec §5.7 표가 "다운스트림 노드는 항상 §5.2 형태만 본다" 라고 명시 — 즉 시작 시점의 envelope 은 NodeHandlerOutput 자체이지 `$node["Map"].output` 으로 노출되는 값이 아님. 그러나 spec §5.1 의 JSON 예시가 "이 시점의 노드 envelope" 으로 표시되어 있어 혼동 여지.
- **개선 제안**: §5.1 의 표현을 "handler 가 반환하는 raw envelope (외부 비노출)" 으로 더 명확히 하고, 가능하면 Map/ForEach handler 도 Loop/Parallel 처럼 `output: null` 을 반환하고 분배용 배열은 별도 internal 필드로 운반하는 방안 검토. 단, executor 구현 변경이 동반되므로 본 plan 은 spec 명확화만 권장.

## 개선안 — 정리된 output

**시작 단계 (handler 반환, 외부 비노출):**

```json
{
  "config": { "inputField": <raw>, "errorPolicy": <enum> },
  "output": <items[] — 분배용 internal>,    // OR null + internal field (대안)
  "meta": { "durationMs": <number> },
  "port": "body"
}
```

**완료 단계 (엔진 오버라이트, 다운스트림 expression 노출):**

```json
{
  "config": { "inputField": <raw>, "errorPolicy": <enum> },
  "output": {
    "mapped": [<emit>, ...],
    "count": <number>
  },
  "meta": { "durationMs": <number> },
  "port": "done"
}
```

> `errorPolicy: 'skip' / 'continue'` 시 `output.mapped[i] = { _skipped: true, error }` 형태로 인덱스 보존 — spec §5.2 footnote.

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| §5.1 의 raw `items[]` 노출 가능성 | handler internal (별도 필드) 또는 spec 표현 명확화 | 외부 expression 노출 금지 (Principle 9.1) |

## Rationale

- 컨테이너의 `output` 은 다운스트림이 보는 값 = 완료 시점 컬렉션 (`mapped`). 시작 시점은 internal.
- 컬렉션 키 분기 (`iterations` / `items` / `mapped` / `branches`) 는 컨테이너 시멘틱 구분 — Loop 는 인덱스 기반, ForEach 는 항목 기반, Map 은 변형, Parallel 은 분기. 동일 키로 통일하면 시멘틱 손실.
- `_skipped: true` 인라인 마커는 인덱스 보존을 위해 유지 (ForEach 는 별도 `output.skipped` 분리 패턴 채택 — 두 노드 시멘틱 차이가 있어 통일 후보로 검토 가능).

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/logic/map/{map.handler.ts, map.schema.ts, map.handler.spec.ts, map.schema.spec.ts, map.component.ts}` 와 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (Map 컨테이너 finalise 분기) · `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts` (공유 executor).

1. **spec §5 ↔ handler return 정합성**:
   - **시작 시점 (port `body`)**: `map.handler.ts:56-59` return `{ config: { inputField }, output: items }` — spec §5.1 의 `meta.durationMs: 0` / `port: 'body'` 는 engine 이 inject (handler 책임 아님). handler 는 `port` 도 반환하지 않음 (engine 의 ForEachExecutor 가 body 포트 활성화 책임).
   - **gap**: handler 가 `config.errorPolicy` 를 echo 하지 않는다 (`:57` — `inputField` 만). schema 정의에는 `errorPolicy: enum.default('stop')` 있으므로 spec §5.1 / §5.2 의 `config.errorPolicy: "stop"` echo 와 spec ↔ impl 불일치. Principle 7 ("raw config 항상 echo") 위반.
   - **완료 시점 (port `done`)**: spec §5.2 의 `output: { mapped, count }` 는 engine 의 finalise 분기가 오버라이트 (`execution-engine.service.ts:4574-4605`) — Principle 9 컨트랙트 정합. handler 는 시작 시점에 raw `items[]` 만 반환하고 완료는 engine 이 담당.

2. **schema ↔ spec config 정합성**: `mapNodeConfigSchema` (`map.schema.ts:29-47`) 의 `inputField` / `errorPolicy` 가 spec §1 표와 동일. default `''`/`'stop'` 정합. `mapNodeOutputSchema` 의 `output: z.array(unknown).optional()` 은 시작 시점 (raw items) 만 표현 — 완료 시점의 `{mapped, count}` 는 별도 컨테이너 finalise 표현 (engine output 이라 노드 단위 schema 와 별도).

3. **validate 일관성**:
   - `handler.validate()` (`map.handler.ts:30-40`) 는 SSOT (`evaluateMetadataBlockingErrors`) + `errorPolicy` enum guard 추가. `inputField` 검증은 `warningRules` 의 `map:no-input-field` (`schema.ts:82-88`) 가 담당.
   - 잠재적 중복: `summaryTemplate.warnWhen` (`schema.ts:73`) 와 `warningRules` 이 같은 조건 (`!inputField`) 을 명시 — `summaryTemplate` 는 legacy back-compat 명시 (`:71` 의 주석). 점진적 제거 후보.
   - per-condition / per-array iteration 검증은 spec 정의상 불필요 (`inputField` 단일 + `errorPolicy` enum).

4. **에러 컨트랙트 (Principle 3)**: handler 는 pre-flight throw 만 — runtime `port: 'error'` 없음. body iter 에러는 `errorPolicy` 분기로 흡수 (engine 책임). spec §6 정합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: 시작 시점 `output: items[]` 는 raw 입력 데이터 — config 리터럴 echo 잔재 아님. 완료 시점 `output: { mapped, count }` 는 변형 결과 — 부합.
   - Principle 2: `meta.durationMs` (engine inject) 만 — Map 의 컨테이너 finalise 분기 (`execution-engine.service.ts:4602-4605`) 는 `structuredMeta` 를 설정하지 않음 (Loop/ForEach 가 `meta.iterations` 등 추가하는 것과 대조). spec §5.2 의 `meta` 도 `durationMs` 만 명시 — 정합.
   - Principle 5: handler 가 `port` 미반환, engine 의 `ForEachExecutor` 가 body/done 활성화. 부합.
   - **Principle 7 위반 (gap)**: `errorPolicy` echo 누락 — 위 §1 gap 참고.
   - Principle 9: 시작 (raw items) → engine override (`{mapped, count}`) 컨트랙트 부합. `execution-engine.service.ts:4598-4605` 가 `collected.skipped` 를 inline `_skipped` 마커로 reconstruct (`:4599-4601`).
   - Principle 10: `inputField` 해석 결과가 배열이 아니면 `[]` fallback (`map.handler.ts:50`) — 부합. ForEach 의 strict throw 와 달리 Map 은 silent fallback (spec §4 정합, 단 `meta.fellBackToEmpty` 같은 가시화 메트릭 없음 — Filter 와 비대칭).

6. **handler 테스트 (`map.handler.spec.ts`)**:
   - validate (9 case) / execute (8 case: dot-path / nested / inline array / non-array / missing path / empty / null input / config echo / rawConfig template 보존) (`:23-175`).
   - **누락**: handler 시점에서 `output: items[]` 만 검증 — engine 의 `{mapped, count}` 오버라이트는 별도 integration test (`execution-engine.service.spec.ts:5059-5124` 영역) 로 위임. spec §5.2 의 다운스트림 노출 형태에 대한 노드 단위 검증은 부재 — 의도된 분리.
   - **누락**: `errorPolicy: 'skip' / 'continue'` 시 `_skipped: true` 인라인 마커 케이스가 handler spec 에 부재 — engine integration spec 에서 다루므로 의도된 분리이나, spec §5.2 footnote 의 inline marker 형태가 노드 단위 테스트로 demonstrate 되지 않음.

7. **횡단 일관성 (컨테이너 4종)**:
   - **인라인 마커 vs 분리 마커**: Map 은 `output.mapped[i] = { _skipped: true, error }` 인라인 (`execution-engine.service.ts:4598-4601`), ForEach 는 `output.items[i] = null` + `output.skipped[]` 분리 — spec 본문 (§7-map.md §5.2 footnote / §9-foreach.md §5.3) 에 의도 분리 명시. 잔여 권고: 통일 검토 (위 frontmatter 참고).
   - **meta 컨테이너 메트릭 비대칭**: Loop `meta.iterations + maxIterationsReached + exitReason` (`execution-engine.service.ts:4649-4653`) / ForEach `meta.iterations + skippedCount?` (`:4567-4572`) / **Map: 비제공** (`:4602-4605` — `structuredMeta` 설정 없음) / Parallel — 별도 plan 의 `meta.branches` 보강 권고 있음. Map 도 `meta.iterations`/`meta.skippedCount` 같은 컨테이너 공통 메트릭이 있으면 일관성 향상.

8. **구현 품질**:
   - `resolveFieldValue` 가 dot-path / inline 양쪽 처리 — config 표현식 resolver 일관 (`map.handler.ts:49`).
   - dead code 없음. 동시 처리 모호함 없음.

## 종합 개선안 (2026-05-16)

- [x] (impl) `MapHandler.execute` 의 `config` echo 객체에 `errorPolicy` 추가 — `errorPolicy: rawConfig.errorPolicy ?? 'stop'`. 근거: spec §5.1 / §5.2 예시는 `config.errorPolicy: "stop"` 포함, schema default `'stop'`, Principle 7 ("항상 echo"). 현 구현 (`map.handler.ts:56-59`) 누락.
- [ ] (impl) Map 컨테이너 finalise 분기에 `meta.iterations` / `meta.skippedCount?` 추가 — Loop/ForEach 와 일관. 근거: `execution-engine.service.ts:4602-4605` 가 `structuredMeta` 미설정 (Loop 의 `:4649-4653` / ForEach 의 `:4567-4572` 와 비대칭).
- [ ] (spec) 위 `meta.iterations` 추가에 맞춰 §5.2 의 `meta` 표에 `iterations: number`, `skippedCount?: number` 항목 추가. 근거: 컨테이너 4종 공통 메트릭.
- [ ] (spec) §5.1 (시작 시점) JSON 예시 위에 "이 envelope 은 handler 가 반환하는 raw 형태로, `$node["X"].output` 으로 외부 노출되지 않는다 — 다운스트림은 §5.2 의 `{ mapped, count }` 만 본다" 한 줄 명시. 근거: 잔여 권고 frontmatter + plan §"진단" 의 모호함.
- [ ] (impl/spec) `errorPolicy: 'skip' / 'continue'` 시 `_skipped: true` 인라인 마커 케이스 1개를 `map.handler.spec.ts` integration smoke 또는 engine spec 에서 추가 검증. 근거: spec §5.2 footnote 가 다운스트림 노출 형태로 명시되어 있으나 handler 단위 테스트 부재.
- [ ] (impl) `meta.fellBackToEmpty` 도입 검토 — `inputField` 결과가 비배열로 `[]` fallback 된 경우 진단. 근거: Filter 의 `meta.fellBackToEmpty` (`filter.handler.ts:78-82`) 와 일관성. spec §5.2 의 "빈 배열 입력" footnote 가 진단 메트릭 없이 silent 가 됨.
