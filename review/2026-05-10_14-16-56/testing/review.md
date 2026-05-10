### 발견사항

- **[INFO]** multi-label 에러 테스트의 `requestPayload` 검증 누락
  - 위치: spec.ts 784~807 (multi-label Principle 2 테스트)
  - 상세: single-label 에러 테스트는 `expect(llmCalls[0].requestPayload).toBeDefined()` 를 검증하지만, multi-label 동일 테스트는 이 단언을 생략했다. 두 경로의 에러 분기는 동일 코드로 처리되므로 행동은 같지만 테스트가 비대칭이다.
  - 제안: multi-label 에러 테스트에 `expect(llmCalls[0].requestPayload).toBeDefined()` 추가

- **[INFO]** multi-label 에러 경로의 모델 폴백 테스트 미존재
  - 위치: spec.ts — single-label 에만 `should fall back model from llmConfig.defaultModel when config.model is unset (error path)` 존재
  - 상세: `config.model` 미설정 시 `llmConfig.defaultModel` 로 폴백되는 경로가 single-label 에러에는 검증되었으나 multi-label 에러 경로는 동일 코드를 공유함에도 미검증 상태다.
  - 제안: multi-label `describe` 블록에 동일 모델 폴백 테스트 추가

- **[INFO]** `output.originalInput` (error 경로 최상위) 미검증
  - 위치: handler.ts 147번 줄 `originalInput: inputField` — 기존 코드, 변경 전부터 존재
  - 상세: 에러 포트에서 `output.originalInput`(truncated 아닌 full) 이 반환되는데, 기존 `should route to error port on LLM failure` 테스트와 신규 두 테스트 모두 `output.error.*` 만 검증하고 `output.originalInput` 은 무검증이다. spec §5.3 JSON 예시에는 포함되어 있다.
  - 제안: 신규 Principle 2 테스트 중 하나에 `expect(result.output.originalInput).toBe('I need a refund')` 추가

- **[INFO]** `meta.durationMs === llmCalls[0].durationMs` 동치 불검증
  - 위치: handler.ts 130 — `errorDurationMs` 가 `meta.durationMs` 와 `llmCalls[0].durationMs` 양쪽에 동일값 대입
  - 상세: 현재 두 필드가 동일 변수를 재사용하여 항등이지만, 테스트는 각각 `typeof … === 'number'` 만 확인하고 값의 동치를 단언하지 않는다. 후일 `llmCalls[0].durationMs` 를 별도 `Date.now()` 로 재계산하도록 변경되면 조용히 동작이 갈라진다.
  - 제안: `expect(meta.durationMs).toBe(llmCalls[0].durationMs)` 추가 (선택적, 설계 의도 고정용)

- **[INFO]** `void _omit` 패턴의 가독성
  - 위치: spec.ts `should fall back model from llmConfig.defaultModel` 테스트
  - 상세: `const { model: _omit, ...configWithoutModel } = ...; void _omit;` 는 lint 경고 억제 관용구이지만 처음 보는 독자에게 의도가 불분명하다.
  - 제안: `const configWithoutModel = { ...baseConfig } as Record<string, unknown>; delete configWithoutModel.model;` 또는 인라인 `{ inputField, categories, includeConfidence }` 명시 destructure 로 교체

- **[INFO]** 제거된 `output._llmCalls` 필드의 부재(negative) 단언 없음
  - 위치: handler.ts diff — `_llmCalls` 가 `output` 에서 `meta.llmCalls` 로 이동
  - 상세: 이전 구현에서 `output._llmCalls` 가 존재했다면, 해당 필드가 더 이상 `output` 에 없음을 검증하는 단언이 없다. 다른 경로에서 여전히 노출될 경우 조용히 계약을 위반한다.
  - 제안: 기존 에러 테스트에 `expect(result.output).not.toHaveProperty('_llmCalls')` 추가

---

### 요약

핵심 변경사항(에러 경로에서 `meta.durationMs` / `meta.model` / `meta.llmCalls` 채우기)에 대한 테스트는 충분히 존재하며, single-label · multi-label 양쪽, 모델 폴백 경로까지 신규 케이스로 커버한다. mock 격리와 `beforeEach` 리셋도 적절하다. 다만 multi-label 테스트가 single-label 대비 `requestPayload` 단언을 빠뜨리는 비대칭성, `output.originalInput` (에러 포트)의 pre-existing 미검증, 그리고 `void _omit` 패턴의 가독성 이슈가 소소하게 남아있다. 기능 정확성에 영향을 주는 결함은 없고 모두 개선 수준의 관찰이다.

### 위험도

**LOW**