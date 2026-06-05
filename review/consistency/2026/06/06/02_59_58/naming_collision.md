# 신규 식별자 충돌 검토 결과

검토 범위: RAG 평가 하베스 구현 완료 후 spec-impl 정합
대상 diff: `origin/main...HEAD` — `codebase/backend/src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`, `src/database/root-entities.ts`

---

## 발견사항

### [WARNING] `parseCliFlag` 함수명이 기존 스크립트 내 로컬 정의와 중복

- **target 신규 식별자**: `parseCliFlag` — `codebase/backend/src/scripts/cli-utils.ts` 로 추출된 공유 함수
- **기존 사용처**:
  - `codebase/backend/src/scripts/migrate-node-output-refs.ts` line 49: `function parseCliFlag(name: string): string | undefined { ... }` (로컬 정의)
  - `codebase/backend/src/scripts/migrate-button-ids.ts` line 50: 동일한 시그니처·구현 로컬 정의
- **상세**: 두 기존 스크립트는 이미 동일 시그니처·구현의 `parseCliFlag` 를 각자 로컬 정의해서 사용 중이다. 신규 `cli-utils.ts` 는 같은 함수를 공유 모듈로 추출했지만, 기존 두 스크립트는 `cli-utils.ts` 를 import 하지 않고 여전히 로컬 정의를 유지한다. 이름과 구현이 동일하므로 런타임 충돌은 없으나, "공유 유틸 vs 로컬 복사" 이중 관리 상태가 발생해 향후 수정 시 둘 중 하나가 누락될 수 있다.
- **제안**: `migrate-node-output-refs.ts` 와 `migrate-button-ids.ts` 에서 로컬 `parseCliFlag` 를 제거하고 `import { parseCliFlag } from './cli-utils'` 로 교체하면 단일 진실로 통합된다. 즉시 충돌이 아니므로 WARNING 등급이나, `cli-utils.ts` 를 도입한 취지가 반감되는 상태다.

---

### [INFO] `ROOT_ENTITIES` 이동 — 기존 import 사이트 호환은 re-export 로 보존됨

- **target 신규 식별자**: `ROOT_ENTITIES` — `codebase/backend/src/database/root-entities.ts` 에 신규 정의
- **기존 사용처**: `codebase/backend/src/app.module.ts` (origin/main 기준 line 110 에 `export const ROOT_ENTITIES`) + `codebase/backend/src/app.module.spec.ts` line 1 (`import { ROOT_ENTITIES } from './app.module'`)
- **상세**: origin/main 에서 `app.module.ts` 가 `ROOT_ENTITIES` 를 정의·export 하던 것을 신규 브랜치에서 `src/database/root-entities.ts` 로 이동하고, `app.module.ts` 에서 `export { ROOT_ENTITIES } from './database/root-entities'` 로 re-export 한다. `app.module.spec.ts` 는 여전히 `app.module` 에서 import 하므로 기존 import 사이트는 정상 동작한다. 의미 충돌 없음.
- **제안**: 현 re-export 구조로 충분. 추가 조치 불필요.

---

### [INFO] `eval/` 디렉터리 신규 생성 — 기존 명명 컨벤션과의 충돌 없음

- **target 신규 식별자**: `codebase/backend/eval/` (디렉터리), `eval/golden.example.json`, `eval/README.md`
- **기존 사용처**: origin/main 의 `codebase/backend/` 에 `eval/` 디렉터리 없음
- **상세**: 프로젝트 폴더 구조 컨벤션과 충돌 없음. `codebase/backend/eval/` 은 하베스 데이터 전용 디렉터리로 명확히 격리되어 있고 `.gitignore` 로 실데이터(`golden.json`, `*.report.json`) 제외 처리됨.
- **제안**: 현 구조 유지.

---

### [INFO] `EvalCliModule` — NestJS 모듈 이름 고유성 확인

- **target 신규 식별자**: `EvalCliModule` — `src/modules/knowledge-base/eval/eval-cli.module.ts`
- **기존 사용처**: origin/main 및 현 브랜치의 기타 모듈 파일에서 `EvalCliModule` 사용처 없음
- **상세**: 신규 이름. 기존 NestJS 모듈(`KnowledgeBaseModule`, `LlmModule` 등)과 이름 충돌 없음.
- **제안**: 현 이름 유지.

---

### [INFO] `GoldenSet`, `GoldenEntry`, `GoldenSource`, `GoldenLanguage`, `GoldenDifficulty` — 타입명 고유성 확인

- **target 신규 식별자**: 위 5개 타입명 — `src/modules/knowledge-base/eval/golden-set.types.ts`
- **기존 사용처**: `codebase/backend/src/` 전체에서 동명 타입 없음
- **상세**: 신규 eval 전용 도메인 타입. 기존 엔티티명(`KnowledgeBase`, `Document`, `DocumentChunk` 등) 및 DTO 명과 충돌 없음.
- **제안**: 현 이름 유지.

---

### [INFO] `EvalReport`, `AggregateMetrics`, `EntryEval`, `NegativeCaseStats`, `RetrievedChunk` — 인터페이스명 고유성 확인

- **target 신규 식별자**: 위 5개 인터페이스 — `src/modules/knowledge-base/eval/retrieval-metrics.ts`
- **기존 사용처**: `codebase/backend/src/` 전체에서 동명 인터페이스 없음
- **상세**: 신규 eval 전용 타입. 기존 API DTO, 엔티티 인터페이스와 충돌 없음.
- **제안**: 현 이름 유지.

---

### [INFO] npm scripts `eval:golden:generate`, `eval:retrieval` — 기존 scripts 네임스페이스 충돌 없음

- **target 신규 식별자**: 위 두 npm script 키
- **기존 사용처**: origin/main `codebase/backend/package.json` 에 `eval:` prefix 스크립트 없음
- **상세**: 기존 스크립트 키(`cleanup:queue-jobs`, `encrypt-auth-config` 등)와 네임스페이스 분리됨.
- **제안**: 현 이름 유지.

---

### [INFO] Rationale 결정 식별자 `D-E1`~`D-E6` — 다른 conventions 와 충돌 없음

- **target 신규 식별자**: `D-E1`~`D-E6` — `spec/conventions/rag-evaluation.md` Rationale 절
- **기존 사용처**: `spec/conventions/` 하위 다른 파일에서 `D-E` prefix 식별자 없음
- **상세**: 신규 파일 전용 결정 레퍼런스. 충돌 없음.
- **제안**: 현 이름 유지.

---

## 요약

이번 변경에서 도입한 신규 식별자(타입명·모듈명·파일 경로·npm 스크립트·Rationale ID) 는 기존 코드베이스 및 spec 에서 다른 의미로 사용 중인 동명 식별자와 의미 충돌을 일으키지 않는다. 유일한 주목 항목은 `parseCliFlag` 함수로, 신규 `cli-utils.ts` 에 공유 버전을 추출했으나 기존 `migrate-node-output-refs.ts` 와 `migrate-button-ids.ts` 는 동일 구현을 여전히 로컬 정의로 보유한다. 런타임 충돌은 없고 구현 내용도 동일하나, 공유 유틸 도입 취지 관점에서 두 파일이 `cli-utils` 를 import 하도록 통합하는 것이 권장된다.

---

## 위험도

LOW
