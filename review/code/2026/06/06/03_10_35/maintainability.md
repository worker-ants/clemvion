# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `main()` 함수가 6가지 책임을 직접 처리 — 분리 권고 (보류 중)
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` `main()` 전체 (약 190줄)
- 상세: CLI 파싱 → 스키마 검증 → NestFactory 부트스트랩 → KB-workspace 조회 → 검색 fan-out → 리포트 출력 → CI 게이트 판정 순서를 단일 `main()` 함수에서 순차 처리한다. 이전 리뷰(02_39_25 #18)에서 WARNING으로 지적됐고 RESOLUTION에 "기능 불영향 유지보수 작업, 향후 Sprint backlog"로 보류되었다. `printAggregate`, `fmt`, `resolveWorkspace` 는 이미 독립 함수로 분리되어 가장 심한 책임 혼재는 해소된 상태다. 남은 부분(`resolveArgs()`, `checkCiGate()`)은 복잡도를 추가로 낮출 여지가 있으나 현재 규모에서 즉각 기능 영향은 없다.
- 제안: Sprint backlog 항목으로 유지. 스크립트 기능 확장(새 metric 추가, 새 CI 조건 등) 시 `runSearchPhase()`, `checkCiGate()` 단계별 함수 분리를 우선 적용할 것.

### [INFO] `generate-golden-set.ts` — LLM 호출 람다 내 중첩 깊이
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` 라인 211~283
- 상세: `Promise.all` → `limit(async () => {...})` → `try/catch/finally` → `for (const q of questions)` 의 4단계 중첩이 존재한다. 이전 리뷰(02_39_25 #19)에서 WARNING으로 지적됐고 보류(기능 불영향)로 처리됐다. 내부 `for` 루프가 `try` 블록 안에서 `generated.push()` 와 함께 위치하며, 오류 처리 흐름(`catch`에서 `failed += 1`)과 정상 흐름이 인접해 있어 의도를 파악하는 데 추가 읽기가 필요하다.
- 제안: `processChunk(chunk, ...): Promise<GoldenEntry[]>` 독립 async 함수로 추출하면 중첩이 2단계로 줄고 단위 테스트도 가능해진다. Sprint backlog 항목.

### [INFO] `parseQuestions` 내 타입 단언 반복
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` 라인 102~135
- 상세: `(parsed as { questions?: unknown })`, `(parsed as { questions: unknown[] })`, `(q as GeneratedQuestion)` 형태의 단언이 동일 객체에 대해 반복된다. `zod` 가 이미 `eval-retrieval.ts` 에서 의존성으로 사용 중이므로 LLM 응답 JSON 파싱에도 동일하게 적용할 수 있다. 현재 구조는 동작에 문제는 없으나 향후 LLM 응답 스키마 변경 시 단언 3곳을 함께 수정해야 한다.
- 제안: `z.object({ questions: z.array(z.object({ question: z.string(), answer: z.string() })) }).safeParse(parsed)` 스키마로 대체하거나, `isGeneratedQuestion(q): q is GeneratedQuestion` 타입가드 함수를 추출해 단언 중복을 제거한다.

### [WARNING] `generate-golden-set.ts` 오류 로그 패턴이 `eval-retrieval.ts` 와 불일치
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` 라인 274 (`console.warn`), 라인 330 (`console.error(err)`)
- 상세: `eval-retrieval.ts` 는 이전 리뷰(#8 fix, 92ebe8f2) 에서 `err.constructor.name` 만 출력하도록 수정되었다. 그러나 `generate-golden-set.ts` 는 청크 생성 실패 시 `err.message` 를 직접 출력하고, `main().catch` 에서 `console.error(err)` 로 에러 객체 전체(스택 트레이스 포함)를 출력한다. 두 스크립트의 오류 처리 일관성이 없으며, `generate-golden-set.ts` 쪽이 DB 내부 에러 메시지나 LLM API 에러 상세를 CI 로그에 노출할 수 있다.
- 제안: `generate-golden-set.ts` 의 두 catch 블록도 `eval-retrieval.ts` 와 동일하게 `err instanceof Error ? err.constructor.name : 'UnknownError'` 패턴으로 통일한다.

### [INFO] 로그 진행 주기 매직 넘버
- 위치: `eval-retrieval.ts` 라인 198 (`searched % 20`), `generate-golden-set.ts` 라인 277 (`done % 10`), 라인 291 (`slice(0, 3)`)
- 상세: `SEARCH_CONCURRENCY`, `CHUNK_LLM_CONCURRENCY`, `GEN_TIMEOUT_MS` 는 파일 상단에 이름 있는 상수로 정의되어 있으나, 로그 출력 주기(`20`, `10`)와 dry-run 샘플 수(`3`)는 인라인 숫자로 남아 있다. 두 스크립트에서 서로 다른 주기(20 vs 10)를 사용하는 이유가 코드에 명시되지 않아 혼란을 준다.
- 제안: `LOG_PROGRESS_EVERY = 20` (eval-retrieval), `LOG_PROGRESS_EVERY = 10` (generate-golden-set), `DRY_RUN_SAMPLE_SIZE = 3` 을 파일 상단 상수로 올리고, 두 파일의 주기 차이가 의도적임을 짧은 주석으로 명시한다.

### [INFO] `evaluateRetrieval` 집계 루프 — 주석 없는 다중 상태 변경
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` 라인 257~268
- 상세: 단일 `for...of goldenSet.entries` 루프에서 `positives`, `byLangPos`, `negCount`, `negRetrievedAny` 네 가지 상태를 동시에 변경한다. 성능상 단일 순회는 합리적이나, `if (entry.shouldRetrieve && entry.goldChunkIds.length > 0)` 분기의 의미("positive/negative 분기")가 주석 없이 암묵적이다.
- 제안: 분기 시작에 `// positive entry: 지표 집계 대상 / negative entry: 회수율 통계만 집계` 한 줄 주석을 추가하면 의도가 즉시 명확해진다.

### 긍정 사항

- **[INFO] `parseCliFlag` 중복 해소 완료**: 이전 리뷰(02_39_25 #17)에서 WARNING으로 지적된 두 스크립트 간 `parseCliFlag` 중복이 `cli-utils.ts` 추출로 이미 해소되었다. 두 스크립트 모두 `import { parseCliFlag } from './cli-utils'` 로 가져와 DRY 원칙을 준수한다.
- **[INFO] `lang-detect.ts` 모범 사례**: 모듈 JSDoc, 정규식 상수 분리(`HANGUL_RE`, `LATIN_RE`), 임계값 상수(`KO_RATIO_THRESHOLD`) 명명, `countMatches` 헬퍼 함수 추출, `/g` 플래그 `lastIndex` 리셋 주석 포함, 함수 본문 6줄. 단일 책임 원칙의 모범 사례다.
- **[INFO] `retrieval-metrics.ts` 순수 함수 설계**: 모든 공개 함수가 부수효과 없이 입력만으로 결과를 결정한다. `orderRetrieved` 에서 `[...retrieved].sort()` 로 입력 배열을 변형하지 않는 방어적 복사, 빈 gold 집합에 대한 `NaN` 반환 계약, `macroAverage` 의 NaN guard(이전 리뷰 수정 반영)가 모두 명확하다.
- **[INFO] `root-entities.ts` JSDoc 문서화**: 분리 이유(eval CLI 경량 부트스트랩)와 유지보수 주의사항(`forFeature` 등록 + 이 배열 동시 갱신)이 JSDoc으로 잘 명시되어 있어 미래 기여자가 누락 회귀를 예방할 수 있다.
- **[INFO] `golden-set.types.ts` 필드 계약 명시**: `shouldRetrieve: false` 의 의미, `goldChunkIds` 개수 계약(`shouldRetrieve: true` 면 1개 이상), `reviewed` silver/gold 승격 의미가 JSDoc으로 명확히 기술되어 오용 방지에 기여한다.

---

## 요약

이번 변경의 유지보수성 전반 수준은 양호하다. 이전 리뷰 사이클(02_39_25)에서 지적된 주요 WARNING — `parseCliFlag` 중복, NaN guard 누락, `cli-utils.ts` 미추출 — 이 모두 수정되어 현재 코드에 반영되어 있다. 새로 발견된 실질적 WARNING은 `generate-golden-set.ts` 의 오류 처리 패턴이 `eval-retrieval.ts` 와 불일치한다는 점이다(에러 메시지 전체 노출 vs 에러 유형만 출력). 나머지 항목은 전부 INFO 수준으로, `main()` 함수 책임 분리와 `processChunk()` 추출은 이전 리뷰에서 이미 Sprint backlog으로 적절히 분류된 사항이며, 로그 주기 매직 넘버·타입 단언 중복·루프 내 분기 주석 누락은 소규모 개선 여지다.

## 위험도

LOW
