# Code Review RESOLUTION — 22_22_19

대상: 커밋 `0fa772406` diff (origin/main...HEAD), 브랜치 `claude/ai-usage-attribution-hardening-358929`.
라우터 선정 7 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation).

## 최종: 전체 위험도 MEDIUM → 조치 후 잔여 Critical 0 / Warning 0 (재검증 확정)

## 1. WARNING#1 (testing + requirement) — **FIX**

- 발견: multi-turn resume 경로(`ai-turn-executor.ts:2296-2302`, `applyMultiTurnTurnMemory`)의 재주입
  `state.workflowId`/`state.executionId`/`state.nodeExecutionId` → 요약 압축 chat `llmContext` 조립이
  **실값 end-to-end 미검증**. 기존 `ai-memory-manager.spec` 는 caller 리터럴 forwarding 만 검증(비대칭).
  IE `nodeId`↔`nodeExecutionId`(커밋 `2db810893`) 동일 클래스 재발 위험.
- 조치: `ai-agent.memory.spec.ts` 에 resume-path 회귀 테스트 추가 — `handler.execute` → `_resumeState`
  에 엔진 재주입(`state.workflowId='wf-resume'`/`executionId='exec-resume'`/`nodeExecutionId='ne-resume-row'`)
  시뮬레이션 → `processMultiTurnMessage` 로 압축 트리거 → `chat.mock.calls[0][2]`(요약 chat 3번째 인자)가
  세 값을 그대로 담는지 + `summarized:true` 전제 단언. single-turn(context.*)=기존 회귀 테스트, resume
  (state.*)=신규, manager forwarding=`ai-memory-manager.spec` — 레이어별 분담.
- 재검증(testing/requirement reverify): **위험도 NONE**. requirement reverify 가 직접 `npx jest` 4-suite
  145 tests PASS + eslint clean 확인. testing reverify 가 조립 코드 경로 통과·call index·`summarized`
  전제 정확성 확인.

## 2. INFO#3 (testing) — **FIX**

- 발견: `ai-memory-manager.spec` 의 multi-turn 테스트 제목·주석이 "resume=state.* 조립 커버"로 오인 소지
  (실제로는 manager 레이어 forwarding 만 검증).
- 조치: 제목을 "manager 레이어 forwarding 계약" 으로, 주석을 "state.* 실 조립은 ai-agent.memory.spec 이,
  single-turn 은 compresses-oldest-turns 회귀 테스트가 담당" 으로 정정.

## 3. SPEC-DRIFT — **FIX (본 PR 포함)**

- 발견: `spec/data-flow/7-llm-usage.md` §1.3 이 C1 배선 후에도 "미배선/NULL" 서술 (requirement SPEC-DRIFT,
  documentation 이 CHANGELOG SoT stale window 로 교차 확인).
- 조치: consistency `--impl-done` 이 이를 CRITICAL(SoT) 로 승격 → §1.3 4개 위치 정정을 본 PR 에 포함.
  상세는 `review/consistency/2026/07/10/22_22_19/RESOLUTION.md`.

## 4. 미조치 (분석 후 조치 불필요/범위 밖) — 근거 명시

| 항목 | reviewer | 판단 |
|---|---|---|
| `state.workflowId as string \| undefined` 무검증 캐스트 | security INFO | 기존 main-chat 소비 사이트(#877/#879) 관용구 동형 확장. 최종 소비처 TypeORM parameterized insert — 신규 공격면 없음. 유지. |
| `executionId` fallback `''`(scope-key) vs `undefined`(NULL 적재) 비대칭 | side_effect INFO#5 | 의도된 분리(각 목적 상이). 코드 리뷰 산출물에 근거 기록 — 소스 주석 추가는 저가치라 미적용. |
| attribution 객체 3곳 수작업 반복(L1163/L2298/L2614) factory 추출 | maintainability INFO | 4번째 등장 시점 리팩터 후보. 현 시점 과잉. |
| `toMatchObject` vs `toEqual` 엄격도 | testing INFO#4 | `LlmCallContext` 3필드 제한으로 컴파일 타임 방지, 위험 낮음. 신규 resume 테스트도 `toMatchObject` 로 통일 유지. |
| `LlmCallContext` 정의부 JSDoc 부재 | documentation INFO | pre-existing, 이 인터페이스 만지는 다음 PR 로. |
| plan cross-ref(`resume-llm-usage-attribution.md`) 교차 갱신 | scope INFO | plan 라이프사이클 관례(선행 plan cross-ref). Scope 위반 아님. |

## 5. TEST WORKFLOW (최종)

- lint PASS / tsc(build) 0 errors / 영향 spec 4-suite 145 PASS / e2e 249 PASS (코드 변경은 test spec +
  spec 문서뿐 — 프로덕션 `.ts` 무변경이라 직전 e2e 그린 유효).
- (참고) 전체 tsconfig(테스트 포함) tsc 는 presentation node spec(carousel/chart/table)의 **pre-existing**
  loose-typing 오류를 표출하나 본 diff 무관·origin/main 동일·production build config 제외 대상.

**결론: Critical 0 / Warning 0 (재검증 확정). 병합 가능.**
