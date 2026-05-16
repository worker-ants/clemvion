# Split output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `output.count` ↔ `meta.itemCount` 의 의도적 분리 유지. (2026-05-16 구현 분석) handler `validate()` 가 schema warningRule 만 호출하여 spec §1 의 `fieldPath` Expression 정의 외 추가 검증 없음을 확인. 잔여 권고는 발견되지 않으며 conventions 11 Principle 모두 부합.

> 대상 spec: `spec/4-nodes/1-logic/6-split.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/6-split.md:62-89`:

```json
{
  "config": { "fieldPath": "{{ $input.order.items }}" },
  "output": {
    "items": [
      { "index": 0, "value": { "sku": "X1" } },
      { "index": 1, "value": { "sku": "X2" } }
    ],
    "count": 2
  },
  "meta": {
    "durationMs": 1,
    "itemCount": 2,
    "fellBackToEmpty": false
  }
}
```

## 진단

Split 은 **데이터 변형 노드** (단계 1개). 입력 객체에서 배열을 추출 → `{index, value}` 정규화. "단계마다 채워지는 field" = 정규화된 배열.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output.items: Array<{index, value}>` | 적절 (output) | 비즈니스 결과 — 다운스트림이 `items` 로 받음 |
| `output.count` | 적절 (output) | spec footnote: `items.length` 와 동일하지만 O(1) 접근용. ForEach 의 `{items, count}` 와 [공통 §5](../../../spec/4-nodes/1-logic/0-common.md) 대칭성 유지 |
| `meta.itemCount` | 약간 중복 (meta) | `output.count` 와 같은 값. spec footnote 가 "Principle 2 분리 원칙" 을 인용하지만, 본질적으로 같은 값. 둘 다 두는 것은 메트릭 축 분리 의도 |
| `meta.fellBackToEmpty` | 적절 (meta) | Principle 10 진단 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.fieldPath` (raw) | 적절 | Principle 7 |

추가 점검 — **`output.count` ↔ `meta.itemCount` 의 중복**:

