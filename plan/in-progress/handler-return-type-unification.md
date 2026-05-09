# Handler Return Type Unification — `Promise<NodeHandlerOutput>` strict 화 + spec fixture 정규화

## A. 배경 (Why)

ai-review `2026-05-06_17-27-43` SUMMARY.md §INFO 에서 발견된 3건이, `plan/complete/ai-review-deferred-items.md` (구 `plan/in-progress/ai-review-deferred-items.md`) 의 9개 PR (B-doc / A / D / C / E / F / G / H / I) 일괄 처리 후에도 **별도 PR 권장 사유로 deferred** 되어 있다. 본 plan 은 그 3건을 단일 plan 으로 통합·상세 재정리한다.

| # | 카테고리 | 발견사항 | 실제 위치 (현재) |
|---|---------|---------|----------------|
| **INFO #1** | API Contract | `ExecutionContext.rawConfig` / `structuredOutputCache` 가 `?` optional 이지만 런타임에는 엔진이 항상 주입. 핸들러 작성자에게 혼란 | `backend/src/nodes/core/node-handler.interface.ts:14, L26, L47-49, L77, L89` |
| **INFO #2** | API Contract / Requirement | `NodeHandler.execute` 반환 타입 `Promise<NodeHandlerOutput> \| Promise<unknown>` 이 사실상 `Promise<unknown>` 과 동치. 신규 핸들러가 잘못된 shape 반환 시 컴파일 에러 없음 | `backend/src/nodes/core/node-handler.interface.ts:163-170` |
| **INFO #14** | Testing | `execution-engine.service.spec.ts` 의 `mockHandler.execute` 가 `{ processed: true, input }` 레거시 flat shape 반환. `adaptHandlerReturn` 거동 변경 시 다수 테스트가 예상치 못하게 실패 | `backend/src/modules/execution-engine/execution-engine.service.spec.ts:130-136` (mockHandler 정의), 동 파일 L1452, L2342, L2531, L2931 외 `execute: jest.fn` 패턴 **약 60곳** |

원 plan 에서 보류된 사유 — "high blast radius (spec.ts ~16 fixture 영향)" + "별도 PR 로 mockHandler 정규 shape 변경과 함께 일괄 처리 권장". 실제 grep 시 `execute: jest.fn` = **60곳** 으로 확인되어 위험도가 한 단계 더 크다.

세 항목은 하나의 contract 단일화 흐름으로 묶인다:
- INFO #2 가 시그니처 strict 화의 **핵심**.
- INFO #14 는 시그니처 strict 화 시 spec.ts 가 즉시 TS 에러를 내는 **연쇄 의존**.
- INFO #1 은 같은 인터페이스 파일의 JSDoc 정합성 보강이라 **함께 처리하는 것이 자연스러움**.

---

## B. 현재 상태 스냅샷 (검증 결과)

### B-1. interface.ts 의 union 타입 (INFO #2)

```ts
// backend/src/nodes/core/node-handler.interface.ts:163-170
export interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> | Promise<unknown>; // ← INFO #2
}
```

### B-2. 프로덕션 핸들러 27개 중 반환 시그니처 분포

- `Promise<NodeHandlerOutput>` 명시 (4): `manual-trigger`, `background`, `parallel`, `information-extractor`
- `Promise<unknown>` (24): `database-query`, `send-email`, `http-request`, `split`, `foreach`, `variable-modification`, `merge`, `map`, `switch`, `variable-declaration`, `filter`, `if-else`, `loop`, `text-classifier`, `ai-agent`, `code`, `transform`, `form`, `chart`, `template`, `carousel`, `workflow`, `table`, 그리고 `information-extractor` 의 helper signatures (L283, L419)

(`grep -rln "Promise<unknown>" backend/src/nodes/` = 28 파일, 일부는 helper / spec 포함.)

#### 표본 검증

`foreach.handler.ts:50-53`:

```ts
return Promise.resolve({
  config: { arrayField: rawConfig.arrayField },
  output: items,
});
```

→ 이미 canonical shape 반환. 시그니처만 stale.

`http-request.handler.ts:127` 도 `Promise<unknown>` 시그니처지만 본문은 `{ config, output, meta }` canonical shape (확인 완료).

