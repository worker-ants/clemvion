# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/` (impl-prep). 프롬프트에 다수 cafe24-api-catalog 파일이 대량
포함됐으나 이번 착수 대상 작업(worktree `node-cancel-signal-b4d1`, 추적 plan
`plan/in-progress/node-cancellation-residual-signal-propagation.md`)과 직접 관련된 것은
`spec/conventions/node-cancellation.md` 다. 해당 파일은 프롬프트에서 **컨텍스트 예산 초과로
생략**되어 있었고, 교차 참조되는 `spec/conventions/execution-context.md` ·
`spec/5-system/4-execution-engine.md` · `spec/4-nodes/1-logic/10-parallel.md` ·
`spec/4-nodes/3-ai/1-ai-agent.md §12.16` 도 프롬프트에 없어(§68개 생략 목록) 전부 `Read` 로
직접 열어 대조했다.

## 발견사항

- **[INFO]** 선형 경로 cancel 전파의 실제 기전은 아직 미확정 — 향후 spec 갱신 시 재반증 주의
  - target 위치: `spec/conventions/node-cancellation.md` §2.3 / §6 (pending_plans 경유
    `plan/in-progress/node-cancellation-residual-signal-propagation.md` "선형 경로 cancel
    전파의 기전 규명 + 결정적 고정" 항목)
  - 과거 결정 출처: `review/code/2026/07/24/20_36_21/RESOLUTION.md` §C1 —
    2R 에서 독립 reviewer 3명이 "`context.abortSignal?.throwIfAborted()`"(parallel 전용이라
    선형 경로에서 항상 undefined)와 "guarded UPDATE(`execution-engine.service.ts:313`)"(§7.5
    resume-claim 전용 sentinel) **두 후보 설명을 모두 반증**했다.
  - 상세: 현재 `node-cancellation.md` 본문·`node-cancellation-propagation.e2e-spec.ts` JSDoc
    모두 "결과(관측된 계약)만 보장, 기전 미확정" 이라는 정확한 상태를 유지하고 있어 **현재는
    위반이 없다**. 다만 이번 잔여 plan 항목(엔진 단위 테스트로 기전을 결정적으로 고정하는 작업)을
    수행하는 과정에서, 이미 반증된 두 설명(특히 "guarded UPDATE :313") 중 하나를 재확인 없이
    다시 확정된 기전으로 문서화하면 **반증된 설명의 재도입**이 된다 — 실측(엔진 unit test)으로
    새 근거를 만든 뒤에만 spec 문언을 "기전 확정"으로 승격해야 한다.
  - 제안: 착수 시 `RESOLUTION.md §C1` 과 e2e JSDoc 의 "기전 미확인" 문구를 먼저 재확인하고,
    엔진 단위 테스트가 실제로 어떤 코드 경로(예: dispatch 루프의 Execution 상태 재조회 지점)를
    새로 특정하는지 실측한 뒤에만 `node-cancellation.md` §6/§2.3 문언을 갱신할 것. 재반증 없이
    과거 반증된 두 후보 중 하나를 그대로 되살리지 않도록 PR 리뷰에서 교차 확인 권장.

- **[INFO]** 검토 범위 커버리지 한계 — 프롬프트 대량 생략분(cafe24-api-catalog 256개 +
  spec 전역 68개) 미검토
  - target 위치: 프롬프트 "⚠ 컨텍스트 예산 초과로 생략된 파일" 두 목록 (총 324개)
  - 상세: 이 중 이번 작업과 직접 연관된 6개 문서(`node-cancellation.md`,
    `execution-context.md`, `4-execution-engine.md`, `10-parallel.md`, `1-ai-agent.md`,
    `chat-channel-adapter.md`)는 `Read` 로 직접 열어 대조했고 전부 정합했다. 나머지
    (특히 cafe24-api-catalog 하위 파일 대다수)는 node-cancellation 작업과 관련성이 낮아
    보여 표본 확인(`_overview.md` Rationale)만 했으며 전수 검토는 하지 않았다.
  - 제안: 실제 코드 변경이 cafe24/makeshop API 클라이언트(§Cafe24·MakeShop 노드 signal
    전파 항목)에 닿으므로, 그 구현 PR 의 `--impl-done` 단계에서 changeset 기준으로 재검토하면
    충분 — 현재 impl-prep 단계에서 무관한 catalog 파일 324개를 전수 열람하는 것은
    비용 대비 실익이 낮다고 판단.

## 대조 확인 결과 (문제 없음 — 참고용)

아래는 잠재 충돌 후보로 직접 열어 대조했으나 **정합이 확인된** 항목들이다 (오탐 방지 기록):

1. **NodeExecution `cancelled` vs rehydration 실패 `failed` 분류** — `node-cancellation.md`
   §5.2 는 "rehydration 실패(§7.5 RESUME_*)는 [NodeExecution] `cancelled` 아님" 이라 서술하고,
   `4-execution-engine.md` §7.5 "Rehydration 실패 케이스" 표는 "Execution `cancelled` +
   `error.code=RESUME_*`, **동반 NodeExecution `failed`**" 라고 명시한다. 얼핏 상충으로 보이나
   실제로는 **엔티티 레벨이 다르다** — Execution.status(=cancelled)와 NodeExecution.status
   (=failed)를 별도로 서술한 것이라 두 문서가 정확히 일치한다. 충돌 아님.
2. **`abortSignal` 을 `ExecutionContext` Stable core 에 유지하는 결정** —
   `execution-context.md` §원칙1/§Rationale 이 "cancellation 은 cross-cutting 이므로 Stable
   core 유지, 동작 계약은 `node-cancellation.md` 위임" 이라 명시하며, 이는 `node-cancellation.md`
   자체 서술과 완전히 정합.
3. **`parentParallelConcurrency` 를 `ExecutionContext` 에서 `ParallelBranchContext` 로 분리한
   결정(결정 G 번복)** — `10-parallel.md`(원 결정 G) → `execution-context.md`(번복,
   consistency-check C-1 옵션 a) → `parallel-p2-followups.md` §7(구현) 3자가 모두 같은 이력을
   일관되게 서술. abortSignal 은 이 번복의 대상이 아니며(Stable core 잔류가 명시적으로 별도
   근거를 가짐) target 이 이를 혼동하고 있지 않음.
4. **`cancel-others-on-fail` 기각된 대안** — `10-parallel.md` §Rationale "결정 A+H" 는
   "`errorPolicy=stop` 자체를 항상 abort 로 바꾸는 안" 을 기각했다고 명시하며,
   `node-cancellation.md` §5.2 의 `stop`/`continue`/`cancel-others-on-fail` 3분류 서술이
   이 기각을 그대로 존중하고 있다 (stop 의미를 바꾸지 않음).
5. **워크플로 타임아웃 = active-running 누적(wall-clock 아님)** — `4-execution-engine.md`
   §Rationale "타임아웃을 active-running 누적 기준으로" 가 wall-clock 방식을 반증 사례
   ("늦게 돌아오니 세션 만료" 회귀)로 명시 기각했고, `node-cancellation.md` §2.3 이 "확정 설계는
   wall-clock 타이머+abort 가 아니라 active-running 누적 타임아웃" 이라고 정확히 같은 결정을
   재서술한다. 잔여 항목(노드 abort 통합)도 양쪽 문서가 "Planned" 로 일치.
6. **cafe24/makeshop API 클라이언트의 signal 부재** — 두 통합 spec(§2-navigation/4-integration.md,
   cafe24/makeshop metadata convention)에는 abort/signal 관련 기존 결정이 전혀 없어(grep 0건),
   잔여 plan 이 이번에 처음 도입하려는 것과 충돌할 과거 결정 자체가 없음.

## 요약

이번 impl-prep 대상(`node-cancellation` 잔여 signal 전파 작업)과 직접 연관된 spec 문서들
(`node-cancellation.md`, `execution-context.md`, `4-execution-engine.md`, `10-parallel.md`,
`1-ai-agent.md §12.16`, `chat-channel-adapter.md`)을 프롬프트 생략분까지 직접 열어 대조한 결과,
과거 Rationale 에서 기각된 대안의 재도입이나 합의된 원칙(Stable core 분류, active-running
누적 타임아웃, cancel-others-on-fail 의미, 결정 A/G/H 이력)의 위반은 발견되지 않았다. 유일한
주의 사항은 "선형 경로 cancel 전파 기전" 이 두 차례 반증을 거쳐 아직 미확정 상태로 남아있다는
점인데, 현재 문서·테스트 모두 이 미확정 상태를 정직하게 기록하고 있어 지금 시점엔 위반이
아니며, 앞으로 이 항목을 다루는 커밋에서 이미 반증된 설명을 재확인 없이 되살리지 않도록 하는
것이 유일한 연속성 리스크다. 프롬프트에 포함된 cafe24-api-catalog 대량 카탈로그 콘텐츠는
이번 작업과 무관해 표본 확인에 그쳤다.

## 위험도

NONE
