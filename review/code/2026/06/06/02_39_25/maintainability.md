# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 12, 13: eval-retrieval.ts / generate-golden-set.ts — parseCliFlag 중복 구현

- **[WARNING]** 동일한 `parseCliFlag` 함수가 두 스크립트에 완전히 동일하게 복사되어 있다.
  - 위치: `codebase/backend/src/scripts/eval-retrieval.ts` L4~L12, `codebase/backend/src/scripts/generate-golden-set.ts` L40~L48
  - 상세: `--flag=val` / `--flag val` 양식을 파싱하는 동일 구현이 두 파일에 중복된다. 세 번째 스크립트가 추가될 때 다시 복사될 가능성이 높다.
  - 제안: `src/scripts/cli-utils.ts` 공통 유틸로 추출하고 두 스크립트에서 import.

### 파일 12: eval-retrieval.ts — `main()` 함수의 과도한 책임

- **[WARNING]** `main()` 함수(~145줄)가 CLI 파싱·NestFactory 부트스트랩·KB-workspace 조회·검색 fan-out·리포트 출력·CI 게이트 판정을 모두 처리한다.
  - 위치: `codebase/backend/src/scripts/eval-retrieval.ts` `main()` 전체
  - 상세: 함수가 6가지 서로 다른 책임을 갖는다. CI 게이트 로직(메트릭 딕셔너리 + `typeof picked` 분기)은 특히 인라인 복잡도가 높다.
  - 제안: `resolveArgs()`, `runSearchPhase()`, `printReport()`, `checkCiGate()` 등 단계별 함수로 분리.

### 파일 13: generate-golden-set.ts — LLM 호출 람다의 중첩 깊이

- **[WARNING]** `Promise.all` → `limit(async () => {...})` 람다 내부에서 try/catch/finally 블록이 중첩되어 가독성이 저하된다.
  - 위치: `codebase/backend/src/scripts/generate-golden-set.ts` L220~L292
  - 상세: 중첩 4단계(`Promise.all` → `limit` → `try` → `for`). `parseQuestions` 결과를 순회해 `generated.push()` 하는 내부 `for` 루프가 `try` 블록 안에 위치해 의도 파악이 어렵다.
  - 제안: `processChunk(chunk, ...): Promise<GoldenEntry[]>` 독립 async 함수로 추출하여 중첩 깊이 2단계로 축소.

### 파일 13: generate-golden-set.ts — `parseQuestions` 내 타입 단언 과다

- **[INFO]** `parseQuestions` 함수에서 동일 객체에 대해 `(parsed as { questions?: unknown })`, `(parsed as { questions: unknown[] })`, `(q as GeneratedQuestion)` 등 다른 형태의 타입 단언이 반복된다.
  - 위치: `codebase/backend/src/scripts/generate-golden-set.ts` L111~L144
  - 상세: `zod`가 이미 의존성에 포함되어 있으므로 JSON 파싱 결과 검증에 활용할 수 있다. 또는 `isGeneratedQuestion(q): q is GeneratedQuestion` 타입가드 함수를 추출하면 의도가 명확해진다.
  - 제안: `zod.object({ questions: zod.array(zod.object({ question: zod.string(), answer: zod.string() })) })` 스키마로 대체하거나 타입가드 함수 추출.

### 파일 12: eval-retrieval.ts / 파일 13: generate-golden-set.ts — 매직 넘버 상수화 미흡

- **[INFO]** 진행 로그 출력 주기(`searched % 20`)와 dry-run 샘플 수(`slice(0, 3)`)가 인라인 숫자로 사용된다.
  - 위치: `eval-retrieval.ts` L1891, `generate-golden-set.ts` L286, L300
  - 상세: `SEARCH_CONCURRENCY = 4`, `CHUNK_LLM_CONCURRENCY = 4`, `GEN_TIMEOUT_MS = 60_000`은 상수로 뽑혔지만, 로그 주기(`20`, `10`)와 dry-run 샘플(`3`)은 인라인된 숫자다.
  - 제안: `LOG_PROGRESS_EVERY = 20`, `DRY_RUN_SAMPLE_SIZE = 3` 등으로 파일 상단에 이동.

### 파일 11: retrieval-metrics.ts — `evaluateRetrieval` 내 다중 상태 변경 루프

- **[INFO]** `for...of goldenSet.entries` 루프 하나에서 `positives`, `byLangPos`, `negCount`, `negRetrievedAny` 네 가지 상태를 동시에 변경한다.
  - 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` L1700~L1712
  - 상세: 성능 이유로 단일 순회는 합리적이나 주석 없이 의도를 파악하기 어렵다.
  - 제안: 루프 시작 부분에 `// positive entry 집계 / negative entry 집계 분기` 주석 추가.

### 긍정 사항

- **[INFO]** `lang-detect.ts`는 모듈 JSDoc, 정규식 상수 분리, 임계값 상수(`KO_RATIO_THRESHOLD`) 외부 노출, 함수 본문 5줄로 단일 책임 원칙의 모범 사례다.
- **[INFO]** `golden-set.types.ts`의 각 필드별 JSDoc 주석은 `shouldRetrieve: false`의 의미와 `goldChunkIds` 개수 계약을 명확히 기술하여 오용 방지에 기여한다.
- **[INFO]** `root-entities.ts` 분리와 `app.module.ts`에서의 re-export 패턴은 이유가 JSDoc에 충분히 문서화되어 있어 유지보수 시 혼란을 방지한다.

---

## 요약

전반적인 코드 품질은 양호하다. 타입 정의(`golden-set.types.ts`), 순수 지표 함수(`retrieval-metrics.ts`), 언어 감지 유틸(`lang-detect.ts`), NestJS 모듈 구성(`eval-cli.module.ts`)은 단일 책임 원칙 준수와 문서화 수준이 높다. 주요 유지보수성 위험은 두 스크립트 파일에 집중되며, `parseCliFlag` 중복 구현이 가장 시급한 WARNING이다(`main()` 함수 과부하·람다 중첩 심화와 함께). 나머지 타입 단언·매직 넘버·루프 주석 이슈는 INFO 수준으로 즉각 기능 영향은 없으나 향후 스크립트 확장 시 회귀 위험을 높인다.

## 위험도

LOW
