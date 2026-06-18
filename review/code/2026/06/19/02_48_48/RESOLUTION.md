# RESOLUTION — C-1 후속 ② (classifyLlmError 미등록 code passthrough 테스트 보강)

테스트-only 변경 (`006c771f`). ai-review `review/code/2026/06/19/02_48_48` (RISK=LOW · **Critical 0 · Warning 0**) · impl-done `review/consistency/2026/06/19/02_55_27` (**BLOCK: NO** · Warning 1 + INFO).

## 조치 항목

### ai-review (C0/W0 — 가드 SUMMARY-only 충족)

| # | 분류 | 조치 / 근거 |
|---|---|---|
| INFO #1 (주석 순서) | 수용 | code→주석 순서는 spec 참조 주석 뒤·details 주석 앞으로 의도 배치. 미세 — 미수정. |
| INFO #2 (spec 참조 중복) | 수용 | it 설명 + 내부 주석 중복은 검색성↑. 미수정. |
| INFO #3 (details `toEqual` 전체) | 수용·선택 | 신규 테스트는 `retryable` 핵심만 단언(passthrough 검증 목적 충족). 전체 shape 는 기존 테스트가 커버. |
| INFO #4 (message 단언) | 수용·선택 | sanitize 경로는 기존 테스트(421-428)가 커버. 핵심(code+retryable)에 집중. |
| INFO #5 (기존 케이스 rename) | 수용 | pre-existing 테스트명 — 본 PR 범위 밖. |
| INFO #6 (분리 커밋) | 수용 | 보강+신규가 동일 논리단위(passthrough 어서션)라 단일 커밋 적절. |

> **공통 근거**: ai-review INFO 6건 전부 선택적(C0/W0). 추가 codebase 편집은 review-gate 재무장(메모리 review-gate-loop) → 재리뷰 루프 유발이라 미수정. 테스트는 기능·spec(§10 L1099) 정합 충분.
> security reviewer output 미생성(transient) — 테스트-only 라 보안 surface 무변, 미재실행.

### impl-done (BLOCK:NO)

| # | 분류 | 조치 / 근거 |
|---|---|---|
| Warning #1 (passthrough 범위 §10 Rationale 미기록) | **이관(planner)** | impl 의 미등록 explicit code passthrough 는 **pre-existing 행위** — 기존 테스트(spec 406-419)가 이미 `LLM_API_ERROR` 를 `retryable:false` 로 단언해 passthrough 를 간접 검증. 내 테스트는 명시화일 뿐 신규 도입 아님. §10 Rationale enrichment("미등록 code passthrough 허용, retryable=false")는 **spec 변경 → project-planner**(developer spec read-only). impl 변경(LLM_CALL_FAILED 재매핑)은 행위변경이라 본 PR 범위 밖. |
| INFO #1/#4 (passthrough 가 §10 표/본문 미명시) | 이관(planner) | Warning #1 과 동일 SPEC-DRIFT — §10 표/L1099 에 passthrough 행/문구 추가. |
| INFO #2 (`details.status` 무시 미기록) | 이관(planner) | §10 L1099 에 "HTTP status 는 top-level `.status` 기준" 한 줄 — planner. |
| INFO #3 (plan 완료표기 누락) | **조치** | `c1-engine-split.md §후속 고려` ② 항목 완료 표기 추가 (본 PR plan 갱신). |
| INFO #5 (픽스처명) | 수용 | `LLM_API_ERROR` 는 기존 테스트+plan 명명. 변경 시 재무장이라 미수정(강제 불요). |

**신규 Critical/Warning: 0** (impl-done Warning 1 = pre-existing 행위의 spec 문서화 갭 → planner). **impl·test 무변** → push 가드 재무장 없음.

## TEST 결과

- **lint**: 통과 — backend `eslint --fix`, 변경 외 파일 무수정
- **unit**: 통과 — backend execution-engine scoped, **33 suites / 806 tests** (신규 테스트 +1 포함)
- **build**: 통과 — backend `npm run build`(tsc clean)
- **e2e**: 통과 — dockerized `make e2e-test`, **34 suites / 202 tests** ("Ran all test suites"; "Jest did not exit" open-handle teardown 경고는 양성)

> backend-scoped lint/unit/build 근거: 본 변경은 backend execution-engine 테스트 파일 1개. e2e 는 화이트리스트 회색지대(test-only 미면제)라 full dockerized 수행.

## 보류·후속 항목

- **§10 passthrough SPEC-DRIFT** (Warning #1 + INFO #1/#2/#4) → **project-planner**: `spec/4-nodes/3-ai/1-ai-agent.md §10 L1099` 에 (a) 미등록 explicit code passthrough 허용·retryable=false, (b) HTTP status 는 top-level `.status` 기준 명시. `c1-engine-split.md` 후속 등재.
- ai-review INFO #2/#3/#4/#5 → 선택적 테스트 그루밍 (details shape·message 단언·rename).
