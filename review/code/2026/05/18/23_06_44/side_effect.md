# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 5: hardcoded-korean-ratchet.test.ts — 파일시스템 쓰기 부작용

- **[WARNING]** `BASELINE_UPDATE=1` 환경변수 활성화 시 테스트 실행 중 `hardcoded-korean-baseline.json` 을 덮어씀
  - 위치: `writeBaseline()` 함수, `fs.writeFileSync(baselinePath, ..., "utf8")` 두 번 호출 (약 1180~1186 라인)
  - 상세: 테스트 프레임워크(vitest) 의 `describe` 블록 최상위에서 `buildCurrentCounts()` 를 즉시 실행하고, `process.env.BASELINE_UPDATE === "1"` 이면 `writeBaseline(counts)` 를 동기로 호출하여 소스 트리 안의 `.json` 파일을 수정한다. 이는 테스트 실행 환경에서 소스 파일을 수정하는 의도된 설계지만, `BASELINE_UPDATE` 변수가 CI/CD 파이프라인에서 실수로 설정된 경우 빌드 환경의 체크아웃 트리를 변경하는 부작용이 발생한다.
  - 제안: `BASELINE_UPDATE=1` 모드에서는 `console.warn` 또는 `console.error` 로 "baseline 갱신은 로컬 실행 전용" 경고를 출력하거나, `process.env.CI` 가 설정된 경우 갱신을 거부하는 가드를 추가할 것. 예: `if (process.env.CI) throw new Error("BASELINE_UPDATE=1 은 로컬 전용입니다. CI 에서는 사용 금지.");`

- **[WARNING]** `writeBaseline` 에서 동일 파일에 두 번 연속 `fs.writeFileSync` 호출
  - 위치: `writeBaseline()` 함수 내 라인 1411~1417
  - 상세: 첫 번째 `writeFileSync` 로 JSON + `\n// total: ${total}\n` 을 쓰고, 즉시 두 번째 `writeFileSync` 로 유효한 JSON 만 남겨 덮어쓴다. 이 사이에 프로세스가 비정상 종료될 경우 JSON 이 아닌 상태(`// total:` 주석 포함)의 파일이 남아 이후 `JSON.parse` 가 실패할 수 있다. 또한 두 번 쓰기는 불필요한 디스크 I/O.
  - 제안: 첫 번째 `writeFileSync` 에서 처음부터 유효한 JSON 만 작성하고, 총합 정보는 `_totalLines` 같은 JSON 키로 포함하거나 아예 제거할 것.

### 파일 5: hardcoded-korean-ratchet.test.ts — 전역 상태 / 모듈 최상위 즉시 실행

- **[INFO]** 테스트 파일 최상위에서 `buildCurrentCounts()` 즉시 실행 — 파일시스템 읽기 부작용
  - 위치: `describe` 블록 내 `const counts = buildCurrentCounts();` (약 1190 라인)
  - 상세: `buildCurrentCounts()` 는 `src/components`, `src/app`, `src/lib` 하위 전체를 재귀적으로 `fs.readdirSync` / `fs.readFileSync` 로 스캔한다. 이는 테스트 모듈 로딩 시점에 파일시스템 읽기가 발생하여, vitest 의 병렬 실행 시 여러 테스트 파일이 동시에 같은 트리를 읽게 된다. 쓰기는 없으므로 경합 조건은 없으나, 대형 src 트리에서 테스트 시작 시간을 지연시킬 수 있다.
  - 제안: `buildCurrentCounts()` 를 `beforeAll` 훅으로 이동하거나, 결과를 캐싱할 것. 현재 구조에서는 vitest 가 파일을 import 할 때 즉시 실행되므로 "수집(collection) 단계"에 부하가 집중된다.

### 파일 3: backend-labels.test.ts — 모듈 최상위 즉시 파일시스템 읽기

- **[INFO]** `describe.runIf(hasBackend)` 블록 최상위에서 모든 schema 파일을 즉시 읽고 파싱
  - 위치: `describe.runIf(hasBackend)` 블록 내 `for (const file of schemaFiles) { const source = fs.readFileSync(file, "utf8"); ... }` (약 689~695 라인)
  - 상세: `schemaFiles` 수집 및 소스 파싱이 테스트 컬렉션 단계에서 즉시 실행된다. `walkSchemaFiles` 가 재귀 탐색이므로 노드 수에 비례하여 I/O 시간이 증가한다. vitest 가 동시에 여러 테스트 파일을 수집할 경우 `backend-labels.test.ts` 와 `nodes-coverage.test.ts` 가 동일 경로를 중복 탐색한다.
  - 제안: `beforeAll` 으로 이동하거나, 두 테스트 파일이 공유하는 `walkSchemaFiles` 로직을 별도 헬퍼 모듈로 추출하여 중복 I/O 를 방지할 것.

