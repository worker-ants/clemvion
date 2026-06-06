# 문서화(Documentation) 리뷰 결과

## 발견사항

### 독스트링/JSDoc

- **[INFO]** `golden-set.types.ts` — 모듈 레벨 JSDoc, 각 타입·필드별 인라인 주석이 충실하다. `GoldenEntry` 필드마다 의미·조건·예외(`shouldRetrieve: false` 시 negatives 처리 등)가 명확히 기술돼 있다. 양호.
  - 위치: `codebase/backend/src/modules/knowledge-base/eval/golden-set.types.ts`

- **[INFO]** `retrieval-metrics.ts` — 공개 함수(`recallAtK`, `precisionAtK`, `hitRateAtK`, `mrrAtK`, `ndcgAtK`, `evaluateRetrieval`)에 수식·NaN 반환 조건·인자 설명이 포함된 JSDoc이 있다. `evaluateRetrieval`의 `@param retrievedByEntryId`는 누락 entry 처리 방침까지 설명한다. 양호.
  - 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts`

- **[INFO]** `lang-detect.ts` — 모듈 레벨 주석에 설계 의도(한글 비율 임계치, CS 문서 라틴 혼입 고려)가 기술돼 있다. `KO_RATIO_THRESHOLD` 상수에 인라인 주석 포함. 양호.

- **[INFO]** `eval-cli.module.ts` — 클래스 JSDoc이 큐·프로세서 제외 이유, `ROOT_ENTITIES` 전체 등록 이유, `autoLoadEntities` 미사용 이유까지 설명한다. 양호.

- **[WARNING]** `eval-retrieval.ts` — `parseCliFlag`, `fmt`, `printAggregate` 헬퍼 함수에 JSDoc이 없다. 이들은 `main()` 내부에서만 쓰이는 내부 유틸이지만, `parseCliFlag`는 `--flag value` / `--flag=value` 두 파싱 형식을 지원하는 비자명 로직이라 인라인 주석이라도 있으면 좋다.
  - 위치: `codebase/backend/src/scripts/eval-retrieval.ts` (parseCliFlag, fmt, printAggregate 함수)
  - 제안: `parseCliFlag`에 `/* --flag value 또는 --flag=value 두 형식 모두 지원 */` 수준의 1줄 주석 추가.

- **[WARNING]** `generate-golden-set.ts` — diff가 binary로 처리되어 내용 확인 불가. 스크립트가 `LlmService` 를 직접 사용하는 복잡한 로직(청크 샘플링 → LLM 호출 → id 해시 dedup → golden.json 머지)임에도 문서 품질을 검증할 수 없다. plan에 기술된 args(`--workspace-id --kb-id --sample N --lang --questions-per-chunk --out --dry-run`) 각각에 대한 JSDoc/주석이 있는지 현재 확인 불가.
  - 위치: `codebase/backend/src/scripts/generate-golden-set.ts`
  - 상세: binary diff로 전달됨 — 실제 파일을 직접 확인해 CLI args 문서화 완전성을 별도로 검증 권장.
  - 제안: 파일 상단에 `eval-retrieval.ts`와 동일한 형식의 모듈 JSDoc(사용법·인자 목록·동작 설명)을 배치했는지 확인.

### README 업데이트

- **[INFO]** `codebase/backend/eval/README.md` 신규 생성됨. 구성표·워크플로(합성→검수→실행)·골든셋 커밋 정책·결정성 설명이 포함돼 있다. spec SoT(`spec/conventions/rag-evaluation.md`) 링크도 명시. 양호.
  - 위치: `codebase/backend/eval/README.md`

- **[WARNING]** `eval/README.md`의 워크플로 섹션이 `npx ts-node` 직접 실행을 안내하는데, `package.json`에 `eval:golden:generate` / `eval:retrieval` npm script가 추가됐다. README에 `npm run eval:golden:generate` / `npm run eval:retrieval` 편의 명령 참조가 없어 독자가 두 경로를 병렬 학습해야 한다.
  - 위치: `codebase/backend/eval/README.md` 워크플로 1·3 단계
  - 제안: 각 단계의 `npx ts-node ...` 예시 아래 `# 또는: npm run eval:golden:generate -- --workspace-id <uuid> ...` 형식의 대안 줄을 추가.

- **[INFO]** 최상위 `codebase/backend/README.md` 또는 프로젝트 루트 README에는 별도 업데이트가 없다. 이 하베스는 개발·CI 도구이므로 사용자 대면 제품 README 업데이트는 불필요하다고 판단. 다만 `eval/` 디렉터리 존재 자체가 `codebase/backend/` 구조에서 새로운 최상위 폴더이므로, backend 레벨 README가 있다면 `eval/` 언급 추가 여부를 확인 권장(blocking 아님).

### API 문서

- **[INFO]** 이번 변경에 HTTP API 엔드포인트 추가/변경 없음. CLI 스크립트 전용이므로 Swagger/OpenAPI 업데이트 불필요.

### 주석 정확성

- **[INFO]** `app.module.ts` 인라인 주석: `ROOT_ENTITIES` 이동 이유를 두 곳(import 위 주석, re-export 위 주석)에서 일관되게 설명한다. 이전 JSDoc(`autoLoadEntities 미사용 정책 ... app.module.spec.ts 의 REQUIRED 목록 두 곳을 함께 갱신`)은 `root-entities.ts`로 이동돼 정확히 유지됨. 양호.

