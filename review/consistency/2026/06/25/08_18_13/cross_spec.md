### 발견사항

충돌 없음.

이번 diff 는 `recordMultiTurnNonProviderToolResults` 내 condition tool 의 `toolCallCount++` 를 제거해 multi-turn 경로를 single-turn 경로 및 spec §7.1 정의와 일치시킨 SPEC-DRIFT 해소 작업이다. 아래 각 관점별로 점검한 결과를 기술한다.

---

**[INFO] spec §7.1 `meta.toolCalls` 정의와의 정합 — 확인됨**
- target 위치: `recordMultiTurnNonProviderToolResults` (ai-turn-executor.ts, diff 라인 1988~1994)
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` (라인 524)
- 상세: spec §7.1 표는 `meta.toolCalls` 를 "KB·MCP·일반 도구 호출 횟수 합산 **(조건 도구 제외)**" 로 정의한다. 이번 변경 전 multi-turn 경로는 condition deferral 에서도 `toolCallCount++` 를 수행해 이 정의와 충돌하고 있었다. diff 는 해당 `toolCallCount++` 를 제거해 spec 과 구현을 일치시킨다. 충돌은 이번 변경으로 해소되었다.
- 제안: 해소 완료, 추가 조치 불필요.

**[INFO] `maxToolCalls` config 정의와의 정합 — 확인됨**
- target 위치: `recordMultiTurnNonProviderToolResults`, `recordSingleTurnNonProviderToolResults`
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §1` (라인 48: "최대 도구 호출 횟수 (KB·MCP·일반 합산)")
- 상세: `maxToolCalls` 의 budget 의미 정의도 조건 도구를 합산 대상으로 포함하지 않는다. 이번 변경은 budget 차감 로직을 이 정의와 동일하게 맞춘다. 모순 없음.

**[INFO] JSDoc 참조 섹션 번호 갱신 (§3.f-g to §6.1.f-g) — 스펙 섹션과 일치**
- target 위치: `recordSingleTurnNonProviderToolResults` JSDoc (diff 라인 1119, 1183)
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.f-g`
- 상세: 이전 JSDoc 은 `§3.f-g` 를 참조했으나, 실제 spec 의 도구 루프 로직은 `§6.1.f-g` 에 위치한다. 코드 내 참조를 올바른 섹션 번호로 수정한 것은 명명 일관성 향상이다. 스펙 섹션 번호 자체는 변경되지 않았으므로 충돌 없음.

**[INFO] `Date.now()` 단일 캡처 — 스펙 중립**
- 상세: `condRouteDurationMs` 변수 도입으로 `Date.now()` 가 한 번만 호출되도록 수정. `meta.durationMs`와 `turnDebug[].totalDurationMs` 가 같은 시각을 참조하는 것은 spec §7.1 `meta.durationMs` 필드 정의와 모순되지 않는다. 다른 spec 영역과 교차 충돌 없음.

**[INFO] `TOOL_BUDGET_EXCEEDED_ERROR` 상수화 — 스펙 중립**
- 상세: 코드 내 `'tool_call_budget_exceeded'` 리터럴을 named constant 로 추출. JSDoc 에서 "LLM-internal 신호" 임을 명시해 외부 에러코드 enum(`MAX_TOOL_CALLS_EXCEEDED` 등)과 레이어가 다름을 문서화. `spec/conventions/error-codes.md` 의 공개 에러코드 목록과 혼용되지 않는다. 충돌 없음.

---

### 요약

이번 변경은 multi-turn 경로의 condition tool `toolCallCount` 합산 버그(SPEC-DRIFT)를 제거해 `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §7.1 의 `meta.toolCalls` 정의("조건 도구 제외")와 일치시켰다. 검토한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 어디에도 다른 spec 영역과 충돌하는 사항이 없다. spec 변경이 수반되지 않았으며("spec 변경 없음"), 기존 spec 본문이 이번 코드 변경의 ground-truth 로 기능했다.

### 위험도

NONE
