# 노드 config 표현식(`{{...}}`) 처리 버그 — 전수 점검 + 수정 설계

## Context

**최초 증상**: Loop 노드의 `count` 필드를 `{{3}}` 으로 설정 시 body port 실행 내역 0건.

**전수 조사 범위**: 표현식을 받을 수 있는 모든 노드 타입 — 컨테이너 노드(Loop/ForEach/Map/Parallel/Switch/If-Else/Background/Split/Filter/Merge/Variable…) + 일반 노드(Integration/AI/Data/Presentation/Flow/Trigger).

---

## Part 1. 진단 결과

### 결론 한 줄

> **버그는 "엔진이 컨테이너 동작 파라미터를 핸들러의 raw-echo 출력(`structured.config`)에서 다시 읽는 분기"에서만 발생한다. 일반 노드는 echo 만 raw 이고 동작은 평가된 `config` 인자로 수행하므로 안전하다.**

### 🔴 BROKEN

#### Loop — `count`, `maxIterations`

- 핸들러: `backend/src/nodes/logic/loop/loop.handler.ts:37-42` 가 `rawConfig.count` echo
- 엔진: `backend/src/modules/execution-engine/execution-engine.service.ts:3841-3895`
  ```ts
  const structured = context.structuredOutputCache?.[containerNode.id];
  const resolvedConfig = structured?.config ?? containerNode.config ?? {};   // L3842 ← raw echo 진입
  // …
  const count = Number(resolvedConfig.count ?? 0);                            // L3886 → Number("{{3}}") = NaN
  ```
- 증상: `for (i < NaN)` 0회 실행 → body port 비어 있음.

#### Parallel — `branchCount`, `maxConcurrency`, `waitAll` (Loop 보다 더 은밀)

- 핸들러: `backend/src/nodes/logic/parallel/parallel.handler.ts:47-52`
- 엔진: `execution-engine.service.ts:3629-3645`
  ```ts
  const branchCount =
    typeof resolvedConfig.branchCount === 'number' &&
    Number.isFinite(resolvedConfig.branchCount)
      ? Math.max(2, Math.min(16, Math.floor(resolvedConfig.branchCount)))
      : 2;                                                                    // string "{{4}}" → 조용히 default 2
  ```
- 증상: 에러 없이 잘못된 분기 수로 실행. 발견 늦음.

### 🟡 THEORETICAL — ForEach/Map `errorPolicy`

`(resolvedConfig.errorPolicy as 'stop' | 'skip' | 'continue') ?? 'stop'` — TS cast 만, 런타임 검증 X. 사용자가 `errorPolicy: "{{...}}"` 입력 시 raw 문자열이 executor 로 진입. 흔치 않은 시나리오.

### 🟢 SAFE

- ForEach/Map 의 배열 입력: `handlerOutput = structured?.output` 경로 (핸들러가 평가된 `config` 로 계산한 결과)
- If-Else / Switch / Split / Filter / Merge / Background / Variable: 분기·동작이 핸들러 내부에서 완료 (`_selectedPort` 만 신뢰)
- Integration / AI / Data / Presentation / Flow / Trigger: echo 만 raw, 동작은 평가된 `config` 인자

### 패턴 도식 (현재 결함)

```
   사용자 config (raw, "{{3}}")
              │
              ▼
   resolveConfig (평가) ─────────► resolvedConfig (3, number)  ┐
              │                                                │
              ▼                                                │ executeNode 안에서만 살아있고
   handler(input, resolvedConfig, ctx)                         │ 핸들러 호출 후 사라짐 ❌
     ・echo: ctx.rawConfig.count  ──► output.config = "{{3}}"  │
              │                                                │
              ▼                                                │
   structuredOutputCache[nodeId] = { config: "{{3}}", … }      │
              │                                                │
              ▼                                                │
   runContainerInner / runParallel                             │
     resolvedConfig = structured?.config ?? node.config        │ 변수명만 resolved,
     Number(resolvedConfig.count) → NaN ❌                     │ 실제는 raw
```

---

## Part 2. 엔진측 수정안 (상세)

### 핵심 아이디어

> **Echo 채널과 엔진 동작 채널을 분리**한다. `structured.config` 는 raw echo 전용으로 둔 채(`$node[X].config` 표현식 접근에서 `{{...}}` 보존), **엔진 동작 파라미터용 평가된 config 를 별도 슬롯에 저장·재사용**한다.

### 왜 이 방식인가 (대안 비교)