→ **24개 핸들러 모두 canonical shape 를 반환하고 있어 시그니처 변경만으로 충분할 가능성이 매우 높다.** 단, 본 plan 실행 시 각 파일의 마지막 return 문을 확인해 strict signature 변경 후 컴파일이 통과하는지 검증.

### B-3. spec.ts mockHandler (INFO #14)

```ts
// backend/src/modules/execution-engine/execution-engine.service.spec.ts:130-136
const mockHandler: NodeHandler = {
  validate: () => ({ valid: true, errors: [] }),
  execute: jest.fn(async (input: unknown) => ({
    processed: true,           // ← legacy flat shape
    input,
  })),
};
```

추가로 동 파일 내 `mockHandler.execute as jest.Mock).mockResolvedValue` 또는 `execute: jest.fn` 으로 in-place 정의되는 핸들러 fixture 가 **60곳** (spec.ts L132 ~ L3810+). 모두 `{ processed: true, ... }` / `{ value: 'data' }` / `{ ok: true }` / `{ port: '...', data: ... }` 등 bare/legacy shape.

### B-4. lenient 모드의 의존 사슬

`backend/src/modules/execution-engine/handler-output.adapter.ts`:

- `adaptHandlerReturn` (L34) — 프로덕션은 strict throw, 그 외 (`NODE_ENV !== 'production'`) 은 `wrapBareAsNodeHandlerOutput` 로 fallback
- `wrapBareAsNodeHandlerOutput` (L90) — bare object 의 top-level `status` / `port` / `_resumeState` 만 lift 하고 나머지는 `output: raw` 로 wrap

따라서 spec.ts 의 60곳 fixture 는 lenient 경로에 의존 중. signature 변경 (`Promise<NodeHandlerOutput>`) 만 하면 spec.ts 가 일제히 TS 에러를 낸다 — **fixture 마이그레이션이 signature 변경과 동일 PR (또는 상호 종속 PR 묶음) 에서 함께 진행돼야 한다.**

### B-5. 다른 위험 인자

