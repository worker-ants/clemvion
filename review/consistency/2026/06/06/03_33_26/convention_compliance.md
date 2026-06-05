# 정식 규약 준수 검토 결과

검토 범위: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md` — 2차 fix(이모지 제거·§2 positive 정의·§3 --threshold·cli-utils code 등재) 후 최종 정합 검증
diff 기준: `origin/main...HEAD`

---

## 발견사항

### CRITICAL

없음.

### WARNING

없음.

### INFO

- **[INFO]** `cli-utils.spec.ts` 가 `spec/conventions/rag-evaluation.md` `code:` 목록에 미등재
  - target 위치: `spec/conventions/rag-evaluation.md` frontmatter `code:` 배열
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"
  - 상세: 2차 fix 에서 `cli-utils.spec.ts` 가 추가됐으나 frontmatter `code:` 에 `cli-utils.ts` 는 등재됐고 `cli-utils.spec.ts` 는 미등재. spec-code-paths 가드는 glob 허용이므로 빌드 실패 없음.
  - 제안: `codebase/backend/src/scripts/cli-utils.spec.ts` 를 `code:` 목록에 추가하거나 glob 패턴(`src/scripts/cli-utils*`) 으로 통합.

- **[INFO]** `eval/README.md` 를 `code:` 에 나열하는 것은 느슨한 관례
  - target 위치: `spec/conventions/rag-evaluation.md` frontmatter `code:` 9번째 항목
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "구현 경로"
  - 상세: README 는 운영 가이드 문서이나 파일이 실존하므로 `spec-code-paths.test.ts` 가드 통과. 프로젝트 내 다른 spec 에서도 README 를 `code:` 에 등재하는 관례가 있어 일관성 유지됨.
  - 제안: 낮은 중요도. 현재 상태 유지 가능.

---

## 검토 결과 상세

### 1. 명명 규약

적합. 구현된 파일 명명 패턴:

- `golden-set.types.ts` — TypeScript 관례(kebab-case) 적합
- `retrieval-metrics.ts` / `retrieval-metrics.spec.ts` — `.spec.ts` suffix 통일
- `eval-cli.module.ts` — NestJS 모듈 명명 패턴(`<name>.module.ts`) 적합
- `lang-detect.ts` / `cli-utils.ts` / `cli-utils.spec.ts` — 적합
- `eval-retrieval.ts` / `generate-golden-set.ts` — scripts 폴더 내 kebab-case 적합
- `eval/golden.example.json` / `eval/README.md` — 적합
- `src/database/root-entities.ts` — 적합 (기존 `ROOT_ENTITIES` 이전)

`spec/conventions/rag-evaluation.md` 의 `id: rag-evaluation` — kebab-case, `spec-impl-evidence.md §2.1` id 규칙 적합.

### 2. 출력 포맷 규약

적합.

- `EvalReport` 내 에러 코드 (`RERANK_ENDPOINT_FAILED`, `RERANK_NO_VALID_RESULTS`, `RERANK_LLM_GRADING_FAILED`, `RERANK_CONFIG_INVALID`) — `spec/conventions/error-codes.md` 의 UPPER_SNAKE_CASE 표기 요구와 일치. `spec/5-system/9-rag-search.md §4.2` ragDiagnostics `error` 필드 정의와 일치.
- `AggregateMetrics` / `NegativeCaseStats` / `EvalReport` / `EntryEval` — `spec/conventions/rag-evaluation.md §2 집계` 명세와 필드명·구조 일치 (`overall`/`byLanguage`/`negatives`/`perEntry`, `ks`/`maxK`/`totalEntries`).
- `GoldenSet` / `GoldenEntry` 스키마 — `spec/conventions/rag-evaluation.md §1` 표 필드 목록과 `golden-set.types.ts` 일치.
- `shouldRetrieve: false` 부정 케이스가 macro 평균에서 제외되고 `negatives.retrievedAnyRate` 로만 집계 — 규약 §1·§2 준수.
- positive 집계 조건 (`shouldRetrieve=true` 이면서 `goldChunkIds` 1개 이상) 이 `retrieval-metrics.ts evaluateRetrieval()` 구현과 `spec/conventions/rag-evaluation.md §2 집계` 정의와 일치.

### 3. 문서 구조 규약

적합.

- `spec/conventions/rag-evaluation.md` — Overview / 본문(§1~§5) / Rationale 3섹션 구조 준수.
- `spec/5-system/9-rag-search.md` — Overview / 본문(§1~§7) / Rationale 구조 준수.
- `spec/conventions/rag-evaluation.md` frontmatter: `id: rag-evaluation`, `status: implemented`, `code:` 목록 — `spec-impl-evidence.md §2` 스키마 완전 적합.
- `spec/5-system/9-rag-search.md` frontmatter: `id: rag-search`, `status: partial`, `code:` (2개), `pending_plans:` (2개) — `spec-impl-evidence.md §2` partial 상태 의무 필드 충족.
- `eval/README.md` 는 `codebase/` 하위 운영 문서로, spec 파일이 아니므로 frontmatter lifecycle 불필요. 적합.

### 4. API 문서 규약

해당 없음 — 이번 diff 에서 API 컨트롤러·DTO 신규 추가 없음. 기존 `spec/5-system/9-rag-search.md §2-§4` 의 툴 포맷·ragSources·ragDiagnostics 스키마 변경 없음.

### 5. 금지 항목

위반 없음.

- `generate-golden-set.ts` LLM 호출은 `LlmService.chat()` 경유 — CLAUDE.md "외부 LLM 호출 정책" 의 `subprocess.run(["claude", -p, ...])` / Anthropic SDK 직접 호출 금지 위반 없음.
- `eval/golden.json` 은 `.gitignore` 에 명시적 등재 — 규약 §4 "실 골든셋 기본 git 미커밋" 준수.
- `--out` 경로 CWD 경계 가드 구현 — SSRF/경로 탈출 방어 적합.

---

## 요약

`spec/conventions/rag-evaluation.md` 와 `spec/5-system/9-rag-search.md` 양 문서 모두 정식 규약을 충실히 준수한다. frontmatter 스키마(id/status/code/pending_plans)는 `spec-impl-evidence.md §2` 를 완전 충족하며, 문서 구조는 Overview/본문/Rationale 3섹션 권장 구조를 따른다. 구현 코드의 에러 코드 표기(UPPER_SNAKE_CASE), 스키마 필드명, negatives 처리 정책, positive 집계 조건이 모두 규약 명세와 일치한다. `cli-utils.spec.ts` 미등재와 `eval/README.md` 를 `code:` 에 포함한 점은 INFO 수준 형식 불일치로, 가드 실패를 유발하지 않는다. CRITICAL 및 WARNING 발견사항 없음.

---

## 위험도

NONE
