# Review Resolution — 03 C-2 2차 (ai-turn-executor god-method 분해)

리뷰 SUMMARY: `review/code/2026/06/25/01_19_35/SUMMARY.md`
**위험도 MEDIUM · Critical 0 · Warning 7 · INFO 10.** 14 reviewer 라우팅(8 success).
대상 커밋 `ff8c5d68`.

## 반영 (Addressed)

| # | 카테고리 | 조치 |
| --- | --- | --- |
| W-1·W-10 | testing | `ai-turn-executor.spec.ts executeSingleTurn` 에 executor-레벨 2건 추가: ① condition-only 라우팅(`handleSingleTurnConditionRoute` → `endReason:'condition'`·`condition.id`) ② **single-turn condition 미합산 비대칭**(condition+normal 혼합 → `meta.toolCalls===1`, condition 미카운트). MEDIUM 을 유발한 핵심 의미론 직접 고정. |
| W-3 | testing | `processMultiTurnMessage — form_submitted resume` describe 에 **form bypass**(`source:'ai_message'`) 테스트 추가: cancelled tool_result(`user_sent_message_instead`) 삽입 + `pendingFormToolCall` 클리어(caller state + resume state) 단언. `handleMultiTurnUserMessageEntry` §6.2 2.c.bypass 분기 고정. |
| W-5 | architecture | accumulator 8개(`ragAcc`·`turnRagAcc`·`mcpDiagnosticsAcc`·`presentationPayloads`·`presentationCalls`·`presentationSchemaViolations`·`llmCalls`·`toolCallTraces`)를 **`TurnOutputAccumulators` 인터페이스**로 묶어 `handleSingleTurnConditionRoute`(20→13)·`handleMultiTurnConditionRoute`(21→14) 파라미터 축소. ISP 경계 완화. behavior-preserving(참조 전달 동일). |
| W-6·INFO-5 | architecture/doc | `recordMultiTurnNonProviderToolResults` JSDoc 에 **INVARIANT** 블록 추가: single-turn(미합산 §3.f-g)과 multi-turn(합산)의 condition `toolCallCount` 비대칭이 의도적이며 동기화 금지임을 양방향 cross-ref. single-turn 측은 기존 JSDoc 에 이미 명시. |
| W-7 | requirement/spec-drift | **[SPEC-DRIFT] 투명 기록 + planner 위임.** multi-turn condition deferral 의 `toolCallCount++` 가 spec §7.1 `meta.toolCalls` "조건 도구 제외"와 불일치 — 단, **본 리팩터 이전부터의 동작**으로 behavior-preserving 분해가 보존. 합산 코드 `[SPEC-DRIFT]` 주석으로 명시하고 합산/spec 정정 결정은 planner 백로그로 위임(아래 Deferred). |
| INFO-1 | scope | `type MultiTurnMemoryMeta` 중복 의심 → **실파일 확인 결과 516줄 단 1곳**(리뷰어 diff 아티팩트, 기존 L1741 은 single-turn 의 별개 inline union). 변경 불요. |
| INFO-2 | maintainability | deferral/budget stub 문자열을 파일 레벨 상수 `CONDITION_DEFERRAL_RESULT_MSG`·`TOOL_BUDGET_EXCEEDED_ERROR` 로 추출, 두 record helper 공유(중복 제거). |

## 보류 (Deferred — 근거 명시)

| # | 카테고리 | 사유 |
| --- | --- | --- |
| W-7 (코드 fix 부분) | spec-drift | multi-turn condition `toolCallCount++` 의 합산/미합산 **결정은 행위 변경**이라 behavior-preserving 분해 PR 범위 밖. spec §7.1 정정 또는 코드 버그픽스 중 택일은 `project-planner` 위임(백로그). 본 PR 은 기존 동작 보존 + `[SPEC-DRIFT]` 주석으로 표면화. |
| W-2 | testing | multi-turn condition route 토큰 누적 — `processMultiTurnMessage` resume 루프 + condition 혼합 set-up 비용 대비, 핸들러 spec(474) + e2e(214) 가 누적 경로를 간접 커버. W-1/W-3 가 추출 helper 의 고위험 의미론(비대칭·bypass)을 직접 고정. 추가 엣지는 백로그. |
| W-4 | testing | `applyMultiTurnTurnMemory` `keepUserExchanges=0` 분기 — memory spec 의 기존 압축 회귀 테스트가 커버(thread service 미주입 시 graceful degrade). messages in-place 변이는 caller scope 유지 + e2e 통과로 레퍼런스 보존 확인. |
| W-6 (타입 강제) | architecture | `ConditionCountPolicy: 'count'\|'no-count'` 컴파일 강제 — 두 helper 의 의도적 분기를 타입으로 막는 설계 변경. INVARIANT 주석으로 단기 방어, 타입 강제는 후속 grooming. |
| INFO-3 | maintainability | `Date.now() - turnStartedAt` 이중 호출 → 단일 캡처. 원본도 두 독립 호출(μs 차) 이었고, 통합은 미세 행위 변경이라 behavior-preserving PR 에서 보류(가치 낮음). |
| INFO-4·6·7·8·9 | misc | INFO-4(executionId fallback 분산) minor·INFO-6(함수형 스타일 SRP) 후속 PR·INFO-7(`tc.arguments` 직렬화) pre-existing 보안 비이슈·INFO-8(args 필드 주석) minor·INFO-9(`?? []` 방어) **긍정 변경 유지**. |

## 재검증

review-fix 후: prettier clean, ai-turn-executor+handler **477 pass**(신규 3건 포함), lint PASS. W-5 는 behavior-preserving 파라미터 번들링(참조 전달 동일), INFO-2 는 동일 문자열 상수화, W-6/W-7 은 주석 — 런타임 동작 불변. build(tsc, 명시 인터페이스 검증)·unit·**e2e 214** 재수행 PASS, 커밋 `db6896f4` 반영.

## impl-done consistency 결과 (`review/consistency/2026/06/25/01_45_08`, BLOCK:NO)

- **W1·W2 (Cross-Spec/Rationale, pre-existing SPEC-DRIFT)**: multi-turn condition `toolCallCount++` vs spec §7.1 — ai-review W-7 과 동일 사안. 본 PR `[SPEC-DRIFT]` 주석 + plan C-2 백로그로 추적, planner 위임(중복 확인). behavior-preserving 분해라 신규 위반 미도입.
- **I2 (tool_call_budget_exceeded lower_snake_case)**: 값은 **pre-existing**(원본 인라인 리터럴 그대로) — UPPER_SNAKE 변경 시 LLM 이 받는 tool_result 신호가 바뀌어 **행위 변경**이라 보류. convention checker 도 "LLM-internal signal, 외부 계약 미노출"로 NONE 등급. 상수화는 값 불변.
- **I3 (line 962 인라인 리터럴 중복)**: `executeProviderToolBatch` 의 pre-existing 코드(본 추출 범위 밖) — 동일 PR 범위 확대 회피 위해 별도 정리 커밋으로 보류.
- **I1 (`§3.f-g` JSDoc 표기)**·**I5 (별도 spec-drift plan item)**: planner 위임 사항과 함께 후속. I4/I6/I7 변경 불요(확인).
