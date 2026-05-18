# Testing 리뷰 — i18n guard extension

## 발견사항

### nodes-coverage.test.ts

- **[WARNING]** `describe` 블록 외부에서 `collectNodeSchemaFiles` 와 `loadDocsIndex` 호출
  - 위치: `nodes-coverage.test.ts` 라인 325–334 (describe 콜백 최상단)
  - 상세: `schemas` 와 `docs` 변수는 `describe.runIf(hasBackend && hasDocs)` 안의 콜백 최상단에서 즉시 실행된다. vitest 는 describe 콜백을 수집 단계에서 동기적으로 실행하므로, 이 시점에 `backendNodesRoot` 나 `docsRoot` 가 예상과 다른 경로라면 파일시스템 에러가 테스트 결과 없이 프로세스를 종료시킬 수 있다. `beforeAll` 에서 초기화하고 변수를 클로저로 전달하는 패턴이 더 안전하다.
  - 제안: `describe` 안에 `beforeAll` 을 두고 그 안에서 `schemas` / `docs` 를 초기화. `it` 들이 그 변수를 클로저로 참조하도록 구조 변경.

- **[WARNING]** `nodesSection` 이 undefined 일 때의 테스트 동작 불명확
  - 위치: `nodes-coverage.test.ts` 라인 327, 337
  - 상세: `nodesSection` 이 `undefined` 이면 `referencedAbsPaths` 가 빈 Set 이 되어 모든 schema 가 `missing` 으로 잡힌다. 이는 의도된 fail 이지만, 진단 메시지에 "02-nodes 섹션을 찾지 못했음" 표시가 없어 원인 파악이 어렵다.
  - 제안: 메인 `it` 안에서 `expect(nodesSection).toBeDefined()` 를 선행 검사하거나, 실패 메시지에 "nodesSection 이 undefined 입니다 — loadDocsIndex 결과를 확인하세요" 를 추가.

- **[INFO]** `sanity: >= 10` 하드코딩 임계값에 대한 근거 주석 없음
  - 위치: `nodes-coverage.test.ts` 라인 354
  - 상세: 현재 28종 노드 기준 10은 충분한 하한이지만, 향후 노드가 10개 미만으로 줄거나 카테고리 구조가 바뀔 경우 의미가 희미해진다. 근거를 인라인 주석으로 명시하면 유지보수성이 높아진다.
  - 제안: `// 현재 28종 노드 기준 최소 guard. 10 미만이면 경로 계산 오류일 가능성 높음` 주석 추가.

- **[INFO]** `_` prefix 카테고리·노드 제외 로직과 `core` 제외 로직이 `collectNodeSchemaFiles` 에만 존재
  - 위치: `nodes-coverage.test.ts` 라인 301
  - 상세: `backend-labels.test.ts` 의 `walkSchemaFiles` 는 전체 재귀 탐색으로 `_` prefix 및 `core` 를 제외하지 않는다. 두 테스트가 다른 schema 집합을 수집하므로, backend-labels 테스트가 nodes-coverage 테스트보다 더 넓은 범위를 검증한다. 이는 의도된 차이일 수 있으나 명시가 없다.
  - 제안: `walkSchemaFiles` 에 동일 제외 로직을 적용하거나, 두 함수의 탐색 범위 차이를 주석으로 명시.

---

### backend-labels.test.ts

- **[CRITICAL]** 정적 소스 파싱 방식의 false-negative 위험 — 동적 문자열 / 템플릿 리터럴 미검출
  - 위치: `backend-labels.test.ts` `extractWarningMessages` (라인 563–585), `extractNodeMetadataTopFields` (라인 592–616)
  - 상세: `warningRules[].message` 와 `NodeMetadata.label / description` 을 정규식 + 괄호 깊이 추적으로 파싱한다. 값이 `const MSG = '...'` 처럼 변수에 위임된 경우, 템플릿 리터럴(`\`...\``)을 여러 줄에 걸쳐 쓴 경우, 또는 computed property key 를 사용한 경우는 추출에서 누락된다. 즉, 테스트가 통과해도 실제로 ko 매핑이 없는 메시지가 존재할 수 있다.
  - 제안: 이 한계를 테스트 주석 상단에 명시적으로 기록. 실제 파싱이 필요하다면 `ts-morph` 또는 TypeScript compiler API 를 사용하는 방향을 장기 과제로 plan 에 등록 권장.