- spec footnote: "Principle 2 분리 원칙에 따라 `meta` 에도 표기". 그러나 Loop 의 경우 `output.iterations.length` ↔ `meta.iterations` 로 두는 것과 동일 패턴 — Container 카테고리의 일관성을 위해 유지.
- 한쪽 제거 검토했으나 `output.count` 는 **다운스트림 비즈니스 분기**(예: `if count > 0`)에 자주 쓰이고, `meta.itemCount` 는 **모니터링 / 로그 메트릭** 목적. 의미 구분이 가능하므로 유지.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": { "fieldPath": <Expression raw> },
  "output": {
    "items": [{ "index": <number>, "value": <unknown> }, ...],
    "count": <number>
  },
  "meta": {
    "durationMs": <number>,
    "itemCount": <number>,         // output.count 메트릭 미러
    "fellBackToEmpty": <boolean>
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- 데이터 변형 노드의 `output` 은 변형 결과 자체. 입력의 다른 필드는 (입력 객체 root 에 있던 `id` 등은) 의도적으로 **포함되지 않는다** — spec §5.1 후반부 명시. 단일 책임 원칙.
- `count` 직렬 노출은 ForEach·Map 의 `{items, count}` / `{mapped, count}` 와 [공통 §5](../../../spec/4-nodes/1-logic/0-common.md) 의 통일된 컬렉션 키 규약을 따른다.
- `meta.itemCount` 와 `output.count` 의 중복은 메트릭 축 / 비즈니스 데이터 축의 의도적 분리 (Principle 1 vs 2). 모니터링 사이드에서는 모든 노드의 `meta.*Count` 패턴으로 통일된 메트릭을 수집할 수 있어야 한다.

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/logic/split/{split.handler.ts, split.schema.ts, split.handler.spec.ts, split.schema.spec.ts, split.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - `split.handler.ts:49-67` 의 두 return 분기 (비배열 fallback / 정상) 모두 `{ config: { fieldPath }, output: { items, count }, meta: { itemCount, fellBackToEmpty } }` — spec §5.1 와 100% 일치.
   - `meta.durationMs` 는 spec §5.1 표 ("engine inject") 와 일치 — handler 가 채우지 않음. 변경 없음 — `handler:return` 이 spec §5.1 과 일치.

2. **schema ↔ spec config 정합성**: `splitNodeConfigSchema` (`split.schema.ts:35-49`) 가 `fieldPath: z.string().default('')` — spec §1 "Expression / 필수 / 기본값 `''`" 와 일치. `splitNodeOutputSchema` (`split.schema.ts:7-33`) 의 `output.items[].{index, value}` + `output.count` shape 도 spec §5.1 표와 일치.

3. **validate 일관성**:
   - `handler.validate()` (`split.handler.ts:26-29`) 가 `evaluateMetadataBlockingErrors` 만 호출 — warningRules SSOT 로 전적 위임.
   - schema 의 `warningRules` (`split.schema.ts:76-82`) 가 `split:no-field-path` 단일 룰. 의무 검증 없음. `validateConfig` 부재 — per-item iteration 검증이 필요 없는 단순 노드.

4. **에러 컨트랙트 (Principle 3)**:
   - pre-flight throw (fieldPath 누락) 만 사용 — runtime `port:'error'` 없음. spec §6 와 일치.
   - **비배열 입력 = 빈 배열 fallback** (`split.handler.ts:45-54`) → Principle 10 정합. `meta.fellBackToEmpty: true` 로 진단 가능 — Principle 10 "필수 config 필드 missing 외에는 throw 금지" 와 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `config.fieldPath` raw + `output.items` 평가 결과 — 직교. 부합.
   - Principle 2: `meta.itemCount` / `meta.fellBackToEmpty` 모두 메트릭. 부합.
   - Principle 7: `rawConfig.fieldPath` echo (`split.handler.ts:40-41`) — 표현식 보존. 부합.
   - Principle 9.2 대칭성: ForEach `{items, count}` 와 동일 컬렉션 키. 부합.
   - Principle 10: 비배열 fallback 적용. 부합.

6. **handler 테스트 (`split.handler.spec.ts`)**:
   - 정상 / scalar 항목 / nested fieldPath / inline expression-resolved array / 비배열 fallback / null 값 / 빈 배열 (fellBackToEmpty=false) / rawConfig echo / meta 메트릭 모두 커버 (`:1-233`).
   - 분기 케이스 spec §5.1 단일 — 모든 케이스 커버. 누락 분기 없음.

7. **횡단 일관성 (데이터 노드 2종)**:
   - Split 의 `{ items, count }` ↔ Merge (`merge.md`) 의 결과 형태와 [공통 §5](../../../spec/4-nodes/1-logic/0-common.md) 컬렉션 키 대칭성 유지. ForEach 의 `{ items, count }` 와도 일관.
   - `meta.fellBackToEmpty` 는 Filter 의 비배열 입력 처리 (filter 는 throw — Principle 10 표) 와 대비되는 의도적 차이. 두 노드 모두 Principle 10 표에 명시.

8. **구현 품질**:
   - `resolveFieldValue` (`split.handler.ts:43`) 를 통한 dot-path / inline-array 통합 처리 — spec §4 와 일치. dead code 없음.
   - `Array.isArray` 가드 (`:45`) — null/undefined/object/string 모두 같은 fallback 경로. 안전.
   - `SplitItem` interface (`:18-21`) 가 spec §5.1 의 `{ index, value }` shape 와 1:1.

## 종합 개선안 (2026-05-16)

권고 없음 — 모든 단면 (spec / schema / handler / tests) 이 conventions Principle 0–11 과 정합. `output.count` ↔ `meta.itemCount` 의 의도적 중복도 spec footnote 와 plan §"진단" 의 일관된 정당화로 유지.
