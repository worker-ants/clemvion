# Resolution — ai-review 23_06_04 (M-1 3단계 AiTurnExecutor 추출)

리뷰 결과: **Critical 0 / WARNING 9 / INFO 15 (risk MEDIUM).**

본 PR 은 **behavior-preserving refactor** (god-handler turn 실행 표면을 `AiTurnExecutor`
로 verbatim 추출, 동작 1:1 보존). 따라서 조치 원칙:

- **FIX** = 신규 spec(`ai-turn-executor.spec.ts`)에 **additive 테스트만** 추가 (moved 코드·동작 무변경, 회귀 0).
- **DEFER** = ⓐ pre-existing 동작(고치면 behavior change → refactor 계약 위반), ⓑ C-2(03-maintainability) 메서드 분리 후속, ⓒ planner-only(spec 쓰기 권한 밖), ⓓ verbatim 보존 대상. 전부 근거 기록.

## FIXED (이번 PR — 신규 테스트 보강, production 코드 무변경)

| ai-review # | 카테고리 | 조치 |
|---|---|---|
| W#7 | testing | `capFormDataBytes` 직접 단위 테스트 4건 추가 — cap 미만(메타 없음)·cap 초과 string truncate·**UTF-8 멀티바이트 경계(한글)**·비-string-only(truncate 대상 없음+메타 부착). `capFormDataBytes`/`FORM_SUBMITTED_MAX_BYTES` 를 executor 에서 export. |
| W#8 | testing | `processMultiTurnMessage` **form_submitted resume** 분기 executor 직접 테스트 — render_form tool_use 가 있는 state 에서 form 제출 → tool_result splice → LLM 재호출 → waiting 재진입, **`pendingFormToolCall` 클리어 부작용(호출자 state + 다음 `_resumeState`)** 검증. |
| I#14 | testing | `buildMultiTurnFinalOutput` 포트 매핑을 단일 `it` → `it.each` (max_turns/user_ended/error/condition 4 케이스) 분리 — 실패 시 케이스 즉시 식별. |

신규 spec: 9 → **17 테스트 PASS**.

## DEFERRED (근거 기록)

### ⓐ pre-existing 동작 — behavior-preserving refactor 가 보존해야 함 (고치면 계약 위반)

| ai-review # | 발견 | 검증·근거 |
|---|---|---|
| **W#1** (requirement, MEDIUM 견인) | multi-turn 루프 `conditionToolCalls` 에서 `toolCallCount++` — spec §7.1·`executeSingleTurn`(증가 없음)과 불일치 | **pre-existing 확정.** `git show HEAD~1:ai-agent.handler.ts` 의 multi-turn 루프(L2240 `for…conditionToolCalls` → L2241 `toolCallCount++`)와 본 PR executor(L2152→L2153)가 **byte-identical**. 본 PR 이 도입한 게 아니라 refactor 가 **표면화한 선행 불일치**다. 멀티턴 `meta.toolCalls`/`maxToolCalls` 예산 소비를 바꾸는 것은 **동작 변경**이라 behavior-preserving refactor 범위 밖 → **별건 spec-aligned 버그수정**(planner: §7 multi-turn `meta.toolCalls` 의 조건 도구 포함 여부 명문화 → developer: 두 경로 정렬 + 회귀 테스트)로 위임. 본 PR 은 1:1 보존이 정답. |
| I#2 (security) | 일반 chat `userMessage` 길이 cap 없음(formData 만 cap) | pre-existing 동작. cap 도입 = 동작 변경 → 별건(spec §12.7 확장 검토). |
| I#3 (security) | `sanitizeToolError` URL/credential 패턴 마스킹 없음 | pre-existing(verbatim). 마스킹 강화 = 별건 보안 개선. |
| I#4/I#6 (security/perf) | `AI_RETRY_STATE_TTL_MINUTES` 상한 clamp 없음 / 매 호출 `process.env` 파싱 | pre-existing(`resolveRetryStateTtlMinutes` verbatim). W#2 와 함께 처리. |
| I#5 (perf) | `buildTools` provider 순차 `for…of` | pre-existing. 병렬화는 MCP 진단 누적 순서에 영향 가능 → 별건 검증 필요. |
| I#9 (side-effect) | `delete state.pendingFormToolCall` in-place 변이 | pre-existing(verbatim). concurrency-reviewer 도 "실질 위험 낮음" 판정. 무상태 collaborator + turn-단위 park 라 race 없음. |

