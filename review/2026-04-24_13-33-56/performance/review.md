## 발견사항

- **[INFO]** `sanitizeEvidence` 무조건 호출 (single-label 경로)
  - 위치: `text-classifier.handler.ts`, `processSingleLabelResult` 내 try 블록 (`evidence = sanitizeEvidence(parsed.evidence)`)
  - 상세: `includeEvidence=false` 일 때도 항상 호출됨. 단, 이 경우 LLM 응답에 `evidence` 필드 자체가 없으므로 `parsed.evidence === undefined` → `!Array.isArray(undefined)` 분기에서 즉시 `[]` 반환(O(1)). multi-label 경로는 `includeEvidence` 가드 안에서만 호출하므로 일관성이 없음.
  - 제안: `if (includeEvidence)` 조건 안으로 이동하거나 그대로 두어도 무방. 런타임 영향은 무시할 수 있음.

```typescript
// 현재 (단일 레이블 processSingleLabelResult)
evidence = sanitizeEvidence(parsed.evidence);  // includeEvidence와 무관하게 항상 실행

// 멀티 레이블은 가드 존재
...(includeEvidence ? { evidence: sanitizeEvidence(c.evidence) } : {}),
```

- **[INFO]** 프롬프트 빌드 시 `categoryNames.map()` 중복 실행
  - 위치: `buildSingleLabelPrompt` — `responseFields` 문자열과 `jsonSchema.properties.category.enum`(schemaEnum) 각각 별도 연산
  - 상세: 카테고리 수가 적고(보통 < 20개) 요청 1회에 1번만 실행되므로 실제 부하는 마이크로초 수준. LLM 네트워크 I/O가 수백~수천 ms 를 차지하는 구조에서 의미 있는 병목이 아님.
  - 제안: 현 구조 유지 가능. 최적화가 필요하다면 `const quotedNames = categoryNames.map((n) => `"${n}"`)` 를 한 번만 계산하여 재사용.

- **[INFO]** `.filter(Boolean)` 으로 빈 문자열 제거
  - 위치: `responseFields` / `itemFields` 배열 구성 (`buildSingleLabelPrompt`, `buildMultiLabelPrompt`)
  - 상세: 최대 3개 원소 배열에 적용, O(1)에 수렴. 동작은 정확하나 `''` 을 falsy로 이용하는 암묵적 패턴.
  - 제안: 기능·성능 모두 문제없음. 명시성을 원한다면 `.filter((s): s is string => s !== '')` 로 교체.

---

## 요약

변경사항의 핵심 부하는 LLM API 호출(수백 ms)이며, 추가된 JavaScript 코드는 모두 마이크로초 단위의 소규모 연산(소형 배열 필터·문자열 조인·객체 속성 추가)으로 구성된다. `sanitizeEvidence` 는 모듈 레벨에 단일 인스턴스로 정의되어 클로저 오버헤드도 없고, 입력이 `undefined` 일 때 O(1)로 즉시 반환한다. 스키마 빌드 방식이 기존 spread 연산 대신 명시적 속성 대입으로 변경된 것은 오히려 중간 객체 생성을 줄이는 방향이다. 성능 회귀 요소는 실질적으로 없다.

## 위험도

**NONE**