| 옵션 | 내용 | 평가 |
| --- | --- | --- |
| **A. 새 슬롯 추가 (선택)** | `executeNode` 가 이미 계산한 `resolvedConfig` 를 `engineResolvedConfigCache[nodeId]` 에 별도 저장. 컨테이너 엔진은 여기서 읽음 | ✅ 재평가 없음, 부수효과 없음, 채널 분리 명확, 변경 국소적 |
| B. `structured.config` 를 평가된 값으로 변경 | echo 가 평가값이 됨 — `{{...}}` 표현식 보존 깨짐 (Phase 3 의 Principle 7 후퇴) | ❌ |
| C. `runContainerInner` 에서 재 resolve | exprContext 재구성 필요(`nodeMap`, `nodeInput` 등 caller 가 안 가짐). 부수효과 있는 표현식(예: 시간 함수, 카운터) 이중평가 위험 | △ |
| D. 핸들러가 evaluated 값을 별도 필드로 반환 | 13+ 컨테이너 핸들러 컨벤션 변경, Phase 3 작업 되돌림 | ❌ |

**옵션 A** 가 변경 면적이 가장 작고 의미가 가장 명확. 아래는 옵션 A 의 상세 설계.

### 수정 대상 파일·위치

| # | 파일 | 라인 (현재) | 작업 |
| --- | --- | --- | --- |
| 1 | `backend/src/modules/execution-engine/context/execution-context.service.ts` (또는 context 정의 파일) | 캐시 정의 | `engineResolvedConfigCache: Record<string, Record<string, unknown>>` 슬롯 추가 + setter `setEngineResolvedConfig(executionId, nodeId, cfg)` |
| 2 | `backend/src/nodes/core/node-handler.interface.ts` (또는 `ExecutionContext` 정의) | `ExecutionContext` 타입 | `engineResolvedConfigCache?: Readonly<Record<string, Record<string, unknown>>>` 노출 (read-only 로) |
| 3 | `execution-engine.service.ts:2414-2463` | 핸들러 호출 직후 | `resolvedConfig` 를 `engineResolvedConfigCache` 에도 저장 (`setStructuredOutput` 직후 한 줄 추가) |
| 4 | `execution-engine.service.ts:3629-3630` (Parallel) | runParallel 진입부 | 변수명 `resolvedConfig` → `engineResolvedConfig`, source 를 `context.engineResolvedConfigCache?.[parallelNode.id] ?? parallelNode.config` 로 변경 |
| 5 | `execution-engine.service.ts:3841-3842` (Container) | runContainerInner 진입부 | 동일 패턴으로 변경 |
| 6 | `execution-engine.service.ts:3886` (Loop count) | 동작 파라미터 | 안전망으로 `Number()` 강제 대신 `validateContainerCount()` 같은 헬퍼로 type-guard. 평가가 된 후라 number 면 그대로, string 이면 `Number(trim)` 후 finite 체크. 표현식이 실패해 string 이 그대로 도착하면 **명확한 에러**(`INVALID_LOOP_COUNT: <value>`) 던지기 |
| 7 | `execution-engine.service.ts:3632-3645` (Parallel typeof guards) | 동작 파라미터 | 같은 헬퍼로 통일. silent default fallback → 명확한 에러. |
| 8 | `execution-engine.service.ts:3851-3853, 3872-3873` (ForEach/Map errorPolicy) | enum cast | `validateErrorPolicy(value)` 헬퍼로 enum 검증 후 mismatch 시 default + warn |
| 9 | `backend/src/modules/execution-engine/expression/expression-resolver.service.ts` 또는 새 파일 | helper | `coerceContainerNumber(value, fieldName)`, `coerceContainerBoolean`, `coerceErrorPolicy` 신규 추가 (정상 number/boolean → 통과, string number 문자열 "3" → 변환, 표현식 미평가 string `"{{...}}"` → throw) |
| 10 | 테스트 | 신규 | Loop/Parallel/ForEach 의 expression-fed config 테스트. `{{3}}`, `{{$var.n}}`, `{{$input.x}}` 입력 시 정상 동작 확인. `$node[loopId].config.count` 가 여전히 raw 인지 invariant 테스트. |

### 변경 후 데이터 흐름 (수정안 적용)

```
   사용자 config (raw, "{{3}}")
              │
              ▼
   resolveConfig (평가) ─────────► resolvedConfig (3, number)
              │                              │
              │                              ├─► engineResolvedConfigCache[nodeId] = {count:3,…} ✨ NEW
              ▼                              │
   handler(input, resolvedConfig, ctx)       │
     ・echo: ctx.rawConfig.count             │
              │                              │
              ▼                              │
   structuredOutputCache[nodeId].config = "{{3}}"  (raw, 표현식 보존 OK)
                                             │
                                             ▼
   runContainerInner / runParallel
     engineResolvedConfig = ctx.engineResolvedConfigCache?.[id] ?? node.config
     coerceContainerNumber(engineResolvedConfig.count, 'count') → 3 ✓
     for (i = 0; i < 3; i++) … body port 정상 동작 ✓
```

