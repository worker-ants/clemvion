# Code Review Resolution — 2026-05-10_14-16-56

대상 commit: `6dfc984f feat(text-classifier): C — 에러 케이스 meta 메트릭 보강 (durationMs/model/llmCalls)`

리뷰 통합 보고서: `./SUMMARY.md`

전체 위험도 LOW. Critical 0건, Warning 7건, Info 14건. Warning 전건 + 핵심 Info 항목을 후속 정정 commit 으로 일괄 처리.

---

## Warning 조치

### W1 — PII truncation 정책 통일 (Security)

**리뷰 지적**: `output.originalInput` (full) / `output.error.details.originalInput` (500자 cap) / `meta.llmCalls[0].requestPayload.messages[1].content` (full) — 세 노출 지점의 truncation 정책이 다른데 주석은 "PII truncation" 적용으로만 표현.

**조치**: 의도적 분리 정책임을 명시. spec §5.3 필드 표 + 핸들러 주석 양쪽에 다음을 명문화.

- `output.originalInput` — 성공 case 의 `output.result.originalInput` 와 동일 의미. 다운스트림 노드가 원문 입력을 재확인하도록 truncation 없이 보존.
- `output.error.details.originalInput` — 에러 envelope 은 로그·UI 표시 경로가 짧아 PII / 대용량 회피 위해 500자 cap.
- `meta.llmCalls[0].requestPayload` — 디버그 trace 채널. 성공 path 의 `meta.llmCalls` 와 동일 정책 (full 보존). 사용자 노출 시 sanitize 책임은 호출자 (spec 추가).

코드 변경: `handler.ts` catch-block 주석을 3-노출-지점 정책으로 재작성.

### W2 — `durationMs` 책임 분열 (Architecture)

**리뷰 지적**: 성공 경로는 spec 표가 "engine inject" 으로 표기, 에러 경로는 핸들러가 직접 계산 → 책임 분열.

**원인 확인**: 엔진 코드 검증 결과, 비-container 노드의 `meta.durationMs` 는 엔진이 inject 하지 **않는다**. `nodeExec.durationMs` (DB row) 는 엔진이 채우지만 structured output 의 `meta` 에는 손대지 않음 (`handler-output.adapter.ts` / `execution-engine.service.ts:4481` 의 "engine-injected `durationMs`" 주석은 container/loop/foreach 한정). 따라서 성공 경로 spec 표의 "engine inject" 표기는 **잘못된 기존 문서**.

**조치**:
1. 성공 경로 핸들러가 `meta.durationMs` 를 직접 반환하도록 수정. `executeStartedAt = Date.now()` 를 `execute()` 진입부에 stamp → 성공/에러/fallback 모든 경로 동일 측정 기준 (resolveConfig + 프롬프트 빌드 + LLM 호출 전체 span).
2. spec §5.1 표의 출처를 `engine inject` → `handler return` 으로 정정, 측정 기준 명문화.
3. `processSingleLabelResult` / `processMultiLabelResult` 서명에 `durationMs: number` 인자 추가.

### W3 — 에러/성공 meta shape 비대칭 (Architecture / API Contract)

**리뷰 지적**: 성공 meta 에는 토큰 필드 (`inputTokens`/`outputTokens`/`totalTokens`) 가 있고 에러 meta 에는 없음 → `$node[X].meta.inputTokens` 가 에러 포트에서 `undefined`.

**조치**: 에러 catch 블록의 `meta` 에 토큰 필드를 0-default 로 추가. `thinkingTokens` 는 LLM 응답 의존 필드라 미포함 (성공 path 와 동일 — `result.usage?.thinkingTokens` undefined 시 omit). spec §5.3 필드 표에 "에러 시 LLM 응답 미수신 → 모두 0" 행 추가.

### W4 — spec §5.3 필드 표에 `output.originalInput` 누락 (Requirement / Documentation)

**조치**: `output.originalInput` 행을 spec §5.3 필드 표에 추가. `output.error.details.originalInput` (500자 cap) 와의 차이 명시.

### W5 — `meta.durationMs` 측정 기준이 spec 설명과 불일치 (Requirement)

**리뷰 지적**: `callStartedAt` 이 LLM 호출 직전이라 resolveConfig·프롬프트 빌드 시간 누락.

**조치**: W2 의 일환으로 `executeStartedAt` 을 `execute()` 진입부로 이동. spec §5.1 / §5.3 의 "에러 발생 전까지" 문구를 "`execute()` 진입부터 LLM 호출 resolve 직후까지" 로 정정해 측정 시점 명확화.

### W6 — 에러 메트릭 검증 로직 테스트 중복 (Maintainability)

**조치**: `assertErrorMeta(meta, expectedModel)` 로컬 헬퍼 추출. 단일·멀티 레이블 에러 테스트 양쪽이 동일 헬퍼 사용 → meta 계약 변경 시 단일 지점 수정. 헬퍼 내부에서 `meta.durationMs >= llmCalls[0].durationMs` 동치/부등식까지 보강 (Info 5/6 동시 해결).

