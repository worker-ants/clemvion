### 발견사항

- **[WARNING]** 테스트 이름과 실제 동작 불일치
  - 위치: `text-classifier.handler.spec.ts` — `"should coerce non-string evidence items to strings (defensive)"`
  - 상세: 테스트 이름은 "coerce(변환)"이라고 명시하지만, `sanitizeEvidence` 구현은 `.filter()`로 비문자열 항목을 **제거**한다. 테스트 내부 주석도 "dropped"라고 올바르게 표현하고 있어 이름과 동작이 충돌한다.
  - 제안: 테스트 이름을 `"should drop non-string evidence items to preserve string[] contract"` 로 수정

- **[INFO]** `sanitizeEvidence` 가 `includeEvidence: false` 경우에도 항상 호출됨
  - 위치: `text-classifier.handler.ts` — `processSingleLabelResult` 내 `evidence = sanitizeEvidence(parsed.evidence)`
  - 상세: `includeEvidence` 플래그와 무관하게 파싱 결과에서 항상 evidence를 sanitize한다. 출력 게이팅(`...(includeEvidence ? {...} : {})`)이 올바르게 동작하므로 결과에는 영향 없으나, 불필요한 연산이 발생한다.
  - 제안: 정확성 문제는 아니므로 현 상태 유지해도 무방. 또는 `if (includeEvidence) { evidence = sanitizeEvidence(parsed.evidence); }` 로 조건 처리 가능.

- **[INFO]** `includeEvidence: true` + `includeConfidence: false` 조합에 대한 테스트 없음
  - 위치: `text-classifier.handler.spec.ts` — `includeEvidence` describe 블록 전체
  - 상세: 모든 `includeEvidence` 테스트가 `baseConfig`(includeConfidence: true) 또는 `multiLabelConfig`(includeConfidence: true)를 기반으로 한다. 두 플래그가 독립적으로 동작하는지 명시적으로 검증하지 않는다. 핸들러 코드는 spread 연산자로 독립 처리하므로 실제 버그 가능성은 낮다.
  - 제안: `{ ...baseConfig, includeConfidence: false, includeEvidence: true }` 조합 테스트 1건 추가 권장

- **[INFO]** Multi-label에서 완전 미매칭(부분문자열 탐색도 실패) + `includeEvidence: true` 케이스 테스트 없음
  - 위치: `text-classifier.handler.spec.ts` — multi-label `includeEvidence` describe 블록
  - 상세: substring fallback 테스트는 있지만("should attach empty evidence on substring fallback"), 어떤 카테고리도 텍스트에서 발견되지 않아 `matchedCategories`가 `[]`가 되고 `fallback` 포트로 가는 경우가 없다. 핸들러 로직상 `[]`가 되므로 버그 가능성은 없으나 명시적 검증이 없다.
  - 제안: fallback 포트 + `categories: []` 케이스에 `includeEvidence: true` 테스트 추가

---

### 요약

`includeEvidence` 기능은 single-label/multi-label 양쪽 모두 스펙(`spec/4-nodes/3-ai-nodes.md`)과 일치하게 구현되었다. JSON Schema 조건부 삽입, fallback 시 `[]` 강제, sanitize를 통한 방어적 처리, i18n 키 추가, UI 체크박스 연결까지 전 레이어가 일관되게 구성되어 있다. 발견된 사항 중 기능 결함에 해당하는 것은 없으며, 테스트 이름 오류 1건(WARNING)과 미검증 조합 2건(INFO)이 개선 여지로 남는다.

### 위험도

**LOW**