### 불변 조건(Invariants) 보장

1. `$node[X].config.count` 표현식 접근 시 여전히 raw `"{{3}}"` 반환 (Phase 3 Principle 7 유지). `engineResolvedConfigCache` 는 **expression context 에 노출하지 않음** — `$node` 빌더에서 이 새 캐시를 참조하지 말 것 (점검 포인트: `expression-resolver.service.ts` 의 `buildExpressionContext`).
2. 핸들러 인터페이스는 변경 없음. 13+ 컨테이너 핸들러 코드 무수정.
3. Resume/multi-turn AI Agent: `executeNode` 가 매 호출마다 fresh resolve → 캐시 덮어씀. 이전 turn 의 stale 값 사용 위험 없음.

### Edge case 처리

- **iteration context 와의 분리**: Loop 의 `count` 는 `$loop.index` 가 아직 없는 outer context 에서 평가되어야 함. 현재 `executeNode` 가 컨테이너 진입 **전** 에 외부 컨텍스트로 평가하므로 그대로 OK. iteration 안의 body 노드들은 `executeContainerBody` 가 별도로 처리.
- **중첩 컨테이너**: 외부 Loop count 가 `{{$var.n}}`, 내부 Loop count 가 `{{$loop.index + 1}}` 인 경우. 내부 Loop 도 외부 iteration 의 context 에서 평가되어 별도 nodeId 키로 cache 에 저장되므로 충돌 없음. (단, 같은 nodeId 가 같은 execution 내에서 반복 진입할 수 있는지 확인 필요 — 일반적으로 재진입 시 외부 1회만 평가되므로 OK이지만 spec 확인 필요.)
- **노드 config 가 비어 있는 경우**: `node.config ?? {}` fallback 유지. 캐시 미스 시도 동일 fallback.

### 수정 후 동작 매트릭스

| 노드 | 필드 | 입력 | 수정 후 |
| --- | --- | --- | --- |
| Loop | count | `{{3}}` | 3회 ✓ |
| Loop | count | `{{$var.n}}` (n=5) | 5회 ✓ |
| Loop | count | `0` 또는 부정수 | 명확한 에러 (현재도 schema validate 에서 잡힘) |
| Parallel | branchCount | `{{4}}` | 4분기 ✓ |
| Parallel | maxConcurrency | `{{8}}` | 8 ✓ |
| Parallel | waitAll | `{{false}}` | false ✓ |
| ForEach/Map | errorPolicy | `{{$var.policy}}` (= 'skip') | 'skip' ✓ |
| 일반 노드 | 모든 표현식 필드 | `{{...}}` | 변동 없음 (이미 OK) |
| 모든 노드 | `$node[X].config.count` 등 표현식 접근 | 후속 노드에서 참조 | raw 그대로 (현 동작 유지) |

### 작업 단위(PR 분할 제안)

규모가 크지 않아 한 PR 로도 가능하지만, 리뷰 부담을 줄이려면 다음과 같이 쪼갤 수 있음:

1. **PR-1 (인프라)**: `engineResolvedConfigCache` 슬롯 추가, `executeNode` 에서 저장. 동작 변화 없음 (소비자 없음).
2. **PR-2 (Loop fix)**: `runContainerInner` Loop 분기를 새 캐시로 전환 + `coerceContainerNumber` helper. Loop 표현식 테스트.
3. **PR-3 (Parallel fix)**: `runParallel` 을 새 캐시로 전환. Parallel 표현식 테스트.
4. **PR-4 (ForEach/Map enum guard, 선택)**: `errorPolicy` 검증 강화.

PR-1 만 머지되면 PR-2~4 는 독립 진행 가능.

### 검증 방법(end-to-end)

1. **단위 테스트**:
   - `loop-executor.spec.ts` — count 가 number 로 들어왔을 때 정상 (기존 그대로). 추가 케이스 없음 (executor 단계는 변경 없음).
   - `execution-engine.service.spec.ts` 신규 케이스: Loop with `count: "{{3}}"`, with `count: "{{$var.n}}"`, with `count: "{{$input.x}}"`. body 가 3회 실행되고 iterations 길이 3 확인.
   - 동일 패턴으로 Parallel branchCount 표현식 테스트.
