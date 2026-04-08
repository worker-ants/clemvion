## 발견사항

### [CRITICAL] `timeout` 포트 제거로 인한 회귀 테스트 파괴 위험
- **위치**: `spec/4-nodes/3-ai-nodes.md` — 포트 구조, Single/Multi Turn 실행 로직
- **상세**: `timeout` 전용 포트가 `error` 포트로 통합되었습니다. 기존에 `timeout` 포트를 검증하던 테스트 케이스가 존재한다면 즉시 깨집니다. 특히 Multi Turn 모드에서 `turnTimeout` 초과 시 `timeout` 포트로 라우팅하던 로직이 `error` 포트로 변경되었으므로, 해당 경로를 커버하는 테스트가 반드시 업데이트되어야 합니다.
- **제안**: 다음 테스트 케이스를 업데이트/추가해야 합니다:
  ```
  - LLM API 호출 타임아웃 → error 포트 라우팅 (code: "LLM_TIMEOUT")
  - rate limit 발생 → error 포트 라우팅 (code: "LLM_RATE_LIMIT")
  - turnTimeout 초과 → error 포트 라우팅 (Multi Turn)
  - endReason = "timeout" 이 error 포트에서 반환되는지 검증
  ```

---

### [CRITICAL] 도구 이름 규칙 변경으로 인한 테스트 파괴
- **위치**: `spec/4-nodes/3-ai-nodes.md` — Tool Area 연동, 조건 도구 등록
- **상세**: 도구 이름이 순수 UUID에서 `cond_{sanitized}` / `tool_{sanitized}` 접두사 방식으로 변경되었습니다. LLM 호출 시 전달되는 `tools` 배열의 `name` 필드를 검증하는 모든 테스트가 실패합니다. 특히 sanitize 로직(`-` → `_` 치환)에 대한 단위 테스트가 누락될 위험이 높습니다.
- **제안**:
  ```
  // sanitizeId 함수 단위 테스트 필수
  sanitizeId("abc123-de45-fg67") → "abc123_de45_fg67"
  
  // 도구 이름 생성 테스트
  conditionTool.name === `cond_${sanitizeId(condition.id)}`
  regularTool.name === `tool_${sanitizeId(node.id)}`
  
  // LLM API 전송 payload 스냅샷 테스트 업데이트 필요
  ```

---

### [WARNING] Single Turn 포트 순서 변경 — 기존 테스트의 배열 인덱스 의존
- **위치**: `spec/4-nodes/3-ai-nodes.md` — Single Turn 모드 포트 구조
- **상세**: 포트 순서가 `out → conditions → timeout → error`에서 `conditions → out → error`로 변경되었습니다. 포트 목록을 배열 순서 또는 인덱스로 검증하는 테스트가 잘못된 결과를 반환할 수 있습니다.
- **제안**: 포트 검증 테스트는 배열 순서가 아닌 포트 ID/key 기반으로 작성해야 합니다:
  ```typescript
  expect(ports).toContainEqual({ id: 'out' })
  expect(ports).toContainEqual({ id: 'error' })
  expect(ports.find(p => p.id === 'timeout')).toBeUndefined()
  ```

---

### [WARNING] Multi Turn 조건 0개 시 하위 호환 로직 — 엣지 케이스 테스트 누락
- **위치**: `spec/4-nodes/3-ai-nodes.md` — "조건이 0개인 경우 (하위 호환)"
- **상세**: Multi Turn + 조건 0개일 때 `out` 포트만 제공하는 하위 호환 로직이 추가되었습니다. 이 분기는 기존 엣지를 보존하는 중요한 경로임에도 명시적 테스트가 누락될 가능성이 높습니다. 조건 0개 → `out`, 조건 1개 추가 시 → `user_ended + max_turns + error` 로 포트 구조가 변하는 동적 변환도 테스트가 필요합니다.
- **제안**:
  ```
  - Multi Turn, conditions=[] → 포트: [out]
  - Multi Turn, conditions=[{...}] → 포트: [{cond.id}, user_ended, max_turns, error], out 없음
  - Multi Turn, conditions=[] 에서 조건 1개 추가 시 out 포트 제거 및 전용 포트 추가
  ```

