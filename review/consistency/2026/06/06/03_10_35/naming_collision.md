# 신규 식별자 충돌 검토 결과

검토 범위: `spec/conventions/rag-evaluation.md + spec/5-system/9-rag-search.md — NUL fix·이모지 수정 후 재검증`
diff-base: origin/main

---

## 발견사항

충돌로 판정할 항목이 없다. 아래는 전수 점검 결과다.

---

### [INFO] `ROOT_ENTITIES` — 파일 이동, 기존 export 호환 유지됨

- target 신규 식별자: `export const ROOT_ENTITIES` 를 `src/database/root-entities.ts` 에 새로 정의
- 기존 사용처: `src/app.module.ts` (origin/main line 110) 에서 동일 이름으로 정의·export, `src/app.module.spec.ts` 에서 `import { ROOT_ENTITIES } from './app.module'` 로 소비
- 상세: 정의를 app.module 에서 새 파일(`src/database/root-entities.ts`)로 이동하고, app.module 은 re-export(`export { ROOT_ENTITIES } from './database/root-entities'`)로 기존 import 사이트 호환을 유지한다. app.module.spec.ts 는 `./app.module` 경로에서 import 하므로 변경 없이 계속 동작한다. 충돌이 아니라 **이동 후 re-export**이며 의미 변경 없음.
- 제안: 없음 (정상 처리).

---

### [INFO] `GoldenEntrySchema` / `GoldenSetSchema` — eval-retrieval.ts 로컬 zod 스키마

- target 신규 식별자: `const GoldenEntrySchema`, `const GoldenSetSchema` (zod, `src/scripts/eval-retrieval.ts` 파일-스코프 상수)
- 기존 사용처: 코드베이스 전체에 동일 이름 없음
- 상세: 파일-스코프 상수이므로 외부 노출 없고 충돌 없음.
- 제안: 없음.

---

### [INFO] `ChunkRow` / `GeneratedQuestion` — generate-golden-set.ts 로컬 인터페이스

- target 신규 식별자: `interface ChunkRow`, `interface GeneratedQuestion` (`src/scripts/generate-golden-set.ts` 파일-스코프)
- 기존 사용처: 코드베이스 전체에 동일 이름 없음
- 상세: 파일-스코프 인터페이스이므로 외부 충돌 없음.
- 제안: 없음.

---

### [INFO] npm scripts `eval:golden:generate` / `eval:retrieval`

- target 신규 식별자: `codebase/backend/package.json` 의 두 script 키
- 기존 사용처: origin/main 의 `package.json` 에 동일 키 없음 (확인 완료)
- 상세: 새 키이므로 덮어쓰기 충돌 없음.
- 제안: 없음.

---

### [INFO] `src/database/root-entities.ts` 신규 파일 경로

- target 신규 식별자: `src/database/root-entities.ts`
- 기존 사용처: origin/main 의 `src/` 아래 `database/` 디렉터리 없음 (확인 완료)
- 상세: 새 파일 경로이며 기존 파일과 겹치지 않음.
- 제안: 없음.

---

### [INFO] `src/modules/knowledge-base/eval/` 신규 하위 디렉터리

- target 신규 식별자: `eval/` 서브디렉터리와 그 안의 4개 파일
- 기존 사용처: origin/main 의 `knowledge-base/` 아래 `eval/` 디렉터리 없음 (확인 완료)
- 상세: 새 디렉터리이며 기존 구조(`chunking/`, `dto/`, `embedding/`, `entities/`, `graph/`, `parsers/`, `queues/`, `search/`, `utils/`)와 명칭 충돌 없음.
- 제안: 없음.

---

### [INFO] `codebase/backend/eval/` 루트 레벨 신규 디렉터리

- target 신규 식별자: `codebase/backend/eval/` (README.md, golden.example.json)
- 기존 사용처: origin/main 의 `codebase/backend/` 아래 `eval/` 디렉터리 없음 (확인 완료)
- 상세: 새 디렉터리이며 기존 파일과 경로 충돌 없음.
- 제안: 없음.

---

### [INFO] `spec/conventions/rag-evaluation.md` 파일 경로 및 식별자

- target 신규 식별자: `spec/conventions/rag-evaluation.md` (conventions 폴더 신규 파일)
- 기존 사용처: 다른 spec 파일에서 해당 경로를 다른 의미로 사용하는 사례 없음
- 상세: `spec/conventions/` 아래의 신규 convention 파일. 기존 규약 파일들(`node-output.md`, `error-codes.md`, `migrations.md` 등)과 이름 충돌 없음.
- 제안: 없음.

---

## 요약

이번 diff 가 도입한 신규 식별자(타입명 `GoldenSet`·`GoldenEntry`·`GoldenLanguage`·`GoldenSource`·`GoldenDifficulty`·`GoldenSetMeta`·`RetrievedChunk`·`EvalReport`·`AggregateMetrics`·`NegativeCaseStats`·`EntryEval`·`EvalCliModule`, npm scripts, 파일 경로 등)는 코드베이스 전체에서 기존에 사용되지 않았거나 의미를 유지한 채 이동(ROOT_ENTITIES)된 것으로 확인된다. 요구사항 ID 공간에서도 RAG 평가 규약 관련 ID 가 기존 spec 에서 별도 의미로 사용되는 사례가 없다. 충돌 항목은 발견되지 않는다.

---

## 위험도

NONE
