### 발견사항

- **[WARNING]** 테스트 이름과 실제 동작 불일치
  - 위치: `handler.spec.ts`, single-label `includeEvidence` suite — "should coerce non-string evidence items to strings (defensive)"
  - 상세: `sanitizeEvidence`는 비문자열을 문자열로 강제 변환(coerce)하지 않고 **드롭(drop)**한다. `value.filter((v): v is string => typeof v === 'string')`. 어서션(`toEqual(['valid'])`)은 올바르나, 이름이 "coerce"라고 명시해 향후 독자가 변환 동작이 있다고 오해할 수 있다.
  - 제안: `"should drop non-string evidence items to preserve string[] contract"`로 변경

- **[WARNING]** `includeEvidence: true` + `includeConfidence: false` 조합 미테스트
  - 위치: `handler.spec.ts`, single-label / multi-label 두 suite 모두
  - 상세: 현재 모든 evidence 테스트는 `baseConfig`(`includeConfidence: true`)를 스프레드하여 사용한다. 구현은 두 플래그를 독립적으로 처리하지만, confidence 없이 evidence만 있는 경우(`{ ...baseConfig, includeConfidence: false, includeEvidence: true }`)를 검증하는 케이스가 없다. 출력 결과에서 `confidence`가 누락되고 `evidence`만 포함되는 경로가 실제로 맞는지 확인되지 않는다.
  - 제안: 두 모드 각각에 해당 조합 케이스 1개씩 추가

- **[WARNING]** multi-label + `includeEvidence: true` + 빈 배열 fallback 케이스 미테스트
  - 위치: `handler.spec.ts`, multi-label `includeEvidence` suite
  - 상세: "should route to fallback when empty categories array returned" 테스트는 `includeEvidence` 없이 실행된다. `includeEvidence: true`인 상태에서 LLM이 `{"categories": []}`를 반환할 때 `port: 'fallback'`이고 `result.categories`가 `[]`인지 검증하는 케이스가 없다.
  - 제안: multi-label `includeEvidence` suite에 `'{"categories": []}'` 반환 케이스 추가

- **[INFO]** `textClassifierNodeConfigSchema`의 `includeEvidence` 필드 파싱 테스트 부재
  - 위치: `text-classifier.schema.spec.ts`
  - 상세: schema spec 파일은 `textClassifierNodeOutputSchema`만 검증하고 `textClassifierNodeConfigSchema`는 건드리지 않는다. `includeEvidence` 기본값이 `false`인지, boolean이 아닌 값이 들어왔을 때 zod가 reject하는지 등의 config-schema 경로가 미검증 상태다.
  - 제안: `textClassifierNodeConfigSchema`에 대해 `includeEvidence` 기본값(`false`)과 파싱 성공 케이스 최소 1개 추가

- **[INFO]** `sanitizeEvidence`가 모듈 스코프 함수임에도 단독 단위 테스트 없음
  - 위치: `text-classifier.handler.ts:421-424` — `sanitizeEvidence`
  - 상세: 핸들러 통합 경로를 통해 간접 커버는 되어 있으나, `sanitizeEvidence(undefined)`, `sanitizeEvidence({})`, `sanitizeEvidence([1,2,3])` 같은 입력을 핸들러 컨텍스트 없이 명시적으로 검증하는 테스트가 없다. 현재 커버리지에서 치명적 갭은 아니나 함수 자체의 계약이 명확해지면 좋다.
  - 제안: 함수를 export하거나 별도 헬퍼 파일로 분리해 순수 단위 테스트 추가 고려

---

### 요약

`includeEvidence` 기능에 대한 테스트 커버리지는 전반적으로 충실하다. single-label · multi-label 두 모드 모두에서 기본값 누락, 정상 파싱, LLM 생략 fallback, `__none__` fallback, JSON 파싱 실패, 비문자열 항목 처리, substring fallback 등 핵심 경로를 고르게 테스트한다. 그러나 "coerce"라는 오도하는 테스트 이름, `includeEvidence: true` + `includeConfidence: false` 조합 미검증, multi-label + evidence + 빈 배열 fallback 케이스 누락, config-schema 레벨 테스트 부재가 보완 포인트다. 기존 테스트는 새 플래그가 opt-in(`false` 기본값)으로 설계되어 있어 회귀 위험 없이 유효하다.

### 위험도

**LOW**