- **[WARNING]** `skipString` 함수가 템플릿 리터럴 내부 표현식(`${}`) 을 처리하지 않음
  - 위치: `backend-labels.test.ts` `skipString` (라인 664–672), `hardcoded-korean-ratchet.test.ts` 의 동일 함수 (라인 1116–1137)
  - 상세: `` ` `` 를 만나면 동일한 `quote` 비교로 닫힘을 탐색한다. 하지만 `\`Hello ${name}\`` 처럼 중괄호 표현식이 포함되면, 표현식 내부의 중첩 문자열이 바깥 backtick 의 종료로 오해되어 파싱이 틀어질 수 있다. 현재 schema 파일에서 템플릿 리터럴 사용이 드물다면 실질적 영향은 낮지만, 잠재적 false-negative 경로가 존재한다.
  - 제안: `skipString` 에 backtick 감지 시 `${}` 내부 중첩 파싱 또는 단순 `depth` 카운터를 추가. 또는 주석으로 "템플릿 리터럴 표현식 미지원" 제한을 명시.

- **[WARNING]** 테스트 데이터 수집(`allWarnings`, `allLabels`, `allDescriptions`)이 `describe` 콜백 최상단에서 동기 실행됨
  - 위치: `backend-labels.test.ts` 라인 683–695
  - 상세: `nodes-coverage.test.ts` 와 동일한 패턴. `describe` 콜백 최상단에서 `fs.readFileSync` 를 반복 실행하므로, 파일 읽기 실패 시 `it` 블록이 등록되기 전에 오류가 발생해 테스트 결과가 아닌 프로세스 에러로 노출된다.
  - 제안: `beforeAll` 으로 이동.

- **[INFO]** `ERROR_KO` 가 `backend-labels.ts` 에서 export 되지 않아 테스트 커버 불가
  - 위치: `backend-labels.test.ts` 라인 508–512 (import 목록), `backend-labels.ts` 전체
  - 상세: PROJECT.md 매핑표는 "신규 errorCode·warningCode 발행 시 `ERROR_KO` 에 한국어 매핑 등록" 을 명시하지만, 현재 `backend-labels.ts` 에는 `ERROR_KO` 가 존재하지 않는다. 테스트도 `WARNING_KO` / `NODE_LABEL_KO` / `NODE_DESCRIPTION_KO` 만 검증하고 `ERROR_KO` 는 검증하지 않는다. 문서와 실제 코드 사이의 불일치.
  - 제안: `ERROR_KO` 를 `backend-labels.ts` 에 추가하고 export 하거나, PROJECT.md 매핑표에서 `ERROR_KO` 언급을 제거하고 현재 구조(warningCode 만 `WARNING_KO` 에서 관리)를 명확히 기술.

---

### hardcoded-korean-ratchet.test.ts

- **[WARNING]** `writeBaseline` 에서 `JSON.stringify` + inline comment 추가 후 즉시 덮어쓰는 이중 쓰기 패턴
  - 위치: `hardcoded-korean-ratchet.test.ts` 라인 1411–1417
  - 상세: `fs.writeFileSync` 를 두 번 호출한다. 첫 번째 호출에서 invalid JSON(`// total: N` 주석)을 쓰고, 두 번째 호출에서 올바른 JSON으로 덮어쓴다. 두 번째 쓰기 사이에 프로세스가 비정상 종료되면 `baseline.json` 이 invalid JSON 상태로 남는다. 이후 실행 시 `JSON.parse` 가 throw 하고 테스트가 crash 한다.
  - 제안: 첫 번째 쓰기를 제거하고 두 번째 쓰기(올바른 JSON)만 남긴다. `total` 을 로그로 출력하는 것으로 충분하다.

- **[WARNING]** `BASELINE_UPDATE=1` 시 `return` 이 `describe` 콜백 안에서 호출됨
  - 위치: `hardcoded-korean-ratchet.test.ts` 라인 1201
  - 상세: `describe` 콜백 안에서 `return` 을 사용해 나머지 `it` 등록을 건너뛰는 패턴은 vitest 에서 지원되나 공식 패턴은 아니다. vitest 버전이 올라가거나 설정이 바뀌면 예상치 못한 동작(예: 이미 등록된 `it` 이 실행됨)이 생길 수 있다. `BASELINE_UPDATE=1` 분기는 별도 `describe` 블록으로 분리하거나, 각 `it` 안에서 `process.env.BASELINE_UPDATE === "1"` 을 확인하는 방식이 더 명확하다.
  - 제안: `BASELINE_UPDATE` 분기를 `describe` 바깥의 조건문으로 분리하거나, `if (process.env.BASELINE_UPDATE !== "1")` 가드 하에 나머지 `it` 을 등록.

