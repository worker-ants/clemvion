# Code Review 통합 보고서

> 대상: RAG 평가 하네스 P0 Phase 0+1 (rag-eval-harness) 2차 리뷰
> 커밋: 23eedfd3 (feat) + 92ebe8f2 (fix) + b64c21dc (NUL 바이트 수정)
> 일시: 2026-06-06

---

## 전체 위험도

**MEDIUM** — CLI 스크립트 레이어에 테스트가 전무하고, `generate-golden-set.ts` 에 보안·아키텍처·부작용 관련 WARNING 이 복합적으로 존재한다. 핵심 지표 레이어(`retrieval-metrics.ts`)는 양호하며 Critical 발견사항은 없다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Security / Architecture / Maintainability (통합) | `generate-golden-set.ts` catch 블록에서 `err.message` / `err` 전체를 직접 출력 — `eval-retrieval.ts` 의 에러 sanitize 패턴(#8 fix, `err.constructor.name`만 출력) 미적용. LLM API 에러 시 API 키 접두어·내부 엔드포인트가 로그에 노출될 수 있음 | `codebase/backend/src/scripts/generate-golden-set.ts` L272-274 (청크 catch), L329-332 (main catch) | 청크 catch: `const kind = err instanceof Error ? err.constructor.name : 'UnknownError'; console.warn(...)` 패턴으로 교체. main catch도 동일 패턴으로 통일 (eval-retrieval.ts #8 fix 그대로 적용) |
| W2 | Side Effect / Security | `generate-golden-set.ts` 의 `--out` 경로에 CWD 경계 가드 누락. `eval-retrieval.ts` 에는 `outAbs.startsWith(resolve(process.cwd()))` 검사가 있으나 이 파일에는 없어 `--out ../../etc/somefile` 로 CWD 밖 임의 경로에 파일 생성 가능 | `codebase/backend/src/scripts/generate-golden-set.ts` L172, L316-317 | `eval-retrieval.ts` L129-135 패턴 동일 적용: `outAbs.startsWith(resolve(process.cwd()))` 검사 후 실패 시 `process.exit(1)` |
| W3 | Testing | CLI 스크립트 레이어 테스트 전무: `cli-utils.ts` (`parseCliFlag`), `eval-retrieval.ts` (`fmt`, CI 게이트 분기, 경로 가드, zod 실패 경로), `generate-golden-set.ts` (id 해시 안정성, `reviewed:true` 보존 머지, parseQuestions 파싱 오류) 모두 자동 검증 밖 | `codebase/backend/src/scripts/cli-utils.ts`, `eval-retrieval.ts`, `generate-golden-set.ts` | `cli-utils.spec.ts` 추가 (parseCliFlag 4개 케이스). `fmt`, CI 게이트를 export / 순수 함수로 추출해 단위 테스트 추가. `generate-golden-set.ts` 핵심 로직 LlmService mock 단위 테스트 추가 |
| W4 | Testing | `EvalCliModule` DI 연결 회귀 테스트 없음 — `RagSearchService`, `RerankService`, `RerankClientFactory` 의존성 파손을 자동 탐지하는 테스트 부재 (현재 수동 스모크에만 의존) | `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` | `eval-cli.module.spec.ts` 추가: TypeOrmModule/LlmModule/RerankConfigModule mock 후 RagSearchService DI 성공 assertion |
| W5 | Requirement | `evaluateRetrieval` positive 분류 기준 (`shouldRetrieve && goldChunkIds.length > 0`) 이 spec 에 미기재 — spec 은 `shouldRetrieve:true` 만 언급, `goldChunkIds.length > 0` 조건은 코드에만 존재 | `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` L262 vs `spec/conventions/rag-evaluation.md §2` | `spec/conventions/rag-evaluation.md §2 집계`의 positive 정의에 "(`shouldRetrieve:true`이면서 `goldChunkIds`가 1개 이상)" 조건을 `project-planner`에 명시 요청 |
| W6 | Architecture (이전 보류 #15 재기록) | `EvalCliModule` 이 `ROOT_ENTITIES` 전체(~40개) 등록 — 실제 필요 entity 는 소수이나 TypeORM이 모든 entity 메타데이터를 초기화, CLI 부트스트랩 비용 과다. 새 entity 추가 시 eval CLI도 암묵적 영향 | `eval-cli.module.ts` L48 | 중장기: `EVAL_CLI_ENTITIES = [KnowledgeBase, DocumentChunk, LlmConfig, RerankConfig, Workspace]` 배열을 `root-entities.ts`에 별도 export, Sprint backlog 등록 |
| W7 | Database | `generate-golden-set.ts` `ORDER BY ${orderBy}` 문자열 인터폴레이션 패턴 — 현재 2개 상수값만 사용해 실질 위험 없으나, 패턴 자체가 향후 확장 시 SQL injection 취약점이 될 수 있음 | `codebase/backend/src/scripts/generate-golden-set.ts` L185, L186-194 | `const ALLOWED_ORDERS = { random: 'random()', id: 'id' } as const` 화이트리스트 const 맵으로 인터폴레이션 패턴 제거, 또는 쿼리 전체 분기 |
| W8 | Documentation | `golden.example.json` `meta.description` 내 `"eval/README.md 참조"` 경로 표현 모호 — 같은 디렉터리 파일인지 루트 기준 경로인지 불명확 | `codebase/backend/eval/golden.example.json` meta.description | `"README.md(같은 디렉터리) 참조"` 로 변경하거나 현행 유지 (기능 무영향, 중요도 낮음) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Security | `--out` 경로 비교 시 trailing-slash 엣지 케이스 — `outAbs.startsWith(resolve(process.cwd()))` 는 `/tmp/eval-evil` 같은 경로가 CWD `/tmp/eval` 기준 통과할 이론적 가능성 있음 | `eval-retrieval.ts` L129-135 | `+ '/'` 또는 `path.relative()` 기반 검사로 강화 권장 (CLI 특성상 즉각 차단 아님) |
| I2 | Security | `generate-golden-set.ts` `stableEntryId`에서 SHA-1 사용 — 암호 목적 아닌 content-address 식별자 용도이므로 보안 위험 없음 | `generate-golden-set.ts` L86-96 | `// content-address identifier, not security hash` 주석 추가 권장 |
| I3 | Security | `generate-golden-set.ts` SQL `ORDER BY` 화이트리스트 const 매핑 부재 — 현재 안전, 미래 확장 위험 방지용 | `generate-golden-set.ts` L185, 191 | `ORDER_BY_MAP: Record<'id'|'random', string>` 형태 추가 권장 |
| I4 | Performance | `ndcgAtK` 내 `Math.log2` 반복 계산 — Phase 0 규모(수십~수백 entry)에서 실질 병목 없음 | `retrieval-metrics.ts` L101-109 | 수천 entry 규모 도달 시 log2 테이블 pre-compute 권장 |
| I5 | Performance | `evaluateEntry` 내 `ranked.slice(0, k)` 중복 호출 — 현 규모 허용 | `retrieval-metrics.ts` L180-185 | 대규모 시 `maxK` 단일 slice + limit 파라미터 방식으로 개선 |
| I6 | Performance | `eval-retrieval.ts` kbId 개별 DB 쿼리 (wsCache 캐싱 완료) — 신규 kbId N개 시 N번 왕복 | `eval-retrieval.ts` L146-163 | `WHERE id = ANY($1::uuid[])` 배치 조회로 pre-warm 가능 (현 규모 차이 미미) |
| I7 | Performance | `EvalCliModule` ROOT_ENTITIES 전체 등록으로 CLI 부트스트랩 비용 | `eval-cli.module.ts` L429 | 중장기: EVAL_CLI_ENTITIES 최소 집합으로 분리 (W6 중복) |
| I8 | Architecture | `GoldenSetMeta.version: 1` 리터럴 타입 고정 — 스키마 변경 시 마이그레이션 경로 미명시 | `golden-set.types.ts` L56 | 향후 변경 시 versioned discriminated union 패턴 또는 마이그레이션 함수 설계 권장 |
| I9 | Architecture | eval 레이어가 `knowledge-base` 모듈 서브디렉터리에 위치 — 현재 자연스럽지만 다른 리트리버 평가 시 경계 초과 가능 | `src/modules/knowledge-base/eval/` | 평가 대상 확장 시 `src/modules/eval/` 독립 모듈 분리 검토 |
| I10 | Architecture | `main()` 함수 과도한 책임 (보류 #18) — CLI 파싱·부트스트랩·조회·fan-out·리포트·CI 게이트 단일 처리 | `eval-retrieval.ts` main() | Sprint backlog: `resolveArgs()`, `runSearchPhase()`, `printReport()`, `checkCiGate()` 분리 |
| I11 | Requirement | `--ks 0,-1,abc` 처럼 유효 양정수 없으면 빈 배열이 되고 경고 없이 빈 테이블 출력 | `eval-retrieval.ts` L119-123 | `ks.length === 0` 시 기본값 `[1,3,5,10]` 대체 또는 오류 출력 |
| I12 | SPEC-DRIFT | [SPEC-DRIFT] `--threshold` 플래그가 코드·README에는 구현되어 있으나 `spec/conventions/rag-evaluation.md §3` 표에 미등재 — 코드가 spec보다 앞서 있음. 코드 revert가 아닌 spec 갱신이 정답 | `eval-retrieval.ts` vs `spec/conventions/rag-evaluation.md §3` | 코드 유지 + spec §3 표에 `[--threshold 0]` 옵션 추가 — `project-planner` 위임 |
| I13 | Testing | `firstRelevantRank` 함수 간접 커버만, 직접 테스트 없음 (`null` 반환 경로) | `retrieval-metrics.ts` L72 | 직접 테스트 케이스 추가 권장 |
| I14 | Testing | `precisionAtK(k <= 0)` 방어 분기 미테스트 | `retrieval-metrics.ts` L57 | `precisionAtK(['c1'], gold, 0)` → `0` 케이스 추가 |
| I15 | Testing | `golden.example.json` 이 `GoldenSetSchema` zod 검증을 통과하는지 자동 검증 없음 | `eval/golden.example.json` | `retrieval-metrics.spec.ts` 또는 별도 스펙에 safeParse 통과 assertion 추가 |
| I16 | Maintainability | 로그 출력 주기 매직 넘버 (`20`, `10`, `3`) — SEARCH_CONCURRENCY 등은 상수화됐으나 로그 주기는 인라인 | `eval-retrieval.ts` L198, `generate-golden-set.ts` L277, L291 | `LOG_PROGRESS_EVERY`, `DRY_RUN_SAMPLE_SIZE` 상수 추출 + 주기 차이 의도 주석 |
| I17 | Maintainability | `parseQuestions` 내 타입 단언 반복 (`as { questions?: unknown }` 등 3회) | `generate-golden-set.ts` L102-135 | zod 스키마 또는 타입가드 함수로 단언 중복 제거 |
| I18 | Maintainability | `evaluateRetrieval` 집계 루프 내 positive/negative 분기 주석 없음 | `retrieval-metrics.ts` L257-268 | `// positive entry: 지표 집계 대상 / negative entry: 회수율 통계만 집계` 한 줄 주석 추가 |
| I19 | Maintainability | `generate-golden-set.ts` LLM 호출 람다 내 4단계 중첩 (보류 #19) | `generate-golden-set.ts` L211-283 | `processChunk()` 독립 async 함수 추출, Sprint backlog |
| I20 | Documentation | `spec/5-system/9-rag-search.md` 에서 `rag-evaluation.md` 로의 정방향 링크 추가 여부 미확인 | `spec/5-system/9-rag-search.md` | 링크 1줄 누락이면 추가 권장 (기능 무영향) |
| I21 | Database | `document_chunk` 샘플링 쿼리 `knowledge_base_id` 인덱스 존재 여부 미확인 | `generate-golden-set.ts` L186-194 | 인덱스 존재 확인 권장 (운영 서비스 직접 영향 없음) |
| I22 | Concurrency | `retrieved` 결과 맵에 중복 `entry.id` 있으면 마지막 write가 묵시적으로 덮어씀 — zod가 중복 id 검증 안 함 | `eval-retrieval.ts` L166, L176, L186-189 | 실행 전 Set 중복 검사 추가 가능 (실용적 위험 낮음) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `generate-golden-set.ts` catch에서 err.message 직접 출력 (WARNING) |
| performance | NONE | 이전 리뷰 조치 완료. 나머지 모두 현 규모 허용 |
| architecture | LOW | generate-golden-set.ts 에러 sanitize 패턴 불일치 (WARNING); 이전 보류 항목 유지 |
| requirement | LOW | positive 분류 기준 spec 미기재 (WARNING); SPEC-DRIFT: --threshold 미등재 (INFO) |
| scope | NONE | 전 변경 파일이 plan 체크리스트와 1:1 대응, 범위 이탈 없음 |
| side_effect | LOW | generate-golden-set.ts --out 경로 CWD 경계 가드 누락 (WARNING) |
| maintainability | LOW | generate-golden-set.ts 오류 로그 패턴 불일치 (WARNING); 나머지 INFO |
| testing | MEDIUM | CLI 스크립트 레이어 테스트 전무, EvalCliModule DI 회귀 테스트 없음 (4 WARNING) |
| documentation | LOW | golden.example.json meta.description 경로 모호 (WARNING, 기능 무영향) |
| dependency | NONE | 신규 외부 패키지 추가 없음, 전 항목 기존 의존성 재활용 |
| database | LOW | ORDER BY 인터폴레이션 패턴 (WARNING); 배치 조회 미적용 (WARNING) |
| concurrency | NONE | wsCache Promise 캐싱 조치 완료. 나머지 단일 스레드 환경에서 안전 |

---

## 발견 없는 에이전트

- **performance**: CRITICAL/WARNING 신규 발견 없음 (이전 리뷰 조치 완료)
- **scope**: CRITICAL/WARNING 발견 없음 (전 변경 범위 내)
- **dependency**: CRITICAL/WARNING 발견 없음 (신규 외부 패키지 0)
- **concurrency**: CRITICAL/WARNING 발견 없음 (핵심 경쟁 조건 조치 완료)

---

## 권장 조치사항

1. **(즉시 · 코드 수정)** `generate-golden-set.ts` catch 블록 에러 sanitize 패턴 통일 — 청크 catch L272-274 및 main catch L329-332 모두 `err.constructor.name` 출력으로 교체 (W1: security + architecture + maintainability 동일 이슈)
2. **(즉시 · 코드 수정)** `generate-golden-set.ts` `--out` CWD 경계 가드 추가 — `eval-retrieval.ts` L129-135 패턴 그대로 복사 적용 (W2)
3. **(단기 · 테스트 추가)** `cli-utils.spec.ts` 신규 추가: `parseCliFlag` 4개 경계 케이스 검증 (W3 일부)
4. **(단기 · 테스트 추가)** `eval-retrieval.ts` 테스트: `fmt` export 또는 분리, CI 게이트 `checkCiGate()` 순수 함수 추출 후 단위 테스트 추가 (W3)
5. **(단기 · 테스트 추가)** `generate-golden-set.ts` 테스트: `LlmService` mock 사용 id 해시 안정성, `reviewed:true` 보존 머지 로직 검증 (W3 — 데이터 손실 회귀 방지)
6. **(단기 · 테스트 추가)** `eval-cli.module.spec.ts` 신규 추가: DI 연결 회귀 자동 검증 (W4)
7. **(단기 · spec 갱신 위임)** `spec/conventions/rag-evaluation.md §2` positive 정의에 `goldChunkIds.length > 0` 조건 명시 — `project-planner` 위임 (W5)
8. **(단기 · spec 갱신 위임)** `spec/conventions/rag-evaluation.md §3` 표에 `--threshold` 옵션 등재 — `project-planner` 위임 (I12 SPEC-DRIFT)
9. **(중장기 · backlog)** `generate-golden-set.ts` `ORDER BY` 인터폴레이션 → `ALLOWED_ORDERS` const 맵 패턴으로 교체 (W7)
10. **(중장기 · backlog)** `EvalCliModule` `EVAL_CLI_ENTITIES` 최소 집합 분리, `main()` 함수 단계별 함수 분리, `processChunk()` 추출 등 기술부채 항목 Sprint backlog 유지 관리 (W6, I10, I19)

---

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행** (12명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | api_contract | 해당 변경에 API 계약 변경 없음 (CLI 스크립트 전용) |
  | user_guide_sync | 사용자 가이드 동기화 대상 변경 없음 |

- **강제 포함 (router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명)