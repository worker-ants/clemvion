## 발견사항

- **[INFO]** 신규 외부 패키지 없음
  - 위치: 전체 변경 파일
  - 상세: 모든 변경이 기존 `zod` 및 프로젝트 내부 모듈만 활용한다. `package.json` 변경 없음.
  - 제안: 해당 없음

- **[WARNING]** 3중 동기화 구조 — `c.id` 반환값 처리 미세 불일치
  - 위치: `resolve-dynamic-ports.ts:87`, `text-classifier.handler.ts:buildCategoryPortIds`
  - 상세: 포트 id 계산 로직이 프론트엔드 resolver → 백엔드 resolver → 핸들러 `buildCategoryPortIds` 세 곳에 복제되어 있다. 현재 변경에서 백엔드 resolver는 `c.id`(원본 그대로) 를 반환하지만, 핸들러의 `buildCategoryPortIds`는 `c.id.trim()`(공백 제거 후) 를 반환한다. 스키마가 `[a-zA-Z0-9_-]+` 패턴을 강제하므로 실제 불일치는 발생하지 않으나, 스키마를 우회한 원시 입력이 들어오면 동일한 입력에서 두 구현이 다른 port id를 발행할 수 있다.
  - 제안: 두 구현 중 하나를 정규 출처로 지정하거나, 공용 유틸(`buildStablePortId(rawId, fallback)`)로 추출해 세 지점이 동일 함수를 호출하도록 단일화 검토. 현재 수준에서는 `resolve-dynamic-ports.ts`도 `.trim()` 후 반환하도록 맞추는 것이 최소 수정.

- **[INFO]** `aiAgentConditionalPorts` 와 `classifierCategoriesPorts` 의 id 가드 패턴 불일치 (기존 코드)
  - 위치: `resolve-dynamic-ports.ts:158` vs `resolve-dynamic-ports.ts:87`
  - 상세: `aiAgentConditionalPorts`는 `c.id.length > 0`(trim 없음)을 사용하고, 이번에 추가된 `classifierCategoriesPorts`는 `c.id.trim().length > 0`을 사용한다. 이 변경 이전부터 존재하던 불일치이며, 이번 PR이 도입한 것은 아니다.
  - 제안: 추후 `switchPorts` / `aiAgentConditionalPorts` / `classifierCategoriesPorts` 모두 trim 기반 가드로 통일.

- **[INFO]** `categoryDefSchema` 의 `export` 공개 전환
  - 위치: `text-classifier.schema.ts:9`
  - 상세: 기존 `const`(모듈 내부)에서 `export const`로 변경되어 외부 소비 가능한 API가 됐다. 테스트(`text-classifier.schema.spec.ts`)에서 직접 임포트하는 올바른 패턴.
  - 제안: 해당 없음 — 의도한 공개.

---

## 요약

이번 변경은 외부 패키지를 전혀 추가하지 않으며, 기존 `zod`와 프로젝트 내부 모듈만 활용한다. 주목할 의존성 위험은 **프론트엔드 resolver → 백엔드 resolver → 핸들러 `buildCategoryPortIds`** 간 3중 복제 구조로, 스키마 검증이 항상 선행된다는 가정 아래에서는 안전하지만 `trim()` 처리 차이가 미세한 불일치를 남긴다. 전체 의존성 관점에서 구조적 변화가 없고, 위험 요인이 실질적으로 발현될 조건이 제한적이다.

## 위험도

**LOW**