2. **invariant 테스트**: Loop 다음에 Template 노드를 두고 `{{ $node["Loop"].config.count }}` 표현식이 여전히 raw `"{{3}}"` 또는 raw `"{{$var.n}}"` 으로 그대로 보이는지 확인 (Phase 3 회귀 방지).
3. **수동 검증**: frontend 에서 워크플로우 만들어 Loop count 에 `{{3}}` 입력, 실행, body port 실행 내역 3건 확인.

### Critical Files

- `backend/src/modules/execution-engine/execution-engine.service.ts:2414-2463` (캐시 저장 추가)
- `backend/src/modules/execution-engine/execution-engine.service.ts:3629-3645` (Parallel 동작 파라미터)
- `backend/src/modules/execution-engine/execution-engine.service.ts:3841-3895` (Container 동작 파라미터)
- `backend/src/modules/execution-engine/context/execution-context.service.ts` (또는 동급 파일 — 캐시 슬롯 정의)
- `backend/src/nodes/core/node-handler.interface.ts` (`ExecutionContext` 타입에 캐시 노출)
- `backend/src/modules/execution-engine/expression/expression-resolver.service.ts` 또는 신규 helper 파일 (coerce 함수들)

### 핸들러 변경 없음 (확인용)

- `loop.handler.ts`, `parallel.handler.ts`, `foreach.handler.ts`, `map.handler.ts`: **수정 없음**. 현재 raw echo 패턴 그대로 유지 (Phase 3 의 의도가 그것).
- 일반 노드 핸들러 13+: **수정 없음**.

---

## 다음 단계

이 plan 을 검토 후, 채택 여부 / PR 분할 / 우선순위 / 추가 고려사항 알려주세요. 채택되면 SDD+TDD 로 PR-1 부터 진행.

---

## 구현 진행 (2026-05-08)

| PR | 커밋 | 상태 | 변경 요약 |
| --- | --- | --- | --- |
| PR-1 (인프라) | `e5bd43b7` | 완료 | `ExecutionContext.engineResolvedConfigCache` 슬롯 + setter + executeNode 가 핸들러 호출 직후 평가된 config snapshot 저장. 행동 변화 0 (소비자 없음). |
| PR-2 (Loop fix) | `ea0b9294` | 완료 | `runContainerInner` 가 `engineResolvedConfigCache` 에서 동작 파라미터를 읽음. `Number(resolvedConfig.count)` → `coerceContainerNumber(...)` 로 명시적 검증. 5건 회귀 테스트 (`{{3}}`, `{{$node["src"].output.n}}`, raw echo invariant, literal number, literal string). |
| PR-3 (Parallel fix) | `2cc3cbb2` | 완료 | `runParallel` 도 `engineResolvedConfigCache` 사용. `typeof` silent fallback → `coerceContainerNumber/Boolean` 로 명시 검증. branchCount/maxConcurrency/waitAll 표현식 입력 정상 동작. 1건 e2e 회귀 테스트 (`branchCount: '{{4}}'` → 4 분기). |
| PR-4 (errorPolicy) | `66c18bce` | 완료 | `coerceErrorPolicy` 헬퍼 + ForEach/Map 에 적용. PR-2 의 cache 분리 덕분에 사용자가 설정한 `errorPolicy: 'skip'` 가 비로소 동작에 반영됨 (latent bug 함께 수정). 1건 e2e 회귀 테스트 (`errorPolicy: 'skip'` → 두번째 item throw 후에도 다음 iteration 진행). |

### TEST WORKFLOW 결과

- lint: clean (auto-fix 적용)
- unit test: **170 suite / 2824 pass** (engine module 13 suite / 264 pass — 신규 helper 23건 + Loop expression 5건 + Parallel expression 1건 + ForEach errorPolicy 1건 = 30건 추가)
- build: clean

### Spec 갱신

`spec/5-system/4-execution-engine.md` §6.1 컨텍스트 구조 표에 `engineResolvedConfigCache` 행 추가 — 핸들러 종료 후 컨테이너 동작 파라미터 재평가 경로의 source 임을 명시. expression context 에는 노출하지 않음을 강조 (Principle 7 보존).

### 핸들러 변경 없음 (검증)

Phase 3 raw-echo 패턴(`rawConfig.X` echo) 무수정. 13+ 컨테이너 + 일반 노드 핸들러 모두 코드 그대로.

### 잔여 항목

- 본 plan 의 모든 항목 완료 → 다음 turn 에 `git mv plan/in-progress/expression-config-bug.md plan/complete/expression-config-bug.md` 로 이동.
- ai-review (REVIEW WORKFLOW) 결과에서 추가 이슈 발견 시 보강.