### W7 — `output._llmCalls` 제거의 잠재적 breaking change (API Contract / Dependency)

**조치 1**: 다운스트림 사용처 grep — `backend/` 내부에서 `_llmCalls` 참조는 information-extractor spec 1건 (negative 단언) + 본 변경 뿐. `frontend/src/components/editor/run-results/llm-call-trace.ts` 가 `output._llmCalls` 를 single-call 노드에서 읽지만, **text-classifier 의 성공 path 는 이미 `output._llmCalls` 를 반환하지 않고 `meta.llmCalls` 만 사용**. 즉, frontend 는 text-classifier 에서 이미 빈 배열을 반환받는 상태였고, 본 변경은 에러 path 에서도 동일 조건으로 정렬. 다운스트림 expression 영향 0건.

**조치 2**: 테스트에 `expect(result.output).not.toHaveProperty('_llmCalls')` 명시 (Info 4 동시 해결).

**조치 3**: 향후 frontend `extractLlmCalls` 가 `meta.llmCalls` 도 읽도록 보강하는 별도 작업이 필요하나, 본 commit 범위 외. plan 후속 항목으로 분리.

---

## Info 조치

| # | 항목 | 조치 |
|---|------|------|
| I1 | 멀티 레이블 에러 테스트 `requestPayload` 검증 누락 | `assertErrorMeta` 헬퍼 내부에 `expect(llmCalls[0].requestPayload).toBeDefined()` 포함 → 양 모드 자동 커버 |
| I2 | 멀티 레이블 모델 폴백 테스트 미존재 | `should fall back model from llmConfig.defaultModel ... (multi-label error path)` 신규 케이스 추가 |
| I3 | `output.originalInput` (에러) 검증 없음 | 신규 Principle 2 테스트에 `expect(data.originalInput).toBe(...)` 추가 (single + multi 양쪽) |
| I4 | `output._llmCalls` 부재 negative 단언 없음 | `expect(data).not.toHaveProperty('_llmCalls')` 추가 (single + multi 양쪽) |
| I5 | `meta.durationMs === llmCalls[0].durationMs` 동치 미검증 | `assertErrorMeta` 헬퍼에 `meta.durationMs >= llmCalls[0].durationMs` 부등식 검증 추가 (executeStartedAt > callStartedAt 이므로 등호 아닌 부등식) |
| I6 | 두 `durationMs` 시맨틱 중복 | 헬퍼 주석에 시맨틱 차이 명문화 (whole execute span vs LLM call). 핸들러 주석에도 reflect |
| I7 | `requestPayload` PII 노출 | spec §5.3 표의 `output.error.message` 행에 "사용자 노출 시 sanitize 책임은 호출자" 추가. `meta.llmCalls` 디버그 전용 의도는 성공 path 와 동일 정책이라 별도 변경 없음 |
| I8 | LLM provider 에러 메시지 원문 패스스루 | I7 와 동일 라인의 sanitize 책임 명기로 흡수 |
| I9 | 성공/에러 `durationMs` 주입 비대칭 미문서화 | W2 의 일환으로 양 path 모두 핸들러 책임으로 통일 → 비대칭 자체 해소 |
| I10 | `void _omit` 비표준 패턴 | `const { model: _, ...rest } = ...` 로 단순화 (single + multi 양쪽) |
| I11 | `as number` 타입 캐스트 잉여 | `assertErrorMeta` 로 단언 일원화하면서 `expect.any(Number)` 사용 → 캐스트 제거 |
| I12 | 멀티 레이블 테스트 CONVENTIONS 주석 부재 | 헬퍼로 일원화 + 멀티 레이블 케이스에 모드별 의도 한 줄 주석 추가 |
| I13 | 핸들러 주석 마지막 두 줄 중복 | catch-block 주석을 3-노출-지점 정책 + Principle 2 + 시맨틱 분리 한 묶음으로 재작성 → 중복 제거 |
| I14 | `errorDurationMs` 측정이 truncation 이후 | W5 조치로 `executeStartedAt` 을 execute() 진입부로 이동 → truncation 시간은 자연 포함되므로 별도 처리 불필요 |

---

## 검증

1. **lint**: pass (pre-existing `variable-modification.handler.ts:109` warning 1건은 별도 모듈, 본 변경과 무관)
2. **unit test**: 88 / 88 (text-classifier suite), 3060 / 3060 (full backend)
3. **build**: pass (`nest build` 성공)
4. **doc-link**: 0 broken refs

---

## 후속 follow-up (별도 작업)

- frontend `extractLlmCalls` 가 `meta.llmCalls` 도 읽도록 확장 — 현재 단일 호출 LLM 노드 (text-classifier / information-extractor 일부) 의 run-results UI 가 호출 trace 를 `output._llmCalls` 에서만 찾고 있어 spec §5.x 의 `meta.llmCalls` 정합 채널로 통합 필요. plan/in-progress 항목으로 분리.
