# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 정적 소스 파싱 방식의 false-negative 위험(동적 문자열·템플릿 리터럴 미검출)과 `writeBaseline` 이중 쓰기로 인한 corrupted baseline 가능성이 핵심. 보안·아키텍처·의존성 변경은 없으며 전반적으로 테스트·문서 품질은 양호함.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | 정적 소스 파싱 방식(`extractWarningMessages`, `extractNodeMetadataTopFields`)이 동적 문자열·템플릿 리터럴·변수 할당 형태를 검출하지 못함. 테스트가 통과해도 실제 ko 매핑 누락 케이스가 존재할 수 있음 | `backend-labels.test.ts` | 파싱 한계를 테스트 상단 주석으로 명시. 장기 과제로 `ts-morph` / TypeScript compiler API 기반 정적 분석을 plan 에 등록 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 안정성 | `writeBaseline` 에서 동일 파일에 두 번 연속 `fs.writeFileSync` 호출. 첫 번째 호출이 invalid JSON(주석 포함)을 기록하며, 두 번째 호출 전 프로세스 비정상 종료 시 `hardcoded-korean-baseline.json` 이 invalid JSON 상태로 남아 이후 테스트가 crash 함 | `hardcoded-korean-ratchet.test.ts` | 첫 번째 `writeFileSync` 를 제거하고 두 번째(올바른 JSON)만 유지. total 은 `console.log` 로 출력 |
| 2 | CI 안전성 | `BASELINE_UPDATE=1` 환경변수 활성화 시 테스트 실행 중 소스 트리의 `hardcoded-korean-baseline.json` 을 덮어씀. CI 환경에서 실수로 설정될 경우 ratchet 가드 무력화 위험 | `hardcoded-korean-ratchet.test.ts` `writeBaseline()` | `process.env.CI` 가 설정된 경우 갱신을 거부하는 가드 추가 |
| 3 | 테스트 구조 | `describe` 콜백 안에서 `return` 으로 `BASELINE_UPDATE=1` 분기를 처리하는 패턴이 비표준. vitest 버전 업 또는 설정 변경 시 예상치 못한 동작 위험 | `hardcoded-korean-ratchet.test.ts` | `BASELINE_UPDATE` 분기를 별 `describe.runIf` 블록으로 분리 |
| 4 | 테스트 파싱 | `skipString` 함수가 템플릿 리터럴 내부 `${}` 표현식을 처리하지 않아 표현식 안의 중첩 문자열이 backtick 종료로 오인될 수 있음 | `backend-labels.test.ts`; `hardcoded-korean-ratchet.test.ts` | `skipString` 에 backtick 처리 시 `${}` 중첩 depth 카운터 추가, 또는 제한 사항을 주석으로 명시 |
| 5 | 테스트 수집 | `describe` 콜백 최상단에서 `fs.readFileSync` 를 동기로 반복 실행. 파일 읽기 실패 시 `it` 블록이 등록되기 전에 오류가 발생해 테스트 결과가 아닌 프로세스 에러로 노출됨 | `backend-labels.test.ts`; `nodes-coverage.test.ts` | `beforeAll` 훅으로 이동 |
| 6 | 코드 품질 | `repoRoot` 경로 계산 시 `".."` 인자 6개 나열 방식과 `hasBackend` 존재 확인 패턴이 두 테스트 파일에 각각 중복 작성됨 | `backend-labels.test.ts`; `nodes-coverage.test.ts` | 공통 헬퍼 모듈(`__tests__/helpers/backend-paths.ts`)로 추출 또는 `findRepoRoot(startDir)` 함수 단일화 |
| 7 | 요구사항 정합성 | `walkSchemaFiles`(`backend-labels.test.ts`)와 `collectNodeSchemaFiles`(`nodes-coverage.test.ts`)의 노드 수집 범위가 불일치. 전자는 `core/` 포함, 후자는 명시 제외 | `backend-labels.test.ts`; `nodes-coverage.test.ts` | 두 파일이 동일한 컬렉션 로직 또는 공유 헬퍼를 사용하도록 통일 |
| 8 | 수동 파서 복잡도 | depth-tracking 루프가 `collectTopLevelStringFields`, `extractWarningMessages`, `extractNodeMetadataTopFields` 세 곳에 중복 존재 | `backend-labels.test.ts` | depth-tracking 블록 추출 로직을 `extractBlock(source, open, close, startIdx)` 형태의 단일 유틸로 추출 |
| 9 | 문서 누락 | `nodes-coverage.test.ts` 의 `describe.runIf(hasBackend && hasDocs)` 조건부 실행에 대한 CI 격리 이유 주석 누락 | `nodes-coverage.test.ts` | `const hasBackend = ...` 위에 격리·CI 환경 대응 단행 주석 추가 |
| 10 | 문서 누락 | `collectTopLevelStringFields`, `skipString`, `unescape` 헬퍼 함수에 JSDoc 없음 | `backend-labels.test.ts` | 각 헬퍼 상단에 JSDoc 으로 역할·한계 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 제안 |
|---|----------|----------|------|
| 1 | 보안 | CI 환경에서 `BASELINE_UPDATE` 가 설정되지 않도록 운영 정책 명문화 필요 | CI 파이프라인 설정 확인 및 정책 문서화 |
| 2 | 보안 | `WARNING_KO` 등이 `Record<string, string>` 타입으로 export 되어 외부 변조 가능 | `as const satisfies` 또는 `Object.freeze` 검토 |
| 3 | 요구사항 | `schema` 파일 없는 노드 디렉토리가 수집에서 조용히 누락됨 | "모든 노드 디렉토리에 schema 파일이 1개 이상 존재" sanity 테스트 추가 |
| 4 | 요구사항 | CI 환경에서 `hasBackend && hasDocs` false 이면 suite skip 되어 실패 미인지 | CI 환경에서 명시적 에러 발행 검토 |
| 5 | 요구사항 | 정적 파싱 제약을 테스트 파일 상단에 명시 필요 | "정적 리터럴만 검출하며 동적 문자열은 커버하지 않는다" 주석 추가 |
| 6 | 요구사항 | `ERROR_KO` 가 `backend-labels.ts` 에 존재하지 않으나 PROJECT.md 매핑표·spec/conventions/i18n-userguide.md 에 언급되어 코드-문서 불일치 | `ERROR_KO` 신설·export 하거나 문서에서 해당 언급 제거 |
| 7 | 부작용 | `buildCurrentCounts()` 가 `describe` 콜백 최상단에서 즉시 실행되어 src 트리 전체를 동기 스캔 | `beforeAll` 훅으로 이동 또는 결과 캐싱 |
| 8 | 부작용 | export 전환된 세 상수가 "테스트 전용 내부 데이터"임을 나타내는 표기 없음 | `/** @internal — exported for test parity guard */` 주석 추가 |
| 9 | 유지보수성 | `unescape` 함수명이 deprecated 전역 `unescape()` 와 동명이어서 코드 리딩 시 혼란 가능 | `unescapeString` 또는 `resolveEscapes` 로 명칭 변경 |
| 10 | 유지보수성 | sanity 임계값 `10` 이 두 파일에 하드코딩되어 있으며 근거 주석 없음 | `const MIN_EXPECTED_NODES = 10` 으로 named constant 선언 |
| 11 | 유지보수성 | `NODE_CATEGORY_KO` 에 대소문자 중복 키 관리 이유가 코드에 명시되지 않음 | 주석에 대소문자 양쪽 키 등록 이유 기술 |
| 12 | 문서 | PROJECT.md 의 `spec/conventions/i18n-userguide.md` 링크 실존 여부 미확인 | 해당 파일이 실제로 존재하고 Principle 1·3·4가 정의되어 있는지 확인 |
| 13 | 문서 | `hardcoded-korean-baseline.json` 정리 일정 없음 | `plan/in-progress` 에 파일별 정리 일정 또는 담당자 기록 |
| 14 | 계획 | `plan/complete/harness-i18n-userguide-gap.md` frontmatter `worktree` 가 이전 P0 worktree 로 기록되어 현재 worktree 와 불일치 | 완료 plan 이므로 현상 유지 가능 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 모든 발견사항 INFO 수준. 파일시스템 접근은 고정 경로, 민감 정보 없음 |
| requirement | LOW | 수집 범위 불일치, `writeBaseline` dead code, schema 없는 노드 디렉토리 누락 |
| scope | NONE | 변경 범위는 plan 항목과 정확히 일치. 범위 이탈 없음 |
| side_effect | LOW | `BASELINE_UPDATE=1` 소스 파일 덮어쓰기, 이중 writeFileSync 중간 상태 |
| maintainability | LOW | repoRoot·hasBackend 중복 로직, depth-tracking 루프 중복 |
| testing | MEDIUM | 정적 파싱 false-negative(CRITICAL), writeBaseline 이중 쓰기 crash 위험 |
| documentation | LOW | `describe.runIf` CI 격리 주석 누락, 파서 헬퍼 함수 JSDoc 미비 |

---

## 라우터 결정

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
- **제외**:
  - `performance` — I/O 최적화·캐시·반복문 성능 변경 없음
  - `architecture` — 모듈 경계·서비스 레이어·DI 변경 없음
  - `dependency` — package.json/package-lock.json 의존성 변경 없음
  - `database` — migrations/SQL/Prisma schema 변경 없음
  - `concurrency` — async/await·Promise·락·워커·큐 변경 없음
  - `api_contract` — HTTP route·GraphQL·swagger 변경 없음
