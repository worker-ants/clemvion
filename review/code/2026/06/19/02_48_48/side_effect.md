# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] 테스트 파일 전용 변경 — 프로덕션 부작용 없음
- 위치: `ai-turn-orchestrator.service.spec.ts` (테스트 파일)
- 상세: 이번 diff 는 `.spec.ts` 파일에만 적용된다. 프로덕션 소스(`ai-turn-orchestrator.service.ts`)는 수정되지 않았으므로, 전역 상태·API 시그니처·파일시스템·네트워크 호출·이벤트 발생 경로에 대한 런타임 부작용은 발생하지 않는다.

### [INFO] 기존 테스트 케이스에 `expect(result.code)` 어서션 추가
- 위치: 409번 인근 — `'details 필드를 포함한 오류를 처리한다 (retryable 자동 분류)'` 케이스
- 상세: `expect(result.code).toBe('LLM_API_ERROR')` 어서션이 기존 `expect(result.details)` 어서션 앞에 삽입됐다. 어서션 순서 변경이나 상태 공유 없이 단순히 검증 범위를 확장한다. `extract()(err)` 호출은 `classifyLlmError` 의 pure function 경로를 타므로 테스트 간 공유 상태를 건드리지 않는다.
- 제안: 없음. 의도한 명세 강화.

### [INFO] 신규 `it` 블록 추가 — `LLM_PROVIDER_QUOTA` passthrough 검증
- 위치: 47~57번 라인(diff 기준) — `'미등록 explicit code 는 정규화 시 그대로 passthrough ...'`
- 상세: `Object.assign(new Error(...), { code: 'LLM_PROVIDER_QUOTA' })` 를 사용해 로컬 `err` 객체를 생성 후 즉시 `extract()(err)` 에 전달한다. 반환값을 로컬 `result` 에 받아 두 어서션을 수행하며 테스트 범위 밖으로 누출되는 객체 참조나 상태가 없다.
  - `handlerRegistry`, `contextService`, `orchestrator` 등의 공유 픽스처는 이 케이스에서 사용되지 않는다 (`AiTurnOrchestrator.extractAiTurnErrorPayload` 는 static 메서드).
  - `afterEach(() => jest.restoreAllMocks())` 가 등록돼 있으므로, 이 `it` 블록에서 spy 를 사용하지 않더라도 전체 suite 의 mock 복원 정책은 보전된다.
- 제안: 없음.

### [INFO] `extract()` 헬퍼의 반복 호출 패턴 — 부작용 없음
- 위치: `describe('extractAiTurnErrorPayload')` 내 `extract` 헬퍼 함수
- 상세: `extract()` 는 매번 `AiTurnOrchestrator.extractAiTurnErrorPayload` 함수 참조를 반환하는 getter 이며, static 메서드이므로 인스턴스 상태를 읽거나 변경하지 않는다. 신규 테스트가 이를 재사용하는 방식은 기존 패턴과 동일하다.

## 요약

이번 변경은 `.spec.ts` 테스트 파일에만 국한되며, 프로덕션 코드 경로·전역/공유 상태·파일시스템·네트워크·이벤트·API 시그니처 중 어느 것도 변경하지 않는다. 추가된 어서션과 신규 `it` 블록은 `classifyLlmError` 의 explicitCode passthrough 분기(미등록 code 를 그대로 보존하고 `retryable=false` 로 반환)를 spec 규약 레벨에서 명시적으로 고정하는 회귀 가드이며, 의도하지 않은 부작용은 없다.

## 위험도

NONE
