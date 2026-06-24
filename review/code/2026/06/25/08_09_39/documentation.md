# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] JSDoc 레이어 경계 설명 추가 — 양호
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `CONDITION_DEFERRAL_RESULT_MSG`/`TOOL_BUDGET_EXCEEDED_ERROR` 상수 블록 (diff +699~701)
- 상세: `TOOL_BUDGET_EXCEEDED_ERROR` 가 LLM-internal 신호이며 공개 에러코드(`MAX_TOOL_CALLS_EXCEEDED`)와 다른 레이어임을 명시하는 JSDoc 설명이 추가됐다. 계층 구분이 이전에는 없었으므로 유지보수자가 두 값을 혼동할 여지가 있었는데, 이번 변경이 이를 해소한다. 문서화 관점에서 긍정적인 변경이다.

### [INFO] JSDoc spec 참조 경로 완전화 — 양호
- 위치: `ai-turn-executor.ts` — `recordSingleTurnNonProviderToolResults` JSDoc (diff +719~720), `recordMultiTurnNonProviderToolResults` JSDoc (diff +785~787)
- 상세: 두 private 메서드의 JSDoc 에서 `§3.f-g` 라는 불완전 참조가 `spec §7.1 meta.toolCalls` / `spec/4-nodes/3-ai/1-ai-agent.md §6.1.f-g` 로 완전 경로 형태로 교체됐다. 짧은 절 번호만으로는 어느 문서의 어느 절인지 알 수 없어 탐색 비용이 있었는데, 이번 변경이 이를 제거한다.

### [INFO] INVARIANT 주석 제거 및 정책 통일 반영 — 적절
- 위치: `ai-turn-executor.ts` — `recordMultiTurnNonProviderToolResults` JSDoc 블록 (diff +782~787) + 조건 도구 루프 인라인 주석 (diff +795~803)
- 상세: 이전에는 "multi-turn 은 합산 — single-turn 과 의도적으로 다르다. 동기화 금지." 라는 INVARIANT 주석이 존재했다. 이번 버그픽스로 정책이 통일됐으므로 해당 주석을 제거하고 새 동작(미합산 + W7 SPEC-DRIFT 해소 이력)을 서술한 것은 정확하다. 오래된 주석이 새 코드와 모순되는 상황이 남지 않도록 처리됐다.

### [INFO] condition-route 단일 캡처 인라인 주석 — 양호
- 위치: `ai-turn-executor.ts` — `handleSingleTurnConditionRoute` (diff +739~741) 및 multi-turn 대응 위치 (diff +811~813)
- 상세: `condRouteDurationMs = Date.now() - singleTurnStartedAt` 캡처 지점에 왜 단일 변수로 뽑는지(trace durationMs 와 turnDebug 가 동일 시각을 참조해야 함) 설명이 추가됐다. 이전에는 `Date.now()` 가 두 번 호출돼 미세한 시각 차이가 생겼고, 그 의도가 주석 없이 암묵적이었다.

### [INFO] 테스트 인라인 주석 — 충분
- 위치: `ai-turn-executor.spec.ts` — 추가된 `it` 블록 앞 주석 (diff +61~63)
- 상세: 새 테스트 케이스("multi-turn condition no-count")에는 해당 픽스의 배경(C-2 후속, W7 BLOCK 해소, spec §7.1 조건 도구 제외 + §6.1.f-g)을 서술한 주석이 달려 있다. 테스트 목적과 spec 근거가 명확하다.

### [INFO] spec 변경 불필요 — 확인됨
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §7.1, §6.1.f-g
- 상세: spec §7.1 `meta.toolCalls` 항목(line 524)은 이미 "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)"로 명시돼 있으며, §6.1.g(line 385)도 `maxToolCalls` 합산에서 조건 도구를 제외하는 동작을 기술한다. 이번 코드 변경은 기존 spec 에 코드를 수렴시키는 버그픽스이므로 spec 갱신은 불필요하다. 커밋 메시지도 "spec 변경 불요"를 명시하고 있다.

### [INFO] README·CHANGELOG 업데이트 불필요
- 위치: 프로젝트 루트 / `codebase/backend/`
- 상세: 이번 변경은 외부 API 스키마·설정 옵션·사용자 facing 기능에 영향을 주지 않는 내부 버그픽스(toolCallCount 합산 로직 정정)다. README 또는 CHANGELOG 갱신이 필요한 수준의 변경이 아니다.

### [INFO] 환경변수 문서화 영향 없음
- 위치: `ai-turn-executor.ts` — `resolveRetryStateTtlMinutes` (`AI_RETRY_STATE_TTL_MINUTES`)
- 상세: 이번 diff 가 해당 함수를 건드리지 않았으며, 기존 JSDoc 이 환경변수 이름·default·파싱 규칙을 이미 명시하고 있다. 변경 없이 적절한 상태다.

## 요약

이번 변경(W7 SPEC-DRIFT 버그픽스)은 문서화 관점에서 전반적으로 양호하다. `TOOL_BUDGET_EXCEEDED_ERROR` 레이어 경계 JSDoc 추가, spec 참조 경로의 완전화(`§3.f-g` → 파일 경로 포함 완전 경로), 이전 동작과 모순된 INVARIANT 주석 제거, condition-route 단일 캡처 의도 주석 추가가 모두 이뤄졌다. 기존 spec(§7.1 조건 도구 제외 명세)이 이미 올바르게 기술돼 있어 spec/README/CHANGELOG 갱신은 불필요하다. 주석·JSDoc 이 실제 코드 동작과 일치하는 상태로 정렬됐고, 오래된 모순 주석이 남지 않는다.

## 위험도

NONE