- **[INFO]** `root-entities.ts` JSDoc은 `app.module.spec.ts` 갱신 의무까지 포함한 회귀 방지 안내가 있다. 분리 이유(eval CLI 경량 부트스트랩)도 명시. 양호.

- **[WARNING]** `root-entities.ts`의 JSDoc 마지막 문장 "app.module 은 여기서 re-export 한다"는 주어-방향이 애매하다. "여기서" = root-entities가 app.module로 re-export한다는 의미인지, app.module이 여기서 re-export한다는 의미인지 불명확하다. 실제로는 `app.module.ts`가 `root-entities.ts`에서 re-export하는 방향인데 주석이 반대로 읽힐 수 있다.
  - 위치: `codebase/backend/src/database/root-entities.ts` JSDoc 마지막 문장
  - 제안: "app.module 은 여기서 re-export 한다" → "app.module 이 이 배열을 re-export 하여 기존 import 사이트 호환을 유지한다"로 명확화.

### 인라인 주석

- **[INFO]** `eval-retrieval.ts` — `resolveWorkspace` 함수 바로 앞에 "KB → workspace 매핑(검색 호출에 workspaceId 필요)" 주석이 있다. CI 게이트 섹션, search concurrency 상수, 진행 보고 조건 등 비자명 부분에 적절한 주석이 있다. 양호.

- **[INFO]** `eval-cli.module.ts` — TypeORM `entities` 옵션 옆 인라인 주석(`autoLoadEntities 로는 부족한 이유, 큐 미기동 이유`)이 충실하다. 양호.

- **[WARNING]** `retrieval-metrics.ts`의 `firstRelevantRank` 함수는 `export`로 공개돼 있지만 1줄 주석(`/** 1-based first relevant rank within top-k, 없으면 null. */`)만 있다. 이 함수는 `mrrAtK`의 내부 구현에서 호출되는 동시에 `EvalReport`의 `perEntry` 필드(`firstRelevantRank: number | null`)에 직접 노출되므로 공개 API 수준의 문서가 필요하다.
  - 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` `firstRelevantRank` 함수
  - 제안: `@param`·`@returns` 포함 JSDoc 추가. 특히 "top-k 범위 내에서만 탐색" 동작을 명시.

### 변경 이력 / CHANGELOG

- **[INFO]** 프로젝트에 별도 CHANGELOG 파일 관리 규약이 보이지 않는다(plan/spec 기반 SDD). `plan/in-progress/rag-eval-harness.md`가 변경 이력 역할을 수행하고 있어 CHANGELOG 미갱신은 정상이다.

### 설정 문서

- **[WARNING]** `eval-cli.module.ts`는 `.env`에서 `database.*` / `llm.*` / `app.*` 설정을 읽는다. 이 스크립트를 실행하려면 백엔드 `.env`가 필요한데, `eval/README.md`에는 `.env` 전제조건 언급이 없다.
  - 위치: `codebase/backend/eval/README.md` 지표 실행 단계
  - 제안: 실행 전제조건 섹션(또는 지표 실행 위 주의 블록)에 "`.env` 에 DB 접속 정보 및 LLM config 가 설정돼 있어야 한다" 1~2줄 추가. `eval:golden:generate` 도 동일.

- **[WARNING]** `eval-retrieval.ts`의 `--threshold` 플래그가 README 워크플로 예시에 언급되지 않는다. README의 지표 실행 게이트 예시는 `--fail-metric`/`--fail-k`/`--fail-under`를 소개하지만, `--threshold`(검색 결과 최소 스코어 컷)는 결과에 영향이 크기 때문에 문서화가 필요하다.
  - 위치: `codebase/backend/eval/README.md` 지표 실행 섹션
  - 제안: `--threshold 0.0` 기본값 및 용도("검색 score 하한, 기본 0 = 필터 없음")를 예시 명령에 주석으로 추가.

### 예제 코드

- **[INFO]** `eval/golden.example.json` — KO×2, EN×1, manual/synthetic/reviewed 다양성을 갖춘 3 entry 픽스처. `generatedFrom` 필드(synthetic 전용)의 예시도 포함. `GoldenSetMeta.description`에 사용 목적 설명. 양호.

- **[INFO]** `eval/README.md` — bash 코드 블록으로 합성·지표 실행·CI 게이트화 예시가 모두 있다. `--dry-run` 언급도 있다. 양호.

---

## 요약

전반적으로 이번 RAG 평가 하베스 구현의 문서화 품질은 높다. 핵심 타입(`golden-set.types.ts`), 지표 함수(`retrieval-metrics.ts`), 경량 DI 모듈(`eval-cli.module.ts`) 모두 설계 의도와 사용 제약을 담은 JSDoc을 갖추고 있으며, `eval/README.md`는 합성→검수→실행→해석의 워크플로를 단계별로 안내한다. 개선이 필요한 부분은 네 가지다. (1) `eval/README.md`에 `.env` 전제조건과 `--threshold` 플래그 문서화가 빠져 있어 사용자가 실행 시 혼란을 겪을 수 있고, (2) npm scripts(`eval:golden:generate` / `eval:retrieval`)가 README 예시와 연결되지 않으며, (3) `root-entities.ts` JSDoc의 re-export 방향 설명이 애매하고, (4) `generate-golden-set.ts`는 binary diff로 전달되어 내부 문서화 완전성을 검증할 수 없어 별도 확인이 권장된다.

## 위험도

LOW

---

STATUS: SUCCESS