### ⓑ C-2 (03-maintainability) 메서드 분리 후속 — M-1 추출 범위 밖

| ai-review # | 발견 | 근거 |
|---|---|---|
| W#3 | `processMultiTurnMessage` ~750줄 과다 복잡도 → `_resolveFormInteraction`/`_runToolLoop`/`_buildResumeStatePayload` 분리 | **M-1 = god-handler 에서 turn 실행을 *추출*(OUT). C-2 = turn 실행 *내부* 메서드 분리(WITHIN).** plan §M-1 "메서드 분리 상세: [03-maintainability.md] C-2" 명시. 본 PR 에서 분리 = scope creep + verbatim 이탈(회귀 위험↑). C-2 위임. |
| W#4 | `executeSingleTurn`↔multi-turn 루프 condition/normal tool 처리 중복 → `_processNonProviderToolCalls` 공유 헬퍼 | 동일 — 공유 헬퍼 추출은 C-2 단위. pre-existing 중복을 verbatim 이전(신규 위험 0). |
| W#5 | `MAX_TURN_DEBUG_HISTORY=50` 메서드 인라인 상수 | pre-existing(verbatim). 모듈 상수 승격은 cosmetic — C-2 정리. |
| W#6 | `sanitizeToolError` 매직넘버 200 | pre-existing(verbatim). 상수 추출은 C-2 정리. |
| I#10/I#11 | JSDoc 블록 순서 / 공개 메서드 JSDoc 보강 | pre-existing 문서 nit(verbatim). C-2 정리. |
| I#8 | resume `state: Record<string,unknown>` 비구조화 → `ResumeState` interface | 타입 모델링 도입 = 별도 작업. M-1 후 점진 적용(리뷰어도 "M-1 완료 후" 명시). |

### ⓒ architecture DI — #665·#668 와 동일 deliberate-defer (무상태 collaborator 패턴)

| ai-review # | 발견 | 근거 |
|---|---|---|
| W#2 | `resolveRetryStateTtlMinutes` 가 `process.env` 직접 read → ConfigService 주입 | `AiConditionEvaluator`(#665)·`AiMemoryManager`(#668) 와 **동일한 무상태 collaborator 패턴**(no interface, `new` 인스턴스화). `resolveRetryStateTtlMinutes` 는 핸들러에서 verbatim 이전된 모듈 함수 — env 접근 위치 불변. ConfigService/DI 도입은 본 refactor 와 직교한 별도 아키텍처 결정 → **deliberate-defer** (task 예상 잔존 ⓐ). |

### ⓓ planner-only — developer spec 쓰기 권한 밖

| ai-review # | 발견 | 근거 |
|---|---|---|
| I#1 (SPEC-DRIFT) | spec frontmatter `code:` 에 `ai-turn-executor.ts`·`ai-condition-evaluator.ts`·`ai-memory-manager.ts` 미등재 | CLAUDE.md: developer `spec/` **read-only**. plan §M-1 "planner 후속(비차단 SPEC-DRIFT)" 일괄 처리 항목. consistency impl-prep(23_03_12) 도 동일 비차단 판정. → **planner 위임** (task 예상 잔존 ⓑ). |
| I#12 | `AI_RETRY_STATE_TTL_MINUTES` 중앙 env 문서 미등록 | pre-existing(신규 env 아님 — 핸들러 시절부터 존재). planner/docs 후속. |
| I#13/I#15 | `RagAccumulator.skipReason` 테스트 / `ToolCallTrace` re-export | RagAccumulator 는 ai-agent.handler.spec 가 transitively 커버. `ToolCallTrace` 는 외부 import 없음(빌드 PASS 로 확인) — 현행 유지(리뷰어 권고 "현행 유지"). |

## 재검증

- 신규 spec 17 PASS, ai-agent 스위트 PASS, **production 코드(`ai-turn-executor.ts`/`ai-agent.handler.ts`) 무변경** → build/unit 회귀 0.
- 잔존 WARNING 은 전부 위 ⓐ~ⓓ 로 문서화된 **deliberate-defer / pre-existing / C-2 / planner** — Critical 0, developer-scoped 수렴.
