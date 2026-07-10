# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical/보안/스코프 이슈는 없음. 유일한 실질 리스크는 multi-turn resume 경로(`state.workflowId`/`state.nodeExecutionId` → `llmContext` 조립, `ai-turn-executor.ts:2296-2302`)의 attribution 배선이 값 단위 end-to-end 회귀 테스트로 고정되지 않은 것(testing-reviewer MEDIUM, requirement-reviewer 대칭 WARNING). 그 외에는 spec drift 1건(코드가 옳고 spec 만 낡음)과 다수의 저위험 INFO 뿐이다.

> **처분(호출자 반영)**: WARNING#1 은 본 PR 에서 resume 경로 값 단위 단언 추가로 해소. SPEC-DRIFT 는 `spec/data-flow/7-llm-usage.md` §1.3 4개 위치 정정을 **본 PR 에 포함**(drift window 0). 상세 [RESOLUTION.md](RESOLUTION.md).
> **재검증(`reverify/`, 커밋 `0fa772406`)**: testing = NONE(신규 resume 테스트가 `state.*` 조립 실값 검증 확인), requirement = NONE(직접 jest 145 PASS + SPEC-DRIFT 정합 확인). → Critical 0 / Warning 0 확정.

## Critical 발견사항

없음 — 7개 실행 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 Critical 없음으로 보고.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement | multi-turn resume 경로의 `state.workflowId`/`state.nodeExecutionId` → `llmContext` 조립이 값 단위 end-to-end 로 검증되지 않음(single-turn 은 검증됨, 비대칭). 신규 `ai-memory-manager.spec.ts` 테스트는 caller 가 리터럴로 만든 `llmContext` 의 forwarding 만 검증하고 `state.*` 추출·조립 로직 자체는 어떤 테스트도 실값으로 왕복하지 않음. 이 프로젝트에서 "필드명은 맞는데 값이 틀림"(예: `nodeId`↔`nodeExecutionId` 혼용) 버그가 실제 재발한 전례(커밋 `2db810893`)가 있어 동일 클래스 회귀가 조용히 통과할 위험. | `ai-turn-executor.ts:2296-2302`, `ai-agent.memory.spec.ts:292-393`(단언 부재), `ai-memory-manager.spec.ts:479-521`(forwarding 만 검증) | 기존 multi-turn `summary_buffer` 테스트에 turn1 요약 chat 호출 직후 `expect(mockLlmService.chat.mock.calls[0][2]).toMatchObject({ workflowId, nodeExecutionId })` 단언 추가로 저비용 해소. |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `spec/data-flow/7-llm-usage.md` §1.3 이 이번 배선으로 stale — 코드가 spec 이 요구한 "잔여 attribution 갭 해소" 방향을 정확히 구현했으나 spec 본문은 여전히 "AI Agent 자동 메모리 롤링 요약 압축 chat 은 context 미전달 → 전부 NULL/미배선 잔여 갭"으로 서술 중. CHANGELOG 가 이 stale 한 spec 을 SoT 로 인용해 일시적 혼란 창(window) 발생. | `spec/data-flow/7-llm-usage.md:107,113,162,204-206`; `CHANGELOG.md` | 코드는 그대로 유지. §1.3 4개 위치를 "단발=`context.*`, resume=`state.*` 로 채움"으로 정정 — **본 PR 에 포함**(consistency BLOCK 해소, drift window 0). |

## 참고 (INFO) — 발췌

- **INFO(Security)**: `state.workflowId as string | undefined` 무검증 캐스트는 기존 main-chat 소비 사이트(#877/#879)의 관용구 동형 확장. 최종 소비처 TypeORM parameterized insert — 신규 공격면 없음. 조치 불필요.
- **INFO(Testing #3)**: 신규 `ai-memory-manager.spec.ts` 테스트 주석이 "state.* 조립 고정"으로 오인 소지 → 주석을 "forwarding 만 검증"으로 정정(본 PR 반영).
- **INFO(Side Effect #5)**: `executionId` fallback `''`(scope-key) vs `undefined`(NULL 적재) 비대칭은 의도 — 회귀 방지 주석 권장.
- **INFO(Maintainability)**: attribution 객체 3곳 수작업 반복(L1163/L2298/L2614), 명시 타입 주석은 1곳만 — 4번째 등장 시 factory 추출 고려(비차단).
- **INFO(Documentation)**: `LlmCallContext` 정의부(`llm.service.ts`) JSDoc 부재(pre-existing).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | multi-turn resume `state.*` attribution 조립 end-to-end 미검증 (WARNING) |
| requirement | LOW | 동일 testing 갭 대칭 WARNING + spec §1.3 SPEC-DRIFT |
| side_effect | LOW | 의도된 NULL→값 DB 기록 변경, fallback 비대칭(INFO) |
| maintainability | LOW | attribution 객체 반복 조립·타입 주석 비일관(INFO) |
| documentation | LOW | CHANGELOG SoT stale window, JSDoc 위치(INFO) |
| security | NONE | 무검증 캐스트 관용구(기존 패턴 확장, 신규 리스크 아님) |
| scope | NONE | 타 작업 plan 교차 갱신(관례적 bookkeeping) |

## 라우터 결정

- **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, 전부 agents_forced router_safety).
- **제외(7명)**: performance/architecture/dependency/database/concurrency/api_contract/user_guide_sync — 각각 I/O·모듈경계·의존성·DB·동시성·HTTP계약·user-facing 변경 없음.