- `ExecutionContextService.setNodeOutput` 등 일부 엔진 내부 경로가 `wrapBareAsNodeHandlerOutput` 을 직접 호출 (handler-output.adapter.ts:25-32 docstring 참고). 본 함수 자체는 **유지** — 삭제 대상이 아님.
- `backend/src/nodes/integration/_base/integration-handler-base.spec.ts:16` 의 mock signature 도 `Promise<unknown>` — 함께 수정 필요.
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` 등 일부 핸들러 spec 도 `Promise<unknown>` 사용 — 함께 검토.

---

## C. 목표 (What)

1. **interface.ts 시그니처 단일화** (INFO #2) — `Promise<NodeHandlerOutput> | Promise<unknown>` → `Promise<NodeHandlerOutput>` 단일.
2. **24개 프로덕션 핸들러 시그니처 갱신** — `Promise<unknown>` → `Promise<NodeHandlerOutput>`. 본문은 이미 canonical 이므로 무변경 (검증 후 확정).
3. **spec.ts (그리고 다른 spec.ts 류) 60+ fixture 마이그레이션** (INFO #14) — `{ processed: true, input }` → `{ config: {}, output: { processed: true, input } }` 등 canonical shape.
4. **`adaptHandlerReturn` lenient mode 처리 결정** — D-1 결정 후 코드/테스트 적용.
5. **INFO #1 처리** — JSDoc 보강 + 테스트 헬퍼 factory 도입 여부 결정 (D-2).

---

## D. 옵션 / 결정 필요 (Decision Points)

### D-1. `adaptHandlerReturn` 의 lenient mode

| 안 | 설명 | 트레이드오프 |
|----|------|------------|
| **(가) 유지** | non-prod 에서는 lenient 유지. spec 마이그레이션은 일관성 차원에서 진행 | 타입은 strict, 런타임은 lenient — 이중 contract |
| **(나) 제거 (권장)** | `adaptHandlerReturn` 도 항상 strict. 비-canonical 는 항상 throw | 단일 contract / 향후 런타임 디버깅 명확. 마이그레이션 없는 fixture 는 즉시 fail — 강제력 ↑ |
| **(다) 경고만** | non-prod 에서 lenient + console.warn (deprecation) | 점진 마이그레이션 가능하지만, 두 가지 모드 유지 부담 |

**권장: (나)** — TS 시그니처 strict 와 런타임 strict 가 일치해야 INFO #2 의 본질이 해소됨. spec.ts 마이그레이션을 같은 PR 에서 끝내므로 (다)/(가) 의 점진성 이점이 약함. 단, 구현 진입 시 사용자 재확인 필요.

### D-2. INFO #1 (`ExecutionContext` engine-injected 필드)

| 안 | 설명 |
|----|------|
| **(가) 분리 인터페이스** | `EngineRuntimeContext extends ExecutionContext` 도입, `_executedNodes` / `structuredOutputCache` / `engineResolvedConfigCache` / `rawConfig` 이전 |
| **(나) JSDoc 보강만 (권장)** | 기존 인터페이스 유지, "엔진이 항상 주입" 명시 + `makeExecutionContext(overrides)` 테스트 헬퍼 추가 |

**권장: (나)** — 구 plan §A.4 (INFO #4 EngineRuntimeContext 분리) 가 "✅ 현 컨벤션 충분 — `_executedNodes` `_` prefix + JSDoc internal 마커. 별도 인터페이스 분리 불필요" 로 이미 결정됨. 일관성 차원에서 (나) 선택 — JSDoc 한 줄 보강 + `makeExecutionContext(overrides)` 헬퍼.

### D-3. spec.ts fixture 마이그레이션 패턴

| 안 | 마이그레이션 모양 |
|----|------------------|
| **(가) 명시적** | 각 fixture 에 직접 `{ config: {}, output: { ... } }` 작성 |
| **(나) 헬퍼 (권장)** | `mockOutput(output, opts?)` 헬퍼로 `{ config: {}, output, ...opts }` 생성. 60곳 적용 |

**권장: (나)** — 가독성 + 향후 contract 변경 시 한 곳 수정으로 전파. 헬퍼 위치는 `execution-engine.service.spec.ts` 상단 또는 `backend/src/modules/execution-engine/__test__/mock-output.ts` 신규.

---

## E. 변경 범위 / Critical Files

### E-1. 인터페이스 (1 파일)

- `backend/src/nodes/core/node-handler.interface.ts:163-170` — union 제거 (`| Promise<unknown>` 삭제)
- `backend/src/nodes/core/node-handler.interface.ts:14, 26, 47-49, 77, 89` (INFO #1) — JSDoc 보강:
  - "엔진이 dispatch 직전 항상 주입한다. `?` 표기는 테스트 fixture 에서 생략을 허용하기 위함."

### E-2. 프로덕션 핸들러 시그니처 (24 파일)

`grep -rl "Promise<unknown>" backend/src/nodes/` 결과 중 핸들러 본체 24개:

- integration: `database-query.handler.ts`, `send-email.handler.ts`, `http-request.handler.ts`
- logic: `split.handler.ts`, `foreach.handler.ts`, `variable-modification.handler.ts`, `merge.handler.ts`, `map.handler.ts`, `switch.handler.ts`, `variable-declaration.handler.ts`, `filter.handler.ts`, `if-else.handler.ts`, `loop.handler.ts`
- ai: `text-classifier.handler.ts`, `ai-agent.handler.ts`, `information-extractor.handler.ts` (helper L283/L419)
- data: `code.handler.ts`, `transform.handler.ts`
- presentation: `form.handler.ts`, `chart.handler.ts`, `template.handler.ts`, `carousel.handler.ts`, `table.handler.ts`
- flow: `workflow.handler.ts`

각 파일에 대해:
1. `execute(...): Promise<unknown>` → `: Promise<NodeHandlerOutput>` 변경
2. `import { NodeHandlerOutput }` 추가 (필요 시)
3. 컴파일러가 본문의 return 문에서 contract 위반 발견 시 즉시 수정 (현재까지 표본 검증으론 위반 없음)

### E-3. 핸들러 spec 파일

- `backend/src/nodes/integration/_base/integration-handler-base.spec.ts:16` — mock signature 갱신
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` — 검토
- 기타 27개 핸들러 spec 중 `Promise<unknown>` 시그니처 사용처 — 일괄 검토

