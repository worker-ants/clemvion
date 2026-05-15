### 발견사항

- **[INFO]** `sanitizeEvidence` 함수의 위치가 클래스 외부 모듈 레벨에 정의됨
  - 위치: `text-classifier.handler.ts` 마지막 줄
  - 상세: 클래스 내부에서만 사용되는 순수 함수를 모듈 레벨에 배치한 것은 의도적인 선택으로 보임. 다만 파일 내 다른 private 메서드들은 클래스 내부에 있어 미묘한 비일관성이 있음
  - 제안: 현재 패턴 유지 가능. 단, 추후 유사 유틸리티 함수가 늘어날 경우 `utils/` 또는 내부 static private method로 통일하는 것을 권장

- **[INFO]** `responseFields` / `itemFields` 배열 필터링 패턴이 두 `build*Prompt` 메서드에서 구조적으로 동일하게 반복됨
  - 위치: `buildSingleLabelPrompt` L173-183, `buildMultiLabelPrompt` L219-229
  - 상세: 두 블록 모두 `[field, boolFlag ? '- ...' : '', ...]`.filter(Boolean)`.join('\n')` 패턴을 사용. 현재 2곳이라 허용 가능한 중복이지만, `includeEvidence` 이후 필드가 추가될 경우 3곳 이상으로 발산할 위험이 있음
  - 제안: 즉각적인 리팩토링보다는 다음 필드 추가 시점에 `buildResponseFieldList(fields: {text: string, enabled: boolean}[])` 형태의 헬퍼로 추출하는 것이 적절

- **[INFO]** `processSingleLabelResult`와 `processMultiLabelResult`에서 `includeConfidence` / `includeEvidence` 플래그를 spread 연산자로 조건부 포함하는 패턴이 반복됨
  - 위치: `processSingleLabelResult` L326-328, `processMultiLabelResult` L376-379, L387-389
  - 상세: `...(flag ? { key: value } : {})` 패턴이 5곳에 산재. 각 인스턴스는 단순하나 새 플래그 추가 시 누락 위험이 증가함
  - 제안: 현재 2개 플래그 수준에서는 허용 범위. 3개 이상이 될 경우 `pickIf` 헬퍼 또는 명시적 객체 조립 방식으로 전환 권장

- **[INFO]** `processSingleLabelResult`에서 JSON 파싱 실패 fallback 경로에 `evidence`가 암묵적으로 빈 배열로 유지됨
  - 위치: `text-classifier.handler.ts` L306-313 (catch 블록)
  - 상세: catch 블록에서 `evidence`를 명시적으로 재설정하지 않고, 초기값 `let evidence: string[] = []`에 의존함. `includeEvidence: true`인 fallback 경로와 `includeEvidence: false`인 경로 모두 동일하게 동작하므로 현재는 정확하지만, 향후 catch 블록에 로직이 추가될 경우 의도가 불명확해질 수 있음
  - 제안: catch 블록 내 `evidence = [];` 한 줄 명시적 추가로 의도를 문서화

- **[INFO]** 테스트 픽스처에서 `usage` 객체가 모든 `mockResolvedValueOnce` 호출에서 동일한 값으로 반복됨
  - 위치: `text-classifier.handler.spec.ts` 내 `includeEvidence` describe 블록들
  - 상세: `{ inputTokens: 50, outputTokens: 10, totalTokens: 60 }` 가 각 it 블록에 인라인 중복됨. 기존 파일의 `beforeEach` mock도 동일 값을 사용하므로 일관성 있음
  - 제안: `includeEvidence` describe 스코프 상단에 `const evidenceUsage = { inputTokens: 50, outputTokens: 10, totalTokens: 60 }` 상수로 추출하면 픽스처 변경 시 한 곳만 수정하면 됨

---

### 요약

`includeEvidence` 기능 추가는 기존 `includeConfidence` 패턴을 충실히 따르고 있어 일관성이 높다. `sanitizeEvidence` 순수 함수 추출, `required` 배열 점진적 구성 방식, 스키마·프롬프트·처리 로직의 병렬 확장 구조 모두 유지보수 관점에서 적절하다. 발견된 항목들은 현재 규모에서는 실질적 문제가 없으며, 동일 패턴의 세 번째 플래그가 추가되는 시점에 리팩토링 신호로 참고하면 된다.

### 위험도

**LOW**