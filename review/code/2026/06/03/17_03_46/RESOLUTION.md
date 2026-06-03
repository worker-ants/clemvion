# Review Resolution — 멀티턴 AI 노드 요소별 발생 시각·소요시간

대상 리뷰: `review/code/2026/06/03/17_03_46/SUMMARY.md` (위험도 MEDIUM, Critical 0, Warning 7)
처리자: developer (main). security 리뷰어 1차 산출 실패 → 재실행으로 보완(LOW, 발견 없음).

## 위험도/카운트
- Critical: 0 → 조치 불요
- Warning: 7 → **5건 코드 수정, 2건 사유 명시 후 deferred**
- security reviewer 재실행: **LOW, 전부 INFO** (외부 fanout strip 정책 유지 확인, 인젝션·XSS 없음)

## Warning 처리

| # | 처리 | 내용 |
|---|------|------|
| W1 (Testing) | ✅ Fixed | `use-execution-events.test.ts` 에 `startedAt` 전파 3케이스 추가 — (a) `tool_call_started` backend startedAt 우선, (b) 미동봉 시 client ISO 폴백, (c) `tool_call_completed` 의 startedAt reconcile(started 유실 시) |
| W2 (Testing/Bug) | ✅ Fixed | **실제 버그**: `toolStatusMapFromItems` 가 `startedAt` 미전파 → `ai_message` 스냅샷 REPLACE 시 live tool 발생 시각 유실. `startedAt: item.timestamp` 추가(영속 경로 `toolStatusMapFromDebug` 와 대칭) + `conversation-utils.test.ts` 회귀 테스트 추가 |
| W3 (Requirement) | ✅ Fixed | spec §9.12 표기 literal `"time"` → `"time-seconds"` 로 정정(구현과 일치). 구현은 같은 분 내 turn 구분 위해 초 단위 표시가 의도 — spec 텍스트를 구현에 맞춤 |
| W4 (Maintainability) | ⏸ Deferred | timestamp+duration 인라인 렌더 패턴 5~7곳. **deferred 사유**: surface 별 레이아웃이 상이(타임라인 inline-flex / 노드 리스트 flex-col stacked / 헤더 datetime / 챗버블 ml-auto). 단일 컴포넌트로 강제 추출 시 prop 분기가 늘어 가독성이 더 나빠지는 over-abstraction 위험. 동작 무관 순수 maintainability. 향후 surface 가 더 늘면 재검토 |
| W5 (Maintainability) | ✅ Fixed | 백엔드 `new Date(<ms>).toISOString()` 변환 5곳 중복 → `toIso(ms)` 헬퍼 단일화 (`ai-agent.handler.ts`) |
| W6 (Maintainability) | ⏸ Deferred | `startedAt?/finishedAt?` 포함 인라인 타입이 FE/BE 여러 파일에 분산. **deferred 사유**: 프론트·백엔드 **크로스 패키지** 타입이라 공유에는 별도 공유 패키지 도입이 필요(리뷰 I6/I7 도 별도 lift 로 인정). 현재는 각 파일 SYNC 주석으로 동기화 부담 관리 중이며 모두 하위호환 optional 이라 drift 위험 낮음. 공유 타입 패키지 도입은 본 작업 범위 밖 후속 |
| W7 (User Guide Sync) | ✅ Fixed | `05-run-and-debug/run-results.mdx` + `.en.mdx` 갱신 — 타임라인 FieldTable 에 "발생 시각/Timestamp" 항목 추가 + §멀티턴 소절에 요소별 시각·소요시간(및 tool-only 응답) 1~2문장 추가. KO/EN parity |

## Info 처리 (선별)
- **I9** ✅ Fixed: tool 실행 `finishedAt`/`durationMs` 를 단일 `Date.now()`(=`finishedAtMs`)에서 산출해 1ms 오차 제거. (llmCalls 4곳은 spec 허용 ms 차이라 유지)
- I1/I2/I3/I4 (테스트 보강), I5(=W2 와 동일, 처리됨), I6/I7(=W6), I8(렌더 메모이즈 — 관측 시 도입), I11/I12/I13/I14: INFO 수준으로 현 단계 비차단. I13(`system_error` 시각 폴백)은 §9.12 가 `turns[].timestamp` 단일 출처로 충분하며 spec 모호성 아님으로 판단.

## 검증 (TEST WORKFLOW 재수행)
- FE `tsc --noEmit`: 0 errors. eslint(변경 파일): clean.
- FE vitest (run-results · websocket · conversation · date): **458 passed**.
- BE eslint(handler): clean. BE jest (ai-agent.handler · execution-engine.service): **345 passed**.
- BE `tsc`: 변경 3파일 신규 에러 0 (잔여는 main 기존 무관 이슈).

## 결론
Critical 0. Warning 7 중 5건 수정 + 2건(W4/W6, 순수 maintainability) 사유 명시 deferred. 모든 테스트 green. **BLOCK 해소.**