---

### [WARNING] 신규 유효성 검증 규칙 — 테스트 케이스 부재
- **위치**: `spec/4-nodes/3-ai-nodes.md` — "유효성 검증 규칙" (신규 추가 섹션)
- **상세**: 다음 유효성 검증 규칙이 새로 명시되었으나 대응하는 테스트 케이스가 존재하지 않습니다:
  - 최대 20개 조건 제한
  - 예약된 포트 ID(`out`, `in`, `timeout`, `error`, `user_ended`, `max_turns`)와 조건 id 충돌 금지
  - `prompt` 최대 2,000자
  - `reason` 응답 500자 잘림 처리
- **제안**:
  ```
  - conditions.length === 21 → ValidationError
  - condition.id === 'error' → ValidationError (예약어 충돌)
  - condition.prompt.length === 2001 → ValidationError
  - reason이 501자인 LLM 응답 → 500자로 잘림 확인
  ```

---

### [WARNING] `_turnDebugHistory` 신규 필드 — 출력 스키마 테스트 누락
- **위치**: `spec/4-nodes/3-ai-nodes.md` — "디버그 데이터 (`_turnDebugHistory`)" (신규 섹션)
- **상세**: Multi Turn 실행 결과에 `_turnDebugHistory` 필드가 추가되었습니다. function calling 발생 시 동일 턴 내에 여러 `llmCalls` 항목이 쌓이는 로직에 대한 테스트가 없습니다. 특히 `turnIndex`와 `llmCalls` 배열의 연관 관계, `totalDurationMs` 합산 정확성 검증이 필요합니다.
- **제안**:
  ```
  - 단순 1턴, tool call 없음 → _turnDebugHistory[0].llmCalls.length === 1
  - 1턴, tool call 2회 → _turnDebugHistory[0].llmCalls.length === 3
  - totalDurationMs === sum(llmCalls[].durationMs) 검증
  ```

---

### [INFO] `endReason: "timeout"` 값 — 포트와 enum 간 불일치 문서화 부족
- **위치**: `spec/4-nodes/3-ai-nodes.md` — `endReason` enum 정의
- **상세**: `endReason` enum에 `timeout`이 여전히 포함되어 있으나 대응하는 포트는 없습니다. 주석으로 설명이 추가되었지만, 프론트엔드에서 `endReason === 'timeout'`인 `error` 포트 출력을 처리하는 분기 로직 테스트가 누락될 수 있습니다.
- **제안**: 프론트엔드 포트 라우팅 로직 테스트에서 `endReason: 'timeout'`이 포함된 `error` 포트 출력을 올바르게 처리하는지 검증 추가.

---

## 요약

이번 변경은 PRD/Spec 문서에 대한 수정으로, 구현 코드 자체가 아닌 요구사항 명세의 변경입니다. 그러나 `timeout` 포트 제거와 도구 이름 규칙(`cond_`/`tool_` 접두사) 변경은 **기존 구현 코드와 테스트에 직접적인 회귀를 유발하는 파괴적 변경(breaking change)**입니다. 특히 LLM API payload의 `tools[].name` 필드를 검증하는 통합 테스트와 포트 라우팅 단위 테스트가 즉시 깨질 가능성이 높습니다. 신규 추가된 유효성 검증 규칙(최대 20개 조건, 예약어 충돌, 글자수 제한)과 `_turnDebugHistory` 출력 필드에 대한 테스트 케이스도 새로 작성되어야 합니다. sanitize 함수처럼 순수 함수성이 강한 유틸리티는 단위 테스트 작성이 용이하므로 우선적으로 커버되어야 합니다.

## 위험도

**HIGH**