- **[WARNING]** `isExcluded` 가 `lib/i18n/backend-labels.ts` 만 제외하고 `hardcoded-korean-ratchet.test.ts` 자체는 `__filenameAbs` 비교로만 제외
  - 위치: `hardcoded-korean-ratchet.test.ts` 라인 1150, `isExcluded` 라인 1301
  - 상세: `isExcluded` 에 `/__tests__/` 경로 제외가 있으므로 본 테스트 파일도 이미 제외된다. `if (file === __filenameAbs)` 체크는 중복 방어인데, 두 제외 로직이 충돌할 경우(예: 테스트 파일이 `__tests__` 폴더 밖으로 이동)를 대비한다는 주석이 없으면 이유가 불명확하다.
  - 제안: 중복 제외 로직의 의도를 주석으로 명시. 또는 `isExcluded` 에 절대경로 비교를 통합하여 단일 제외 진입점으로 관리.

- **[INFO]** "baseline 에 있지만 사라진 파일" 항목이 항상 `expect(true).toBe(true)` 로 통과 — 정보성임이 불명확
  - 위치: `hardcoded-korean-ratchet.test.ts` 라인 1476–1485
  - 상세: 테스트 이름("깔끔하게 제거됐어요")이 단언처럼 읽히지만 실제로는 항상 통과한다. `it.skip` 또는 `console.warn` 만 남기고 `it` 을 등록하지 않는 편이 의도를 더 명확하게 전달한다.
  - 제안: `it` 을 제거하고 `beforeAll` 또는 `afterAll` 안의 `console.warn` 으로 변경하거나, 테스트 이름에 "(info-only, 항상 통과)" 를 명시.

---

### hardcoded-korean-baseline.json

- **[INFO]** baseline 에 6개 파일 / 32라인이 기록되어 있으나 감소 목표가 명시된 타임라인 없음
  - 위치: `hardcoded-korean-baseline.json` 전체
  - 상세: `_schema` 필드에 "Goal: monotonic decrease toward {}" 라고 기록되었지만, 언제까지 어느 파일을 정리할지 plan 에 명시되어 있지 않다. 현재 상태로 무기한 방치될 경우 ratchet 의 점감 효과가 사라진다.
  - 제안: `plan/in-progress` 에 baseline 파일별 정리 일정 또는 담당자를 최소 한 줄씩 기록.

---

### backend-labels.ts (변경 부분)

- **[INFO]** `WARNING_KO` / `NODE_LABEL_KO` / `NODE_DESCRIPTION_KO` 를 `export` 로 전환했으나 `ERROR_KO` 부재 (위 backend-labels.test.ts 항목과 동일 컨텍스트)
  - 위치: `backend-labels.ts` diff 라인 +1507, +1527, +1536
  - 상세: export 전환 자체는 테스트 가능성(testability) 향상을 위한 올바른 조치. 단, PROJECT.md 에서 언급하는 `ERROR_KO` 가 이 파일에 아직 없다는 점은 별도 follow-up 필요.
  - 제안: 위 INFO 항목 참고.

---

## 요약

이번 변경은 i18n 갱신 누락을 빌드 단계에서 결정적으로 차단하기 위한 3종 신규 테스트(`nodes-coverage`, `backend-labels`, `hardcoded-korean-ratchet`)와 관련 지원 파일을 추가한다. 테스트의 설계 의도와 커버리지 방향은 명확하고, 각 guard 가 보완 관계에 있음을 주석으로 잘 서술하고 있다. 다만 정적 소스 파싱 방식(`extractWarningMessages`, `collectTopLevelStringFields`)이 동적 문자열·템플릿 리터럴에서 false-negative 를 낼 수 있다는 점이 CRITICAL 위험으로 남는다. `describe` 콜백 최상단에서의 동기 파일시스템 접근과 `writeBaseline` 의 이중 쓰기 패턴은 실행 환경에 따라 crash 또는 corrupted baseline 으로 이어질 수 있다. `ERROR_KO` 부재로 인한 PROJECT.md 와의 문서-코드 불일치도 단기 처리가 필요하다. 격리 측면에서 두 테스트가 `hasBackend` / `hasDocs` 플래그로 CI 환경에서 조건부 건너뜀을 처리하는 점은 적절하다.

## 위험도

MEDIUM
