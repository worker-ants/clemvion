# Rationale 연속성 검토 결과

대상: `spec/conventions/node-cancellation.md`

---

## 발견사항

해당 항목 없음 — 아래는 검토 과정에서 확인된 사항들이다.

### [INFO] `NodeExecution.cancelled` 와 rehydration 실패 분류 경계 명문화

- **target 위치**: `spec/conventions/node-cancellation.md` §5.1 및 §5.1 하단 NOTE (`rehydration 실패는 cancelled 아님`)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` `## Rationale` — "rehydration 단말 상태 이분 — `cancelled` (Execution) vs `failed` (NodeExecution)" 항 (§Rationale 4)
- **상세**: target §5.1 의 NOTE (`"§7.5 의 RESUME_* 인프라 실패는 abortSignal 경로가 아니므로 NodeExecution 은 failed 로 종결한다"`)는 execution-engine Rationale §4 ("NodeExecution `cancelled` 는 abortSignal 경로 전용 — rehydration 실패는 abort 가 아닌 인프라 결함이므로 failed 로 종결")와 정합한다. 충돌 없음.
- **제안**: 현행 유지. 두 문서가 서로를 cross-link 하고 동일 원칙을 공유하고 있어 정합성이 충분하다.

### [INFO] `AbortSignal` 표준 API 채택 — wrapper 대안 명시적 기각

- **target 위치**: `spec/conventions/node-cancellation.md` §Rationale "표준 AbortSignal API 채택 근거" (`"별도 wrapper 불필요"`)
- **과거 결정 출처**: 동일 target 문서의 Rationale 자체 (신규 컨벤션 문서이므로 과거 기각 기록이 본 문서에 내재)
- **상세**: 표준 `AbortSignal` API 를 채택하고 custom wrapper / CancellationToken 패턴을 사용하지 않는 결정이 Rationale 에 명시되어 있다. 이후 구현 현황(§6)에서도 HTTP·AI·Parallel 모두 표준 `AbortController`/`AbortSignal` 만 사용하며 wrapper 가 도입된 흔적이 없다. 정합 유지.
- **제안**: 현행 유지.

### [INFO] `NodeHandler.execute` 시그니처 불변 — 3파라미터 유지

- **target 위치**: `spec/conventions/node-cancellation.md` §2 도입부 및 §Rationale "NodeHandler.execute 시그니처 변경 없이 ExecutionContext 필드로 전파한 근거"
- **과거 결정 출처**: 동일 target 문서 Rationale (명시적 결정)
- **상세**: `execute(input, config, context)` 3-파라미터 시그니처를 유지하고 `abortSignal` 을 4번째 파라미터로 직접 추가하는 대안은 명시적으로 기각됐다. §2 본문에서도 `context.abortSignal` 경로만 서술하고 있어 정합이다. 24개 핸들러 시그니처 변경 비용 근거도 Rationale 에 정확히 기록돼 있다.
- **제안**: 현행 유지.

### [INFO] wall-clock 타이머 + abort 방식 기각 — active-running 누적 방식 채택

- **target 위치**: `spec/conventions/node-cancellation.md` §2.3 "Workflow 단위 시간 한도" 항
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §8 + `## Rationale` "타임아웃을 active-running 누적 기준으로"
- **상세**: target §2.3 은 Workflow 단위 타임아웃 설계를 "wall-clock 타이머+abort 가 아니라 active-running 누적 타임아웃(`assertActiveTimeWithinLimit`)"으로 명기한다. 이는 execution-engine 의 §8/Rationale 에서 확정된 설계이며, target 이 이를 정확히 반영하고 있다. 정합 이탈 없음.
- **제안**: 현행 유지.

---

## 요약

`spec/conventions/node-cancellation.md` 는 Rationale 연속성 관점에서 문제가 없다. (1) 표준 `AbortSignal` API 채택 및 wrapper 기각, (2) `NodeHandler.execute` 시그니처 불변·`ExecutionContext` 필드 경로, (3) `NodeExecution.cancelled` = abortSignal 경로 전용·rehydration 실패는 `failed` 의 이분 원칙, (4) wall-clock 기반 abort 기각·active-running 누적 타임아웃 채택 — 이 네 가지 핵심 결정 모두 본 문서 Rationale 과 참조된 관련 spec(execution-engine.md, execution-context.md, 10-parallel.md)의 Rationale 과 일치한다. 기각된 대안이 재도입된 사례, 합의 원칙 위반, 무근거 번복, invariant 우회는 확인되지 않았다.

## 위험도

NONE