### 파일 6: backend-labels.ts — 공개 API(export) 추가

- **[INFO]** `WARNING_KO`, `NODE_LABEL_KO`, `NODE_DESCRIPTION_KO` 세 상수를 `const` 에서 `export const` 로 변경
  - 위치: diff 라인 1507/1527/1536 (`-const`  → `+export const`)
  - 상세: 세 상수는 이전에 모듈-프라이빗이었으나 이번 변경으로 공개 API 가 된다. 이 자체는 의도된 변경이며 하위 호환성에 문제가 없다(기존 소비자 없음). 다만 공개 이후부터는 테스트(`backend-labels.test.ts`) 외 런타임 코드에서도 직접 참조 가능해지므로, 추후 테이블 구조 변경 시 영향 범위가 넓어진다. 현재 런타임에서 직접 import 하는 코드가 없다면 실제 위험은 없다.
  - 제안: 이 세 상수는 "테스트에서만 필요한 내부 데이터"이므로 export 범위를 테스트 전용(`@internal` JSDoc 태그 또는 `_` prefix 네이밍 컨벤션)으로 명시하거나, 현재처럼 풀 export 를 유지하되 향후 직접 참조 확산을 방지하는 주석을 추가할 것.

### 파일 2: nodes-coverage.test.ts — 모듈 스코프 전역 변수 (파일시스템 존재 여부 플래그)

- **[INFO]** `hasBackend` 와 `hasDocs` 가 모듈 최상위에서 `fs.existsSync` 로 즉시 평가
  - 위치: 약 285~286 라인 (`const hasBackend = fs.existsSync(backendNodesRoot);`)
  - 상세: 이 두 플래그는 테스트 수집 단계에 확정되며, 이후 `describe.runIf(hasBackend && hasDocs)` 조건으로 사용된다. 테스트 실행 전 파일시스템 변화가 있어도 재평가되지 않는다. 실제 문제가 될 가능성은 낮지만 "모듈 import = 파일시스템 체크" 의 부작용이 존재한다.
  - 제안: 동일한 패턴이 `backend-labels.test.ts` 에도 있어 일관성이 있으므로 현재대로 유지 가능. 단, 이 패턴이 프로젝트 전체에서 명시적으로 허용된 방식임을 코드 주석으로 명확히 하면 좋다.

### 파일 7: plan/complete/harness-i18n-userguide-gap.md — 문서 전용, 부작용 없음

- **[INFO]** plan 문서 신규 추가로 코드 부작용 없음. `plan/complete/` 에 직접 배치된 점은 완료 상태임을 명시하며 의도된 배치임.

### 파일 1: PROJECT.md — 문서 전용, 부작용 없음

- **[INFO]** 문서 변경만이므로 런타임 부작용 없음. `§자동 가드` 절과 `§변경 유형 → 갱신 위치 매핑` 표에 신규 행/항목 추가. 기존 항목 삭제 없음.

---

## 요약

이번 변경 세트는 주로 새 테스트 파일 3개(`nodes-coverage.test.ts`, `backend-labels.test.ts`, `hardcoded-korean-ratchet.test.ts`) 와 baseline JSON, 기존 파일 2개(`backend-labels.ts`, `PROJECT.md`) 에 대한 수정으로 구성된다. 가장 주목할 부작용은 `hardcoded-korean-ratchet.test.ts` 의 `BASELINE_UPDATE=1` 모드로, 테스트 실행 중 소스 트리의 JSON 파일을 직접 덮어쓴다. 이는 의도된 설계이나 CI 환경에서 실수로 활성화될 경우 소스 파일 오염의 위험이 있고, 두 번 연속 `writeFileSync` 호출로 인한 중간 불완전 상태 가능성도 존재한다. `backend-labels.ts` 의 세 상수 export 전환은 공개 API 추가로 하위 호환성에 문제는 없으나 향후 참조 확산 관리가 필요하다. 나머지 파일시스템 읽기 부작용(테스트 수집 단계의 즉시 디렉토리 스캔)은 낮은 위험이다. 의도치 않은 전역 변수 신설, 시그니처 파괴적 변경, 네트워크 호출, 이벤트/콜백 변경은 없다.

## 위험도

LOW
