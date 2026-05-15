## 부작용 코드 리뷰 결과

### 발견사항

---

**[INFO] private 메서드 시그니처 변경 — 내부 전용이므로 외부 영향 없음**
- 위치: `text-classifier.handler.ts` — `buildSingleLabelPrompt`, `buildMultiLabelPrompt`, `processSingleLabelResult`, `processMultiLabelResult`
- 상세: 네 개의 private 메서드 모두 `includeEvidence: boolean` 매개변수가 추가됨. 모두 `private`이고 호출부(`execute`)에서 새 인자를 전달하므로 외부 계약에 영향 없음.
- 제안: 현재 구조 유지 적절. 변경 없음.

---

**[INFO] 모듈 최상위 함수 추가 (`sanitizeEvidence`)**
- 위치: `text-classifier.handler.ts` 마지막 라인
- 상세: `export` 없이 모듈 스코프에 추가된 순수 함수. 전역 상태 변경 없음.
- 제안: 변경 없음.

---

**[WARNING] 테스트 명칭과 구현 불일치**
- 위치: `text-classifier.handler.spec.ts`, `"should coerce non-string evidence items to strings (defensive)"` 테스트
- 상세: 테스트 이름은 "coerce(강제 변환)"이라 했으나 `sanitizeEvidence` 구현은 `filter`로 비문자열을 **탈락**시킴. 테스트 내 주석(`// Non-string items are dropped`)도 "dropped"라 되어 있어 이름과 모순. 런타임 동작에는 영향 없지만 향후 구현자가 coerce 의미로 변경하면 계약이 깨질 수 있음.
- 제안: 테스트 이름을 `"should drop non-string evidence items (defensive)"` 으로 수정.

---

**[INFO] UI 필드 순서 변경 (`order: 7 → 8`)**
- 위치: `text-classifier.schema.ts` — `multiLabel` 필드의 `ui.order`
- 상세: `includeEvidence`를 `order: 7`로 삽입하면서 기존 `multiLabel`의 order가 8로 밀림. 설정 UI의 체크박스 렌더 순서에만 영향.
- 제안: 변경 없음. 의도된 순서 조정.

---

**[INFO] 출력 구조 additive 변경 — 기존 워크플로 영향 없음**
- 위치: `text-classifier.handler.ts` — `processSingleLabelResult`, `processMultiLabelResult`
- 상세: `evidence` 필드는 `includeEvidence: true`일 때만 출력에 포함. 기본값이 `false`이므로 기존 워크플로 결과 구조 불변. 스키마는 `.passthrough()` + `optional()`로 선언되어 있어 하위 호환 유지.
- 제안: 변경 없음.

---

**[INFO] 단일 레이블 JSON 파싱 실패 시 evidence 초기화 경로 추적**
- 위치: `text-classifier.handler.ts` — `processSingleLabelResult` catch 블록
- 상세: `evidence`는 `[]`로 초기화 후 catch 블록에서 재할당 없음. 텍스트 폴백으로 카테고리를 찾더라도 `evidence`는 `[]` 유지. `includeEvidence: true`이고 `isFallback: false`(카테고리 발견)인 경우에도 `evidence: []`를 출력하는데, 이는 스펙("JSON 파싱 실패 시 빈 배열")과 일치하고 테스트도 이를 검증함.
- 제안: 변경 없음.

---

### 요약

이번 변경은 `includeEvidence` 옵트인 기능을 추가하는 것으로, 모든 부작용 위험 요소가 잘 통제되어 있다. public API(`execute`, `validate`)의 시그니처는 변경되지 않았고, 기본값(`false`)이 보장되어 기존 워크플로 동작이 완전히 보존된다. `sanitizeEvidence`는 순수 함수이며 상태 변이가 없다. 유일한 실질적 위험은 테스트 이름("coerce")과 실제 구현("drop") 사이의 용어 불일치로, 런타임에는 영향이 없지만 미래 유지보수 시 혼란을 줄 수 있다.

### 위험도

**LOW**