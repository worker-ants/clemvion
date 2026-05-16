# Parallel output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 의 §5.2 JSON 예시·필드 표에서 `meta` 가 여전히 누락된 상태(2026-05-16 확인). 컨테이너 컨트랙트 (Principle 9) 자체는 정합.
> 잔여 권고 항목:
> - §5.2 (`done` 포트) JSON 예시 + 필드 표에 `meta.durationMs` (engine 공통) + `meta.branches` (= `branches.length`, Container 메트릭 — Principle 2) 보강. 다른 Container 노드 (Loop / ForEach / Map) 와 일관성 확보.
> - (2026-05-16 구현 분석) `errorPolicy` 가 schema 에 노출되지 않음(`parallel.schema.ts:29-67`) — handler 도 echo 안 함. spec §1 미구현 마킹 유지 + 추후 노출 검토. `parallel.handler.spec.ts` 자체 부재 — `parallel.schema.spec.ts` 에 handler 테스트가 통합되어 있으나 unit-test 파일 분리 권장.

> 대상 spec: `spec/4-nodes/1-logic/10-parallel.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/10-parallel.md:77-83` — §5.1 시작 (N 분기 fan-out):

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": null,
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

`spec/4-nodes/1-logic/10-parallel.md:95-107` — §5.2 완료 (`done`, 엔진 오버라이트):

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": {
    "branches": [
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "validate", "ok": true } },
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "enrich", "ok": true } },
      { "status": "rejected",  "error": { "code": "Error", "message": "notify failed" } }
    ]
  },
  "port": "done"
}
```

## 진단

Parallel 은 **컨테이너** (병렬 fan-out). 단계 2개. Loop 와 같이 `output: null` → engine override 컨트랙트 채택.

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 (N 분기 fan-out) | `output: null`, `port: string[]` | 적절 — Principle 9.1 + Principle 5 fan-out |
| 반복 중 | (각 분기 서브그래프가 자체 output) | 적절 |
| 완료 (`done`) | `output: { branches: BranchResult[] }`, `port: 'done'` | 적절 — `Promise.allSettled` 모델 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output.branches[i].status: 'fulfilled' | 'rejected'` | 적절 (output) | 분기 종료 상태 — 비즈니스 데이터 |
| `output.branches[i].value` (fulfilled 시) | 적절 | 분기 terminal 노드 출력 |
| `output.branches[i].error: {code, message}` (rejected 시) | 적절 | `errorPolicy='continue'` 모드의 실패 분기 정보 |
| `meta` | spec §5.2 에 명시 없음 (생략?) | 미흡 — `meta.durationMs` / `meta.branches` 카운트 등이 없음 |
| `config.*` (raw echo) | 적절 | Principle 7 |
| `port: string[] → 'done'` | 적절 | 단계 전이 |

추가 점검:

1. **`output.count` 제거됨** — spec §5.2 명시: "P1.1 직교성 — `branches.length` 가 SSOT". 적절 (Principle 1.1 직교).
2. **`meta` 누락** — §5.2 JSON 예시에 `meta` 필드가 없음. CONVENTIONS Principle 2 에 따라 최소한 `meta.durationMs` 와 `meta.branches` (Container 메트릭) 가 채워져야 함. spec 보강 필요.
3. **dead field `waitAll`** — schema 에 노출되지만 P1 에서 항상 `true` 로 동작. spec §1 미구현 마킹. raw echo 는 유지하나 사용자 혼동 우려 — schema 단계 제거 또는 reject 가 [개선안 logic/parallel.md §3](../../../plan/complete/archive/from-user-memo/node-specs-improvement/logic/parallel.md#3-제안된-output-구조) 에서 제안. 본 plan 은 spec 본문에 dead field 경고가 잘 명시되어 있어 변경 없음.
4. **`errorPolicy` config 누출 미흡** — schema 에 노출되지 않았다고 §1 미구현 마킹 — config echo 도 안 됨. P1 schema 노출 시 plan 갱신.

## 개선안 — 정리된 output

**시작 단계:**
```json
{
  "config": { "branchCount": <number raw>, "maxConcurrency": <number raw>, "waitAll": <boolean raw> },
  "output": null,
  "port": ["branch_0", ..., "branch_{N-1}"]
}
```

**완료 단계 (엔진 오버라이트, `meta` 보강 권장):**
```json
{
  "config": { "branchCount": <raw>, "maxConcurrency": <raw>, "waitAll": <raw> },
  "output": {
    "branches": [
      { "status": "fulfilled", "value": <unknown> } | { "status": "rejected", "error": { "code": ..., "message": ... } },
      ...
    ]
  },
  "meta": {                                           // ⚠ 현 spec 에 누락 — 보강 필요
    "durationMs": <number>,
    "branches": <number>,                             // = branches.length, Container 메트릭 (Principle 2)
    "fulfilledCount"?: <number>,                      // 진단용
    "rejectedCount"?: <number>                        // 진단용 (errorPolicy='continue' 시)
  },
  "port": "done"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음 — 현재 output 은 정리되어 있음) | — | |

## Rationale

- 컨테이너 컨트랙트 (`output: null` → 컬렉션 키 오버라이트) 가 일관성 있게 적용됨.
- `Promise.allSettled` 모델 (`{status, value | error}`) 은 분기별 독립 결과를 명확히 표현 — `errorPolicy='stop'` 에서는 첫 실패 시 즉시 throw 되므로 `branches[i]` 가 모두 fulfilled, `errorPolicy='continue'` 에서만 rejected 가 관찰됨.
- 컬렉션 키 = `branches` 로 Loop/ForEach/Map 과 시멘틱 구분 (병렬 분기 vs 반복).
- **`meta` 보강**: spec §5.2 의 JSON 예시에 `meta` 가 빠져 있어 다른 컨테이너 노드 (`Loop`, `ForEach`, `Map`) 와 일관성이 떨어짐. 최소한 `meta.durationMs` 와 `meta.branches` 권장.

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/logic/parallel/{parallel.handler.ts, parallel.schema.ts, parallel.schema.spec.ts, parallel.component.ts}`. `parallel.handler.spec.ts` 는 존재하지 않으며 `parallel.schema.spec.ts` 에 handler.execute / handler.validate 테스트가 통합되어 있다.

1. **spec §5 ↔ handler return 정합성 (컨테이너 컨트랙트)**:
   - `parallel.handler.ts:52-60` 의 return 객체 `{ config: { branchCount, maxConcurrency, waitAll }, output: null, port: ports }` — 시작 시점 반환. spec §5.1 JSON 과 정합 (`output: null` + `port: string[]`).
   - **gap1**: handler 가 `config.errorPolicy` 를 echo 하지 않는다 — schema 에 노출되지 않은 미구현 필드 (§1 마킹). spec 본문은 P1 미구현이라고 명시하므로 spec ↔ 구현 정합. schema 노출 시 함께 echo 추가 필요.
   - 완료 시점 `{ branches: [...] }` 오버라이트는 엔진 책임 (`ParallelExecutor`) — handler 가 직접 반환하지 않음. Principle 9.2 부합.

2. **schema ↔ spec config 정합성**:
   - `parallelNodeConfigSchema` (`parallel.schema.ts:29-67`): `branchCount` (int, 2-16, default 2) / `maxConcurrency` (int, 0-16, default 0) / `waitAll` (boolean, default true). spec §1 표와 일치.
   - **gap2**: spec §1 의 `errorPolicy` 필드는 schema 에 부재 (§1 미구현 마킹). 정합 (의도).
   - **dead field**: `waitAll` 은 schema 에 있으나 P1 항상 true 동작 (spec §1 마킹). raw echo 유지.

3. **validate 일관성**:
   - `parallel.handler.ts:21-26` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` (warningRules + `validateConfig` SSOT) 만 사용 — SSOT 침범 없음. 깔끔.
   - `warningRules` (`parallel.schema.ts:140-146`) 가 `parallel:branch-count-out-of-range` 만 정의 (canvas badge용 mini-DSL), `validateParallelConfig` (`:85-118`) 가 integer / range / boolean type 가드. 분리 명확.
   - **gap3**: 메시지 일관성 — `branchCount must be 2 to 16.` (warningRule) vs `branchCount must be a value between 2 and 16.` (validateConfig) 가 다름 — `parallel.schema.spec.ts:171-173` 가 두 메시지 모두 검증. 의도된 분리 (canvas vs runtime) 지만 사용자 노출 시 중복 메시지 발생.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw (config validate) 만 사용 — runtime `port:'error'` 없음 (spec §6 명시). `errorPolicy=continue` 의 분기 실패 정보 수집은 엔진 책임. 부합.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `output: null` + `port: string[]` — config 와 직교. 부합.
   - Principle 2: handler 가 `meta` 를 발행하지 않음 — 완료 시점 엔진이 `meta.durationMs` 만 주입 (engine 공통). **잔여 권고 항목** — `meta.branches` (= `branches.length`) / `meta.fulfilledCount` / `meta.rejectedCount` 도 엔진에서 inject 검토. spec §5.2 `meta` 표 자체 부재.
   - Principle 5: 시작 `port: string[]` (fan-out) → 완료 `port: 'done'` (단일). 부합.
   - Principle 6: `branch_<index>` 동적 포트 ID — `<prefix>_<index>` 형식. 부합.
   - Principle 7: `branchCount` / `maxConcurrency` / `waitAll` raw echo (`parallel.handler.ts:53-57`). 부합. clamp 는 `port.length` 에서 관찰 (테스트 `parallel.schema.spec.ts:220-242`).
   - Principle 9: `output: null` 컨테이너 컨트랙트 + 엔진 오버라이트. 부합.

6. **handler 테스트 (`parallel.schema.spec.ts` 에 통합)**:
   - schema 기본값 / 명시 값 / 메타데이터 / handler.validate (branchCount 범위, maxConcurrency 범위·정수, waitAll boolean) / warningRules / validateParallelConfig / evaluateMetadataBlockingErrors / handler.execute (branchCount 포트 생성 + `output: null`, config echo, default 2, clamp 16, raw echo of out-of-range maxConcurrency).
   - **누락**:
     - handler 의 `rawConfig` 우선 사용 (`parallel.handler.ts:51`) 직접 확인 테스트 없음 — `{{ }}` 표현식 echo 시나리오는 if-else 처럼 별도 테스트 권장.
     - 별도 `parallel.handler.spec.ts` 파일 부재 — 다른 노드(`if-else`/`foreach`/`merge`/`background`)는 분리되어 있어 횡단 컨벤션 위배.

7. **횡단 일관성 (컨테이너 4종)**:
   - Loop / ForEach / Map 은 완료 시점 `{<key>, count}` (count 포함) — Parallel 만 `{branches}` (count 제거, spec §5.2 footnote: "P1.1 직교성 — `branches.length` 가 SSOT"). 일관성을 위해 다른 3 노드의 `count` 도 제거 검토할지, 아니면 Parallel 만 추가할지 결정 필요. 현 spec 은 분기 의도 (Parallel 은 fan-out, 다른 노드는 반복 — count 의미 차이) 로 정당화하지만 동일 컨테이너 카테고리에서 비대칭.
   - 완료 시점 `meta`: Loop / ForEach / Map 은 `meta.iterations` (Parallel: `meta.branches` 권고) — 횡단 명명 통일 필요 (`iterations` vs `branches` 차이는 의도).

8. **구현 품질**: clean — clamp 로직 (`Math.max(2, Math.min(16, Math.floor(...)))`) 명확. `rawConfig ?? config` (`:51`) 패턴 일관. ParallelExecutor 위임 분리 깔끔.

## 종합 개선안 (2026-05-16)

- [ ] (spec) §5.2 JSON 예시 + 필드 표에 `meta.durationMs` (engine inject) + `meta.branches` (= `branches.length`, Container 메트릭) 보강. 옵션으로 `meta.fulfilledCount` / `meta.rejectedCount` (`errorPolicy=continue` 진단용) 추가 검토. 근거: spec `10-parallel.md:95-107` 와 Loop/ForEach/Map 의 `meta.iterations` 일관성.
- [ ] (impl) 엔진 (`ParallelExecutor`) 측에서 완료 시점 오버라이트에 `meta.branches` / `meta.durationMs` inject — 위 spec 결정에 따라.
- [ ] (impl) `parallel.handler.spec.ts` 분리 신설 — 다른 노드와 횡단 컨벤션 일치. `parallel.schema.spec.ts` 의 handler.execute / handler.validate 블록 (`:35-242`) 을 옮긴다. 근거: `foreach.handler.spec.ts` / `merge.handler.spec.ts` / `background.handler.spec.ts` 의 분리 패턴.
- [ ] (impl) handler.execute 의 `rawConfig` 우선 echo (`parallel.handler.ts:51-57`) 직접 확인 unit-test 추가 — `{{ }}` template 시나리오는 numeric/boolean 필드라 의미가 약하나 일관성 차원.
- [ ] (spec) `branchCount` 범위 에러 메시지 통일 — `parallel.schema.ts:144` (`must be 2 to 16.`) vs `:95-96` (`must be a value between 2 and 16.`) 가 다름 → mini-DSL 메시지를 imperative 와 동일하게 통일하거나, validateConfig 가 warningRule 발화 시 imperative 검사 skip.