### E-4. execution-engine.service.spec.ts (1 파일, ~60 fixture)

- L130-136 mockHandler 기본값 → `mockOutput({ processed: true, input })` (D-3 (나) 헬퍼)
- 60+ `execute: jest.fn(async ... => ({ ... }))` fixture → canonical shape 또는 `mockOutput` 호출
- L1452, L2342, L2531, L2931 등 `mockResolvedValue({ processed: true })` → `mockResolvedValue(mockOutput({ processed: true }))`
- 일부 fixture 는 `{ port, data }` 형태로 routing 의도 — `mockOutput(data, { port: '...' })` 로 변환

### E-5. handler-output.adapter.ts

- D-1 (나) 채택 시:
  - `adaptHandlerReturn` (L34-76) lenient 분기 제거, `process.env.NODE_ENV` 체크 삭제, 항상 `isNewShape` 검사 후 throw
- `wrapBareAsNodeHandlerOutput` (L90-111) 은 **유지** — `ExecutionContextService.setNodeOutput` 등이 직접 호출 (engine internal coercion)
- `handler-output.adapter.spec.ts` — lenient mode 테스트 (있다면) 삭제, strict throw 테스트 추가

---

## F. 검증

- `cd backend && npm run lint && npm run test && npm run build` — green
- `npm run test -- execution-engine.service.spec` — 322 tests 모두 통과 (회귀 0)
- `npm run test -- handler-output.adapter.spec` — strict mode 회귀 케이스 추가
- 핸들러별 spec — 27 파일 모두 통과
- TypeScript 컴파일이 향후 비-canonical return 시도를 차단하는지 회귀 테스트 1건 (`@ts-expect-error` 마커 + 의도적 잘못된 return shape)

---

## G. PR 분할 권장

### 단일 PR (권장)

근거:
- spec.ts signature 변경과 fixture 마이그레이션이 분리되면 중간 단계에서 컴파일 깨짐
- 60곳 fixture 마이그레이션은 헬퍼 도입 후 mechanical replace 1회로 끝남
- D-1 (나) 선택 시 lenient 제거가 같은 commit 에 들어가야 일관성 보장

### 분할이 필요한 경우 (리뷰 부담 분산)

- **PR-1 (production 시그니처)** — interface.ts + 24 핸들러 + 핸들러 spec. 본문 무변경, 시그니처만 (저위험)
- **PR-2 (test fixture 마이그레이션)** — execution-engine.service.spec.ts + handler-output.adapter.ts lenient 제거 + `mockOutput` 헬퍼

PR-1 → PR-2 순서. PR-1 후에도 spec.ts 가 lenient mode 로 buffer 되므로 빌드 깨지지 않음.

---

## H. Final 체크리스트

- [ ] D-1 (lenient mode 처리), D-2 (INFO #1 접근), D-3 (fixture 헬퍼 모양) 사용자 재확인
- [ ] interface.ts union 제거
- [ ] interface.ts JSDoc 보강 (INFO #1)
- [ ] 24 production 핸들러 시그니처 갱신
- [ ] 핸들러 spec mock signature 갱신
- [ ] mockHandler 기본값 canonical shape
- [ ] `mockOutput` 헬퍼 도입 (위치 결정 포함)
- [ ] 60+ fixture 마이그레이션
- [ ] `adaptHandlerReturn` lenient 분기 제거 (D-1 결정 따라)
- [ ] `handler-output.adapter.spec.ts` 회귀 케이스
- [ ] `@ts-expect-error` 컴파일 차단 회귀 테스트
- [ ] lint / test / build green
- [ ] 본 plan 의 모든 항목 처리 시 `git mv plan/in-progress/handler-return-type-unification.md plan/complete/`

---

## 인입 참조

- 구 plan: `plan/complete/ai-review-deferred-items.md` (이전엔 `plan/in-progress/`. 본 plan 은 그 §"Deferred (보류 — 별도 PR 권장)" 의 후속)
- 원 리뷰: `review/2026-05-06_17-27-43/SUMMARY.md` §INFO #1, #2, #14
